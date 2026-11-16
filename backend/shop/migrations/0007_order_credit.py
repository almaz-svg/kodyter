from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0006_orderitem_is_prepared'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='on_credit',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='order',
            name='credit_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='credit_by_name',
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
