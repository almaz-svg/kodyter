"""Add the ten approved demo products without replacing catalog or order data."""
import json
import re
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from shop.models import Category, Product


def validated_manifest():
    backend = Path(settings.BASE_DIR)
    manifest = backend / 'shop/data/pdf_catalog_20261017.json'
    public = (backend.parent / 'frontend/public').resolve()
    try:
        rows = json.loads(manifest.read_text(encoding='utf-8-sig'))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise CommandError('Cannot read the fixed PDF catalog manifest.') from exc
    if not isinstance(rows, list) or len(rows) != 10:
        raise CommandError('The PDF catalog manifest must contain exactly 10 products.')

    required = {'page', 'category_slug', 'name', 'price', 'image', 'description'}
    optional = {'weight', 'ingredients', 'allergens'}
    pages, images = set(), set()
    for index, row in enumerate(rows, 1):
        prefix = f'Manifest row {index}: '
        if not isinstance(row, dict) or not required <= row.keys() or row.keys() - required - optional:
            raise CommandError(prefix + 'missing or unsupported fields.')
        page = row['page']
        if type(page) is not int or page not in range(1, 11) or page in pages:
            raise CommandError(prefix + 'page must be a unique integer from 1 to 10.')
        pages.add(page)
        if not isinstance(row['category_slug'], str) or not re.fullmatch(r'[a-z0-9_-]{1,50}', row['category_slug']):
            raise CommandError(prefix + 'invalid category slug.')
        if not isinstance(row['name'], str) or not row['name'].strip() or len(row['name']) > 160:
            raise CommandError(prefix + 'name must be nonempty and at most 160 characters.')
        if not isinstance(row['description'], str) or len(row['description']) > 5000:
            raise CommandError(prefix + 'description must be a string of at most 5000 characters.')
        if not isinstance(row['price'], str) or not re.fullmatch(r'(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?', row['price']):
            raise CommandError(prefix + 'price must be a nonnegative decimal string with at most 2 decimal places.')
        if any(row.get(field, '') != '' for field in optional):
            raise CommandError(prefix + 'weight, ingredients and allergens must remain blank until confirmed.')

        image = row['image']
        if not isinstance(image, str) or not re.fullmatch(rf'/images/catalog/pdf-{page:02d}-[a-f0-9]{{8,64}}\.webp', image) or image in images:
            raise CommandError(prefix + 'image must be a unique WebP URL for the matching PDF page.')
        images.add(image)
        try:
            asset = (public / image.lstrip('/')).resolve(strict=True)
            asset.relative_to(public)
            if not asset.is_file() or asset.stat().st_size == 0:
                raise ValueError('Not a nonempty file')
        except (OSError, RuntimeError, ValueError) as exc:
            raise CommandError(prefix + 'image is missing, empty or outside frontend/public.') from exc
    return rows


class Command(BaseCommand):
    help = 'Import the fixed ten-product PDF demo catalog; existing image URLs are skipped without edits.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Validate and report counts without creating products.')

    def handle(self, *args, **options):
        if not settings.DEMO_MODE:
            raise CommandError('import_pdf_catalog is disabled when DEMO_MODE=false.')
        rows = validated_manifest()
        slugs = {row['category_slug'] for row in rows}
        images = {row['image'] for row in rows}
        with transaction.atomic():
            category_query = Category.objects.filter(slug__in=slugs).order_by('pk')
            if not options['dry_run']:
                # Serialize imports of these categories before checking existing images.
                category_query = category_query.select_for_update()
            categories = {category.slug: category for category in category_query}
            missing = slugs - categories.keys()
            if missing:
                raise CommandError('Missing categories: ' + ', '.join(sorted(missing)))
            existing = set(Product.objects.filter(image__in=images).values_list('image', flat=True))
            pending = [row for row in rows if row['image'] not in existing]
            if not options['dry_run']:
                Product.objects.bulk_create([
                    Product(category=categories[row['category_slug']], name=row['name'],
                            description=row['description'], price=Decimal(row['price']),
                            image=row['image'], weight='', ingredients='', allergens='',
                            is_visible=True, is_available=True)
                    for row in pending
                ])
        action = 'Would create' if options['dry_run'] else 'Created'
        self.stdout.write(f'{action}: {len(pending)}; skipped existing: {len(rows) - len(pending)}; total manifest: {len(rows)}.')
