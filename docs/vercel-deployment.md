# Vercel + Supabase: развёртывание Anasym

Опубликованная витрина: **[https://anasym-bakery.vercel.app](https://anasym-bakery.vercel.app)**. Deployment получил статус READY; страницы и базовые API-запросы проверены. Все 27 проверок сценария заказа, доставки и учёта оплаты прошли: [отчёт публикации](vercel-verification-2026-10-16.md).

Инструкция для отдельного проекта **`anasym-bakery`** в Vercel и отдельной базы **`anasym-bakery-db`** в Supabase Free, регион Frankfurt (`fra1`). Подключение базы предназначено для окружения **Production**. Существующий проект `anashym` не является целью этих команд.

Идентификатор целевого Vercel-проекта: **`prj_CZX3wnRlI4mvwhvM99aeWzXAw0JK`**. Перед операциями с production проверяйте именно ID, а не только похожее имя.

## Устройство проекта

В настройках Vercel Root Directory — корень репозитория, Framework Preset — Other (`framework: null`). `npm ci --prefix frontend` устанавливает зависимости; `npm run build --prefix frontend` собирает React в `frontend/dist`. Python-функция `api/index.py` импортирует Django из `backend`.

`vercel.json` сначала направляет `/api/*` в эту функцию, затем обслуживает статические файлы и остальные страницы через `index.html`. Страницы и API работают на одном HTTPS-origin: браузеру не нужен отдельный адрес сервера или CORS. Сессии хранятся в PostgreSQL, cookie защищены флагами HttpOnly/Secure; изменения требуют CSRF-токена.

Python зафиксирован в `.python-version` как 3.12. Корневой `requirements.txt` содержит **все пины напрямую**: при изменении зависимостей синхронизируйте его с `backend/requirements.txt`. В данном развёртывании ссылка `-r backend/requirements.txt` не прошла обнаружение зависимостей Vercel.

Изображения и шрифты входят в `frontend/public` и сборку. Runtime не сохраняет загрузки на локальный диск. Миграции и наполнение не запускаются в build или при старте функции.

## Переменные окружения

Настройки задаются в Vercel для Production. Секретные значения не записываются в этот документ, исходный код, вывод команд или параметры frontend `VITE_*`.

| Переменная | Значение / назначение |
|---|---|
| `DJANGO_SECRET_KEY` | Отдельный случайный секрет этой среды, хранить как секрет Vercel |
| `POSTGRES_URL` | Секретный URL новой Supabase-базы из подключённой интеграции |
| `DATABASE_URL` | Необязательный явный URL; если непустой, имеет приоритет над `POSTGRES_URL` |
| `DEBUG` | `false` |
| `USE_SQLITE` | `false`; на Vercel fallback на SQLite запрещён |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `true` |
| `TRUSTED_PROXY_COUNT` | `1` |
| `SECURE_SSL_REDIRECT` | `true` |
| `SECURE_HSTS_SECONDS` | `3600` |
| `DEMO_MODE` | **`true`**, пока наполнение демонстрационное |
| `DELIVERY_FEE` | `1500.00` |
| `PASSWORD_RESET_ENABLED` | **`false` до подключения и проверки SMTP** |
| `DATABASE_CONN_MAX_AGE` | `0` |
| `DATABASE_CONNECT_TIMEOUT` | `10` — значение по умолчанию |
| `POSTGRES_SSLMODE` | `require` |
| `ALLOWED_HOSTS` | При собственном домене — точное имя, без схемы и пути |
| `CSRF_TRUSTED_ORIGINS` | При собственном домене — его точный HTTPS-origin |
| `FRONTEND_URL` | Необязательный явный HTTPS-адрес витрины; имеет приоритет над платформенным значением |

Vercel предоставляет `VERCEL=1`, `VERCEL_URL` и `VERCEL_PROJECT_PRODUCTION_URL`. Сервер принимает только валидные точные hostnames из этих платформенных переменных и добавляет соответствующие HTTPS-origins в CSRF. Маски `*.vercel.app` не используются. При отсутствии явного `FRONTEND_URL` используется `https://VERCEL_PROJECT_PRODUCTION_URL`.

Для Supabase transaction pooler в Vercel отключены prepared statements и серверные курсоры. Поддерживаются URL-параметры `sslmode`, `channel_binding`, `connect_timeout`; явные настройки SSL/timeout имеют приоритет. Соединение закрывается после запроса, включены проверки его состояния.

Общий cache для ограничения частоты входа хранится в таблице `anasym_cache`, поэтому её нужно создать до первого запроса авторизации.

При выключенном восстановлении валидный запрос получает одинаковый 503 с понятным сообщением до поиска аккаунта. Сайт не сообщает об отправке несуществующего письма. Для включения нужны SMTP-настройки `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` и проверка доставки/сбоев. Само переключение флага не устраняет ранее отмеченное различие ответов при сбое SMTP; перед включением нужно устранить и проверить этот сценарий.

## Подготовка базы и защита доступа

Подключайтесь только к новой базе `anasym-bakery-db`. Перед обновлением существующих данных сделайте резервную копию. Правильный порядок:

1. Применить Django-миграции.
2. Создать `anasym_cache` командой `createcachetable`.
3. Выполнить `scripts/protect-supabase.sql`.
4. Только для первоначальной демонстрационной среды выполнить `seed_demo`.

SQL включает RLS и отзывает права `anon`/`authenticated` на таблицы приложения в `public`: `shop_*`, `auth_*`, `django_*`, `anasym_cache`. Схема Supabase `auth` не изменяется. Авторизацию выполняет Django; его серверное соединение владельца таблиц сохраняет доступ. Клиентские Supabase API-ключи не нужны.

**Повторяйте защитный SQL после каждых миграций, создающих таблицы.** Скрипт не меняет default privileges: новая таблица может снова получить стандартные grants Supabase. Аналогично повторите защиту после восстановления резервной копии. Проверяйте RLS и отсутствие SELECT у `anon` и `authenticated`, затем работоспособность Django. [Официальная документация о grants и RLS](https://supabase.com/docs/guides/api/securing-your-api).

Команды ниже предназначены для локальной машины оператора с установленными backend-зависимостями. После привязки CLI к проекту определите проверку в текущей PowerShell-сессии и получите production env в приватный файл:

```powershell
function Assert-AnasymVercelProject {
    $linkFile = Join-Path $PWD '.vercel/project.json'
    if (-not (Test-Path -LiteralPath $linkFile)) { throw 'Сначала привяжите правильный Vercel-проект.' }
    $linkedProject = Get-Content -LiteralPath $linkFile -Raw | ConvertFrom-Json
    if ($linkedProject.projectId -cne 'prj_CZX3wnRlI4mvwhvM99aeWzXAw0JK') {
        throw 'Операция остановлена: выбран другой Vercel-проект.'
    }
}
Assert-AnasymVercelProject
vercel env pull .secrets/vercel-production.env --environment=production
if ($LASTEXITCODE -ne 0) { throw 'Не удалось получить production env.' }
```

**Переменные Vercel типа Sensitive не выдаются через `env pull`.** Поэтому дополнительно необходим сохранённый приватный файл `.secrets/vercel-app.env` с разрешёнными настройками приложения, включая исходный `DJANGO_SECRET_KEY`. Он создаётся при первоначальной настройке; не заменяйте секрет новым случайным значением для обычного обновления. Если приватная копия потеряна, остановитесь и восстановите её из защищённого хранилища. `vercel-production.env` содержит доступные для pull значения интеграции, в том числе подключение БД; `vercel-app.env` дополняет и переопределяет их.

Не печатайте оба файла и не добавляйте их в Git. Пример проверяет ID проекта, наличие секрета/БД и обязательные флаги без вывода значений, затем загружает только перечисленные настройки. Локальный `backend/.env` не используется:

```powershell
@'
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlparse
from dotenv import dotenv_values

root = Path.cwd()
project = json.loads((root / '.vercel/project.json').read_text(encoding='utf-8-sig'))
if project.get('projectId') != 'prj_CZX3wnRlI4mvwhvM99aeWzXAw0JK':
    raise SystemExit('Операция остановлена: выбран другой Vercel-проект.')
private_file = root / '.secrets/vercel-app.env'
if not private_file.is_file():
    raise SystemExit('Нет сохранённого приватного vercel-app.env; Sensitive-секреты не восстанавливаются через env pull.')
allowed = {
    'DJANGO_SECRET_KEY', 'DATABASE_URL', 'POSTGRES_URL', 'DEBUG', 'USE_SQLITE',
    'COOKIE_SECURE', 'TRUST_PROXY', 'TRUSTED_PROXY_COUNT', 'SECURE_SSL_REDIRECT',
    'SECURE_HSTS_SECONDS', 'DEMO_MODE', 'DELIVERY_FEE', 'PASSWORD_RESET_ENABLED',
    'DATABASE_CONN_MAX_AGE', 'DATABASE_CONNECT_TIMEOUT', 'POSTGRES_SSLMODE',
    'ALLOWED_HOSTS', 'CSRF_TRUSTED_ORIGINS', 'FRONTEND_URL',
    'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL',
}
combined = {
    **dotenv_values(root / '.secrets/vercel-production.env'),
    **dotenv_values(private_file),
}
values = {key: value for key, value in combined.items() if key in allowed and value is not None}
if not values.get('DJANGO_SECRET_KEY'):
    raise SystemExit('Отсутствует DJANGO_SECRET_KEY; значения не выводятся.')
database_url = values.get('DATABASE_URL') or values.get('POSTGRES_URL')
if not database_url:
    raise SystemExit('Отсутствует подключение PostgreSQL; значения не выводятся.')
database = urlparse(database_url)
if database.scheme not in ('postgres', 'postgresql') or not database.hostname:
    raise SystemExit('Некорректные параметры подключения PostgreSQL; значения не выводятся.')
required_flags = {'DEBUG': 'false', 'USE_SQLITE': 'false', 'COOKIE_SECURE': 'true',
                  'TRUST_PROXY': 'true', 'SECURE_SSL_REDIRECT': 'true',
                  'DEMO_MODE': 'true', 'PASSWORD_RESET_ENABLED': 'false',
                  'POSTGRES_SSLMODE': 'require'}
for name, expected in required_flags.items():
    if values.get(name, '').lower() != expected:
        raise SystemExit(f'Проверьте обязательную настройку {name}; значение не выводится.')
for name in allowed:
    os.environ.pop(name, None)
os.environ.update(values)
os.environ['VERCEL'] = '1'
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
os.environ['DEMO_ACCOUNTS_FILE'] = str(root / '.secrets/vercel-demo-accounts.txt')

def manage(*args):
    subprocess.run([sys.executable, str(root / 'backend/manage.py'), *args], check=True)

manage('migrate', '--noinput')
manage('createcachetable')
sys.path.insert(0, str(root / 'backend'))
import django
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute((root / 'scripts/protect-supabase.sql').read_text(encoding='utf-8'))
connection.close()

# Только при первом наполнении новой демонстрационной базы:
# manage('seed_demo')
'@ | ./backend/.venv/Scripts/python.exe -
```

`seed_demo` создаёт четыре роли и каталог. Новые случайные пароли записываются только в `.secrets/vercel-demo-accounts.txt`; повторный вызов не сбрасывает пароли. Доступы облачной и локальной среды отдельные. Не переносите тестовые заказы из локальной базы автоматически.

## Публикация и обновление через CLI

Установите поддерживаемую Node.js и Vercel CLI. При обновлении CLI сначала выполните `npm install --global vercel@latest`, затем `vercel --version` и зафиксируйте использованную версию в отчёте запуска. Если PowerShell блокирует оболочку `npm`, используйте вызов npm CLI через `node`, приведённый в README.

Из корня проекта:

```powershell
vercel login
vercel link --project anasym-bakery
```

Проверьте выбранный аккаунт/команду и ID проекта в `.vercel/project.json`, вызвав `Assert-AnasymVercelProject` из примера выше. Не выбирайте `anashym`. Проверьте Root Directory, production env, сделайте копию базы и выполните последовательность миграций/защиты выше.

Затем выполните локальную сборку и проверки. Backend unit-тесты ниже явно изолированы от cloud: PostgreSQL URL сбрасываются, чтение dotenv отключено, SQLite разрешён только в этой локальной тестовой оболочке. Они не заменяют проверку PostgreSQL-транзакций:

```powershell
npm --prefix frontend test
npm --prefix frontend run build
$unitEnvNames = @('DATABASE_URL', 'POSTGRES_URL', 'VERCEL', 'USE_SQLITE', 'PYTHON_DOTENV_DISABLED', 'DJANGO_SECRET_KEY')
$previousUnitEnv = @{}
foreach ($name in $unitEnvNames) { $previousUnitEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:DATABASE_URL = $null
    $env:POSTGRES_URL = $null
    $env:VERCEL = '0'
    $env:USE_SQLITE = 'true'
    $env:PYTHON_DOTENV_DISABLED = '1'
    $env:DJANGO_SECRET_KEY = 'local-unit-test-only-not-for-deployment'
    ./backend/.venv/Scripts/python.exe -m unittest discover -s backend/config -p test_deployment.py
    if ($LASTEXITCODE -ne 0) { throw 'Deployment unit tests failed' }
    ./backend/.venv/Scripts/python.exe backend/manage.py test shop.test_password_reset_availability --noinput
    if ($LASTEXITCODE -ne 0) { throw 'Password reset unit tests failed' }
} finally {
    foreach ($name in $unitEnvNames) { [Environment]::SetEnvironmentVariable($name, $previousUnitEnv[$name], 'Process') }
}
```

После успешных проверок опубликуйте:

```powershell
Assert-AnasymVercelProject
vercel --prod
```

Последняя команда публикует сайт. Успешный upload или сборка ещё не подтверждает основной сценарий. Проверьте по выданному HTTPS-адресу: главную, прямой переход `/catalog` и `/cashier`, изображения, `/api/health/`, вход четырёх ролей, checkout/idempotency, общую очередь курьеров, доставку и учёт оплаты. При ошибке базы или API сайт не считается прошедшим проверку.

Production env не подключается к Preview автоматически. Если потребуется preview-среда, используйте отдельную тестовую базу и явно настройте её; не запускайте тестовые миграции или `manage.py test` на production-подключении.

`.vercelignore` исключает `.env*`, `.secrets/` на любом уровне, локальные базы, дампы, логи, зависимости и кэши. В том числе приватные вспомогательные `.secrets/configure-vercel.py` и файлы доступов не должны входить в upload. Секреты задаются в настройках Vercel, а не в сборке React.

## Резервные копии

Docker-скрипт `scripts/backup.ps1` копирует только Docker-базу. Для Supabase используйте собственный `pg_dump` с версией не ниже основной версии сервера; подключение для обслуживания берите из Supabase Dashboard (direct или session pooler), без публикации пароля в аргументах/логах. Передайте `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE=require` через приватное окружение процесса.

После загрузки этих переменных можно выполнить:

```powershell
Assert-AnasymVercelProject
New-Item -ItemType Directory -Force -Path backups | Out-Null
$backupFile = Join-Path $PWD ('backups/vercel-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
pg_dump --format=custom --no-owner --no-acl --schema=public --file=$backupFile
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
Get-FileHash -LiteralPath $backupFile -Algorithm SHA256
```

Этот дамп сохраняет Django-данные из `public`, а не внутренние сервисные схемы Supabase. Храните его отдельно от компьютера/сервиса, с ограниченным доступом; отдельно сохраните секреты и версию исходного кода. Наличие Free-проекта не заменяет собственную проверяемую процедуру копирования.

Восстанавливайте сначала в отдельную проверочную базу с `pg_restore --no-owner --no-acl --exit-on-error --single-transaction --dbname=<проверочная-база> <дамп>`. Параметры подключения и пароль передавайте через приватное окружение. Для Supabase после восстановления повторите `protect-supabase.sql`, проверьте вход, существующие заказы и права ролей. Возврат основной базы требует остановки записи и свежей копии; не выполняйте `--clean` против рабочего проекта для обычной проверки. Эта инструкция сама по себе не подтверждает проведённое cloud-восстановление.
