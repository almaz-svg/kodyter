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
