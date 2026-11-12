"""Product photos are stored in Supabase Storage, never on the server's disk: Vercel has no writable persistent disk."""
import uuid
from urllib import error as urlerror
from urllib import request as urlrequest

from django.conf import settings


# Vercel rejects request bodies above 4.5 MB, so the photo limit stays below that including multipart overhead.
MAX_IMAGE_BYTES = 4 * 1024 * 1024
UPLOAD_TIMEOUT_SECONDS = 15
EXTENSIONS = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}


class ImageUploadError(Exception):
    """The file is not an acceptable photo; the message is safe to show to the administrator."""


class StorageNotConfigured(Exception):
    """SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing on this deployment."""


def detect_image_type(data):
    """Check the file signature, not the name or the browser's claim: an SVG or text renamed to .jpg is refused."""
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if len(data) >= 12 and data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    return None


def _storage_base():
    base = (settings.SUPABASE_URL or '').rstrip('/')
    key = settings.SUPABASE_SERVICE_ROLE_KEY or ''
    if not base or not key:
        raise StorageNotConfigured
    return base, key


def _post_to_storage(url, data, content_type, key):
    request = urlrequest.Request(url, data=data, method='POST', headers={
        'Authorization': f'Bearer {key}',
        'apikey': key,
        'Content-Type': content_type,
        'x-upsert': 'false',
    })
    with urlrequest.urlopen(request, timeout=UPLOAD_TIMEOUT_SECONDS) as response:
        response.read()


def upload_product_image(data):
    """Store one photo in the public bucket and return its public URL."""
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageUploadError('Файл больше 4 МБ. Уменьшите фото или выберите другое.')
    content_type = detect_image_type(data)
    if content_type is None:
        raise ImageUploadError('Поддерживаются только JPEG, PNG и WebP.')
    base, key = _storage_base()
    bucket = settings.SUPABASE_STORAGE_BUCKET
    path = f'products/{uuid.uuid4().hex}.{EXTENSIONS[content_type]}'
    try:
        _post_to_storage(f'{base}/storage/v1/object/{bucket}/{path}', data, content_type, key)
    except (urlerror.URLError, TimeoutError, OSError) as error:
        raise ImageUploadError('Не удалось сохранить фото. Попробуйте ещё раз.') from error
    return f'{base}/storage/v1/object/public/{bucket}/{path}'
