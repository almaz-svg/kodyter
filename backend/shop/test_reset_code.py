import re
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .models import PasswordResetCode, User


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'], EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class ResetCodeTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='reset@code.test', password='Old-password-432!', name='Айгерим')

    def request_code(self, email='reset@code.test'):
        return self.client.post('/api/auth/password-reset/', {'email': email}, format='json')

    def last_code(self):
        return re.search(r'\b(\d{6})\b', mail.outbox[-1].body)[1]

    def confirm(self, code, password='New-password-987!', email='reset@code.test'):
        return self.client.post('/api/auth/password-reset-code/', {'email': email, 'code': code, 'password': password}, format='json')

    def test_code_resets_the_password_once(self):
        self.assertEqual(self.request_code('RESET@code.test').status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('код', mail.outbox[0].subject.lower())
        self.assertTrue(mail.outbox[0].alternatives)  # an HTML version for mail apps
        code = self.last_code()
        self.assertNotIn(code, PasswordResetCode.objects.get().code_hash)
        self.assertEqual(self.confirm(code).status_code, 200)
        self.assertEqual(self.confirm(code).status_code, 400)
        self.assertTrue(APIClient().post('/api/auth/login/', {'email': 'reset@code.test', 'password': 'New-password-987!'}, format='json').status_code == 200)

    def test_unknown_or_blocked_accounts_get_the_same_answer_and_no_mail(self):
        User.objects.create_user(email='blocked@code.test', password='Old-password-432!', name='B', is_active=False)
        known = self.request_code().json()
        unknown = self.request_code('nobody@code.test').json()
        blocked = self.request_code('blocked@code.test').json()
        self.assertEqual(known, unknown)
        self.assertEqual(known, blocked)
        self.assertEqual(len(mail.outbox), 1)

    def test_wrong_codes_count_down_and_then_the_code_stops_working(self):
        self.request_code()
        code = self.last_code()
        wrong = '000000' if code != '000000' else '111111'
        for left in (4, 3, 2, 1):
            response = self.confirm(wrong)
            self.assertEqual(response.status_code, 400)
            self.assertIn(f'Осталось попыток: {left}', response.json()['detail'])
        self.assertNotIn('Осталось', self.confirm(wrong).json()['detail'])
        self.assertEqual(self.confirm(code).status_code, 400)  # locked even with the right code
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Old-password-432!'))

    def test_expired_code_is_refused(self):
        self.request_code()
        PasswordResetCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.confirm(self.last_code()).status_code, 400)

    def test_resend_waits_a_minute_and_a_new_code_replaces_the_old(self):
        self.request_code()
        first = self.last_code()
        self.request_code()
        self.assertEqual(len(mail.outbox), 1)  # too soon: nothing new is sent
        PasswordResetCode.objects.update(created_at=timezone.now() - timedelta(minutes=2))
        self.request_code()
        self.assertEqual(len(mail.outbox), 2)
        second = self.last_code()
        if first != second:
            self.assertEqual(self.confirm(first).status_code, 400)
        self.assertEqual(self.confirm(second).status_code, 200)

    def test_hourly_limit(self):
        for _ in range(6):
            self.request_code()
            PasswordResetCode.objects.update(created_at=timezone.now() - timedelta(minutes=2))
        self.assertEqual(len(mail.outbox), 5)

    def test_weak_password_keeps_the_code_usable(self):
        self.request_code()
        code = self.last_code()
        response = self.confirm(code, password='123')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json().get('fields', response.json()))
        self.assertEqual(self.confirm(code).status_code, 200)

    def test_bad_code_format_is_refused(self):
        self.request_code()
        for bad in ('12345', 'abcdef', '1234567'):
            self.assertEqual(self.confirm(bad).status_code, 400, bad)

    @override_settings(EMAIL_BACKEND='shop.test_reset_code.BrokenBackend')
    def test_failed_delivery_does_not_block_the_next_request(self):
        self.assertEqual(self.request_code().status_code, 503)
        self.assertFalse(PasswordResetCode.objects.exists())


class BrokenBackend:
    def __init__(self, *args, **kwargs):
        pass

    def send_messages(self, messages):
        raise ConnectionError('smtp down')
