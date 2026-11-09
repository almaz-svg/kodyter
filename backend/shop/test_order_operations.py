import logging
import uuid
from decimal import Decimal

from rest_framework.test import APITestCase

from .models import Order, User


def make_order(customer, **fields):
    defaults = dict(recipient_name='Покупатель', phone='+77010000000', address='Тараз, ул. Конаева, 62а', subtotal=Decimal('1000.00'), delivery_fee=Decimal('1500.00'), total=Decimal('2500.00'), idempotency_key=uuid.uuid4(), request_fingerprint='0' * 64)
    return Order.objects.create(customer=customer, **{**defaults, **fields})


class OrderOperationsBase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='admin@example.test', password='Safe-password-222!', name='Admin', role='ADMIN')
        self.customer = User.objects.create_user(email='customer@example.test', password='Safe-password-222!', name='Customer')
        self.courier = User.objects.create_user(email='courier@example.test', password='Safe-password-222!', name='Courier', role='COURIER')
        self.courier2 = User.objects.create_user(email='courier2@example.test', password='Safe-password-222!', name='Courier 2', role='COURIER')


class BlockedCourierReassignmentTests(OrderOperationsBase):
    def assign(self, order):
        self.client.force_login(self.admin)
        return self.client.post(f'/api/orders/{order.pk}/assign/', {'courier_id': self.courier2.pk})

    def block_courier(self):
        User.objects.filter(pk=self.courier.pk).update(is_active=False)

    def test_order_on_the_way_moves_from_blocked_courier_and_can_be_finished(self):
        for status in ('HANDED_OVER', 'IN_TRANSIT'):
            with self.subTest(status=status):
                User.objects.filter(pk=self.courier.pk).update(is_active=True)
                order = make_order(self.customer, status=status, courier=self.courier)
                self.block_courier()
                response = self.assign(order)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['courier'], self.courier2.pk)
                self.assertIs(response.json()['courier_is_active'], True)
        self.client.force_login(self.courier2)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/transition/', {'status': 'DELIVERED'}).status_code, 200)

    def test_active_courier_keeps_order_after_pickup(self):
        order = make_order(self.customer, status='HANDED_OVER', courier=self.courier)
        self.assertEqual(self.assign(order).status_code, 409)
        order.refresh_from_db()
        self.assertEqual(order.courier_id, self.courier.pk)

    def test_finished_orders_stay_locked_even_with_blocked_courier(self):
        for status in ('DELIVERED', 'CANCELLED'):
            with self.subTest(status=status):
                order = make_order(self.customer, status=status, courier=self.courier)
                self.block_courier()
                self.assertEqual(self.assign(order).status_code, 409)

    def test_customer_view_does_not_expose_courier_account_state(self):
        order = make_order(self.customer, status='HANDED_OVER', courier=self.courier)
        self.client.force_login(self.customer)
        self.assertNotIn('courier_is_active', self.client.get(f'/api/orders/{order.pk}/').json())


class OrderListLimitTests(OrderOperationsBase):
    def setUp(self):
        super().setUp()
        self.orders = [make_order(self.customer) for _ in range(103)]
        self.client.force_login(self.admin)

    def test_default_response_is_bounded_and_newest_first(self):
        data = self.client.get('/api/orders/').json()
        self.assertEqual(len(data), 100)
        self.assertEqual(data[0]['id'], self.orders[-1].pk)

    def test_limit_extends_the_plain_list(self):
        self.assertEqual(len(self.client.get('/api/orders/?limit=102').json()), 102)

    def test_limit_applies_after_filters(self):
        target = self.orders[0]
        data = self.client.get(f'/api/orders/?search={target.number}&limit=1').json()
        self.assertEqual([order['id'] for order in data], [target.pk])

    def test_invalid_limits_are_rejected(self):
        for value in ('0', '-1', 'abc', '501'):
            with self.subTest(value=value):
                self.assertEqual(self.client.get(f'/api/orders/?limit={value}').status_code, 400)


class ErrorLoggingTests(APITestCase):
    def test_server_errors_reach_stderr_without_debug_only_filters(self):
        handlers = logging.getLogger('django.request').handlers
        self.assertTrue(handlers)
        self.assertTrue(all(isinstance(handler, logging.StreamHandler) and not handler.filters for handler in handlers))
        self.assertEqual(logging.getLogger('django.request').level, logging.ERROR)
