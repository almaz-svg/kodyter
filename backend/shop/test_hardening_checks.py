import os
import subprocess
import sys
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Category, Order, Payment, Product, User
from .security import validate_image_reference
from .serializers import ProductSerializer

FAST_HASHER = ['django.contrib.auth.hashers.MD5PasswordHasher']
PASSWORD = 'Staff-password-123!'


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class HardeningBase(TestCase):
    def setUp(self):
        cache.clear()
        self.customer = User.objects.create_user(email='buyer@hardening.test', password=PASSWORD, name='Buyer')
        self.cashier = User.objects.create_user(email='cashier@hardening.test', password=PASSWORD, name='Cashier', role='CASHIER')
        self.admin = User.objects.create_user(email='admin@hardening.test', password=PASSWORD, name='Admin', role='ADMIN')
        self.category = Category.objects.create(name='Bakery', slug='bakery')
        self.product = Product.objects.create(category=self.category, name='Croissant', price=Decimal('900.00'), image='/images/catalog/card-01.webp')
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def checkout_payload(self, **overrides):
        payload = {
            'recipient_name': 'Айгерим',
            'phone': '+77011234567',
            'address': 'Taraz, Konaev 62a',
            'comment': 'Подъезд 2',
            'items': [{'product_id': self.product.pk, 'quantity': 2, 'expected_price': '900.00'}],
            'expected_delivery_fee': '1500.00',
            'idempotency_key': str(uuid.uuid4()),
        }
        payload.update(overrides)
        return payload


class PriceIntegrityTests(HardeningBase):
    def post_checkout(self, **overrides):
        self.api.force_login(self.customer)
        return self.api.post('/api/orders/', self.checkout_payload(**overrides), format='json')

    def test_total_is_computed_by_server(self):
        response = self.post_checkout()
        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(pk=response.json()['id'])
        self.assertEqual(order.subtotal, Decimal('1800.00'))
        self.assertEqual(order.total, Decimal('1800.00') + settings.DELIVERY_FEE)

    def test_client_price_below_server_price_is_refused(self):
        response = self.post_checkout(items=[{'product_id': self.product.pk, 'quantity': 2, 'expected_price': '1.00'}])
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Order.objects.count(), 0)

    def test_client_delivery_fee_is_refused_when_it_differs_from_server(self):
        response = self.post_checkout(expected_delivery_fee='0.00')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Order.objects.count(), 0)

    def test_zero_price_product_cannot_be_ordered(self):
        Product.objects.filter(pk=self.product.pk).update(price=Decimal('0.00'))
        response = self.post_checkout(items=[{'product_id': self.product.pk, 'quantity': 1, 'expected_price': '0.00'}])
        self.assertEqual(response.status_code, 409)

    def test_quantity_outside_range_is_refused(self):
        self.assertEqual(self.post_checkout(items=[{'product_id': self.product.pk, 'quantity': 0, 'expected_price': '900.00'}]).status_code, 400)
        # The per-product maximum is 200 units; one more is refused.
        self.assertEqual(self.post_checkout(items=[{'product_id': self.product.pk, 'quantity': 201, 'expected_price': '900.00'}]).status_code, 400)

    def test_admin_cannot_set_zero_or_negative_price(self):
        self.api.force_login(self.admin)
        for price in ('0', '-5.00'):
            response = self.api.post('/api/admin/products/', {'category': self.category.pk, 'name': 'Free', 'price': price}, format='json')
            self.assertEqual(response.status_code, 400, price)
        self.assertFalse(ProductSerializer(data={'category': self.category.pk, 'name': 'Free', 'price': '0.00'}).is_valid())

    def test_payment_amount_comes_from_server_order_total_only(self):
        order = Order.objects.get(pk=self.post_checkout().json()['id'])
        Order.objects.filter(pk=order.pk).update(status='DELIVERED')
        self.api.force_login(self.cashier)
        response = self.api.post(f'/api/orders/{order.pk}/payment/', {'method': 'CASH', 'idempotency_key': str(uuid.uuid4()), 'amount': '1.00'}, format='json')
        self.assertEqual(response.status_code, 201)
        payment = Payment.objects.get(order=order)
        self.assertEqual(payment.amount, order.total)

    def test_payment_refused_before_delivery(self):
        order = Order.objects.get(pk=self.post_checkout().json()['id'])
        self.api.force_login(self.cashier)
        response = self.api.post(f'/api/orders/{order.pk}/payment/', {'method': 'CASH', 'idempotency_key': str(uuid.uuid4())}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertFalse(Payment.objects.exists())

    def test_customer_cannot_record_payment(self):
        order = Order.objects.get(pk=self.post_checkout().json()['id'])
        Order.objects.filter(pk=order.pk).update(status='DELIVERED')
        self.api.force_login(self.customer)
        response = self.api.post(f'/api/orders/{order.pk}/payment/', {'method': 'CASH', 'idempotency_key': str(uuid.uuid4())}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Payment.objects.exists())


class ImageReferenceTests(TestCase):
    def test_local_catalog_images_are_accepted(self):
        for value in ('/images/catalog/card-01.webp', '/media/products/cake-2.png', '/images/catalog/pdf-03-41fe2cd89c.jpeg', ''):
            self.assertEqual(validate_image_reference(value), value)

    def test_dangerous_or_foreign_references_are_refused(self):
        refused = [
            '/media/evil.svg',                  # SVG can carry script
            '/images/../../etc/passwd',         # traversal
            'javascript:alert(1)',
            'data:image/svg+xml;base64,PHN2Zz4=',
            '/images/photo.php',                # wrong extension
            '/images/a.webp?x=<script>',        # markup in query
            'http://insecure.example.test/a.webp',  # plain http
            'https://evil.example.test/a.exe',
            '/images/' + 'a' * 500 + '.webp',   # too long
        ]
        for value in refused:
            with self.subTest(value=value[:40]):
                with self.assertRaises(DjangoValidationError):
                    validate_image_reference(value)

    def test_product_api_rejects_svg_photo(self):
        category = Category.objects.create(name='Bakery', slug='bakery')
        admin = User.objects.create_user(email='admin2@hardening.test', password=PASSWORD, name='Admin', role='ADMIN')
        api = APIClient()
        api.force_login(admin)
        response = api.post('/api/admin/products/', {'category': category.pk, 'name': 'Bun', 'price': '300.00', 'image': '/media/bun.svg'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Product.objects.filter(name='Bun').exists())


class UploadAndBodyLimitTests(HardeningBase):
    def test_multipart_file_upload_is_refused(self):
        self.api.force_login(self.admin)
        upload = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        from django.core.files.uploadedfile import SimpleUploadedFile
        response = self.api.post('/api/admin/products/', {'category': self.category.pk, 'name': 'Bun', 'price': '300.00', 'image': SimpleUploadedFile('bun.svg', upload, content_type='image/svg+xml')}, format='multipart')
        self.assertEqual(response.status_code, 415)
        self.assertFalse(Product.objects.filter(name='Bun').exists())

    @override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=2048)
    def test_oversized_json_body_is_refused(self):
        response = self.api.post('/api/auth/login/', {'email': 'x@example.test', 'password': 'x' * 4096}, format='json')
        self.assertGreaterEqual(response.status_code, 400)
        self.assertNotEqual(response.status_code, 200)

    def test_debug_is_off_by_default(self):
        self.assertFalse(settings.DEBUG)

    def test_default_body_limit_is_one_megabyte(self):
        self.assertEqual(settings.DATA_UPLOAD_MAX_MEMORY_SIZE, 1024 * 1024)


class ConfigGuardTests(TestCase):
    """Settings are read at import time, so each case starts a fresh interpreter."""

    def load_settings(self, **env):
        base = {k: v for k, v in os.environ.items() if k not in ('DEBUG', 'VERCEL', 'DJANGO_ENV', 'DJANGO_SECRET_KEY', 'USE_SQLITE', 'DATABASE_URL', 'POSTGRES_URL')}
        base.update(env)
        return subprocess.run([sys.executable, '-c', 'import config.settings'], cwd=settings.BASE_DIR, env=base, capture_output=True, text=True, timeout=60)

    def test_debug_is_refused_on_vercel(self):
        result = self.load_settings(VERCEL='1', DEBUG='true', DJANGO_SECRET_KEY='k' * 60, DATABASE_URL='postgresql://u:p@db.example/main')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DEBUG must be false', result.stderr)

    def test_debug_is_refused_when_django_env_is_production(self):
        result = self.load_settings(DJANGO_ENV='production', DEBUG='true', DJANGO_SECRET_KEY='k' * 60, USE_SQLITE='true')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DEBUG must be false', result.stderr)

    def test_production_accepts_debug_false_with_long_secret(self):
        result = self.load_settings(VERCEL='1', DEBUG='false', DJANGO_SECRET_KEY='k' * 60, DATABASE_URL='postgresql://u:p@db.example/main')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_short_secret_is_refused_outside_debug(self):
        result = self.load_settings(DEBUG='false', DJANGO_SECRET_KEY='short', USE_SQLITE='true')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('at least 50', result.stderr)

    def test_placeholder_secret_is_refused_outside_debug(self):
        result = self.load_settings(DEBUG='false', DJANGO_SECRET_KEY='test-only-' + 'x' * 60, USE_SQLITE='true')
        self.assertNotEqual(result.returncode, 0)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'], DELIVERY_FEE=Decimal('0.00'))
class NoDeliveryFeeTests(TestCase):
    """Delivery is paid separately: with DELIVERY_FEE=0 the order total is just the goods."""

    def test_total_equals_goods_without_delivery_fee(self):
        self.client = APIClient()
        buyer = User.objects.create_user(email='nofee@check.test', password='Nofee-password-123!', name='Buyer')
        category = Category.objects.create(name='Bakery', slug='bakery-nofee')
        product = Product.objects.create(category=category, name='Bun', price='500.00')
        self.client.force_login(buyer)
        self.assertEqual(self.client.get('/api/settings/').json()['delivery_fee'], '0.00')
        response = self.client.post('/api/orders/', {'recipient_name': 'Buyer', 'phone': '+77011234567', 'address': 'Almaty Abai 1', 'comment': '', 'items': [{'product_id': product.pk, 'quantity': 3, 'expected_price': '500.00'}], 'expected_delivery_fee': '0.00', 'idempotency_key': str(uuid.uuid4())}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual((Decimal(response.json()['delivery_fee']), Decimal(response.json()['total'])), (Decimal('0'), Decimal('1500.00')))
