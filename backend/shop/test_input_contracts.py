import inspect
import os
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import serializers as drf_serializers
from rest_framework.test import APIClient

from . import serializers as shop_serializers
from .models import Category, Order, Payment, Product, User
from .serializers import (
    AvailableItemSerializer, AvailableOrderSerializer, BusinessAccountSerializer, CategorySerializer, CheckoutItemSerializer,
    CheckoutSerializer, CourierUpdateSerializer, OrderItemSerializer, OrderSerializer,
    PaymentRequestSerializer, ProblemSerializer, ProductSerializer, RegisterSerializer,
    StatusHistorySerializer, UserSerializer,
)

PASSWORD = 'Staff-password-123!'

# Every field a client may send, per input serializer. Adding a field here is a deliberate API change.
EXPECTED_CLIENT_WRITES = {
    UserSerializer: {'name', 'phone'},
    # Registration chooses the account type ('физлицо' or 'заведение'); wholesale_price is admin-only input.
    RegisterSerializer: {'name', 'email', 'phone', 'password', 'account_type', 'company_name'},
    CategorySerializer: {'name', 'slug', 'description', 'image', 'is_visible'},
    # Only an administrator writes business approval.
    BusinessAccountSerializer: {'business_approved', 'credit_allowed'},
    ProductSerializer: {'category', 'name', 'description', 'image', 'price', 'wholesale_price', 'wholesale_min_qty', 'weight', 'pieces', 'ingredients', 'allergens', 'is_available', 'is_visible'},
    CourierUpdateSerializer: {'name', 'phone', 'is_active'},
    PaymentRequestSerializer: {'method', 'idempotency_key'},
    CheckoutSerializer: {'recipient_name', 'phone', 'address', 'comment', 'items', 'expected_delivery_fee', 'idempotency_key'},
    CheckoutItemSerializer: {'product_id', 'quantity', 'expected_price'},
}
# Output-only serializers must not accept any input at all.
OUTPUT_ONLY = [OrderSerializer, OrderItemSerializer, AvailableOrderSerializer, AvailableItemSerializer, StatusHistorySerializer, ProblemSerializer]
# Server-owned values that must never be writable on any serializer.
SERVER_OWNED = {'status', 'total', 'subtotal', 'delivery_fee', 'is_paid', 'payment_status', 'paid_at', 'paid_by', 'paid_by_name', 'user', 'owner', 'customer', 'courier', 'created_at', 'number', 'role', 'is_staff', 'is_superuser', 'request_fingerprint', 'cancellation_reason'}


def declared_serializers():
    return [cls for _, cls in inspect.getmembers(shop_serializers, inspect.isclass)
            if issubclass(cls, drf_serializers.BaseSerializer) and cls.__module__ == shop_serializers.__name__]


def writable_fields(cls):
    return {name for name, field in cls().fields.items() if not field.read_only}


class SerializerContractTests(TestCase):
    def test_no_serializer_uses_all_or_exclude(self):
        for cls in declared_serializers():
            meta = getattr(cls, 'Meta', None)
            if meta is None:
                continue
            with self.subTest(serializer=cls.__name__):
                self.assertNotEqual(getattr(meta, 'fields', None), '__all__')
                self.assertFalse(hasattr(meta, 'exclude'))

    def test_input_serializers_accept_exactly_the_expected_fields(self):
        for cls, expected in EXPECTED_CLIENT_WRITES.items():
            with self.subTest(serializer=cls.__name__):
                self.assertEqual(writable_fields(cls), expected)

    def test_server_owned_fields_are_never_writable(self):
        for cls in EXPECTED_CLIENT_WRITES:
            with self.subTest(serializer=cls.__name__):
                self.assertEqual(writable_fields(cls) & SERVER_OWNED, set())

    def test_output_only_serializers_accept_no_input(self):
        for cls in OUTPUT_ONLY:
            with self.subTest(serializer=cls.__name__):
                self.assertEqual(writable_fields(cls), set())


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class CheckoutInputTests(TestCase):
    def setUp(self):
        cache.clear()
        self.customer = User.objects.create_user(email='buyer@contracts.test', password=PASSWORD, name='Buyer')
        self.other = User.objects.create_user(email='other@contracts.test', password=PASSWORD, name='Other')
        self.cashier = User.objects.create_user(email='cashier@contracts.test', password=PASSWORD, name='Cashier', role='CASHIER')
        self.category = Category.objects.create(name='Bakery', slug='bakery')
        self.product = Product.objects.create(category=self.category, name='Croissant', price=Decimal('900.00'), image='/images/catalog/card-01.webp')
        self.api = APIClient()
        self.api.force_login(self.customer)

    def tearDown(self):
        cache.clear()

    def payload(self, quantity=1, price='900.00', **extra):
        data = {
            'recipient_name': 'Айгерим',
            'phone': '+77011234567',
            'address': 'Taraz, Konaev 62a',
            'comment': 'Подъезд 2',
            'items': [{'product_id': self.product.pk, 'quantity': quantity, 'expected_price': price}],
            'expected_delivery_fee': '1500.00',
            'idempotency_key': str(uuid.uuid4()),
        }
        data.update(extra)
        return data

    def post(self, data):
        return self.api.post('/api/orders/', data, format='json')

    # --- quantity: whole number from 1 to the configured maximum ---

    def test_quantity_must_be_a_whole_number_in_range(self):
        for bad in (0, -1, 1.5, 'abc', 10 ** 9):
            with self.subTest(quantity=bad):
                response = self.post(self.payload(quantity=bad))
                self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_quantity_one_and_the_default_maximum_are_accepted(self):
        self.assertEqual(self.post(self.payload(quantity=1)).status_code, 201)
        self.assertEqual(self.post(self.payload(quantity=settings.MAX_ORDER_ITEM_QUANTITY)).status_code, 201)

    def test_comment_is_optional_for_checkout(self):
        without_comment = self.payload()
        del without_comment['comment']
        self.assertEqual(self.post(without_comment).status_code, 201)
        self.assertEqual(self.post(self.payload(comment='')).status_code, 201)
        self.assertEqual(self.post(self.payload(comment='   ')).status_code, 201)
        self.assertEqual(self.post(self.payload(comment='Подъезд 2, этаж 3')).status_code, 201)

    def test_default_maximum_is_200_units_per_line(self):
        if 'MAX_ORDER_ITEM_QUANTITY' in os.environ:
            self.skipTest('MAX_ORDER_ITEM_QUANTITY is set in the environment; the default does not apply')
        self.assertEqual(settings.MAX_ORDER_ITEM_QUANTITY, 200)
        self.assertEqual(self.post(self.payload(quantity=200)).status_code, 201)
        self.assertEqual(self.post(self.payload(quantity=201)).status_code, 400)

    @override_settings(MAX_ORDER_ITEM_QUANTITY=5)
    def test_maximum_comes_from_settings(self):
        self.assertEqual(self.post(self.payload(quantity=5)).status_code, 201)
        self.assertEqual(self.post(self.payload(quantity=6)).status_code, 400)

    # --- money: Decimal only, two places, rounded to kopecks ---

    def test_prices_with_more_than_two_places_are_refused(self):
        self.assertEqual(self.post(self.payload(price='0.105')).status_code, 400)

    def test_total_is_exact_decimal_sum_of_kopecks(self):
        Product.objects.filter(pk=self.product.pk).update(price=Decimal('0.10'))
        response = self.post(self.payload(quantity=3, price='0.10'))
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body['subtotal'], '0.30')
        self.assertEqual(body['total'], '1500.30')
        self.assertIsInstance(body['total'], str)

    # --- injected fields are ignored, never trusted ---

    def test_status_owner_total_and_item_price_in_request_are_ignored(self):
        data = self.payload(
            quantity=2,
            status='PAID', is_paid=True, payment_status='PAID', paid_at='2026-01-01T00:00:00Z',
            customer=self.other.pk, user=self.other.pk, courier=self.cashier.pk,
            total='1.00', subtotal='1.00', created_at='2000-01-01T00:00:00Z', is_staff=True,
        )
        data['items'][0]['price'] = '1.00'
        response = self.post(data)
        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(pk=response.json()['id'])
        self.assertEqual(order.status, 'NEW')
        self.assertEqual(order.customer_id, self.customer.pk)
        self.assertIsNone(order.courier_id)
        self.assertEqual(order.subtotal, Decimal('1800.00'))
        self.assertEqual(order.total, Decimal('1800.00') + settings.DELIVERY_FEE)
        self.assertEqual(order.items.get().price, Decimal('900.00'))
        self.assertFalse(Payment.objects.filter(order=order).exists())
        self.assertNotEqual(order.created_at.year, 2000)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class ProfileAndAdminInjectionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.customer = User.objects.create_user(email='profile@contracts.test', password=PASSWORD, name='Profile')
        self.courier = User.objects.create_user(email='courier@contracts.test', password=PASSWORD, name='Courier', role='COURIER')
        self.admin = User.objects.create_user(email='admin@contracts.test', password=PASSWORD, name='Admin', role='ADMIN')
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def test_profile_patch_cannot_escalate_role_or_flags(self):
        self.api.force_login(self.customer)
        response = self.api.patch('/api/auth/profile/', {'name': 'Renamed', 'role': 'ADMIN', 'is_staff': True, 'is_superuser': True, 'is_active': False, 'email': 'new@contracts.test'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.name, 'Renamed')
        self.assertEqual(self.customer.role, 'CUSTOMER')
        self.assertFalse(self.customer.is_staff)
        self.assertFalse(self.customer.is_superuser)
        self.assertTrue(self.customer.is_active)
        self.assertEqual(self.customer.email, 'profile@contracts.test')

    def test_admin_courier_patch_cannot_change_role(self):
        self.api.force_login(self.admin)
        response = self.api.patch(f'/api/admin/couriers/{self.courier.pk}/', {'name': 'Courier X', 'role': 'ADMIN', 'is_staff': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.courier.refresh_from_db()
        self.assertEqual(self.courier.role, 'COURIER')
        self.assertFalse(self.courier.is_staff)


class PaginationTests(TestCase):
    def setUp(self):
        cache.clear()
        category = Category.objects.create(name='Bakery', slug='bakery')
        Product.objects.bulk_create([
            Product(category=category, name=f'Item {number}', price=Decimal('100.00'), image='/images/catalog/card-01.webp')
            for number in range(105)
        ])
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def test_page_size_request_is_capped_at_max_page_size(self):
        response = self.api.get('/api/products/?page_size=100000')
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['count'], 105)
        self.assertEqual(len(body['results']), 100)
        self.assertIsNotNone(body['next'])

    def test_plain_list_without_page_size_keeps_its_shape(self):
        response = self.api.get('/api/products/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)
        self.assertEqual(len(response.json()), 105)

    def test_invalid_page_size_falls_back_to_plain_list(self):
        response = self.api.get('/api/products/?page_size=abc')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)
