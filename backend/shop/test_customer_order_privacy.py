import uuid

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Category, Order, Payment, Problem, Product, StatusHistory, User


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class CustomerOrderPrivacyTests(APITestCase):
    """Customers must not see the names of staff who handled their order or the cashier who took payment."""

    def setUp(self):
        cache.clear()
        password = 'Privacy-password-123!'
        self.admin = User.objects.create_user(email='admin@privacy.test', password=password, name='Admin Name', role='ADMIN')
        self.courier = User.objects.create_user(email='courier@privacy.test', password=password, name='Courier Name', role='COURIER')
        self.cashier = User.objects.create_user(email='cashier@privacy.test', password=password, name='Cashier Name', role='CASHIER')
        self.customer = User.objects.create_user(email='buyer@privacy.test', password=password, name='Buyer')
        category = Category.objects.create(name='Bakery', slug='bakery-privacy')
        product = Product.objects.create(category=category, name='Croissant', price='900')
        self.order = Order.objects.create(customer=self.customer, courier=self.courier, recipient_name='Buyer', phone='+77011234567', address='Almaty Abai 1', status='DELIVERED', subtotal='1800', delivery_fee='1500', total='3300', idempotency_key=uuid.uuid4(), request_fingerprint='privacy-fixture')
        self.order.items.create(product=product, name=product.name, price=product.price, quantity=2)
        StatusHistory.objects.create(order=self.order, from_status='', to_status='NEW', actor=self.customer, actor_name='Buyer')
        StatusHistory.objects.create(order=self.order, from_status='NEW', to_status='DELIVERED', actor=self.courier, actor_name='Courier Name')
        Problem.objects.create(order=self.order, message='Door code changed', actor=self.courier, actor_name='Courier Name')
        Payment.objects.create(order=self.order, amount='3300', method='CASH', idempotency_key=uuid.uuid4(), paid_by=self.cashier, paid_by_name='Cashier Name')

    def assert_no_staff_identities(self, data):
        self.assertNotIn('paid_by', data)
        self.assertNotIn('paid_by_name', data)
        for entry in data['status_history']:
            self.assertNotIn('actor_name', entry)
        for problem in data['problems']:
            self.assertNotIn('actor_name', problem)

    def test_customer_detail_hides_staff_names_but_keeps_customer_facts(self):
        self.client.force_login(self.customer)
        response = self.client.get(f'/api/orders/{self.order.pk}/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assert_no_staff_identities(data)
        self.assertEqual(data['payment_status'], 'PAID')
        self.assertIsNotNone(data['paid_at'])
        self.assertEqual(data['problems'][0]['message'], 'Door code changed')
        self.assertEqual([entry['to_status'] for entry in data['status_history']], ['NEW', 'DELIVERED'])

    def test_customer_list_hides_staff_names(self):
        self.client.force_login(self.customer)
        response = self.client.get('/api/orders/')
        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual(len(rows), 1)
        self.assert_no_staff_identities(rows[0])

    def test_staff_still_see_who_did_what(self):
        self.client.force_login(self.admin)
        data = self.client.get(f'/api/orders/{self.order.pk}/').json()
        self.assertEqual(data['paid_by_name'], 'Cashier Name')
        self.assertEqual(data['problems'][0]['actor_name'], 'Courier Name')
        self.assertEqual(data['status_history'][1]['actor_name'], 'Courier Name')
