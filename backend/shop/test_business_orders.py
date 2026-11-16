from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import User
from .test_staff_workflow import StaffFixtures


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'], AUTO_DISPATCH_COURIERS=False)
class BusinessOrderTests(StaffFixtures, APITestCase):
    def setUp(self):
        cache.clear()
        self.make_users()

    def test_staff_see_which_business_ordered(self):
        User.objects.filter(pk=self.customer.pk).update(account_type='BUSINESS', company_name='Кофе брейк')
        pooled = self.make_order()
        carried = self.make_order(status='IN_TRANSIT', courier=self.couriers[1])
        for staff in (self.admin, self.cashier):
            self.client.force_login(staff)
            self.assertEqual(self.client.get(f'/api/orders/{pooled.pk}/').json()['customer_company'], 'Кофе брейк')
        self.client.force_login(self.couriers[0])
        self.assertEqual(self.client.get('/api/courier/available-orders/').json()[0]['customer_company'], 'Кофе брейк')
        team = self.client.get('/api/courier/team-orders/').json()['orders']
        self.assertEqual([(row['id'], row['customer_company']) for row in team], [(carried.pk, 'Кофе брейк')])

    def test_orders_of_individuals_have_no_business_name(self):
        User.objects.filter(pk=self.customer.pk).update(company_name='Leftover')  # an individual account: the name is ignored
        order = self.make_order()
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(f'/api/orders/{order.pk}/').json()['customer_company'], '')

    def test_admin_business_list_has_contacts_and_order_summary(self):
        User.objects.filter(pk=self.customer.pk).update(account_type='BUSINESS', company_name='Кофе брейк')
        self.make_order(status='DELIVERED', total='3000.00')
        self.make_order(status='NEW', total='1000.00')
        self.make_order(status='CANCELLED', total='9000.00')
        self.client.force_login(self.admin)
        row = self.client.get('/api/admin/businesses/').json()[0]
        self.assertEqual((row['company_name'], row['orders_count'], row['delivered_total']), ('Кофе брейк', 2, '3000.00'))
        self.assertTrue(row['last_order_at'] and row['date_joined'])
        updated = self.client.patch(f'/api/admin/businesses/{self.customer.pk}/', {'business_approved': True}, format='json')
        self.assertEqual((updated.status_code, updated.json()['business_approved']), (200, True))

    @override_settings(WHOLESALE_MIN_QTY=12)
    def test_only_an_approved_business_learns_the_wholesale_quantity(self):
        self.client.force_login(self.customer)
        self.assertIsNone(self.client.get('/api/auth/me/').json()['wholesale_min_qty'])
        User.objects.filter(pk=self.customer.pk).update(account_type='BUSINESS', company_name='Cafe')
        self.assertIsNone(self.client.get('/api/auth/me/').json()['wholesale_min_qty'])
        User.objects.filter(pk=self.customer.pk).update(business_approved=True)
        self.assertEqual(self.client.get('/api/auth/me/').json()['wholesale_min_qty'], 12)
