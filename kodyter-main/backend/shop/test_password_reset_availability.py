"""A disabled external email service must not reveal whether an account exists."""
from django.test import override_settings
from django.core.cache import cache
from rest_framework.test import APISimpleTestCase


@override_settings(PASSWORD_RESET_ENABLED=False)
class PasswordResetAvailabilityTests(APISimpleTestCase):
    # SimpleTestCase forbids DB queries: rejection happens before account lookup.
    def setUp(self):
        cache.clear()

    def test_disabled_reset_rejects_all_valid_addresses_without_account_lookup(self):
        responses = [self.client.post('/api/auth/password-reset/', {'email': email}, format='json')
                     for email in ('customer@anasym.test', 'unknown@anasym.test')]
        self.assertEqual([response.status_code for response in responses], [503, 503])
        self.assertEqual(responses[0].json(), responses[1].json())
        self.assertIn('временно недоступно', responses[0].json()['detail'])

    def test_disabled_reset_still_validates_the_email(self):
        response = self.client.post('/api/auth/password-reset/', {'email': 'not-an-email'}, format='json')
        self.assertEqual(response.status_code, 400)
