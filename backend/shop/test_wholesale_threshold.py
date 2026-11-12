import uuid
from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Category, Product, User


PASSWORD = 'Threshold-password-123!'


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class WholesaleThresholdTests(APITestCase):
    """A wholesale price applies to one product only when this order holds at least WHOLESALE_MIN_QTY units of that product.
    The count is per product, never the total of different products."""

    def setUp(self):
        cache.clear()
        self.approved = User.objects.create_user(email='approved@threshold.test', password=PASSWORD, name='Approved', account_type='BUSINESS', company_name='Кафе Одобрено', business_approved=True)
        self.pending = User.objects.create_user(email='pending@threshold.test', password=PASSWORD, name='Pending', account_type='BUSINESS', company_name='Кафе Ожидает')
        self.individual = User.objects.create_user(email='person@threshold.test', password=PASSWORD, name='Person')
        category = Category.objects.create(name='Выпечка', slug='bakery-threshold')
        self.croissant = Product.objects.create(category=category, name='Круассан', price='890.00', wholesale_price='756.50')
        self.eclair = Product.objects.create(category=category, name='Эклер', price='1290.00', wholesale_price='1100.00')
        self.plain = Product.objects.create(category=category, name='Булочка', price='500.00')

    def order(self, user, lines):
        """lines: list of (product, quantity, expected_price)."""
        self.client.force_login(user)
        items = [{'product_id': product.pk, 'quantity': quantity, 'expected_price': str(price)} for product, quantity, price in lines]
        return self.client.post('/api/orders/', {'recipient_name': 'Threshold', 'phone': '+77011234567', 'address': 'Almaty Abai 1', 'comment': 'Подъезд 2', 'items': items, 'expected_delivery_fee': '1500.00', 'idempotency_key': str(uuid.uuid4())}, format='json')

    def catalog_row(self, user, product):
        if user is None:
            self.client.logout()
        else:
            self.client.force_login(user)
        rows = {row['id']: row for row in self.client.get('/api/products/').json()}
        return rows[product.pk]

    # --- checkout: the server decides the price per product line ---

    def test_ten_croissants_for_an_approved_business_are_wholesale(self):
        response = self.order(self.approved, [(self.croissant, 10, '756.50')])
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Decimal(response.json()['subtotal']), Decimal('7565.00'))
        self.assertEqual(Decimal(response.json()['items'][0]['price']), Decimal('756.50'))

    def test_nine_croissants_for_an_approved_business_are_retail(self):
        response = self.order(self.approved, [(self.croissant, 9, '890.00')])
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Decimal(response.json()['subtotal']), Decimal('8010.00'))

    def test_nine_croissants_at_the_wholesale_price_are_refused(self):
        self.assertEqual(self.order(self.approved, [(self.croissant, 9, '756.50')]).status_code, 409)

    def test_five_croissants_and_five_eclairs_are_both_retail(self):
        # Ten units in total, but no single product reaches ten: both lines stay at retail.
        response = self.order(self.approved, [(self.croissant, 5, '890.00'), (self.eclair, 5, '1290.00')])
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Decimal(response.json()['subtotal']), Decimal('10900.00'))

    def test_ten_croissants_are_wholesale_while_a_small_line_stays_retail(self):
        response = self.order(self.approved, [(self.croissant, 10, '756.50'), (self.eclair, 2, '1290.00')])
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Decimal(response.json()['subtotal']), Decimal('7565.00') + Decimal('2580.00'))

    def test_product_without_wholesale_price_stays_retail_at_any_quantity(self):
        response = self.order(self.approved, [(self.plain, 12, '500.00')])
        self.assertEqual(response.status_code, 201, response.content)

    def test_unapproved_business_with_ten_croissants_pays_retail(self):
        self.assertEqual(self.order(self.pending, [(self.croissant, 10, '756.50')]).status_code, 409)
        self.assertEqual(self.order(self.pending, [(self.croissant, 10, '890.00')]).status_code, 201)

    def test_individual_with_ten_croissants_pays_retail(self):
        self.assertEqual(self.order(self.individual, [(self.croissant, 10, '756.50')]).status_code, 409)
        self.assertEqual(self.order(self.individual, [(self.croissant, 10, '890.00')]).status_code, 201)

    def test_threshold_is_configurable(self):
        with override_settings(WHOLESALE_MIN_QTY=3):
            self.assertEqual(self.order(self.approved, [(self.croissant, 3, '756.50')]).status_code, 201)

    # --- catalog: the list price is retail; approved businesses see the wholesale offer next to it ---

    def test_guest_catalog_shows_only_retail(self):
        row = self.catalog_row(None, self.croissant)
        self.assertEqual(Decimal(row['price']), Decimal('890.00'))
        self.assertNotIn('wholesale_price', row)
        self.assertNotIn('wholesale_min_qty', row)

    def test_individual_catalog_shows_only_retail(self):
        row = self.catalog_row(self.individual, self.croissant)
        self.assertEqual(Decimal(row['price']), Decimal('890.00'))
        self.assertNotIn('wholesale_price', row)

    def test_unapproved_business_catalog_shows_only_retail(self):
        row = self.catalog_row(self.pending, self.croissant)
        self.assertEqual(Decimal(row['price']), Decimal('890.00'))
        self.assertNotIn('wholesale_price', row)

    def test_approved_business_catalog_shows_retail_and_the_wholesale_offer(self):
        row = self.catalog_row(self.approved, self.croissant)
        self.assertEqual(Decimal(row['price']), Decimal('890.00'))
        self.assertEqual(Decimal(row['wholesale_price']), Decimal('756.50'))
        self.assertEqual(row['wholesale_min_qty'], 10)

    def test_approved_business_product_without_wholesale_has_no_offer(self):
        row = self.catalog_row(self.approved, self.plain)
        self.assertNotIn('wholesale_price', row)
