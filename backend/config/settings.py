import os
import re
import sys
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
IS_VERCEL = os.getenv('VERCEL') == '1'
# Cloud configuration must never fall back to a developer's local secrets.
if not IS_VERCEL:
    load_dotenv(BASE_DIR / '.env')
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
TESTING = 'test' in sys.argv
if DEBUG and (IS_VERCEL or os.getenv('DJANGO_ENV') == 'production'):
    raise ImproperlyConfigured('DEBUG must be false in production; unset DEBUG or set it to false.')
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'test-only-secret-key-not-for-deployment' if TESTING else '')
if not SECRET_KEY:
    raise ImproperlyConfigured('Set DJANGO_SECRET_KEY in backend/.env or the environment.')
if not DEBUG and not TESTING and (len(SECRET_KEY) < 50 or SECRET_KEY.startswith('test-only')):
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be at least 50 random characters outside DEBUG.')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver' if TESTING else 'localhost,127.0.0.1').split(',')
CSRF_TRUSTED_ORIGINS = [v for v in os.getenv('CSRF_TRUSTED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080').split(',') if v]
vercel_hosts = {}
if IS_VERCEL:
    for name in ('VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'):
        host = os.getenv(name, '').strip().lower()
        if host and len(host) <= 253 and all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in host.split('.')):
            vercel_hosts[name] = host
            if host not in ALLOWED_HOSTS:
                ALLOWED_HOSTS.append(host)
            origin = f'https://{host}'
            if origin not in CSRF_TRUSTED_ORIGINS:
                CSRF_TRUSTED_ORIGINS.append(origin)
INSTALLED_APPS = ['django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'rest_framework', 'corsheaders', 'shop']
MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware', 'django.middleware.security.SecurityMiddleware', 'shop.security.SecurityHeadersMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
# The API accepts JSON only and no file uploads; 1 MB bounds every request body (DRF honours this limit too).
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv('DATA_UPLOAD_MAX_MEMORY_SIZE', str(1024 * 1024)))
FILE_UPLOAD_MAX_MEMORY_SIZE = DATA_UPLOAD_MAX_MEMORY_SIZE
DATA_UPLOAD_MAX_NUMBER_FIELDS = 500
AUTH_USER_MODEL = 'shop.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
# Tests can run against a dedicated PostgreSQL server or database; the variable is read only under `manage.py test`.
test_database_url = os.getenv('DATABASE_URL_TEST', '') if TESTING else ''
if test_database_url and 'test' not in urlparse(test_database_url).path.lower():
    raise ImproperlyConfigured('DATABASE_URL_TEST must name a database whose name contains "test".')
database_url = test_database_url or os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL', '')
if database_url:
    db = urlparse(database_url)
    if db.scheme not in ('postgres', 'postgresql'):
        raise ImproperlyConfigured('DATABASE_URL must point to PostgreSQL.')
    query = parse_qs(db.query)
    db_options = {name: query[name][-1] for name in ('sslmode', 'channel_binding') if name in query}
    sslmode = os.getenv('POSTGRES_SSLMODE') or db_options.get('sslmode') or ('require' if IS_VERCEL else '')
    if sslmode:
        db_options['sslmode'] = sslmode
    db_options['connect_timeout'] = int(os.getenv('DATABASE_CONNECT_TIMEOUT') or query.get('connect_timeout', ['10'])[-1])
    if IS_VERCEL:
        # Supabase's transaction pooler cannot retain session prepared statements.
        db_options['prepare_threshold'] = None
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': unquote(db.path.lstrip('/')), 'USER': unquote(db.username or ''),
        'PASSWORD': unquote(db.password or ''), 'HOST': db.hostname, 'PORT': db.port or 5432,
        'CONN_MAX_AGE': int(os.getenv('DATABASE_CONN_MAX_AGE', '0' if IS_VERCEL else '60')),
        'CONN_HEALTH_CHECKS': True,
        'DISABLE_SERVER_SIDE_CURSORS': IS_VERCEL,
        'OPTIONS': db_options,
    }}
elif not IS_VERCEL and (TESTING or os.getenv('USE_SQLITE', 'false').lower() == 'true'):
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3', 'OPTIONS': {'timeout': 20}}}
else:
    raise ImproperlyConfigured('Set DATABASE_URL or POSTGRES_URL. USE_SQLITE=true is allowed only for local development.')
LANGUAGE_CODE = 'ru'
TIME_ZONE = 'Asia/Qyzylorda'
USE_I18N = True
USE_TZ = True
if IS_VERCEL:
    # Provision once with manage.py createcachetable; shared across functions.
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.db.DatabaseCache', 'LOCATION': 'anasym_cache'}}
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['shop.security.CookieSessionAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'EXCEPTION_HANDLER': 'shop.security.api_exception_handler',
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['shop.parsers.ObjectJSONParser'],
    # Global limits protect catalog and order endpoints; auth keeps its stricter scope.
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle', 'rest_framework.throttling.UserRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {'anon': '120/minute', 'user': '600/minute', 'auth': '60/hour'},
    'NUM_PROXIES': int(os.getenv('TRUSTED_PROXY_COUNT', '0')),
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
    # Pagination is opt-in per request (?page_size=N); the server caps N, so one request cannot ask for everything.
    'DEFAULT_PAGINATION_CLASS': 'shop.pagination.BoundedPageNumberPagination',
}
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_NAME = os.getenv('SESSION_COOKIE_NAME', 'sessionid')
CSRF_COOKIE_NAME = os.getenv('CSRF_COOKIE_NAME', 'csrftoken')
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
# Absolute session lifetime of 12 hours; a staff shift fits inside this window.
SESSION_COOKIE_AGE = int(os.getenv('SESSION_COOKIE_AGE', '43200'))
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'false' if DEBUG or TESTING else 'true').lower() == 'true'
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'false').lower() == 'true'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0
if os.getenv('TRUST_PROXY', 'false').lower() == 'true':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
frontend_default = f"https://{vercel_hosts['VERCEL_PROJECT_PRODUCTION_URL']}" if 'VERCEL_PROJECT_PRODUCTION_URL' in vercel_hosts else 'http://localhost:5173'
FRONTEND_URL = (os.getenv('FRONTEND_URL') or frontend_default).rstrip('/')
# Production traffic is same-origin through the proxy; cross-origin access is opt-in per origin.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [v.strip().rstrip('/') for v in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if v.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'PATCH', 'POST', 'PUT', 'OPTIONS']
CORS_ALLOW_HEADERS = ['accept', 'content-type', 'x-csrftoken']
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend' if DEBUG or TESTING else 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() == 'true'
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Anasym <noreply@example.invalid>')
PASSWORD_RESET_TIMEOUT = 3600
PASSWORD_RESET_ENABLED = os.getenv('PASSWORD_RESET_ENABLED', 'true').lower() == 'true'
DELIVERY_FEE = Decimal(os.getenv('DELIVERY_FEE', '1500.00'))
# Upper bound for one order line; the server enforces it, the client value is only a hint.
MAX_ORDER_ITEM_QUANTITY = int(os.getenv('MAX_ORDER_ITEM_QUANTITY', '200'))
# A wholesale price applies to a product only from this many units of that product in one order.
WHOLESALE_MIN_QTY = int(os.getenv('WHOLESALE_MIN_QTY', '10'))
# Hosts allowed for https photo links, comma-separated, exact names only. Empty means local photos only.
IMAGE_ALLOWED_HOSTS = [host.strip().lower() for host in os.getenv('IMAGE_ALLOWED_HOSTS', '').split(',') if host.strip()]
# Supabase Storage holds product photos uploaded from the admin panel. The service key is a secret: set it only in the environment.
SUPABASE_URL = os.getenv('SUPABASE_URL', '').rstrip('/')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
SUPABASE_STORAGE_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET', 'product-images')
DEMO_MODE = os.getenv('DEMO_MODE', 'false').lower() == 'true'
