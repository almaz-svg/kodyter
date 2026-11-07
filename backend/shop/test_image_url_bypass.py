from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from .models import Category, Product, User
from .security import validate_image_reference

ALLOWED = ['cdn.example.test']


class ImageReferenceAcceptanceTests(SimpleTestCase):
    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_local_paths_and_allowlisted_https_urls_are_accepted(self):
        accepted = [
            '/images/catalog/card-01.webp',
            '/media/products/cake-2.png',
            'https://cdn.example.test/products/cake.webp',
            # Extension and host are case-insensitive after normalisation.
            'https://cdn.example.test/products/CAKE.WEBP',
            'https://CDN.example.test/products/cake.png',
            '',
        ]
        for value in accepted:
            with self.subTest(value=value):
                self.assertEqual(validate_image_reference(value), value)


class ImageReferenceBypassTests(SimpleTestCase):
    def assertRejected(self, value):
        with self.assertRaises(DjangoValidationError, msg=repr(value)):
            validate_image_reference(value)

    # --- 1. the host allowlist ---

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_host_outside_allowlist_is_refused(self):
        for value in [
            'https://evil.example.test/a.webp',
            'https://cdn.example.test.evil.example.test/a.webp',   # suffix trick
            'https://evil-cdn.example.test/a.webp',                # prefix trick
            'https://cdn.example.test./a.webp',                    # trailing dot is a different name
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=[])
    def test_empty_allowlist_refuses_every_https_url(self):
        self.assertRejected('https://cdn.example.test/a.webp')
        self.assertEqual(validate_image_reference('/images/a.webp'), '/images/a.webp')

    @override_settings(IMAGE_ALLOWED_HOSTS=['203.0.113.5', '[2001:db8::1]'])
    def test_ip_addresses_are_refused_even_when_listed(self):
        for value in ['https://203.0.113.5/a.webp', 'https://[2001:db8::1]/a.webp']:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_non_ascii_host_is_refused(self):
        self.assertRejected('https://cdn.exаmple.test/a.webp')  # Cyrillic а

    # --- 2. normalisation: encoding, case, query, fragment, delimiters ---

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_percent_encoded_traversal_is_refused(self):
        for value in [
            '/images/%2e%2e/etc/passwd.webp',
            'https://cdn.example.test/%2e%2e/a.webp',
            'https://cdn.example.test/a%2F..%2Fb.webp',
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_double_encoded_traversal_is_refused(self):
        for value in [
            '/images/%252e%252e/etc/passwd.webp',
            'https://cdn.example.test/%252e%252e/a.webp',
            'https://cdn.example.test/a%252F..%252Fb.webp',
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_percent_encoded_userinfo_is_refused(self):
        self.assertRejected('https://cdn.example.test%40evil.example.test/a.webp')

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_query_string_cannot_hide_a_script_extension(self):
        for value in [
            'https://cdn.example.test/a.php?f=.png',
            'https://cdn.example.test/a.webp?x=1',
            'https://cdn.example.test/a.php?.webp',
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_fragment_cannot_hide_a_script_extension(self):
        for value in [
            'https://cdn.example.test/a.php#.png',
            'https://cdn.example.test/a.webp#x',
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_extension_must_be_last_and_unique(self):
        for value in [
            'https://cdn.example.test/a.php.png',
            'https://cdn.example.test/a.webp.php',
            'https://cdn.example.test/a.webp;.php',
            'https://cdn.example.test/.webp',
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_backslashes_are_refused(self):
        for value in [
            'https://cdn.example.test\\@evil.example.test/a.webp',
            'https://cdn.example.test/a\\..\\b.webp',
            '/images\\a.webp',
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_double_slashes_are_refused(self):
        for value in [
            'https://cdn.example.test//a.webp',
            'https://cdn.example.test/a//b.webp',
            '//evil.example.test/a.webp',      # protocol-relative
            '/images//a.webp',
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_userinfo_is_refused(self):
        self.assertRejected('https://cdn.example.test@evil.example.test/a.webp')
        self.assertRejected('https://user:secret@cdn.example.test/a.webp')

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_explicit_port_is_refused(self):
        self.assertRejected('https://cdn.example.test:8443/a.webp')

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_data_and_javascript_schemes_are_refused(self):
        for value in [
            'data:image/png;base64,iVBORw0KGgo=',
            'DATA:image/png;base64,iVBORw0KGgo=',
            'javascript:alert(1)',
            'JaVaScRiPt:alert(1)',
            'https://cdn.example.test/x.webp?javascript:alert(1)',
        ]:
            with self.subTest(value=value):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_plain_http_and_svg_are_refused(self):
        self.assertRejected('http://cdn.example.test/a.webp')
        self.assertRejected('https://cdn.example.test/a.svg')
        self.assertRejected('/media/bun.svg')

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_whitespace_and_control_characters_are_refused(self):
        for value in [
            'https://cdn.example.test/a.webp\n',
            'https://cdn.example.test/a\t.webp',
            ' /images/a.webp',
            '/images/a.webp\x00',
        ]:
            with self.subTest(value=repr(value)):
                self.assertRejected(value)

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_local_paths_cannot_be_percent_encoded(self):
        self.assertRejected('/images/a%20b.webp')
        self.assertRejected('/images/%2e%2e/a.webp')


class ImageUrlApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='admin@images.test', password='Staff-password-123!', name='Admin', role='ADMIN')
        self.category = Category.objects.create(name='Bakery', slug='bakery')
        self.api = APIClient()
        self.api.force_login(self.admin)

    def create_product(self, image):
        return self.api.post('/api/admin/products/', {'category': self.category.pk, 'name': 'Bun', 'price': '300.00', 'image': image}, format='json')

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_photo_from_unlisted_host_is_refused_by_the_api(self):
        response = self.create_product('https://evil.example.test/a.webp')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Product.objects.filter(name='Bun').exists())

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_photo_from_listed_host_is_stored(self):
        response = self.create_product('https://cdn.example.test/products/bun.webp')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Product.objects.get(name='Bun').image, 'https://cdn.example.test/products/bun.webp')

    @override_settings(IMAGE_ALLOWED_HOSTS=ALLOWED)
    def test_encoded_photo_reference_is_refused_by_the_api(self):
        response = self.create_product('https://cdn.example.test/%2e%2e/bun.webp')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Product.objects.filter(name='Bun').exists())
