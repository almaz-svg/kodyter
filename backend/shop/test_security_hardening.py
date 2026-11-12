from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework.throttling import AnonRateThrottle

from .models import User
from .security import reject_markup
from .serializers import CheckoutSerializer, RegisterSerializer
from django.core.exceptions import ValidationError as DjangoValidationError


class SecurityHeaderTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client_api = APIClient()

    def test_api_responses_carry_security_headers(self):
        response = self.client_api.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['X-Frame-Options'], 'DENY')
        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response['Referrer-Policy'], 'strict-origin-when-cross-origin')
        self.assertIn("frame-ancestors 'none'", response['Content-Security-Policy'])
        self.assertIn('camera=()', response['Permissions-Policy'])
        self.assertEqual(response['Cross-Origin-Opener-Policy'], 'same-origin')

    def test_api_responses_are_not_cached(self):
        response = self.client_api.get('/api/settings/')
        self.assertEqual(response['Cache-Control'], 'no-store')


@override_settings(CORS_ALLOWED_ORIGINS=['https://shop.example.test'])
class CorsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client_api = APIClient()

    def test_allowlisted_origin_receives_cors_headers(self):
        response = self.client_api.get('/api/health/', HTTP_ORIGIN='https://shop.example.test')
        self.assertEqual(response['Access-Control-Allow-Origin'], 'https://shop.example.test')
        self.assertEqual(response['Access-Control-Allow-Credentials'], 'true')

    def test_unknown_origin_receives_no_cors_headers(self):
        response = self.client_api.get('/api/health/', HTTP_ORIGIN='https://evil.example.test')
        self.assertNotIn('Access-Control-Allow-Origin', response)


class MarkupRejectionTests(TestCase):
    def test_reject_markup_refuses_angle_brackets(self):
        with self.assertRaises(DjangoValidationError):
            reject_markup('<img src=x onerror=alert(1)>')

    def test_reject_markup_keeps_ordinary_text(self):
        self.assertEqual(reject_markup('Анастасия Иванова'), 'Анастасия Иванова')

    def test_registration_refuses_script_in_name(self):
        serializer = RegisterSerializer(data={'name': '<script>alert(1)</script>', 'email': 'xss@example.test', 'password': 'Strong-password-222!'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)

    def test_checkout_refuses_markup_in_address(self):
        serializer = CheckoutSerializer(data={
            'recipient_name': 'Айгерим',
            'phone': '+7 701 123 45 67',
            'address': '<b>Taraz</b> Konaev 62a',
            'comment': 'Подъезд 2',
            'items': [{'product_id': 1, 'quantity': 1, 'expected_price': '1000.00'}],
            'expected_delivery_fee': '1500.00',
            'idempotency_key': '6f1c6c1e-1d1e-4f3a-9a77-3c6f2a0b9a11',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)


class PasswordStorageTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client_api = APIClient()

    def test_registered_password_is_stored_only_as_hash(self):
        response = self.client_api.post('/api/auth/register/', {'name': 'Айгерим', 'email': 'hash@example.test', 'password': 'Strong-password-222!'})
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='hash@example.test')
        self.assertTrue(user.password.startswith('pbkdf2_'))
        self.assertNotIn('Strong-password-222!', user.password)
        self.assertTrue(user.check_password('Strong-password-222!'))


class SessionCookieTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client_api = APIClient()
        User.objects.create_user(email='cookie@example.test', password='Strong-password-222!', name='Cookie')

    def test_login_sets_http_only_lax_session_cookie(self):
        response = self.client_api.post('/api/auth/login/', {'email': 'cookie@example.test', 'password': 'Strong-password-222!'})
        self.assertEqual(response.status_code, 200)
        cookie = response.cookies['sessionid']
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Lax')

    def test_session_lifetime_is_bounded(self):
        from django.conf import settings
        self.assertEqual(settings.SESSION_COOKIE_AGE, 43200)
        self.assertTrue(settings.SESSION_EXPIRE_AT_BROWSER_CLOSE)


class GlobalThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client_api = APIClient()

    def tearDown(self):
        cache.clear()

    def test_anonymous_catalog_requests_are_limited(self):
        with mock.patch.dict(AnonRateThrottle.THROTTLE_RATES, {'anon': '3/minute'}):
            statuses = [self.client_api.get('/api/categories/').status_code for _ in range(4)]
        self.assertEqual(statuses[:3], [200, 200, 200])
        self.assertEqual(statuses[3], 429)
