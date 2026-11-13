import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from django.core import mail
from django.core.cache import cache
from django.db import connection, connections, close_old_connections
from django.test import TransactionTestCase
from django.test import override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase, APIClient
from .models import Product, User

class AuthContractTests(APITestCase):
    def test_health_checks_database(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_malformed_auth_payload_returns_validation_error(self):
        self.client.raise_request_exception = False
        for path, data in [('/api/auth/login/', []), ('/api/auth/password-reset/', []), ('/api/auth/password-reset-confirm/', [])]:
            response = self.client.post(path, data, format='json')
            self.assertEqual(response.status_code, 400, path)
            self.assertIn('detail', response.json())

    def test_malformed_password_reset_token_is_not_a_server_error(self):
        self.client.raise_request_exception = False
        user = User.objects.create_user(email='token@example.test', password='Safe-password-222!', name='Token')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        response = self.client.post('/api/auth/password-reset-confirm/', {'uid': uid, 'token': {'invalid': True}, 'password': 'New-password-222!'})
        self.assertEqual(response.status_code, 400)


    def test_csrf_bootstrap_returns_token(self):
        response = self.client.get('/api/auth/csrf/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['csrfToken'])

    def test_anonymous_me_is_unauthorized(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_signup_ignores_attempt_to_grant_admin_role(self):
        response = self.client.post('/api/auth/register/', {'name': 'Amina', 'email': 'amina@example.test', 'password': 'Safe-test-password-719!', 'role': 'ADMIN'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['role'], 'CUSTOMER')
        self.assertEqual(self.client.get('/api/auth/me/').json()['email'], 'amina@example.test')

    def test_password_whitespace_survives_registration_and_login(self):
        password = '  A-safe-password-456!  '
        self.assertEqual(self.client.post('/api/auth/register/', {'name': 'Spaces', 'email': 'spaces@example.test', 'password': password}).status_code, 201)
        self.client.post('/api/auth/logout/')
        self.assertEqual(self.client.post('/api/auth/login/', {'email': 'spaces@example.test', 'password': password}).status_code, 200)

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
    def test_login_rate_limit_applies_even_with_authenticated_session(self):
        cache.clear()
        user = User.objects.create_user(email='limit@example.test', password='Strong-password-222!', name='Limit')
        self.client.force_login(user)
        statuses = [self.client.post('/api/auth/login/', {'email': user.email, 'password': 'incorrect'}).status_code for _ in range(61)]
        self.assertEqual(statuses[0], 401)
        self.assertEqual(statuses[-1], 429)
        cache.clear()

    def test_login_and_anonymous_registration_require_csrf(self):
        browser = APIClient(enforce_csrf_checks=True)
        self.assertEqual(browser.post('/api/auth/login/', {'email': 'x@example.test', 'password': 'X'}).status_code, 403)
        self.assertEqual(browser.post('/api/auth/register/', {'name': 'X', 'email': 'x@example.test', 'password': 'Safe-test-password-719!'}).status_code, 403)
        token = browser.get('/api/auth/csrf/').json()['csrfToken']
        response = browser.post('/api/auth/register/', {'name': 'X', 'email': 'x@example.test', 'password': 'Safe-test-password-719!'}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(browser.patch('/api/auth/profile/', {'name': 'Y'}).status_code, 403)
        token = browser.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(browser.patch('/api/auth/profile/', {'name': 'Y'}, HTTP_X_CSRFTOKEN=token).status_code, 200)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_reset_email_changes_password_and_token_cannot_be_reused(self):
        user = User.objects.create_user(email='reset@example.test', password='Old-password-432!', name='Reset')
        found = self.client.post('/api/auth/password-reset/', {'email': user.email})
        absent = self.client.post('/api/auth/password-reset/', {'email': 'absent@example.test'})
        self.assertEqual(found.json(), absent.json())
        self.assertEqual(len(mail.outbox), 1)
        match = re.search(r'uid=([^&\s]+)&token=([^\s]+)', mail.outbox[0].body)
        data = {'uid': match[1], 'token': match[2], 'password': '  New-password-987!  '}
        self.assertEqual(self.client.post('/api/auth/password-reset-confirm/', data).status_code, 200)
        self.assertEqual(self.client.post('/api/auth/password-reset-confirm/', data).status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password(data['password']))

    def test_profile_cannot_change_role_or_email(self):
        user = User.objects.create_user(email='profile@example.test', password='password', name='Profile')
        self.client.force_login(user)
        response = self.client.patch('/api/auth/profile/', {'name': 'Changed', 'role': 'ADMIN', 'email': 'hijack@example.test'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], 'CUSTOMER')
        self.assertEqual(response.json()['email'], user.email)

@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class OrderContractTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='admin@example.test', password='Test-password-312!', name='Admin', role='ADMIN')
        self.customer = User.objects.create_user(email='buyer@example.test', password='Test-password-312!', name='Buyer')
        self.other = User.objects.create_user(email='other@example.test', password='Test-password-312!', name='Other')
        self.courier = User.objects.create_user(email='courier@example.test', password='Test-password-312!', name='Courier', role='COURIER')
        self.courier2 = User.objects.create_user(email='courier2@example.test', password='Test-password-312!', name='Courier 2', role='COURIER')
        self.client.force_login(self.admin)
        response = self.client.post('/api/admin/categories/', {'name': 'Bakery', 'slug': 'bakery', 'description': 'Fresh'})
        self.assertEqual(response.status_code, 201, response.content)
        self.category = response.json()
        response = self.client.post('/api/admin/products/', {'category': self.category['id'], 'name': 'Croissant', 'description': 'Butter', 'price': '900.00', 'weight': '90 г', 'ingredients': 'Butter, flour', 'allergens': 'Milk, gluten', 'image': '/images/croissant.webp'})
        self.assertEqual(response.status_code, 201, response.content)
        self.product = response.json()
        self.client.force_login(self.customer)

    def payload(self, **changes):
        data = {'recipient_name': 'Amina', 'phone': '+77011234567', 'address': 'Almaty, Abai 1, apt 2', 'comment': 'Call before arrival', 'items': [{'product_id': self.product['id'], 'quantity': 2, 'expected_price': '900.00'}], 'expected_delivery_fee': '1500.00', 'idempotency_key': str(uuid.uuid4())}
        data.update(changes)
        return data

    def order(self):
        self.client.force_login(self.customer)
        response = self.client.post('/api/orders/', self.payload())
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def transition(self, order, status, reason=''):
        return self.client.post(f"/api/orders/{order['id']}/transition/", {'status': status, 'reason': reason})

    def prepare(self, order):
        self.client.force_login(self.admin)
        for status in ['CONFIRMED', 'PREPARING', 'READY']:
            self.assertEqual(self.transition(order, status).status_code, 200)
        self.assertEqual(self.client.post(f"/api/orders/{order['id']}/assign/", {'courier_id': self.courier.pk}).status_code, 200)

    def test_order_totals_and_snapshots_survive_catalog_change(self):
        order = self.order()
        self.assertEqual(order['subtotal'], '1800.00')
        self.assertEqual(order['total'], '3300.00')
        self.assertEqual(order['status'], 'NEW')
        self.client.force_login(self.admin)
        self.client.patch(f"/api/admin/products/{self.product['id']}/", {'price': '1200.00', 'name': 'Renamed', 'is_visible': False})
        self.client.force_login(self.customer)
        saved = self.client.get(f"/api/orders/{order['id']}/").json()
        self.assertEqual(saved['items'][0]['name'], 'Croissant')
        self.assertEqual(saved['items'][0]['price'], '900.00')
        self.assertEqual(saved['total'], '3300.00')

    def test_admin_deletes_unused_product_but_an_ordered_one_is_protected(self):
        self.client.force_login(self.admin)
        spare = self.client.post('/api/admin/products/', {'category': self.category['id'], 'name': 'Bun', 'price': '300.00', 'image': '/images/bun.webp'})
        self.assertEqual(spare.status_code, 201, spare.content)
        spare_id = spare.json()['id']
        self.assertEqual(self.client.delete(f'/api/admin/products/{spare_id}/').status_code, 204)
        self.assertFalse(Product.objects.filter(pk=spare_id).exists())

        order = self.order()
        self.client.force_login(self.admin)
        response = self.client.delete(f"/api/admin/products/{self.product['id']}/")
        self.assertEqual(response.status_code, 409, response.content)
        self.assertIn('нельзя', response.json()['detail'])
        self.assertTrue(Product.objects.filter(pk=self.product['id']).exists())
        saved = self.client.get(f"/api/orders/{order['id']}/").json()
        self.assertEqual(saved['items'][0]['name'], 'Croissant')

    def test_changed_price_returns_conflict_then_explicit_new_price_succeeds(self):
        data = self.payload()
        self.client.force_login(self.admin)
        self.client.patch(f"/api/admin/products/{self.product['id']}/", {'price': '1100.00'})
        self.client.force_login(self.customer)
        self.assertEqual(self.client.post('/api/orders/', data).status_code, 409)
        self.assertEqual(self.client.get('/api/orders/').json(), [])
        data['items'][0]['expected_price'] = '1100.00'
        response = self.client.post('/api/orders/', data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['total'], '3700.00')

    def test_changed_delivery_fee_is_conflict(self):
        self.assertEqual(self.client.post('/api/orders/', self.payload(expected_delivery_fee='1000')).status_code, 409)

    def test_unavailable_hidden_or_hidden_category_cannot_be_ordered(self):
        for path, body in [
            (f"/api/admin/products/{self.product['id']}/", {'is_available': False}),
            (f"/api/admin/products/{self.product['id']}/", {'is_available': True, 'is_visible': False}),
            (f"/api/admin/products/{self.product['id']}/", {'is_visible': True}),
            (f"/api/admin/categories/{self.category['id']}/", {'is_visible': False}),
        ]:
            self.client.force_login(self.admin)
            self.assertEqual(self.client.patch(path, body).status_code, 200)
            self.client.force_login(self.customer)
            if body != {'is_visible': True}:
                self.assertEqual(self.client.post('/api/orders/', self.payload()).status_code, 409)

    def test_same_idempotency_key_never_creates_duplicate(self):
        data = self.payload()
        first = self.client.post('/api/orders/', data)
        self.assertEqual(first.status_code, 201)
        second = self.client.post('/api/orders/', data)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()['id'], second.json()['id'])
        self.assertEqual(len(self.client.get('/api/orders/').json()), 1)
        data['address'] = 'Different address'
        conflict = self.client.post('/api/orders/', data)
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json().get('code'), 'IDEMPOTENCY_CONFLICT')
        self.assertEqual(conflict.json()['order_id'], first.json()['id'])
        self.assertEqual(conflict.json()['number'], first.json()['number'])

    def test_idempotency_key_is_scoped_to_customer(self):
        data = self.payload()
        self.assertEqual(self.client.post('/api/orders/', data).status_code, 201)
        self.client.force_login(self.other)
        self.assertEqual(self.client.post('/api/orders/', data).status_code, 201)

    def test_validation_rejects_zero_negative_empty_and_missing_contact(self):
        for changes in [{'items': []}, {'items': [{'product_id': self.product['id'], 'quantity': 0, 'expected_price': '900'}]}, {'items': [{'product_id': self.product['id'], 'quantity': -1, 'expected_price': '900'}]}, {'recipient_name': ''}, {'phone': 'bad'}, {'address': ''}]:
            response = self.client.post('/api/orders/', self.payload(**changes))
            self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(self.client.get('/api/orders/').json(), [])

    def test_customer_cannot_read_or_mutate_another_customers_order(self):
        order = self.order()
        self.client.force_login(self.other)
        self.assertEqual(self.client.get('/api/orders/').json(), [])
        self.assertEqual(self.client.get(f"/api/orders/{order['id']}/").status_code, 404)
        self.assertEqual(self.transition(order, 'CONFIRMED').status_code, 404)

    def test_customer_cannot_change_status_or_assign_or_write_problem(self):
        order = self.order()
        self.assertEqual(self.transition(order, 'CONFIRMED').status_code, 403)
        self.assertEqual(self.client.post(f"/api/orders/{order['id']}/assign/", {'courier_id': self.courier.pk}).status_code, 403)
        self.assertEqual(self.client.post(f"/api/orders/{order['id']}/problem/", {'message': 'test'}).status_code, 403)

    def test_exact_role_owned_sequential_state_machine(self):
        order = self.order()
        self.client.force_login(self.admin)
        self.assertEqual(self.transition(order, 'READY').status_code, 409)
        self.prepare(order)
        self.assertEqual(self.transition(order, 'HANDED_OVER').status_code, 403)
        self.client.force_login(self.courier)
        self.assertEqual(self.transition(order, 'DELIVERED').status_code, 409)
        for state in ['HANDED_OVER', 'IN_TRANSIT', 'DELIVERED']:
            self.assertEqual(self.transition(order, state).status_code, 200)
        self.assertEqual(self.transition(order, 'IN_TRANSIT').status_code, 409)
        saved = self.client.get(f"/api/orders/{order['id']}/").json()
        self.assertEqual([h['to_status'] for h in saved['status_history']], ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'HANDED_OVER', 'IN_TRANSIT', 'DELIVERED'])
        self.client.force_login(self.admin)
        self.assertEqual(self.transition(order, 'CANCELLED', 'too late').status_code, 409)

    def test_only_assigned_courier_can_access_order(self):
        order = self.order()
        self.prepare(order)
        self.client.force_login(self.courier2)
        self.assertEqual(self.client.get('/api/orders/').json(), [])
        self.assertEqual(self.client.get(f"/api/orders/{order['id']}/").status_code, 404)
        self.assertEqual(self.transition(order, 'HANDED_OVER').status_code, 404)
        self.assertEqual(self.client.post(f"/api/orders/{order['id']}/problem/", {'message': 'late'}).status_code, 404)

    def test_reassignment_revokes_access_and_is_locked_after_pickup(self):
        order = self.order()
        self.prepare(order)
        path = f"/api/orders/{order['id']}/assign/"
        self.assertEqual(self.client.post(path, {'courier_id': self.courier2.pk}).status_code, 200)
        self.client.force_login(self.courier)
        self.assertEqual(self.client.get(f"/api/orders/{order['id']}/").status_code, 404)
        self.client.force_login(self.courier2)
        self.assertEqual(self.transition(order, 'HANDED_OVER').status_code, 200)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(path, {'courier_id': self.courier.pk}).status_code, 409)

    def test_cancellation_requires_admin_reason_and_is_terminal(self):
        order = self.order()
        self.client.force_login(self.admin)
        self.assertEqual(self.transition(order, 'CANCELLED').status_code, 400)
        response = self.transition(order, 'CANCELLED', 'Customer requested cancellation')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['cancellation_reason'], 'Customer requested cancellation')
        self.assertEqual(self.transition(order, 'CONFIRMED').status_code, 409)

    def test_blocked_courier_loses_existing_session_and_cannot_login(self):
        order = self.order()
        self.prepare(order)
        browser = APIClient()
        self.assertEqual(browser.post('/api/auth/login/', {'email': self.courier.email, 'password': 'Test-password-312!'}).status_code, 200)
        self.assertEqual(self.client.patch(f'/api/admin/couriers/{self.courier.pk}/', {'is_active': False}).status_code, 200)
        self.assertEqual(browser.get('/api/orders/').status_code, 401)
        self.assertEqual(browser.post('/api/auth/login/', {'email': self.courier.email, 'password': 'Test-password-312!'}).status_code, 401)

    def test_blocked_courier_cannot_be_assigned(self):
        order = self.order()
        self.client.force_login(self.admin)
        self.client.patch(f'/api/admin/couriers/{self.courier.pk}/', {'is_active': False})
        self.assertEqual(self.client.post(f"/api/orders/{order['id']}/assign/", {'courier_id': self.courier.pk}).status_code, 400)

    def test_problem_message_is_persistent_and_visible_to_admin(self):
        order = self.order()
        self.prepare(order)
        self.client.force_login(self.courier)
        response = self.client.post(f"/api/orders/{order['id']}/problem/", {'message': 'Recipient does not answer'})
        self.assertEqual(response.status_code, 201)
        self.client.force_login(self.admin)
        saved = self.client.get(f"/api/orders/{order['id']}/").json()
        self.assertEqual(saved['problems'][0]['message'], 'Recipient does not answer')
        self.assertEqual(saved['problems'][0]['actor_name'], 'Courier')

    def test_admin_filters_orders_by_number_phone_status_date_and_courier(self):
        order = self.order()
        self.prepare(order)
        for query in [f"search={order['number']}", 'search=701123', 'status=READY', f"courier={self.courier.pk}", f"date={timezone.localdate().isoformat()}"]:
            response = self.client.get('/api/orders/?' + query)
            self.assertEqual([o['id'] for o in response.json()], [order['id']])
        self.assertEqual(self.client.get('/api/orders/?status=DELIVERED').json(), [])
        self.assertEqual(self.client.get('/api/orders/?date=not-a-date').status_code, 400)

    def test_catalog_admin_permission_and_public_hiding(self):
        self.assertEqual(self.client.get('/api/admin/products/').status_code, 403)
        self.assertEqual(self.client.delete(f"/api/admin/products/{self.product['id']}/").status_code, 403)
        self.assertEqual(self.client.post('/api/admin/couriers/', {}).status_code, 403)
        self.client.force_login(self.admin)
        self.client.patch(f"/api/admin/categories/{self.category['id']}/", {'is_visible': False})
        self.client.logout()
        self.assertEqual(self.client.get('/api/products/').json(), [])
        self.assertEqual(self.client.get('/api/categories/').json(), [])
        self.assertEqual(self.client.get(f"/api/products/{self.product['id']}/").status_code, 404)

    def test_admin_can_create_courier_but_cannot_elevate_role_via_patch(self):
        self.client.force_login(self.admin)
        response = self.client.post('/api/admin/couriers/', {'name': 'New Courier', 'email': 'new@example.test', 'password': 'A-valid-password-322!', 'phone': '+77012223344', 'role': 'ADMIN'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['role'], 'COURIER')
        self.assertEqual(self.client.patch(f'/api/admin/couriers/{self.customer.pk}/', {'is_active': False}).status_code, 404)

    def test_admin_and_courier_cannot_create_customer_orders(self):
        for user in (self.admin, self.courier):
            self.client.force_login(user)
            self.assertEqual(self.client.post('/api/orders/', self.payload()).status_code, 403)

    def test_order_snapshots_cannot_be_edited_or_deleted_via_api(self):
        order = self.order()
        self.client.force_login(self.admin)
        path = f"/api/orders/{order['id']}/"
        self.assertEqual(self.client.patch(path, {'total': '1.00', 'items': []}).status_code, 405)
        self.assertEqual(self.client.delete(path).status_code, 405)
        self.assertEqual(self.client.get(path).json()['total'], '3300.00')

    def test_invalid_product_in_cart_rolls_back_every_order_line(self):
        data = self.payload()
        data['items'].append({'product_id': 999999, 'quantity': 1, 'expected_price': '100'})
        self.assertEqual(self.client.post('/api/orders/', data).status_code, 409)
        self.assertEqual(self.client.get('/api/orders/').json(), [])

    def test_idempotent_retry_survives_catalog_change(self):
        data = self.payload()
        first = self.client.post('/api/orders/', data).json()
        self.client.force_login(self.admin)
        self.client.patch(f"/api/admin/products/{self.product['id']}/", {'price': '1300', 'is_available': False})
        self.client.force_login(self.customer)
        second = self.client.post('/api/orders/', data)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()['id'], first['id'])
        self.assertEqual(second.json()['total'], '3300.00')

@skipUnless(connection.vendor == 'postgresql', 'Real PostgreSQL row locks are required; SQLite is not concurrency acceptance.')
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PostgresConcurrencyTests(TransactionTestCase):
    def test_concurrent_checkout_with_same_key_creates_one_order(self):
        from .models import Category, Product, Order
        customer = User.objects.create_user(email='concurrent@example.test', password='Test-password-123!', name='Concurrent')
        category = Category.objects.create(name='Bakery', slug='bakery')
        product = Product.objects.create(category=category, name='Bread', price='900.00')
        data = {'recipient_name': 'Concurrent', 'phone': '+77011234567', 'address': 'Almaty Abai 1', 'comment': 'Подъезд 2', 'items': [{'product_id': product.pk, 'quantity': 2, 'expected_price': '900.00'}], 'expected_delivery_fee': '1500.00', 'idempotency_key': str(uuid.uuid4())}
        barrier = Barrier(2)

        def checkout():
            close_old_connections()
            client = APIClient()
            client.force_login(User.objects.get(pk=customer.pk))
            barrier.wait(timeout=10)
            try:
                response = client.post('/api/orders/', data, format='json')
                return response.status_code, response.json()['id']
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: checkout(), range(2)))
        self.assertEqual(sorted(status for status, _ in results), [200, 201])
        self.assertEqual(len({pk for _, pk in results}), 1)
        self.assertEqual(Order.objects.count(), 1)
