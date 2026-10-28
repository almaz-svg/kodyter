import logging
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from .models import User
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

class PasswordResetView(PublicAuthView):
    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get('email'))
        if not settings.PASSWORD_RESET_ENABLED:
            return Response({'detail': 'Восстановление пароля временно недоступно. Обратитесь к администратору.'}, status=503)
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f'{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}'
            try:
                send_mail('Anasym — восстановление пароля', f'Для смены пароля откройте ссылку (действует 1 час):\n{link}\nЕсли вы не запрашивали смену пароля, проигнорируйте письмо.', settings.DEFAULT_FROM_EMAIL, [user.email])
            except Exception:
                logger.exception('Password reset email delivery failed')
                return Response({'detail': 'Не удалось отправить письмо. Попробуйте позже.'}, status=503)
        return Response({'detail': 'Если аккаунт с таким email существует, мы отправили ссылку для восстановления.'})

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
