<div align="center">

<img src="Logo.png" alt="Anasym" width="120" />

# Anasym

Интернет-магазин авторской кондитерской: каталог, корзина, оплата при получении и кабинеты администратора, курьера и кассира.

[Сайт](https://anasym-bakery.vercel.app) · [API](docs/api-contract.md) · [Развёртывание](docs/vercel-deployment.md) · [Руководство администратора](docs/admin-guide.md) · [Дорожная карта](PRODUCTION_ROADMAP.md)

</div>

> **Важно.** Товары, цены, составы, контакты и учётные записи в начальных данных демонстрационные. Перед публичным запуском их нужно заменить (см. [Перед запуском](#перед-запуском)).

## Стек

- **Фронтенд:** React 19, TypeScript, Vite, React Router
- **Бэкенд:** Django 5.2, Django REST Framework
- **База данных:** PostgreSQL 17 (Supabase в продакшене; SQLite только для локальной разработки)
- **Деплой:** Vercel (фронтенд и Django как serverless-функция) или Docker с Nginx и Caddy

## Возможности

**Покупатель**
- Каталог по категориям, карточка товара с составом и аллергенами.
- Корзина в браузере, оформление заказа с оплатой при получении. Итоговая сумма считается на сервере.
- Регистрация, вход, восстановление пароля, история заказов.
- Интерфейс на қазақша, русском и English.

**Сотрудники**

| Роль | Раздел | Что делает |
| --- | --- | --- |
| Администратор | `/admin` | Каталог и категории, заказы, назначение курьеров, сотрудники, одобрение заведений и оптовых цен |
| Курьер | `/courier` | Свободные заказы, принятие заказа, свои доставки, сообщения о проблемах |
| Кассир | `/cashier` | Заказы и приём оплаты, сводка за день |

**Оптовые цены.** Доступны одобренным заведениям, если в заказе не меньше `WHOLESALE_MIN_QTY` штук (по умолчанию 10) одного товара. Количества разных товаров не суммируются.

## Быстрый старт (Windows)

Нужны Python 3.12, Node.js 22 и PowerShell.

```powershell
# Бэкенд
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# Фронтенд
npm --prefix frontend ci

# Настройки: создайте backend/.env и задайте DJANGO_SECRET_KEY (не короче 50 символов)
Copy-Item backend/.env.example backend/.env
./backend/.venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(50))"

# Запуск: миграции, SQLite и демо-данные
./scripts/launch.ps1 -UseSqlite -SeedDemo
```

Сайт откроется на <http://127.0.0.1:5173>. Остановить: `./scripts/stop.ps1`. Журналы: `.secrets/logs/`.

Если PowerShell блокирует скрипты, запускайте так: `powershell -ExecutionPolicy Bypass -File ./scripts/launch.ps1 -UseSqlite -SeedDemo`.

**С PostgreSQL вместо SQLite.** Укажите `DATABASE_URL` в `backend/.env` (спецсимволы в пароле кодируйте в URL-формате) и запустите `./scripts/launch.ps1 -SeedDemo`. Пользователю базы нужно право `CREATEDB`, иначе не запустятся тесты.

## Тесты

```powershell
# Бэкенд (12 тестов параллельности пропускаются на SQLite)
./backend/.venv/Scripts/python.exe backend/manage.py test --noinput

# Фронтенд: тесты (включая полноту переводов) и сборка с проверкой типов
npm --prefix frontend test
npm --prefix frontend run build

# Миграции согласованы с моделями
./backend/.venv/Scripts/python.exe backend/manage.py makemigrations --check --dry-run
```

Полная проверка бэкенда идёт на PostgreSQL: задайте `DATABASE_URL_TEST`, имя базы должно содержать `test`.

## Конфигурация

Переменные читаются из `backend/.env`. Полный список — в `backend/.env.example` и `backend/config/settings.py`. Основные:

| Переменная | Назначение |
| --- | --- |
| `DJANGO_SECRET_KEY` | Секретный ключ. Обязателен. Вне `DEBUG` не короче 50 символов. |
| `DEBUG` | `true` только для разработки. |
| `DATABASE_URL` | Строка подключения к PostgreSQL. |
| `USE_SQLITE` | `true` только для локальной разработки без PostgreSQL. |
| `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL` | Домены сайта. |
| `DELIVERY_FEE` | Стоимость доставки, ₸ (по умолчанию 1500.00). |
| `WHOLESALE_MIN_QTY` | Порог оптовой цены (по умолчанию 10). |
| `DEMO_MODE` | Нужен для `seed_demo` и `import_pdf_catalog`. |
| `PASSWORD_RESET_ENABLED` | Восстановление пароля. Включайте только с настроенной почтой. |
| `EMAIL_*` | Настройки SMTP. |

Секреты в Git не попадают: `.env`, `backend/.env` и `.secrets/` игнорируются.

## Демо-данные

```powershell
./backend/.venv/Scripts/python.exe backend/manage.py seed_catalog   # базовый каталог
./backend/.venv/Scripts/python.exe backend/manage.py seed_demo      # демо-категории, товары и аккаунты ролей; нужен DEMO_MODE=true
```

Пароли демо-аккаунтов пишутся в `.secrets/demo-accounts.txt`. Повторный запуск не меняет существующие пароли.

## Развёртывание

### Vercel и Supabase

`vercel.json` собирает фронтенд (`frontend/dist`) и публикует Django как функцию `api/index.py`. Пошаговая инструкция, переменные и защита таблиц: [docs/vercel-deployment.md](docs/vercel-deployment.md).

> **Миграции при деплое не применяются.** Сначала выполните `manage.py migrate` против продакшен-базы, и только потом публикуйте код, который от них зависит. Перед миграцией сделайте резервную копию.

### Docker на собственном сервере

Нужны Docker с Compose v2, домен и открытые порты 80 и 443.

```powershell
./scripts/setup-env.ps1   # создаёт .env со случайными секретами
docker compose -f docker-compose.yml -f deploy/compose.https.yml up -d --build
```

В `.env` задайте `DOMAIN`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS=https://ваш-домен` и `FRONTEND_URL=https://ваш-домен`. Для локальной проверки без HTTPS: `docker compose up -d --build`, сайт на <http://localhost:8080>.

## Структура репозитория

```
backend/     Django-проект: config/ (настройки), shop/ (модели, API, тесты, команды)
frontend/    React-приложение: src/ (страницы, кабинеты, переводы), tests/
api/         точка входа Django для Vercel
deploy/      Nginx, Caddy, заголовки безопасности
scripts/     PowerShell: запуск, остановка, настройка окружения, бэкапы
docs/        документация и отчёты о проверках
```

## Документация

- [Контракт API](docs/api-contract.md)
- [Руководство администратора](docs/admin-guide.md)
- [Развёртывание на Vercel и Supabase](docs/vercel-deployment.md)
- [Резервные копии](docs/backup-restore.md)
- [Дорожная карта](PRODUCTION_ROADMAP.md): аудит, задачи P0–P3, блокеры

## Перед запуском

- Подтвердить товары, цены, вес, состав и аллергены.
- Проверить адрес, контакты, зону и стоимость доставки.
- Утвердить условия отмены и возврата, реквизиты и тексты оферты и политики конфиденциальности.
- Настроить SMTP и проверить восстановление пароля.
- Поставить `DEMO_MODE=false` и заменить демо-наполнение.
- Проверить восстановление из резервной копии на отдельной базе.

## Статус

MVP. Функции протестированы, но публичный запуск требует закрытия задач из дорожной карты. Известные ограничения: оплата только наличными, нет учёта остатков, отмену заказа выполняет администратор, список заказов не постраничный.

## Лицензия

Лицензия не выбрана. Все права на код и материалы принадлежат владельцу проекта.
