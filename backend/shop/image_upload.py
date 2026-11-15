"""Product photos are stored in Supabase Storage, never on the server's disk: Vercel has no writable persistent disk."""
import json
import logging
import uuid
from urllib import error as urlerror
from urllib import request as urlrequest

from django.conf import settings


# Vercel rejects request bodies above 4.5 MB, so the photo limit stays below that including multipart overhead.
MAX_IMAGE_BYTES = 4 * 1024 * 1024
UPLOAD_TIMEOUT_SECONDS = 15
EXTENSIONS = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}
logger = logging.getLogger(__name__)


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


def _storage_error_text(error):
    """Supabase answers with JSON such as {"statusCode": "404", "error": "Bucket not found", "message": ...}."""
    try:
        body = error.read().decode('utf-8', 'replace')[:500]
    except Exception:  # noqa: BLE001 - the body is only used for diagnostics
        body = ''
    return body


def _create_public_bucket(base, key, bucket):
    """Create the photo bucket once, as public, so the returned public URLs work."""
    payload = json.dumps({'id': bucket, 'name': bucket, 'public': True}).encode()
    _post_to_storage(f'{base}/storage/v1/bucket', payload, 'application/json', key)
    logger.warning('Created missing public storage bucket %r for photo uploads.', bucket)


def _save_locally(data, extension):
    """Local development only: keep the photo inside the project so the admin form works without Supabase keys."""
    folder = settings.LOCAL_UPLOAD_DIR
    folder.mkdir(parents=True, exist_ok=True)
    name = f'{uuid.uuid4().hex}.{extension}'
    (folder / name).write_bytes(data)
    return f'/media/uploads/{name}'


def upload_product_image(data):
    """Store one photo in the public bucket and return its public URL."""
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageUploadError('Файл больше 4 МБ. Уменьшите фото или выберите другое.')
    content_type = detect_image_type(data)
    if content_type is None:
        raise ImageUploadError('Поддерживаются только JPEG, PNG и WebP.')
    try:
        base, key = _storage_base()
    except StorageNotConfigured:
        if settings.DEBUG and not getattr(settings, 'IS_VERCEL', False):
            return _save_locally(data, EXTENSIONS[content_type])
        raise
    bucket = settings.SUPABASE_STORAGE_BUCKET
    path = f'products/{uuid.uuid4().hex}.{EXTENSIONS[content_type]}'
    object_url = f'{base}/storage/v1/object/{bucket}/{path}'
    try:
        try:
            _post_to_storage(object_url, data, content_type, key)
        except urlerror.HTTPError as error:
            body = _storage_error_text(error)
            if 'bucket not found' not in body.lower():
                raise _StorageRejected(error.code, body) from error
            # The bucket was never created in this Supabase project: create it and try once more.
            _create_public_bucket(base, key, bucket)
            _post_to_storage(object_url, data, content_type, key)
    except _StorageRejected as rejected:
        logger.error('Photo storage rejected the upload: HTTP %s %s', rejected.status, rejected.body)
        if rejected.status in (401, 403) or 'signature' in rejected.body.lower() or 'jwt' in rejected.body.lower():
            raise ImageUploadError('Хранилище фото не принимает ключ доступа. Проверьте SUPABASE_SERVICE_ROLE_KEY на сервере.') from rejected
        raise ImageUploadError('Хранилище фото отклонило файл. Попробуйте ещё раз или выберите другое фото.') from rejected
    except urlerror.HTTPError as error:
        logger.error('Photo storage error: HTTP %s %s', error.code, _storage_error_text(error))
        raise ImageUploadError('Не удалось сохранить фото: хранилище ответило ошибкой. Попробуйте ещё раз.') from error
    except (urlerror.URLError, TimeoutError, OSError) as error:
        logger.error('Photo storage unreachable: %r', error)
        raise ImageUploadError('Не удалось связаться с хранилищем фото. Попробуйте ещё раз.') from error
    return f'{base}/storage/v1/object/public/{bucket}/{path}'


class _StorageRejected(Exception):
    def __init__(self, status, body):
        super().__init__(status)
        self.status = status
        self.body = body
