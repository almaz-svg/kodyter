from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import BasePermission
from .models import User

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
