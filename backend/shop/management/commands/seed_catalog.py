"""Seed the product catalog from catalog_cards.json (48 real product cards).

Usage:
    python manage.py seed_catalog           # create missing products
    python manage.py seed_catalog --dry-run # preview without DB writes
    python manage.py seed_catalog --clear   # delete existing products first
"""
import json
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from shop.models import Category, Product

MANIFEST_PATH = Path(settings.BASE_DIR) / "shop" / "data" / "catalog_cards.json"
PUBLIC_PATH = (Path(settings.BASE_DIR).parent / "frontend" / "public").resolve()


def load_manifest():
    try:
        rows = json.loads(MANIFEST_PATH.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise CommandError(f"Cannot read catalog manifest: {exc}") from exc
    if not isinstance(rows, list) or not rows:
        raise CommandError("Manifest must be a non-empty list.")
    return rows


def validate_rows(rows):
    required = {"card", "category_slug", "name", "price", "image"}
    errors = []
    for i, row in enumerate(rows, 1):
        missing = required - row.keys()
        if missing:
            errors.append(f"Row {i}: missing fields {missing}")
        else:
            image_path = PUBLIC_PATH / row["image"].lstrip("/")
            if not image_path.exists():
                errors.append(f"Row {i}: image not found at {image_path}")
    if errors:
        raise CommandError("Manifest errors:\n" + "\n".join(errors))


class Command(BaseCommand):
    help = "Seed the full 48-product catalog from catalog_cards.json."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB.")
        parser.add_argument("--clear", action="store_true", help="Delete all products before seeding.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        clear = options["clear"]

        rows = load_manifest()
        validate_rows(rows)

        category_slugs = {row["category_slug"] for row in rows}
        image_urls = {row["image"] for row in rows}

        with transaction.atomic():
            # Fetch categories
            categories = {
                c.slug: c
                for c in Category.objects.filter(slug__in=category_slugs)
            }
            missing_cats = category_slugs - categories.keys()
            if missing_cats:
                raise CommandError(
                    f"Missing categories in DB: {', '.join(sorted(missing_cats))}. "
                    f"Run seed_demo first or create these categories via admin."
                )

            if clear and not dry_run:
                deleted, _ = Product.objects.filter(image__in=image_urls).delete()
                self.stdout.write(self.style.WARNING(f"Deleted {deleted} existing catalog products."))

            # Find which images are already in the DB
            existing_images = set(
                Product.objects.filter(image__in=image_urls).values_list("image", flat=True)
            )
            pending = [row for row in rows if row["image"] not in existing_images]

            if not dry_run:
                Product.objects.bulk_create([
                    Product(
                        category=categories[row["category_slug"]],
                        name=row["name"],
                        description="",
                        price=Decimal(row["price"]),
                        image=row["image"],
                        weight="",
                        ingredients="",
                        allergens="",
                        is_visible=True,
                        is_available=True,
                    )
                    for row in pending
                ])

            action = "Would create" if dry_run else "Created"
            skipped = len(rows) - len(pending)
            self.stdout.write(
                self.style.SUCCESS(
                    f"{action}: {len(pending)} products; skipped existing: {skipped}; total in manifest: {len(rows)}."
                )
            )
