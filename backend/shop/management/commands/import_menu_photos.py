"""Add one product per processed menu photo (84 items), hidden until a price is set.

Usage:
    python manage.py import_menu_photos           # create missing products
    python manage.py import_menu_photos --dry-run # validate and preview only

Products are created with price 0, is_visible=False and is_available=False,
so nothing new appears on the storefront until a real price is entered in the admin panel.
Re-running skips photos that already have a product.
"""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from shop.models import Category, Product

MANIFEST_PATH = Path(settings.BASE_DIR) / 'shop' / 'data' / 'menu_photos_84.json'
PUBLIC_PATH = (Path(settings.BASE_DIR).parent / 'frontend' / 'public').resolve()
EXPECTED_ROWS = 84


def load_rows():
    try:
        rows = json.loads(MANIFEST_PATH.read_text(encoding='utf-8-sig'))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise CommandError(f'Cannot read menu manifest: {exc}') from exc
    if not isinstance(rows, list) or len(rows) != EXPECTED_ROWS:
        raise CommandError(f'Manifest must contain exactly {EXPECTED_ROWS} rows.')
    names = set()
    for row in rows:
        n = row['n']
        name = row['name'].strip()
        if not name or name.lower() in names:
            raise CommandError(f'Row {n}: empty or duplicate name {name!r}.')
        names.add(name.lower())
        image = f'/images/catalog/menu/menu-{n:02d}.webp'
        path = PUBLIC_PATH / image.lstrip('/')
        if not path.is_file() or path.stat().st_size == 0:
            raise CommandError(f'Row {n}: photo is missing: {image}')
        row['image'] = image
    return rows


class Command(BaseCommand):
    help = 'Create hidden draft products for the 84 processed menu photos.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Validate and report without writing.')

    @transaction.atomic
    def handle(self, *args, **options):
        rows = load_rows()
        categories = {c.slug: c for c in Category.objects.all()}
        missing = {r['category_slug'] for r in rows} - categories.keys()
        if missing:
            raise CommandError(f'Unknown category slugs: {sorted(missing)}')

        created = skipped = 0
        for row in rows:
            if Product.objects.filter(image=row['image']).exists():
                skipped += 1
                continue
            if not options['dry_run']:
                Product.objects.create(
                    category=categories[row['category_slug']],
                    name=row['name'],
                    image=row['image'],
                    price='0.00',
                    is_visible=False,
                    is_available=False,
                )
            created += 1

        verb = 'Would create' if options['dry_run'] else 'Created'
        self.stdout.write(self.style.SUCCESS(f'{verb} {created} draft products; {skipped} already present.'))
        if options['dry_run']:
            transaction.set_rollback(True)
