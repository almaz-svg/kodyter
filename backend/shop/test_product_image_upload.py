from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from .image_upload import MAX_IMAGE_BYTES
from .models import Category, User


PASSWORD = 'Upload-password-123!'
UPLOAD_URL = '/api/admin/uploads/product-image/'
STORAGE = {
    'SUPABASE_URL': 'https://example.supabase.co',
    'SUPABASE_SERVICE_ROLE_KEY': 'test-only-service-key',
    'SUPABASE_STORAGE_BUCKET': 'product-images',
}
JPEG = b'\xff\xd8\xff\xe0' + b'0' * 200
PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 200
WEBP = b'RIFF' + b'\x00\x00\x00\x00' + b'WEBP' + b'0' * 200


def photo(data, name='photo.jpg', content_type='image/jpeg'):
    return SimpleUploadedFile(name, data, content_type=content_type)


@override_settings(**STORAGE)
class ProductImageUploadTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='admin@upload.test', password=PASSWORD, name='Admin', role='ADMIN')
        self.customer = User.objects.create_user(email='buyer@upload.test', password=PASSWORD, name='Buyer')
        self.category = Category.objects.create(name='Выпечка', slug='bakery-upload', description='', image='', is_visible=True)

    def test_only_admin_can_upload(self):
        response = self.client.post(UPLOAD_URL, {'file': photo(JPEG)}, format='multipart')
        self.assertIn(response.status_code, (401, 403))
        self.client.force_authenticate(user=self.customer)
        self.assertEqual(self.client.post(UPLOAD_URL, {'file': photo(JPEG)}, format='multipart').status_code, 403)

    def test_missing_file_is_refused(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.post(UPLOAD_URL, {}, format='multipart').status_code, 400)

    def test_svg_or_text_renamed_to_jpg_is_refused(self):
        self.client.force_authenticate(user=self.admin)
        fake = photo(b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')
        response = self.client.post(UPLOAD_URL, {'file': fake}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('JPEG, PNG и WebP', str(response.data))

    def test_file_over_the_limit_is_refused(self):
        self.client.force_authenticate(user=self.admin)
        too_big = photo(b'\xff\xd8\xff' + b'0' * MAX_IMAGE_BYTES)
        self.assertEqual(self.client.post(UPLOAD_URL, {'file': too_big}, format='multipart').status_code, 400)

    @override_settings(SUPABASE_URL='', SUPABASE_SERVICE_ROLE_KEY='')
    def test_unconfigured_storage_says_so(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(UPLOAD_URL, {'file': photo(JPEG)}, format='multipart')
        self.assertEqual(response.status_code, 503)

    @patch('shop.image_upload._post_to_storage')
    def test_jpeg_is_stored_and_public_url_returned(self, post):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(UPLOAD_URL, {'file': photo(JPEG)}, format='multipart')
        self.assertEqual(response.status_code, 201)
        url = response.data['url']
        self.assertTrue(url.startswith('https://example.supabase.co/storage/v1/object/public/product-images/products/'))
        self.assertTrue(url.endswith('.jpg'))
        body, content_type = post.call_args.args[1], post.call_args.args[2]
        self.assertEqual((body, content_type), (JPEG, 'image/jpeg'))

    @patch('shop.image_upload._post_to_storage')
    def test_png_and_webp_are_accepted(self, post):
        self.client.force_authenticate(user=self.admin)
        png = self.client.post(UPLOAD_URL, {'file': photo(PNG, 'a.png', 'image/png')}, format='multipart')
        webp = self.client.post(UPLOAD_URL, {'file': photo(WEBP, 'b.webp', 'image/webp')}, format='multipart')
        self.assertEqual((png.status_code, webp.status_code), (201, 201))
        self.assertTrue(png.data['url'].endswith('.png'))
        self.assertTrue(webp.data['url'].endswith('.webp'))

    @patch('shop.image_upload._post_to_storage')
    def test_uploaded_photo_becomes_a_visible_catalog_product(self, post):
        self.client.force_authenticate(user=self.admin)
        url = self.client.post(UPLOAD_URL, {'file': photo(JPEG)}, format='multipart').data['url']
        created = self.client.post('/api/admin/products/', {
            'category': self.category.pk, 'name': 'Круассан новый', 'description': '', 'image': url,
            'price': '900.00', 'weight': '90 г', 'ingredients': '', 'allergens': '',
            'is_available': True, 'is_visible': True,
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.client.force_authenticate(user=None)
        catalog = self.client.get('/api/products/').data
        self.assertIn('Круассан новый', [item['name'] for item in catalog])
        self.assertEqual(next(item for item in catalog if item['name'] == 'Круассан новый')['image'], url)


def storage_http_error(status, body):
    import io
    from urllib.error import HTTPError
    return HTTPError('https://example.supabase.co/storage', status, 'error', {}, io.BytesIO(body.encode()))


@override_settings(**STORAGE)
class StorageErrorHandlingTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='admin2@upload.test', password=PASSWORD, name='Admin', role='ADMIN')
        self.client.force_authenticate(user=self.admin)

    def test_missing_bucket_is_created_and_upload_retried(self):
        calls = []

        def fake_post(url, data, content_type, key):
            calls.append(url)
            if len(calls) == 1:
                raise storage_http_error(400, '{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}')

        with patch('shop.image_upload._post_to_storage', side_effect=fake_post), self.assertLogs('shop.image_upload', 'WARNING'):
            response = self.client.post(UPLOAD_URL, {'file': photo(JPEG)}, format='multipart')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(calls), 3)
        self.assertTrue(calls[1].endswith('/storage/v1/bucket'))
        self.assertIn('/storage/v1/object/public/product-images/products/', response.data['url'])

    def test_rejected_key_gives_a_clear_message_and_is_logged(self):
        error = storage_http_error(403, '{"statusCode":"403","error":"Unauthorized","message":"invalid signature"}')
        with patch('shop.image_upload._post_to_storage', side_effect=error), self.assertLogs('shop.image_upload', 'ERROR') as logs:
            response = self.client.post(UPLOAD_URL, {'file': photo(JPEG)}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('SUPABASE_SERVICE_ROLE_KEY', response.data['detail'])
        self.assertIn('invalid signature', '\n'.join(logs.output))
        self.assertNotIn('test-only-service-key', '\n'.join(logs.output))
