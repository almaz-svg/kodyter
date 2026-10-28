import os
import secrets
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from shop.models import User, Category, Product

class Command(BaseCommand):
    help = 'Create clearly marked demo catalog and demo accounts; write random passwords only to a private local file.'

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEMO_MODE:
            raise CommandError('seed_demo is disabled when DEMO_MODE=false.')
        categories = [
            ('Выпечка', 'bakery', 'Свежая выпечка к вашему столу', '/images/croissant.webp'),
            ('Торты', 'cakes', 'Торты для тёплых встреч', '/images/cake.webp'),
            ('Десерты', 'desserts', 'Маленькие поводы для радости', '/images/tart.webp'),
            ('Кейтеринг', 'catering', 'Наборы для особых событий', '/images/catering.webp'),
            ('Булочки и пирожки', 'buns', 'Домашние булочки и сытная выпечка', '/images/buns.webp'),
        ]
        cats = {}
        for name, slug, description, image in categories:
            cats[slug], _ = Category.objects.get_or_create(slug=slug, defaults={'name': name, 'description': description, 'image': image})
        products = [
            ('Круассан классический', 'bakery', '890.00', '90 г', '/images/croissant.webp', 'Слоистый круассан на сливочном масле, с тонкой хрустящей корочкой.', 'Пшеничная мука, сливочное масло, молоко, сахар, дрожжи, яйцо', 'Глютен, молоко, яйца'),
            ('Медовик домашний', 'cakes', '8900.00', '1 кг', '/images/cake.webp', 'Нежные медовые коржи со сметанным кремом. Для 6–8 человек.', 'Пшеничная мука, мёд, сметана, сахар, сливочное масло, яйца', 'Глютен, молоко, яйца, мёд'),
            ('Тарт с ягодами', 'desserts', '1490.00', '150 г', '/images/tart.webp', 'Песочная основа, ванильный крем и сезонные ягоды.', 'Пшеничная мука, сливочное масло, молоко, яйца, сахар, ягоды', 'Глютен, молоко, яйца'),
            ('Булочка с корицей', 'bakery', '790.00', '120 г', '/images/buns.webp', 'Мягкое сдобное тесто, ароматная корица и сливочная глазурь.', 'Пшеничная мука, молоко, сахар, масло, корица, сливочный сыр', 'Глютен, молоко, яйца'),
            ('Фуршетный сет', 'catering', '18900.00', '24 шт.', '/images/catering.webp', 'Ассорти мини-выпечки и закусок для небольшой компании.', 'Пшеничная мука, сливочное масло, сыр, овощи, яйца', 'Глютен, молоко, яйца, кунжут'),
            ('Круассан с миндалём', 'bakery', '1190.00', '120 г', '/images/croissant.webp', 'Круассан с миндальным кремом и обжаренными лепестками миндаля.', 'Пшеничная мука, масло, миндаль, молоко, сахар, яйца', 'Глютен, молоко, яйца, орехи'),
            ('Самса с сыром', 'buns', '950.00', '130 г', '/images/buns.webp', 'Слоёная самса с нежной сырной начинкой и румяной корочкой.', 'Пшеничная мука, сливочное масло, сыр, яйца, кунжут', 'Глютен, молоко, яйца, кунжут'),
            ('Булочка с маком', 'buns', '790.00', '120 г', '/images/buns.webp', 'Воздушная сдобная булочка с ароматной маковой начинкой.', 'Пшеничная мука, молоко, сливочное масло, яйца, сахар, мак', 'Глютен, молоко, яйца'),
        ]
        for name, slug, price, weight, image, description, ingredients, allergens in products:
            Product.objects.get_or_create(name=name, category=cats[slug], defaults={'price': price, 'weight': weight, 'image': image, 'description': description, 'ingredients': ingredients, 'allergens': allergens})
        output = Path(os.getenv('DEMO_ACCOUNTS_FILE', str(settings.BASE_DIR.parent / '.secrets' / 'demo-accounts.txt'))).resolve()
        accounts = [('ADMIN', 'admin@anasym.test', 'Демо администратор'), ('CUSTOMER', 'customer@anasym.test', 'Демо покупатель'), ('COURIER', 'courier@anasym.test', 'Демо курьер'), ('CASHIER', 'cashier@anasym.test', 'Демо кассир')]
        generated = []
        for role, email, name in accounts:
            if not User.objects.filter(email__iexact=email).exists():
                password = secrets.token_urlsafe(24)
                User.objects.create_user(email=email, password=password, name=name, role=role, phone='+77010000000')
                generated.append(f'{role}\nEmail: {email}\nPassword: {password}\n')
        if generated:
            output.parent.mkdir(parents=True, exist_ok=True)
            # Append only new credentials: re-running never resets an existing password.
            fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
            with os.fdopen(fd, 'a', encoding='utf-8') as handle:
                handle.write('\nAnasym — demo only. Keep this file private.\n\n' + '\n'.join(generated) + '\n')
        self.stdout.write(self.style.SUCCESS('Demo catalog ready. New account credentials, if any, were written to the configured private file.'))
