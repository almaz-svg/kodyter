import uuid

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from .models import Order, Payment, User
from .test_staff_workflow import StaffFixtures


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'], AUTO_DISPATCH_COURIERS=False)
class StaffProfileTests(StaffFixtures, APITestCase):
    def setUp(self):
        cache.clear()
        self.make_users()
        self.courier = self.couriers[0]

    def test_admin_opens_a_courier_profile_with_work_summary(self):
        self.make_order(status='DELIVERED', courier=self.courier)
        self.make_order(status='IN_TRANSIT', courier=self.courier)
        debt = self.make_order(status='DELIVERED', courier=self.courier)
        Order.objects.filter(pk=debt.pk).update(on_credit=True)
        paid = self.make_order(status='DELIVERED', courier=self.courier)
        Payment.objects.create(order=paid, amount=paid.total, method='CASH', idempotency_key=uuid.uuid4(), paid_by=self.courier, paid_by_name=self.courier.name)
        self.client.force_login(self.admin)
        profile = self.client.get(f'/api/admin/couriers/{self.courier.pk}/').json()
        self.assertEqual((profile['name'], profile['email'], profile['role']), ('Courier 0', 'courier0@staff.test', 'COURIER'))
        self.assertIn('date_joined', profile)
        self.assertNotIn('password', profile)
        self.assertEqual(profile['stats'], {'payments_count': 1, 'payments_total': '2400.00', 'delivered': 3, 'active': 1, 'open_debts': 1})

    def test_profiles_are_admin_only_and_scoped_to_the_role(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(f'/api/admin/cashiers/{self.cashier.pk}/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/admin/cashiers/{self.courier.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/admin/couriers/{self.customer.pk}/').status_code, 404)
        for user in (self.courier, self.cashier, self.customer):
            self.client.force_login(user)
            self.assertEqual(self.client.get(f'/api/admin/couriers/{self.courier.pk}/').status_code, 403)
            self.assertEqual(self.client.post(f'/api/admin/couriers/{self.courier.pk}/password/', {'password': 'New-courier-pass-77'}, format='json').status_code, 403)

    def test_admin_sets_a_new_password_and_the_old_one_stops_working(self):
        self.client.force_login(self.admin)
        weak = self.client.post(f'/api/admin/couriers/{self.courier.pk}/password/', {'password': '123'}, format='json')
        self.assertEqual(weak.status_code, 400)
        response = self.client.post(f'/api/admin/couriers/{self.courier.pk}/password/', {'password': 'New-courier-pass-77'}, format='json')
        self.assertEqual(response.status_code, 200)
        browser = APIClient()
        self.assertEqual(browser.post('/api/auth/login/', {'email': 'courier0@staff.test', 'password': 'Staff-password-123!'}, format='json').status_code, 401)
        self.assertEqual(browser.post('/api/auth/login/', {'email': 'courier0@staff.test', 'password': 'New-courier-pass-77'}, format='json').status_code, 200)
        self.assertEqual(self.client.post(f'/api/admin/couriers/{self.cashier.pk}/password/', {'password': 'New-courier-pass-77'}, format='json').status_code, 404)
