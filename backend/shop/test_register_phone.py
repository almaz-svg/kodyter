from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import User


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class RegisterPhoneTests(APITestCase):
    def setUp(self):
        cache.clear()

    def register(self, **extra):
        body = {'name': 'Aigerim', 'email': 'aigerim@phone.test', 'password': 'Phone-password-123!', **extra}
        return self.client.post('/api/auth/register/', body, format='json')

    def test_phone_is_required_for_individuals_and_businesses(self):
        for extra in ({}, {'account_type': 'BUSINESS', 'company_name': 'Cafe'}):
            for phone in (None, '', '   '):
                body = dict(extra) if phone is None else {**extra, 'phone': phone}
                response = self.register(**body)
                self.assertEqual(response.status_code, 400, (extra, phone))
                self.assertIn('phone', response.json().get('fields', response.json()), (extra, phone))
        self.assertFalse(User.objects.filter(email='aigerim@phone.test').exists())

    def test_phone_must_look_like_a_phone_number(self):
        for phone in ('12345', 'call me', '+7 701 abc 45 67', '+7 701 123 45 678', '+44 20 7946 0958'):
            self.assertEqual(self.register(phone=phone).status_code, 400, phone)

    def test_phone_is_saved_for_both_account_types(self):
        self.assertEqual(self.register(phone=' +7 747 224 89 03 ').status_code, 201)
        self.assertEqual(User.objects.get(email='aigerim@phone.test').phone, '+7 747 224 89 03')
        self.client.logout()
        response = self.register(email='cafe@phone.test', phone='+77472248903', account_type='BUSINESS', company_name='Cafe')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get(email='cafe@phone.test').phone, '+7 747 224 89 03')

    def test_staff_created_by_admin_still_do_not_need_a_phone(self):
        admin = User.objects.create_user(email='admin@phone.test', password='Staff-password-123!', name='Admin', role='ADMIN')
        self.client.force_login(admin)
        response = self.client.post('/api/admin/couriers/', {'name': 'Courier', 'email': 'courier@phone.test', 'password': 'Courier-pass-123!'}, format='json')
        self.assertEqual(response.status_code, 201)

    def test_number_is_stored_as_plus_seven_and_groups(self):
        for typed in ('7085676456', '+77085676456', '87085676456', '+7 (708) 567-64-56'):
            User.objects.filter(email='aigerim@phone.test').delete()
            self.client.logout()
            self.assertEqual(self.register(phone=typed).status_code, 201, typed)
            self.assertEqual(User.objects.get(email='aigerim@phone.test').phone, '+7 708 567 64 56', typed)

    def test_profile_keeps_the_same_format_and_customers_cannot_clear_it(self):
        self.assertEqual(self.register(phone='+7 708 567 64 56').status_code, 201)
        response = self.client.patch('/api/auth/profile/', {'phone': '87471112233'}, format='json')
        self.assertEqual((response.status_code, response.json()['phone']), (200, '+7 747 111 22 33'))
        self.assertEqual(self.client.patch('/api/auth/profile/', {'phone': ''}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/auth/profile/', {'phone': '123'}, format='json').status_code, 400)
        self.assertEqual(User.objects.get(email='aigerim@phone.test').phone, '+7 747 111 22 33')
        staff = User.objects.create_user(email='staff@phone.test', password='Staff-password-123!', name='Staff', role='COURIER', phone='+77010000000')
        self.client.force_login(staff)
        self.assertEqual(self.client.patch('/api/auth/profile/', {'phone': ''}, format='json').status_code, 200)
