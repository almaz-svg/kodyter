"""The fixed PDF import must never replace an existing catalog or order snapshot."""
import copy
import io
import json
import tempfile
import uuid
from decimal import Decimal
from pathlib import Path

from django.core.management import call_command, get_commands
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from .models import Category, Order, OrderItem, Product, User


@override_settings(DEMO_MODE=True)
class PdfCatalogImportTests(TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.manifest = self.root / 'backend/shop/data/pdf_catalog_20261017.json'
        self.manifest.parent.mkdir(parents=True)
        self.public = self.root / 'frontend/public'
        (self.public / 'images/catalog').mkdir(parents=True)
        settings = override_settings(BASE_DIR=self.root / 'backend')
        settings.enable()
        self.addCleanup(settings.disable)
        self.category = Category.objects.create(name='Bakery', slug='bakery')
        self.rows = [
            {'page': page, 'category_slug': 'bakery', 'name': f'Demo photo {page}',
             'price': '1234.50', 'image': f'/images/catalog/pdf-{page:02d}-abcdef1234.webp',
             'description': 'Temporary demo product; commercial details are not confirmed.'}
            for page in range(1, 11)
        ]
        for row in self.rows:
            (self.public / row['image'].lstrip('/')).write_bytes(b'RIFF\x04\x00\x00\x00WEBP')
        self.write_manifest(self.rows)

    def write_manifest(self, rows):
        self.manifest.write_text(json.dumps(rows), encoding='utf-8')

    def run_import(self, *args):
        self.assertIn('import_pdf_catalog', get_commands(), 'The safe PDF import command is missing.')
        output = io.StringIO()
        call_command('import_pdf_catalog', *args, stdout=output)
        return output.getvalue()

    def test_dry_run_counts_without_creating_products(self):
        output = self.run_import('--dry-run')
        self.assertIn('Would create: 10', output)
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(User.objects.count(), 0)

    def test_import_and_repeat_preserve_existing_fields_and_order_snapshot(self):
        existing = Product.objects.create(category=self.category, name='Edited by owner',
            image=self.rows[0]['image'], price='777.00', is_available=False, is_visible=False)
        buyer = User.objects.create_user('import-test@example.invalid', 'test-password', name='Buyer')
        order = Order.objects.create(customer=buyer, recipient_name='Buyer', phone='+77010000000',
            address='Test address', subtotal='777', delivery_fee='1500', total='2277',
            idempotency_key=uuid.uuid4(), request_fingerprint='x')
        item = OrderItem.objects.create(order=order, product=existing, name='Original name',
            price='777', quantity=1, image='/images/original.webp')
        original_user = User.objects.values().get(pk=buyer.pk)
        original_order = Order.objects.values().get(pk=order.pk)
        original_item = OrderItem.objects.values().get(pk=item.pk)
        original_product = Product.objects.values().get(pk=existing.pk)

        self.assertIn('Created: 9', self.run_import())
        self.assertIn('Created: 0', self.run_import())
        self.assertEqual(Product.objects.count(), 10)
        self.assertEqual(Product.objects.values().get(pk=existing.pk), original_product)
        self.assertEqual(User.objects.values().get(pk=buyer.pk), original_user)
        self.assertEqual(Order.objects.values().get(pk=order.pk), original_order)
        self.assertEqual(OrderItem.objects.values().get(pk=item.pk), original_item)
        created = Product.objects.get(image=self.rows[1]['image'])
        self.assertEqual(created.price, Decimal('1234.50'))
        self.assertEqual((created.weight, created.ingredients, created.allergens), ('', '', ''))
        self.assertTrue(created.is_available and created.is_visible)

    def test_rejects_disabled_demo_mode(self):
        with override_settings(DEMO_MODE=False), self.assertRaises(CommandError):
            self.run_import()
        self.assertEqual(Product.objects.count(), 0)

    def test_validates_last_row_before_writing_any_product(self):
        invalid_changes = [
            {'category_slug': 'missing'}, {'page': True}, {'page': 1},
            {'price': 'NaN'}, {'price': '-1.00'}, {'price': '1.001'}, {'price': '100000000.00'},
            {'price': 1234.50}, {'name': ''}, {'name': 'x' * 161}, {'description': None},
            {'image': '/images/catalog/../../private.webp'}, {'image': self.rows[0]['image']},
            {'ingredients': 'Unconfirmed ingredients'}, {'unexpected': 'field'},
        ]
        for changes in invalid_changes:
            with self.subTest(changes=changes):
                rows = copy.deepcopy(self.rows)
                rows[-1].update(changes)
                self.write_manifest(rows)
                with self.assertRaises(CommandError):
                    self.run_import()
                self.assertEqual(Product.objects.count(), 0)

    def test_rejects_incomplete_manifest_and_missing_last_photo(self):
        self.write_manifest(self.rows[:-1])
        with self.assertRaises(CommandError):
            self.run_import()
        self.write_manifest(self.rows)
        (self.public / self.rows[-1]['image'].lstrip('/')).unlink()
        with self.assertRaises(CommandError):
            self.run_import('--dry-run')
        with self.assertRaises(CommandError):
            self.run_import()
        self.assertEqual(Product.objects.count(), 0)
