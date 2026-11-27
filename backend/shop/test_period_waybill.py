from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Category, Order, OrderItem, Payment, Product, User
from .test_staff_workflow import StaffFixtures


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'], AUTO_DISPATCH_COURIERS=False)
class PeriodWaybillTests(StaffFixtures, APITestCase):
    def setUp(self):
        cache.clear()
        self.make_users()
        category = Category.objects.create(name='Bakery', slug='bakery-waybill')
        self.bun = Product.objects.create(category=category, name='Bun', price='500.00')
        self.today = timezone.localdate()

    def order(self, status='DELIVERED', days_ago=0, customer=None, missing=False):
        order = self.make_order(status=status)
        if customer:
            order.customer = customer
        order.created_at = timezone.now() - timedelta(days=days_ago)
        order.save()
        OrderItem.objects.create(order=order, product=self.bun, name='Bun', price='500', quantity=2)
        OrderItem.objects.create(order=order, product=self.bun, name='Gone', price='100', quantity=1, is_missing=missing)
        return order

    def get(self, **params):
        return self.client.get('/api/waybill/', params)

    def test_admin_and_cashier_get_orders_of_the_period(self):
        inside = self.order(days_ago=1, missing=True)
        self.order(status='CANCELLED', days_ago=1)
        self.order(days_ago=40)
        Payment.objects.create(order=inside, amount=inside.total, method='CASH', idempotency_key='00000000-0000-0000-0000-000000000001', paid_by=self.cashier, paid_by_name='Cashier')
        for user in (self.admin, self.cashier):
            self.client.force_login(user)
            response = self.get(date_from=(self.today - timedelta(days=7)).isoformat(), date_to=self.today.isoformat())
            self.assertEqual(response.status_code, 200, response.content)
            orders = response.json()['orders']
            self.assertEqual([row['number'] for row in orders], [inside.number])
            self.assertEqual([line['name'] for line in orders[0]['items']], ['Bun'])
            self.assertTrue(orders[0]['paid'])

    def test_other_roles_are_refused(self):
        chef = User.objects.create_user(email='chef@waybill.test', password='Staff-password-123!', name='Chef', role='PASTRY')
        for user in (self.customer, self.couriers[0], chef):
            self.client.force_login(user)
            self.assertEqual(self.get().status_code, 403)

    def test_one_customer_and_bad_ranges(self):
        cafe = User.objects.create_user(email='cafe@waybill.test', password='Staff-password-123!', name='Manager', account_type='BUSINESS', company_name='Кафе Утро')
        mine = self.order(customer=cafe)
        self.order()
        self.client.force_login(self.admin)
        data = self.get(customer=cafe.pk).json()
        self.assertEqual(([row['number'] for row in data['orders']], data['recipient'], data['orders'][0]['company']), ([mine.number], 'Кафе Утро', 'Кафе Утро'))
        self.assertEqual(self.get(date_from='2026-05-10', date_to='2026-05-01').status_code, 400)
        self.assertEqual(self.get(date_from='2024-01-01', date_to='2026-01-01').status_code, 400)
        self.assertEqual(self.get(customer='abc').status_code, 400)
