from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0010_user_credit_allowed'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='wholesale_min_qty',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
