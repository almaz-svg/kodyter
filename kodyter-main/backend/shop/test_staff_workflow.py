import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone as dt_timezone
from threading import Barrier
from unittest import skipUnless

from django.core.cache import cache
from django.db import connection, connections
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APITestCase, APIClient

from .models import Category, Order, Product, User


class StaffFixtures:
    def make_users(self):
        self.admin = User.objects.create_user(email='admin@staff.test', password='Staff-password-123!', name='Admin', role='ADMIN')
        self.cashier = User.objects.create_user(email='cashier@staff.test', password='Staff-password-123!', name='Cashier', role='CASHIER')
        self.customer = User.objects.create_user(email='buyer@staff.test', password='Staff-password-123!', name='Buyer')
        self.couriers = [User.objects.create_user(email=f'courier{i}@staff.test', password='Staff-password-123!', name=f'Courier {i}', role='COURIER') for i in range(2)]

    def make_order(self, status='NEW', courier=None, total='2400.00'):
        return Order.objects.create(customer=self.customer, recipient_name='Private recipient', phone='+77011234567', address='Almaty Abai 1', comment='Private comment', status=status, courier=courier, subtotal='900', delivery_fee='1500', total=total, idempotency_key=uuid.uuid4(), request_fingerprint='fixture')


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class StaffWorkflowTests(StaffFixtures, APITestCase):
    def setUp(self):
        cache.clear()
        self.make_users()

    def test_new_checkout_is_visible_to_admin_cashier_and_all_courier_pools(self):
        category = Category.objects.create(name='Bakery', slug='bakery')
        product = Product.objects.create(category=category, name='Croissant', price='900')
        self.client.force_login(self.customer)
        response = self.client.post('/api/orders/', {'recipient_name': 'Private recipient', 'phone': '+77011234567', 'address': 'Almaty Abai 1', 'comment': 'Private comment', 'items': [{'product_id': product.pk, 'quantity': 2, 'expected_price': '900'}], 'expected_delivery_fee': '1500', 'idempotency_key': str(uuid.uuid4())})
        self.assertEqual(response.status_code, 201)
        order_id = response.json()['id']
        for staff in (self.admin, self.cashier):
            self.client.force_login(staff)
            self.assertEqual([row['id'] for row in self.client.get('/api/orders/').json()], [order_id])
            self.assertEqual(self.client.get(f'/api/orders/{order_id}/').status_code, 200)
        for courier in self.couriers:
            self.client.force_login(courier)
            available = self.client.get('/api/courier/available-orders/')
            self.assertEqual(available.status_code, 200)
            self.assertEqual([row['id'] for row in available.json()], [order_id])
            preview = available.json()[0]
            self.assertEqual(preview['items'], [{'name': 'Croissant', 'quantity': 2}])
            self.assertEqual(preview['items_count'], 2)
            self.assertEqual(set(preview), {'id', 'number', 'status', 'created_at', 'total', 'address', 'items', 'items_count'})
            self.assertEqual(self.client.get('/api/orders/').json(), [])
            self.assertEqual(self.client.get(f'/api/orders/{order_id}/').status_code, 404)

    def test_claim_assigns_without_advancing_status_and_removes_from_every_pool(self):
        order = self.make_order()
        self.client.force_login(self.couriers[0])
        response = self.client.post(f'/api/orders/{order.pk}/claim/', {})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['courier'], self.couriers[0].pk)
        self.assertEqual(response.json()['status'], 'NEW')
        self.assertEqual(response.json()['phone'], '+77011234567')
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/claim/', {}).status_code, 200)
        for courier in self.couriers:
            self.client.force_login(courier)
            self.assertEqual(self.client.get('/api/courier/available-orders/').json(), [])
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/claim/', {}).status_code, 409)
        self.assertEqual(self.client.get(f'/api/orders/{order.pk}/').status_code, 404)

    def test_pool_excludes_assigned_and_terminal_orders(self):
        expected = [self.make_order(status=status).pk for status in ['NEW', 'CONFIRMED', 'PREPARING', 'READY']]
        for status in ['HANDED_OVER', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']:
            self.make_order(status=status)
        self.make_order(courier=self.couriers[1])
        self.client.force_login(self.couriers[0])
        response = self.client.get('/api/courier/available-orders/')
        self.assertEqual(response.status_code, 200)
        self.assertCountEqual([row['id'] for row in response.json()], expected)

    def test_claim_and_pool_are_courier_only_and_blocked_session_is_rejected(self):
        order = self.make_order()
        for user in (self.customer, self.cashier, self.admin):
            self.client.force_login(user)
            self.assertEqual(self.client.get('/api/courier/available-orders/').status_code, 403)
            self.assertEqual(self.client.post(f'/api/orders/{order.pk}/claim/', {}).status_code, 403)
        self.client.force_login(self.couriers[0])
        User.objects.filter(pk=self.couriers[0].pk).update(is_active=False)
        self.assertEqual(self.client.get('/api/courier/available-orders/').status_code, 401)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/claim/', {}).status_code, 401)

    def test_cashier_can_read_all_orders_but_cannot_change_operational_data(self):
        order = self.make_order()
        self.client.force_login(self.cashier)
        self.assertEqual(self.client.get(f'/api/orders/{order.pk}/').status_code, 200)
        self.assertEqual([row['id'] for row in self.client.get('/api/orders/?status=NEW').json()], [order.pk])
        for suffix, body in [('transition', {'status': 'CONFIRMED'}), ('assign', {'courier_id': self.couriers[0].pk}), ('problem', {'message': 'Change'})]:
            self.assertEqual(self.client.post(f'/api/orders/{order.pk}/{suffix}/', body).status_code, 403)
        for endpoint in ['products', 'categories', 'couriers', 'cashiers']:
            self.assertEqual(self.client.get(f'/api/admin/{endpoint}/').status_code, 403)
            self.assertEqual(self.client.post(f'/api/admin/{endpoint}/', {}).status_code, 403)
        self.assertEqual(self.client.post('/api/orders/', {}).status_code, 403)
        self.assertEqual(self.client.patch('/api/auth/profile/', {'name': 'Cashier renamed'}).status_code, 200)

    def test_admin_creates_and_blocks_cashier_without_role_escalation(self):
        self.client.force_login(self.admin)
        response = self.client.post('/api/admin/cashiers/', {'name': 'New Cashier', 'email': 'newcashier@staff.test', 'password': 'Staff-password-456!', 'phone': '+77011234567', 'role': 'ADMIN'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['role'], 'CASHIER')
        new_id = response.json()['id']
        self.assertEqual(self.client.patch(f'/api/admin/cashiers/{self.couriers[0].pk}/', {'is_active': False}).status_code, 404)
        browser = APIClient()
        self.assertEqual(browser.post('/api/auth/login/', {'email': 'newcashier@staff.test', 'password': 'Staff-password-456!'}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/admin/cashiers/{new_id}/', {'is_active': False}).status_code, 200)
        self.assertEqual(browser.get('/api/orders/').status_code, 401)
        self.assertEqual(browser.post('/api/auth/login/', {'email': 'newcashier@staff.test', 'password': 'Staff-password-456!'}, format='json').status_code, 401)

    def test_payment_collects_full_snapshot_total_and_duplicate_is_not_counted(self):
        order = self.make_order(status='DELIVERED')
        self.client.force_login(self.cashier)
        data = {'method': 'CASH', 'idempotency_key': str(uuid.uuid4()), 'amount': '1.00'}
        response = self.client.post(f'/api/orders/{order.pk}/payment/', data)
        self.assertEqual(response.status_code, 201)
        paid = response.json()
        self.assertEqual(paid['payment_status'], 'PAID')
        self.assertEqual(paid['paid_by'], self.cashier.pk)
        self.assertEqual(paid['paid_by_name'], 'Cashier')
        self.assertTrue(paid['paid_at'])
        for _ in range(2):
            duplicate = self.client.post(f'/api/orders/{order.pk}/payment/', data)
            self.assertEqual(duplicate.status_code, 200)
            self.assertEqual(duplicate.json()['paid_at'], paid['paid_at'])
        summary = self.client.get('/api/cashier/summary/').json()
        self.assertEqual(summary['cash_received'], '2400.00')
        self.assertEqual(summary['paid_count'], 1)
        self.assertEqual(summary['unpaid_delivered_count'], 0)

    def test_payment_is_allowed_only_after_delivery_and_only_cashier_or_admin(self):
        order = self.make_order(status='READY', courier=self.couriers[0])
        data = {'method': 'CASH', 'idempotency_key': str(uuid.uuid4())}
        for user in (self.customer, self.couriers[0]):
            self.client.force_login(user)
            self.assertEqual(self.client.post(f'/api/orders/{order.pk}/payment/', data).status_code, 403)
            self.assertEqual(self.client.get('/api/cashier/summary/').status_code, 403)
        self.client.force_login(self.cashier)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/payment/', data).status_code, 409)
        Order.objects.filter(pk=order.pk).update(status='DELIVERED')
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/payment/', {'method': 'CARD', 'idempotency_key': str(uuid.uuid4())}).status_code, 400)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/payment/', {'method': 'CASH', 'idempotency_key': 'bad'}).status_code, 400)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/payment/', data).status_code, 201)

    def test_same_payment_key_cannot_pay_a_second_order(self):
        orders = [self.make_order(status='DELIVERED') for _ in range(2)]
        self.client.force_login(self.cashier)
        data = {'method': 'CASH', 'idempotency_key': str(uuid.uuid4())}
        self.assertEqual(self.client.post(f'/api/orders/{orders[0].pk}/payment/', data).status_code, 201)
        self.assertEqual(self.client.post(f'/api/orders/{orders[1].pk}/payment/', data).status_code, 409)
        self.assertEqual(self.client.get(f'/api/orders/{orders[1].pk}/').json()['payment_status'], 'UNPAID')

    def test_payment_key_from_another_order_is_rejected_even_if_target_already_paid(self):
        orders = [self.make_order(status='DELIVERED') for _ in range(2)]
        self.client.force_login(self.cashier)
        payments = [{'method': 'CASH', 'idempotency_key': str(uuid.uuid4())} for _ in orders]
        receipts = []
        for order, data in zip(orders, payments):
            response = self.client.post(f'/api/orders/{order.pk}/payment/', data)
            self.assertEqual(response.status_code, 201)
            receipts.append(response.json())
        wrong_key = self.client.post(f'/api/orders/{orders[1].pk}/payment/', payments[0])
        self.assertEqual(wrong_key.status_code, 409)
        for order, data, original in zip(orders, payments, receipts):
            repeated = self.client.post(f'/api/orders/{order.pk}/payment/', data)
            self.assertEqual(repeated.status_code, 200)
            self.assertEqual(repeated.json()['paid_at'], original['paid_at'])
        from .models import Payment
        self.assertEqual(Payment.objects.count(), 2)

    def test_summary_uses_local_payment_day_and_all_outstanding_delivered_orders(self):
        paid = self.make_order(status='DELIVERED')
        unpaid = self.make_order(status='DELIVERED', total='3500.00')
        self.make_order(status='READY', total='9900.00')
        self.client.force_login(self.cashier)
        response = self.client.post(f'/api/orders/{paid.pk}/payment/', {'method': 'CASH', 'idempotency_key': str(uuid.uuid4())})
        self.assertEqual(response.status_code, 201)
        from .models import Payment
        Payment.objects.filter(order=paid).update(paid_at=datetime(2026, 10, 14, 20, 30, tzinfo=dt_timezone.utc))
        summary = self.client.get('/api/cashier/summary/?date=2026-10-15').json()
        self.assertEqual(summary, {'date': '2026-10-15', 'currency': 'KZT', 'cash_received': '2400.00', 'paid_count': 1, 'unpaid_delivered_total': '3500.00', 'unpaid_delivered_count': 1})
        previous = self.client.get('/api/cashier/summary/?date=2026-10-14').json()
        self.assertEqual(previous['cash_received'], '0.00')
        self.assertEqual(previous['unpaid_delivered_total'], '3500.00')
        self.assertEqual(self.client.get('/api/cashier/summary/?date=bad').status_code, 400)


@skipUnless(connection.vendor == 'postgresql', 'Actual PostgreSQL locks are required.')
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class StaffConcurrencyTests(StaffFixtures, TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.make_users()

    def requests_at_once(self, users, path, body):
        barrier = Barrier(2)

        def send(user_id):
            try:
                client = APIClient()
                client.force_login(User.objects.get(pk=user_id))
                barrier.wait(timeout=5)
                response = client.post(path, body, format='json')
                data = response.json() if response.get('Content-Type', '').startswith('application/json') else {}
                return response.status_code, data
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            return list(executor.map(send, [user.pk for user in users]))

    def test_two_couriers_claim_one_order_exactly_once(self):
        order = self.make_order()
        outcomes = self.requests_at_once(self.couriers, f'/api/orders/{order.pk}/claim/', {})
        self.assertEqual(sorted(status for status, _ in outcomes), [200, 409])
        order.refresh_from_db()
        winner = next(data for status, data in outcomes if status == 200)
        self.assertEqual(order.courier_id, winner['courier'])
        self.assertEqual(order.status, 'NEW')
        self.assertEqual(order.status_history.count(), 0)

    def test_concurrent_cashier_double_click_creates_one_payment(self):
        order = self.make_order(status='DELIVERED')
        outcomes = self.requests_at_once([self.cashier, self.cashier], f'/api/orders/{order.pk}/payment/', {'method': 'CASH', 'idempotency_key': str(uuid.uuid4())})
        self.assertEqual(sorted(status for status, _ in outcomes), [200, 201])
        from .models import Payment
        self.assertEqual(Payment.objects.filter(order=order).count(), 1)
        self.assertEqual(str(Payment.objects.get(order=order).amount), '2400.00')
