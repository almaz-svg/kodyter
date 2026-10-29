# Anasym — кондитерская

Интернет-магазин кондитерской с личным кабинетом и рабочими местами для персонала.

- Витрина: [anasym-bakery.vercel.app](https://anasym-bakery.vercel.app)
- Стек: React + TypeScript (Vite), Django REST Framework, PostgreSQL (SQLite для локальной разработки)
- Интерфейс на русском, цены в тенге (KZT)

Товары, цены, составы, контакты и учётные записи в начальном наполнении демонстрационные.

## Возможности

- **Покупатель:** регистрация и вход, корзина, оформление заказа с оплатой при получении, история заказов.
- **Администратор** (`/admin`): каталог и категории, очередь заказов с фильтрами, смена статусов, назначение курьеров.
- **Курьер** (`/courier`): общая очередь свободных заказов, принятие заказа, свои доставки, сообщения о проблемах.
- **Кассир** (`/cashier`): все заказы, состояние оплаты, учёт наличных после доставки.

Права проверяются на стороне API. Сессия хранится в HttpOnly cookie, изменение данных требует CSRF-токен. Онлайн-оплата не подключена.

## Структура

```
backend/     Django-приложение (API, модели, миграции, тесты)
frontend/    React-приложение (Vite)
deploy/      Nginx и Caddy для развёртывания с HTTPS
scripts/     Скрипты запуска, остановки, настройки и резервного копирования (PowerShell)
docs/        Документация: API, администратор, развёртывание, отчёты
```

## Быстрый старт (Windows, локально)

Нужны Python 3.12+ и Node.js 22.

```powershell
# 1. Зависимости бэкенда
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# 2. Зависимости фронтенда
npm --prefix frontend ci

# 3. Настройки
Copy-Item backend/.env.example backend/.env
# Заполните в backend/.env как минимум DJANGO_SECRET_KEY.

# 4. Запуск с SQLite и демонстрационными данными
./scripts/launch.ps1 -UseSqlite -SeedDemo
```

После запуска откройте [http://127.0.0.1:5173](http://127.0.0.1:5173). Проверка API: `http://127.0.0.1:5173/api/health/`.

Остановка: `./scripts/stop.ps1`.

### Параметры `launch.ps1`

| Параметр | Назначение |
| --- | --- |
| `-UseSqlite` | Локальная база `backend/db.sqlite3`. Без него нужен `DATABASE_URL` в `backend/.env` (PostgreSQL). |
| `-SeedDemo` | Заполнить демонстрационными данными. Существующие пароли не меняются. |
| `-BackendPort`, `-FrontendPort` | Порты, по умолчанию 8000 и 5173. Нужны, если порты заняты. |
| `-PythonExecutable`, `-NodeExecutable`, `-PostgresBin` | Пути к интерпретаторам и PostgreSQL, если они не в PATH. |

Скрипт выполняет миграции, запускает процессы в фоне и пишет журналы в `.secrets/logs`. Режим `-UseSqlite` не переписывает `backend/.env`.

### Локально с PostgreSQL

Укажите `DATABASE_URL` в `backend/.env` (спецсимволы в пароле — в URL-кодировке), затем запустите `./scripts/launch.ps1 -SeedDemo`. Если PostgreSQL установлен не в `C:/Program Files/PostgreSQL/18/bin`, передайте `-PostgresBin`.

Тестам нужно право CREATEDB у пользователя базы.

## Запуск в Docker

Нужны Docker Desktop (Linux engine) с Compose v2.

```powershell
./scripts/setup-env.ps1
docker compose up -d --build
docker compose exec --user root backend python manage.py seed_demo
```

Откройте [http://localhost:8080](http://localhost:8080). Проверка API: `http://localhost:8080/api/health/`.

- Случайные пароли демо-ролей записываются в `.secrets/demo-accounts.txt`. Файл не попадает в Git.
- `seed_demo` не запускается автоматически при старте; повторный запуск не меняет существующие пароли.
- Данные PostgreSQL хранятся в томе `postgres_data`. `docker compose down` их сохраняет, `down -v` удаляет.
- Порт 8080 привязан к loopback. Браузер обращается к API через Nginx.

## Настройки

Основные переменные в `backend/.env` (полный список — в `backend/.env.example`):

| Переменная | Описание |
| --- | --- |
| `DJANGO_SECRET_KEY` | Секретный ключ Django. Обязателен. |
| `DEBUG` | `true` только для разработки. |
| `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | Домены и origin'ы, с которых открывается сайт. |
| `DATABASE_URL` | Подключение к PostgreSQL. Если пусто, нужен `-UseSqlite`. |
| `FRONTEND_URL` | Адрес фронтенда; используется в ссылках (например, восстановления пароля). |
| `DELIVERY_FEE` | Стоимость доставки. |
| `DEMO_MODE` | Демо-маркировка интерфейса. Сам по себе не меняет содержимое базы. |
| `PASSWORD_RESET_ENABLED` | Восстановление пароля. Включайте только с настроенной почтой. |
| `EMAIL_BACKEND` и `EMAIL_*` | Почта. Консольный backend подходит только для разработки. |

## Тесты и проверки

```powershell
./backend/.venv/Scripts/python.exe backend/manage.py test
npm --prefix frontend test
npm --prefix frontend run build
docker compose config --quiet
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test shop.tests.PostgresConcurrencyTests --verbosity 2
```

Тесты конкурентности (`PostgresConcurrencyTests`) проверяют два одновременных запроса с одним ключом оформления и сохранение единственного заказа. На SQLite они пропускаются, поэтому проверяйте их на PostgreSQL.

Успешные тесты не заменяют приёмку в браузере и проверку Docker-сборки.

## Развёртывание

### Vercel + Supabase

Инструкция: [docs/vercel-deployment.md](docs/vercel-deployment.md). Там описаны переменные окружения, миграции, защита таблиц и резервные копии.

### Свой сервер с Docker и HTTPS

1. Направьте домен на сервер и откройте TCP 80 и 443.
2. Выполните `scripts/setup-env.ps1`. В `.env` задайте `DOMAIN`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS=https://ваш-домен` и `FRONTEND_URL=https://ваш-домен`. Оставьте `FRONTEND_BIND=127.0.0.1` и `DEBUG=false`.
3. Настройте SMTP (`EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` и параметры сервера). Пока почта не проверена, держите `PASSWORD_RESET_ENABLED=false`.
4. Запустите:
   ```powershell
   docker compose -f docker-compose.yml -f deploy/compose.https.yml up -d --build
   ```
   Caddy получит сертификат для домена и направит запросы в Nginx.
5. Создайте рабочие учётные записи и проверьте все роли через HTTPS. Демо-пароли в рабочую среду не переносите.

Перед коммерческим запуском нужно: подтверждённые товары, цены, вес, состав и аллергены; адреса и контакты; зона и стоимость доставки; правила отмены и возврата; реквизиты продавца; тексты согласий. Затем установите `DEMO_MODE=false` и замените демонстрационное наполнение.

## Документация

- [API](docs/api-contract.md)
- [Руководство администратора](docs/admin-guide.md)
- [Резервное копирование и восстановление](docs/backup-restore.md)
- [Развёртывание на Vercel и Supabase](docs/vercel-deployment.md)
- [Отчёт MVP](docs/acceptance-report.md)
- [Последние исправления и проверки](docs/stability-report-2026-10-16.md)
