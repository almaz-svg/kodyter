import re
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import BasePermission
from .models import User

MARKUP_PATTERN = re.compile(r'[<>]')
# Catalog images are static files under /images/ or /media/ (or an https URL).
# SVG is excluded on purpose: it can carry scripts.
IMAGE_PATH_PATTERN = re.compile(r'/(images|media)/[A-Za-z0-9_\-/]+\.(webp|png|jpe?g)')
IMAGE_URL_PATTERN = re.compile(r'https://[A-Za-z0-9.\-]+(/[A-Za-z0-9_\-./%]*)?\.(webp|png|jpe?g)')
IMAGE_MAX_LENGTH = 500

def reject_markup(value):
    """Free text is rendered as plain text; markup characters are refused before storage."""
    if isinstance(value, str) and MARKUP_PATTERN.search(value):
        raise DjangoValidationError('Используйте только обычный текст, без символов < и >.')
    return value

def validate_image_reference(value):
    """Accept only an image path or image URL; blank means no photo."""
    if value in ('', None):
        return value
    if len(value) > IMAGE_MAX_LENGTH or '..' in value:
        raise DjangoValidationError('Укажите путь к фотографии длиной не более 500 символов, без "..".')
    if not (IMAGE_PATH_PATTERN.fullmatch(value) or IMAGE_URL_PATTERN.fullmatch(value)):
        raise DjangoValidationError('Фотография должна быть файлом .webp, .png или .jpg из /images/ или /media/.')
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
