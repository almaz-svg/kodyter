"""Regression coverage for issues found during the post-integration backend audit."""
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from unittest import skipUnless

from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.db import connection, connections, transaction
from django.test import TransactionTestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase, APIClient

from .models import Category, Order, Payment, Product, User


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class InputRegressionTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.customer = User.objects.create_user(email='buyer@regression.test', password='Long-password-456!', name='Buyer')
        self.admin = User.objects.create_user(email='admin@regression.test', password='Long-password-456!', name='Admin', role='ADMIN')

    def test_csrf_refresh_does_not_exhaust_login_attempts(self):
        responses = [self.client.get('/api/auth/csrf/').status_code for _ in range(65)]
        self.assertEqual(set(responses), {200})
        response = self.client.post('/api/auth/login/', {'email': self.customer.email, 'password': 'Long-password-456!'})
        self.assertEqual(response.status_code, 200)

    def test_oversize_email_is_rejected_before_database_write(self):
        email = 'x' * 64 + '@' + 'a' * 63 + '.' + 'b' * 63 + '.' + 'c' * 63 + '.test'
        self.assertGreater(len(email), 254)
        self.client.raise_request_exception = False
        response = self.client.post('/api/auth/register/', {'name': 'Long email', 'email': email, 'password': 'Long-password-456!'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json())

    def test_phone_search_matches_formatted_number_and_formatted_query(self):
        order = Order.objects.create(customer=self.customer, recipient_name='Buyer', phone='+7 (701) 123-45-67', address='Almaty Abai 1', subtotal='900', delivery_fee='1500', total='2400', idempotency_key=uuid.uuid4(), request_fingerprint='unused')
        self.client.force_login(self.admin)
        for query in ['77011234567', '+7 701 123 45 67', '701123']:
            response = self.client.get('/api/orders/', {'search': query})
            self.assertEqual(response.status_code, 200)
            self.assertEqual([item['id'] for item in response.json()], [order.pk], query)


@skipUnless(connection.vendor == 'postgresql', 'Concurrency regression requires PostgreSQL row locks.')
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class ConcurrencyRegressionTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(email='admin@race.test', password='Long-password-456!', name='Admin', role='ADMIN')
        self.courier = User.objects.create_user(email='courier@race.test', password='Long-password-456!', name='Courier', role='COURIER')
        self.customer = User.objects.create_user(email='buyer@race.test', password='Long-password-456!', name='Buyer')

    def wait_for_blocked_connections(self, pids):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            with connection.cursor() as cursor:
                cursor.execute('SELECT count(*) FROM unnest(%s::int[]) AS p(pid) WHERE cardinality(pg_blocking_pids(p.pid)) > 0', [pids])
                if cursor.fetchone()[0] == len(pids):
                    return
            time.sleep(0.01)
        self.fail('Requests did not reach the deliberately locked database row.')

    def request_waiting_on_row(self, model, pk, actor, method, path, data, concurrent_change):
        browser = APIClient()
        browser.force_login(actor)
        pids = Queue()

        def send():
            try:
                connection.ensure_connection()
                pids.put(connection.connection.info.backend_pid)
                return getattr(browser, method)(path, data, format='json').status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                model.objects.select_for_update().get(pk=pk)
                pending = executor.submit(send)
                self.wait_for_blocked_connections([pids.get(timeout=5)])
                concurrent_change()
            return pending.result(timeout=5)

    def make_order(self, courier=None):
        return Order.objects.create(customer=self.customer, courier=courier, status='READY', recipient_name='Buyer', phone='+77011234567', address='Almaty Abai 1', subtotal='900', delivery_fee='1500', total='2400', idempotency_key=uuid.uuid4(), request_fingerprint='regression')

    def test_blocking_courier_stops_waiting_transition_and_problem_requests(self):
        for action, data in [('transition', {'status': 'HANDED_OVER'}), ('problem', {'message': 'Recipient unavailable'})]:
            with self.subTest(action=action):
                User.objects.filter(pk=self.courier.pk).update(is_active=True)
                self.courier.refresh_from_db()
                order = self.make_order(courier=self.courier)
                status = self.request_waiting_on_row(Order, order.pk, self.courier, 'post', f'/api/orders/{order.pk}/{action}/', data, lambda: User.objects.filter(pk=self.courier.pk).update(is_active=False))
                self.assertEqual(status, 401)
                order.refresh_from_db()
                self.assertEqual(order.status, 'READY')
                self.assertEqual(order.status_history.count(), 0)
                self.assertEqual(order.problems.count(), 0)

    def test_blocking_admin_stops_waiting_assignment(self):
        order = self.make_order()
        status = self.request_waiting_on_row(Order, order.pk, self.admin, 'post', f'/api/orders/{order.pk}/assign/', {'courier_id': self.courier.pk}, lambda: User.objects.filter(pk=self.admin.pk).update(is_active=False))
        self.assertEqual(status, 401)
        order.refresh_from_db()
        self.assertIsNone(order.courier_id)

    def test_role_change_cannot_reuse_admin_order_scope_after_wait(self):
        order = self.make_order(courier=self.courier)
        status = self.request_waiting_on_row(Order, order.pk, self.admin, 'post', f'/api/orders/{order.pk}/transition/', {'status': 'HANDED_OVER'}, lambda: User.objects.filter(pk=self.admin.pk).update(role='COURIER'))
        self.assertEqual(status, 401)
        order.refresh_from_db()
        self.assertEqual(order.status, 'READY')
        self.assertEqual(order.status_history.count(), 0)

    def test_blocking_courier_stops_waiting_claim(self):
        order = self.make_order()
        status = self.request_waiting_on_row(Order, order.pk, self.courier, 'post', f'/api/orders/{order.pk}/claim/', {}, lambda: User.objects.filter(pk=self.courier.pk).update(is_active=False))
        self.assertEqual(status, 401)
        order.refresh_from_db()
        self.assertIsNone(order.courier_id)

    def test_blocking_cashier_stops_waiting_payment(self):
        cashier = User.objects.create_user(email='cashier@race.test', password='Long-password-456!', name='Cashier', role='CASHIER')
        order = self.make_order()
        Order.objects.filter(pk=order.pk).update(status='DELIVERED')
        status = self.request_waiting_on_row(Order, order.pk, cashier, 'post', f'/api/orders/{order.pk}/payment/', {'method': 'CASH', 'idempotency_key': str(uuid.uuid4())}, lambda: User.objects.filter(pk=cashier.pk).update(is_active=False))
        self.assertEqual(status, 401)
        self.assertEqual(Payment.objects.count(), 0)

    def test_blocking_customer_stops_checkout_waiting_for_customer_lock(self):
        category = Category.objects.create(name='Bakery', slug='bakery')
        product = Product.objects.create(category=category, name='Croissant', price='900')
        data = {'recipient_name': 'Buyer', 'phone': '+77011234567', 'address': 'Almaty Abai 1', 'items': [{'product_id': product.pk, 'quantity': 1, 'expected_price': '900'}], 'expected_delivery_fee': '1500', 'idempotency_key': str(uuid.uuid4())}
        status = self.request_waiting_on_row(User, self.customer.pk, self.customer, 'post', '/api/orders/', data, lambda: User.objects.filter(pk=self.customer.pk).update(is_active=False))
        self.assertEqual(status, 401)
        self.assertEqual(Order.objects.count(), 0)

    def test_catalog_description_edit_preserves_concurrent_visibility_and_availability(self):
        category = Category.objects.create(name='Bakery', slug='bakery')
        product = Product.objects.create(category=category, name='Croissant', price='900')
        for instance, endpoint, flag in [(product, 'products', 'is_available'), (category, 'categories', 'is_visible')]:
            with self.subTest(endpoint=endpoint):
                model = type(instance)
                status = self.request_waiting_on_row(model, instance.pk, self.admin, 'patch', f'/api/admin/{endpoint}/{instance.pk}/', {'description': 'Updated description'}, lambda: model.objects.filter(pk=instance.pk).update(**{flag: False}))
                self.assertEqual(status, 200)
                instance.refresh_from_db()
                self.assertEqual(instance.description, 'Updated description')
                self.assertFalse(getattr(instance, flag))

    def test_concurrent_profile_edit_cannot_undo_courier_block(self):
        pids = Queue()

        def edit_name():
            try:
                client = APIClient()
                client.force_login(User.objects.get(pk=self.admin.pk))
                pids.put(connection.connection.info.backend_pid)
                return client.patch(f'/api/admin/couriers/{self.courier.pk}/', {'name': 'Updated Courier'}, format='json').status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                User.objects.select_for_update().get(pk=self.courier.pk)
                future = executor.submit(edit_name)
                self.wait_for_blocked_connections([pids.get(timeout=5)])
                User.objects.filter(pk=self.courier.pk).update(is_active=False)
            self.assertEqual(future.result(timeout=5), 200)
        self.courier.refresh_from_db()
        self.assertFalse(self.courier.is_active)
        self.assertEqual(self.courier.name, 'Updated Courier')

    def test_same_password_reset_token_cannot_succeed_twice_concurrently(self):
        token = default_token_generator.make_token(self.courier)
        uid = urlsafe_base64_encode(force_bytes(self.courier.pk))
        pids = Queue()

        def reset_password(index):
            try:
                connection.ensure_connection()
                pids.put(connection.connection.info.backend_pid)
                client = APIClient()
                response = client.post('/api/auth/password-reset-confirm/', {'uid': uid, 'token': token, 'password': f'New-password-456!{index}'}, format='json')
                return response.status_code, index
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            with transaction.atomic():
                User.objects.select_for_update().get(pk=self.courier.pk)
                futures = [executor.submit(reset_password, index) for index in range(2)]
                self.wait_for_blocked_connections([pids.get(timeout=5), pids.get(timeout=5)])
            outcomes = [future.result(timeout=5) for future in futures]
        self.assertEqual(sorted(status for status, _ in outcomes), [200, 400])
        winner = next(index for status, index in outcomes if status == 200)
        self.courier.refresh_from_db()
        self.assertTrue(self.courier.check_password(f'New-password-456!{winner}'))
