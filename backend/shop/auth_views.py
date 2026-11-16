import hashlib
import hmac
import logging
import secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.utils.html import escape
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from .models import PasswordResetCode, User
from .serializers import RegisterSerializer, UserSerializer

logger = logging.getLogger(__name__)

class AuthThrottle(SimpleRateThrottle):
    scope = 'auth'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}

class PublicAuthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # SessionAuthentication skips anonymous CSRF: login/register/reset need it too.
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            SessionAuthentication().enforce_csrf(request)

class CsrfView(PublicAuthView):
    throttle_classes = []

    def get(self, request):
        return Response({'csrfToken': get_token(request)})

class RegisterView(PublicAuthView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.create_user(**serializer.validated_data, role='CUSTOMER')
        except IntegrityError:
            raise serializers.ValidationError({'email': 'Этот email уже зарегистрирован.'})
        login(request, user)
        return Response(UserSerializer(user).data, status=201)

class LoginView(PublicAuthView):
    def post(self, request):
        email = request.data.get('email', '')
        password = request.data.get('password', '')
        if not isinstance(email, str) or not isinstance(password, str):
            raise serializers.ValidationError('Введите email и пароль.')
        user = authenticate(request, email=email.strip().lower(), password=password)
        if user is None:
            raise AuthenticationFailed('Неверный email или пароль либо аккаунт заблокирован.')
        login(request, user)
        return Response(UserSerializer(user).data)

class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'detail': 'Вы вышли из аккаунта.'})

class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

class ProfileView(APIView):
    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

RESET_CODE_LIFETIME = timedelta(minutes=15)
RESET_CODE_RESEND_AFTER = timedelta(seconds=60)
RESET_CODES_PER_HOUR = 5
RESET_CODE_ATTEMPTS = 5
RESET_CODE_ERROR = 'Неверный код или срок его действия истёк. Запросите новый код.'

def reset_code_hash(user, code):
    # Keyed with SECRET_KEY: a leaked table does not reveal codes, and six digits cannot be brute-forced offline.
    return hmac.new(settings.SECRET_KEY.encode(), f'{user.pk}:{code}'.encode(), hashlib.sha256).hexdigest()

class PasswordResetView(PublicAuthView):
    """Email a six-digit code. The answer is the same whether or not the address has an account."""
    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get('email'))
        if not settings.PASSWORD_RESET_ENABLED:
            return Response({'detail': 'Восстановление пароля временно недоступно. Обратитесь к администратору.'}, status=503)
        sent = Response({'detail': 'Если аккаунт с такой почтой существует, мы отправили на неё код.', 'resend_after': int(RESET_CODE_RESEND_AFTER.total_seconds())})
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return sent
        now = timezone.now()
        recent = PasswordResetCode.objects.filter(user=user, created_at__gte=now - timedelta(hours=1))
        # A fresh code is not re-sent within a minute, and at most a few codes go out per hour.
        if recent.filter(created_at__gte=now - RESET_CODE_RESEND_AFTER).exists() or recent.count() >= RESET_CODES_PER_HOUR:
            return sent
        code = f'{secrets.randbelow(1_000_000):06d}'
        with transaction.atomic():
            PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(used_at=now)  # only the newest code works
            entry = PasswordResetCode.objects.create(user=user, code_hash=reset_code_hash(user, code), expires_at=now + RESET_CODE_LIFETIME)
        minutes = int(RESET_CODE_LIFETIME.total_seconds() // 60)
        text = (f'Здравствуйте, {user.name}!\n\nВаш код для восстановления пароля: {code}\n\n'
                f'Код действует {minutes} минут. Введите его на странице «Восстановить доступ».\n'
                'Никому не сообщайте этот код. Если вы не запрашивали смену пароля, просто проигнорируйте письмо.\n\nAnasym')
        html = (f'<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#07382c">'
                f'<h2 style="margin:0 0 12px">Восстановление пароля</h2><p>Здравствуйте, {escape(user.name)}!</p>'
                f'<p>Ваш код для восстановления пароля:</p>'
                f'<p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f6f1e7;padding:16px;text-align:center;border-radius:10px">{code}</p>'
                f'<p>Код действует {minutes} минут. Никому не сообщайте его.</p>'
                '<p style="color:#737c70;font-size:13px">Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.</p><p>Anasym</p></div>')
        try:
            send_mail('Anasym — код для восстановления пароля', text, settings.DEFAULT_FROM_EMAIL, [user.email], html_message=html)
        except Exception:
            logger.exception('Password reset email delivery failed')
            entry.delete()  # a code nobody received must not block the next request
            return Response({'detail': 'Не удалось отправить письмо. Попробуйте позже.'}, status=503)
        return sent

class PasswordResetCodeView(PublicAuthView):
    """Check the emailed code and set the new password. A code allows a few wrong tries, then a new one is needed."""
    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get('email'))
        code = serializers.RegexField(r'^\d{6}$', error_messages={'invalid': 'Введите 6 цифр из письма.'}).run_validation(str(request.data.get('code', '')).strip())
        password = serializers.CharField(max_length=128, trim_whitespace=False).run_validation(request.data.get('password'))
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            raise serializers.ValidationError({'detail': RESET_CODE_ERROR})
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        # The outcome is decided inside the transaction and reported after it, so a wrong try is always counted.
        with transaction.atomic():
            entry = PasswordResetCode.objects.select_for_update().filter(user=user, used_at__isnull=True, expires_at__gt=timezone.now()).first()
            if entry is None or entry.attempts >= RESET_CODE_ATTEMPTS:
                outcome = 'expired'
            elif not hmac.compare_digest(entry.code_hash, reset_code_hash(user, code)):
                entry.attempts += 1
                entry.save(update_fields=['attempts'])
                outcome = 'wrong'
            else:
                entry.used_at = timezone.now()
                entry.save(update_fields=['used_at'])
                locked = User.objects.select_for_update().get(pk=user.pk)
                locked.set_password(password)  # also ends the account's other sessions
                locked.save(update_fields=['password'])
                outcome = 'done'
        if outcome == 'wrong':
            left = RESET_CODE_ATTEMPTS - entry.attempts
            raise serializers.ValidationError({'detail': f'Неверный код. Осталось попыток: {left}.' if left else RESET_CODE_ERROR})
        if outcome == 'expired':
            raise serializers.ValidationError({'detail': RESET_CODE_ERROR})
        return Response({'detail': 'Пароль изменён. Войдите с новым паролем.'})

class PasswordResetConfirmView(PublicAuthView):
    @transaction.atomic
    def post(self, request):
        try:
            user_id = force_str(urlsafe_base64_decode(str(request.data.get('uid', ''))))
            user = User.objects.select_for_update().get(pk=user_id, is_active=True)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist, UnicodeError):
            raise serializers.ValidationError({'detail': 'Ссылка недействительна или устарела.'})
        token = serializers.CharField(max_length=128).run_validation(request.data.get('token'))
        if not default_token_generator.check_token(user, token):
            raise serializers.ValidationError({'detail': 'Ссылка недействительна или устарела.'})
        password = serializers.CharField(max_length=128, trim_whitespace=False).run_validation(request.data.get('password'))
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Пароль изменён. Войдите с новым паролем.'})
