import uuid
from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Category, Product, User


PASSWORD = 'Wholesale-password-123!'


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class WholesalePricingTests(APITestCase):
    """Registered businesses ('заведение') pay the wholesale price; individuals and guests pay the retail price."""

    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(email='admin@wholesale.test', password=PASSWORD, name='Admin', role='ADMIN')
        self.individual = User.objects.create_user(email='person@wholesale.test', password=PASSWORD, name='Person')
        self.business = User.objects.create_user(email='cafe@wholesale.test', password=PASSWORD, name='Manager', account_type='BUSINESS', company_name='Cafe Anasym', business_approved=True)
        category = Category.objects.create(name='Bakery', slug='bakery-wholesale')
        self.with_wholesale = Product.objects.create(category=category, name='Croissant', price='1000.00', wholesale_price='800.00')
        self.without_wholesale = Product.objects.create(category=category, name='Bun', price='500.00')

    def products_as(self, user=None):
        if user:
            self.client.force_login(user)
        else:
            self.client.logout()
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, 200)
        return {row['id']: row for row in response.json()}

    def test_guest_sees_retail_price_and_no_wholesale_field(self):
        rows = self.products_as(None)
        self.assertEqual(Decimal(rows[self.with_wholesale.pk]['price']), Decimal('1000.00'))
        self.assertNotIn('wholesale_price', rows[self.with_wholesale.pk])

    def test_individual_customer_sees_retail_price(self):
        rows = self.products_as(self.individual)
        self.assertEqual(Decimal(rows[self.with_wholesale.pk]['price']), Decimal('1000.00'))
        self.assertNotIn('wholesale_price', rows[self.with_wholesale.pk])

    def test_business_sees_retail_price_and_the_wholesale_offer(self):
        # The list price is retail; wholesale applies from 10 units in one order (see test_wholesale_threshold).
        rows = self.products_as(self.business)
        self.assertEqual(Decimal(rows[self.with_wholesale.pk]['price']), Decimal('1000.00'))
        self.assertEqual(Decimal(rows[self.with_wholesale.pk]['retail_price']), Decimal('1000.00'))
        self.assertEqual(Decimal(rows[self.with_wholesale.pk]['wholesale_price']), Decimal('800.00'))
        self.assertEqual(rows[self.with_wholesale.pk]['wholesale_min_qty'], 10)

    def test_business_without_wholesale_price_pays_retail(self):
        rows = self.products_as(self.business)
        self.assertEqual(Decimal(rows[self.without_wholesale.pk]['price']), Decimal('500.00'))
        self.assertEqual(Decimal(rows[self.without_wholesale.pk]['retail_price']), Decimal('500.00'))

    def test_product_detail_shows_retail_and_the_offer_for_a_business(self):
        self.client.force_login(self.business)
        data = self.client.get(f'/api/products/{self.with_wholesale.pk}/').json()
        self.assertEqual(Decimal(data['price']), Decimal('1000.00'))
        self.assertEqual(Decimal(data['wholesale_price']), Decimal('800.00'))

    def test_admin_sees_and_sets_wholesale_price(self):
        self.client.force_login(self.admin)
        listed = {row['id']: row for row in self.client.get('/api/admin/products/').json()}
        self.assertEqual(Decimal(listed[self.with_wholesale.pk]['wholesale_price']), Decimal('800.00'))
        response = self.client.patch(f'/api/admin/products/{self.without_wholesale.pk}/', {'wholesale_price': '450.00'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.without_wholesale.refresh_from_db()
        self.assertEqual(self.without_wholesale.wholesale_price, Decimal('450.00'))

    def test_wholesale_price_cannot_exceed_retail(self):
        self.client.force_login(self.admin)
        response = self.client.patch(f'/api/admin/products/{self.without_wholesale.pk}/', {'wholesale_price': '600.00'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.without_wholesale.refresh_from_db()
        self.assertIsNone(self.without_wholesale.wholesale_price)

    def test_registration_defaults_to_individual(self):
        response = self.client.post('/api/auth/register/', {'name': 'New Person', 'email': 'new@wholesale.test', 'password': 'Another-password-123!'}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(User.objects.get(email='new@wholesale.test').account_type, 'INDIVIDUAL')

    def test_business_registration_needs_company_name(self):
        response = self.client.post('/api/auth/register/', {'name': 'Manager', 'email': 'nocafe@wholesale.test', 'password': 'Another-password-123!', 'account_type': 'BUSINESS'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email='nocafe@wholesale.test').exists())

    def test_business_registration_stores_company_name(self):
        response = self.client.post('/api/auth/register/', {'name': 'Manager', 'email': 'cafe2@wholesale.test', 'password': 'Another-password-123!', 'account_type': 'BUSINESS', 'company_name': 'Second Cafe'}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        user = User.objects.get(email='cafe2@wholesale.test')
        self.assertEqual((user.account_type, user.company_name), ('BUSINESS', 'Second Cafe'))

    def test_profile_cannot_change_account_type(self):
        self.client.force_login(self.individual)
        self.client.patch('/api/auth/profile/', {'account_type': 'BUSINESS', 'company_name': 'Sneaky'}, format='json')
        self.individual.refresh_from_db()
        self.assertEqual(self.individual.account_type, 'INDIVIDUAL')
        self.assertEqual(self.individual.company_name, '')

    def checkout_payload(self, expected_price, product, quantity=10):
        return {'recipient_name': 'Manager', 'phone': '+77011234567', 'address': 'Almaty Abai 1', 'comment': '', 'items': [{'product_id': product.pk, 'quantity': quantity, 'expected_price': expected_price}], 'expected_delivery_fee': '1500.00', 'idempotency_key': str(uuid.uuid4())}

    def test_business_checkout_charges_wholesale_from_ten_units(self):
        self.client.force_login(self.business)
        response = self.client.post('/api/orders/', self.checkout_payload('800.00', self.with_wholesale, quantity=10), format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Decimal(response.json()['subtotal']), Decimal('8000.00'))
        self.assertEqual(Decimal(response.json()['items'][0]['price']), Decimal('800.00'))

    def test_business_ten_units_at_retail_price_is_a_conflict(self):
        self.client.force_login(self.business)
        response = self.client.post('/api/orders/', self.checkout_payload('1000.00', self.with_wholesale, quantity=10), format='json')
        self.assertEqual(response.status_code, 409)

    def test_business_below_threshold_pays_retail(self):
        self.client.force_login(self.business)
        response = self.client.post('/api/orders/', self.checkout_payload('1000.00', self.with_wholesale, quantity=2), format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Decimal(response.json()['items'][0]['price']), Decimal('1000.00'))

    def test_individual_checkout_with_wholesale_price_is_a_conflict(self):
        self.client.force_login(self.individual)
        response = self.client.post('/api/orders/', self.checkout_payload('800.00', self.with_wholesale), format='json')
        self.assertEqual(response.status_code, 409)
        self.assertFalse(self.individual.orders.exists())
