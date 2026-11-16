import uuid
from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Category, Product, User


PASSWORD = 'Approval-password-123!'


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class BusinessApprovalTests(APITestCase):
    """A business account gets wholesale prices only after an administrator approves it."""

    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(email='admin@approval.test', password=PASSWORD, name='Admin', role='ADMIN')
        self.pending = User.objects.create_user(email='pending@approval.test', password=PASSWORD, name='Pending', account_type='BUSINESS', company_name='Pending Cafe')
        self.individual = User.objects.create_user(email='person@approval.test', password=PASSWORD, name='Person')
        category = Category.objects.create(name='Bakery', slug='bakery-approval')
        self.product = Product.objects.create(category=category, name='Croissant', price='1000.00', wholesale_price='800.00')

    def price_seen_by(self, user):
        self.client.force_login(user)
        rows = {row['id']: row for row in self.client.get('/api/products/').json()}
        return Decimal(rows[self.product.pk]['price'])

    def checkout(self, user, price, quantity=1):
        self.client.force_login(user)
        return self.client.post('/api/orders/', {'recipient_name': 'Pending', 'phone': '+77011234567', 'address': 'Almaty Abai 1', 'comment': 'Подъезд 2', 'items': [{'product_id': self.product.pk, 'quantity': quantity, 'expected_price': price}], 'expected_delivery_fee': '1500.00', 'idempotency_key': str(uuid.uuid4())}, format='json')

    def test_new_business_is_not_approved_and_pays_retail(self):
        self.assertFalse(self.pending.business_approved)
        self.assertEqual(self.price_seen_by(self.pending), Decimal('1000.00'))

    def test_unapproved_business_checkout_uses_retail_price(self):
        self.assertEqual(self.checkout(self.pending, '800.00').status_code, 409)
        self.assertEqual(self.checkout(self.pending, '1000.00').status_code, 201)

    def test_admin_lists_business_accounts_with_approval_state(self):
        self.client.force_login(self.admin)
        rows = self.client.get('/api/admin/businesses/').json()
        self.assertEqual([(row['id'], row['business_approved']) for row in rows], [(self.pending.pk, False)])
        self.assertNotIn('password', rows[0])

    def test_only_admin_can_list_or_approve(self):
        self.client.force_login(self.individual)
        self.assertEqual(self.client.get('/api/admin/businesses/').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/admin/businesses/{self.pending.pk}/', {'business_approved': True}, format='json').status_code, 403)
        self.pending.refresh_from_db()
        self.assertFalse(self.pending.business_approved)

    def test_approval_opens_wholesale_and_revoking_closes_it(self):
        self.client.force_login(self.admin)
        response = self.client.patch(f'/api/admin/businesses/{self.pending.pk}/', {'business_approved': True}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        # Approval opens the offer: the list price stays retail, and ten units are charged at wholesale.
        self.assertEqual(self.price_seen_by(self.pending), Decimal('1000.00'))
        self.assertEqual(self.checkout(self.pending, '800.00', quantity=10).status_code, 201)
        self.assertEqual(self.checkout(self.pending, '800.00', quantity=1).status_code, 409)

        self.client.force_login(self.admin)
        self.assertEqual(self.client.patch(f'/api/admin/businesses/{self.pending.pk}/', {'business_approved': False}, format='json').status_code, 200)
        self.assertEqual(self.price_seen_by(self.pending), Decimal('1000.00'))

    def test_approval_endpoint_refuses_non_business_accounts(self):
        self.client.force_login(self.admin)
        response = self.client.patch(f'/api/admin/businesses/{self.individual.pk}/', {'business_approved': True}, format='json')
        self.assertEqual(response.status_code, 404)
        self.individual.refresh_from_db()
        self.assertFalse(self.individual.business_approved)

    def test_registration_cannot_self_approve(self):
        response = self.client.post('/api/auth/register/', {'phone': '+77011234567', 'name': 'Self', 'email': 'self@approval.test', 'password': 'Self-password-123!', 'account_type': 'BUSINESS', 'company_name': 'Self Cafe', 'business_approved': True}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        user = User.objects.get(email='self@approval.test')
        self.assertFalse(user.business_approved)

    def test_profile_cannot_self_approve(self):
        self.client.force_login(self.pending)
        self.client.patch('/api/auth/profile/', {'business_approved': True}, format='json')
        self.pending.refresh_from_db()
        self.assertFalse(self.pending.business_approved)

    def test_own_account_shows_approval_state(self):
        self.client.force_login(self.pending)
        data = self.client.get('/api/auth/me/').json()
        self.assertEqual((data['account_type'], data['business_approved']), ('BUSINESS', False))
