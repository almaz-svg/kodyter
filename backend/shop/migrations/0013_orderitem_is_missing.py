from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0012_orderitem_retail_price'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='is_missing',
            field=models.BooleanField(default=False),
        ),
    ]
