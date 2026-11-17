from django.db import migrations, models
from django.db.models import F


def mark_past_wholesale(apps, schema_editor):
    """Older lines did not keep the retail price. A business line priced below the product's retail price was wholesale."""
    OrderItem = apps.get_model('shop', 'OrderItem')
    for item in OrderItem.objects.filter(order__customer__account_type='BUSINESS', price__lt=F('product__price')).select_related('product'):
        item.retail_price = item.product.price
        item.save(update_fields=['retail_price'])


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0011_product_wholesale_min_qty'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='retail_price',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.RunPython(mark_past_wholesale, migrations.RunPython.noop),
    ]
