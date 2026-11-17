from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0009_passwordresetcode'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='credit_allowed',
            field=models.BooleanField(default=False),
        ),
    ]
