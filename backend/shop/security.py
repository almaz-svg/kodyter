import ipaddress
import re
from urllib.parse import unquote, urlsplit
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import BasePermission
from .models import User

MARKUP_PATTERN = re.compile(r'[<>]')
# Images are static files: a local path under /images/ or /media/, or an https URL on an allowlisted host.
# SVG is excluded on purpose: it can carry scripts. Extensions are compared in lower case.
IMAGE_EXTENSION = r'\.(?:webp|png|jpe?g)'
LOCAL_IMAGE_PATH = re.compile(r'/(?:images|media)(?:/[A-Za-z0-9_\-]+)+' + IMAGE_EXTENSION)
REMOTE_IMAGE_PATH = re.compile(r'(?:/[A-Za-z0-9_\-]+)+' + IMAGE_EXTENSION)
HOST_NAME = re.compile(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*')
NUMERIC_HOST = re.compile(r'[0-9.]+')
# Spaces, tabs, line breaks, NUL and other control characters, and DEL.
CONTROL_OR_SPACE = re.compile(r'[\x00-\x20\x7f]')
IMAGE_MAX_LENGTH = 500
MAX_DECODE_ROUNDS = 5

def reject_markup(value):
    """Free text is rendered as plain text; markup characters are refused before storage."""
    if isinstance(value, str) and MARKUP_PATTERN.search(value):
        raise DjangoValidationError('Используйте только обычный текст, без символов < и >.')
    return value

def _unquote_fully(value):
    """Decode repeatedly so %2e%2e and %252e%252e are both seen as '..' before any check runs."""
    decoded = value
    for _ in range(MAX_DECODE_ROUNDS):
        once = unquote(decoded)
        if once == decoded:
            return decoded
        decoded = once
    raise DjangoValidationError('Ссылка на фотографию закодирована слишком сложно.')

def _lower_extension(path):
    base, dot, extension = path.rpartition('.')
    return base + dot + extension.lower() if dot else path

def _check_common(text):
    if '\\' in text or '..' in text or '%' in text or CONTROL_OR_SPACE.search(text):
        raise DjangoValidationError('Ссылка на фотографию содержит недопустимые символы.')
    lowered = text.lower()
    if 'javascript:' in lowered or 'data:' in lowered:
        raise DjangoValidationError('Ссылка на фотографию не может быть скриптом или встроенными данными.')

def _check_local(path):
    if path.startswith('//') or not LOCAL_IMAGE_PATH.fullmatch(_lower_extension(path)):
        raise DjangoValidationError('Локальная фотография должна лежать в /images/ или /media/ и быть файлом .webp, .png или .jpg.')

def _allowed_image_hosts():
    return {host.lower() for host in settings.IMAGE_ALLOWED_HOSTS}

def _check_https(text):
    parts = urlsplit(text)
    # Query and fragment are refused outright: they can hide a script extension behind '?.png'.
    if parts.scheme.lower() != 'https' or '?' in text or '#' in text or parts.query or parts.fragment:
        raise DjangoValidationError('Фотография по ссылке должна быть https-адресом без параметров.')
    netloc = parts.netloc
    # '@' is userinfo, ':' is a port, brackets are an IPv6 literal. None of them is allowed in a photo host.
    if '@' in netloc or ':' in netloc or '[' in netloc or ']' in netloc:
        raise DjangoValidationError('Адрес фотографии не может содержать логин, порт или IPv6.')
    host = netloc.lower()
    if not HOST_NAME.fullmatch(host) or NUMERIC_HOST.fullmatch(host):
        raise DjangoValidationError('Укажите доменное имя фотографии, а не IP-адрес или нестандартное имя.')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise DjangoValidationError('Укажите доменное имя фотографии, а не IP-адрес.')
    if host not in _allowed_image_hosts():
        raise DjangoValidationError('Фотографии можно брать только с разрешённых доменов.')
    if not REMOTE_IMAGE_PATH.fullmatch(_lower_extension(parts.path)):
        raise DjangoValidationError('Ссылка на фотографию должна указывать на файл .webp, .png или .jpg.')

def validate_image_reference(value):
    """Accept a local image path or an https image URL on an allowlisted host; blank means no photo.

    Encoded values are refused, and the decoded form is checked too, so a bypass shows up in both places.
    """
    if value in ('', None):
        return value
    if not isinstance(value, str) or len(value) > IMAGE_MAX_LENGTH:
        raise DjangoValidationError('Укажите путь или ссылку на фотографию длиной не более 500 символов.')
    decoded = _unquote_fully(value)
    _check_common(value)
    _check_common(decoded)
    if value.startswith('/'):
        _check_local(value)
    elif value.lower().startswith('https:'):
        _check_https(value)
    else:
        raise DjangoValidationError('Фотография должна быть путём /images/ или /media/ либо https-ссылкой на разрешённый домен.')
    return value

class SecurityHeadersMiddleware:
    """Adds headers that API responses need beyond Django's defaults."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        response.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
        if request.path.startswith('/api/'):
            # Account, order and cashier data must not be kept by browsers or shared caches.
            response.setdefault('Cache-Control', 'no-store')
        return response

def lock_active_actor(user, roles):
    """Revalidate a session under a user lock after waiting for an order lock."""
    actor = User.objects.select_for_update().filter(pk=user.pk).first()
    # A changed role must not inherit the order scope evaluated before the wait.
    if actor is None or not actor.is_active or actor.role not in roles or actor.role != user.role:
        raise AuthenticationFailed('Учётная запись заблокирована или её права изменились.')
    return actor

class CookieSessionAuthentication(SessionAuthentication):
    def authenticate_header(self, request):
        return 'Session'

    def authenticate(self, request):
        result = super().authenticate(request)
        if result and not result[0].is_active:
            raise PermissionDenied('Учётная запись заблокирована.')
        return result

class IsAdmin(BasePermission):
    message = 'Доступ разрешён только администратору.'
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and request.user.role == 'ADMIN')

class IsCourier(BasePermission):
    message = 'Доступ разрешён только активному курьеру.'
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and request.user.role == 'COURIER')

class IsCashierOrAdmin(BasePermission):
    message = 'Доступ разрешён только кассиру и администратору.'
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and request.user.role in ('CASHIER', 'ADMIN'))

def api_exception_handler(exc, context):
    from rest_framework.views import exception_handler
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, list):
        response.data = {'detail': ' '.join(str(item) for item in response.data)}
    if response is not None and isinstance(response.data, dict) and 'detail' not in response.data:
        response.data['detail'] = 'Проверьте заполненные поля.'
    return response
