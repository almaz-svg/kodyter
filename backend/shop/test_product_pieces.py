from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Category, Product, User


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class ProductPiecesTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='admin@pieces.test', password='Staff-password-123!', name='Admin', role='ADMIN')
        self.category = Category.objects.create(name='Bakery', slug='bakery')
        self.client.force_login(self.admin)

    def create(self, **extra):
        return self.client.post('/api/admin/products/', {'name': 'Eclair', 'category': self.category.pk, 'price': '900', **extra}, format='json')

    def test_pieces_are_optional_and_shown_in_the_catalog(self):
        self.assertEqual(self.create().json()['pieces'], None)
        product_id = self.create(name='Box', pieces=6).json()['id']
        self.assertEqual(Product.objects.get(pk=product_id).pieces, 6)
        self.client.logout()
        self.assertEqual(self.client.get(f'/api/products/{product_id}/').json()['pieces'], 6)

    def test_pieces_can_be_cleared_and_must_be_positive(self):
        product_id = self.create(pieces=6).json()['id']
        self.assertEqual(self.client.patch(f'/api/admin/products/{product_id}/', {'pieces': None}, format='json').json()['pieces'], None)
        for bad in (0, -1, 1001, 'abc'):
            self.assertEqual(self.create(pieces=bad).status_code, 400, bad)
