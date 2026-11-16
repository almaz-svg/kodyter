from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0007_order_credit'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='pieces',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
