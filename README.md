<div align="center">

<img src="Logo.png" alt="Anasym" width="120" />

# Anasym

**Интернет-магазин авторской кондитерской** — витрина, корзина, оформление заказа и рабочие места персонала в одном проекте.

[Открыть сайт](https://anasym-bakery.vercel.app) · [API](docs/api-contract.md) · [Развёртывание](docs/vercel-deployment.md) · [Руководство администратора](docs/admin-guide.md)

</div>

---

## О проекте

Anasym — кондитерская в Таразе (ул. Конаева, 62а). Сайт позволяет посмотреть каталог, собрать корзину и заказать доставку с оплатой при получении. Сотрудники работают с заказами в отдельных кабинетах: администратор, курьер и кассир.

| | |
| --- | --- |
| **Фронтенд** | React 19, TypeScript, Vite, React Router, Leaflet (карта), lucide-react |
| **Бэкенд** | Django 5.2, Django REST Framework, Gunicorn |
| **База данных** | PostgreSQL (SQLite для локальной разработки) |
| **Хостинг** | Vercel + Supabase, либо свой сервер на Docker (Nginx + Caddy) |
| **Языки интерфейса** | Қазақша, Русский, English |
| **Валюта** | Тенге (₸) |

> Товары, цены, составы, контакты и учётные записи в начальном наполнении демонстрационные.

## Возможности

### Покупатель
- Каталог с категориями и слайдером, страница товара с составом и аллергенами.
- Выбор количества: кнопки «−»/«+», ввод числа с клавиатуры и быстрые значения (10, 20, 50, 70).
- Корзина, регистрация и вход, восстановление пароля, история заказов.
- Оформление заказа с оплатой при получении.
- Переключатель языка (қаз / рус / eng) и адаптивная вёрстка с мобильным меню.
- Карта с адресом кондитерской, страницы «О нас», «Доставка», «Контакты».
- Политика конфиденциальности, публичная оферта и баннер согласия на cookies.

### Персонал
| Роль | Адрес | Что делает |
| --- | --- | --- |
| Администратор | `/admin` | Каталог и категории, очередь заказов с фильтрами, смена статусов, назначение курьеров, управление курьерами и кассирами |
| Курьер | `/courier` | Общая очередь свободных заказов, принятие заказа, свои доставки, сообщения о проблемах |
| Кассир | `/cashier` | Все заказы, состояние оплаты, учёт наличных после доставки |

### Безопасность
- Права проверяются на стороне API, а не только в интерфейсе.
- Сессия хранится в HttpOnly cookie, изменение данных требует CSRF-токен.
- Ограничение частоты попыток входа.
- Онлайн-оплата не подключена.

## Структура репозитория

```
backend/      Django: API, модели, миграции, тесты, команды импорта каталога
frontend/     React-приложение (Vite)
  src/          App, Home, Catalog, ShopFlow (корзина и заказ), Portals (кабинеты),
                i18n (переводы), MapSection, Legal, store (состояние корзины и пользователя)
  tests/        Тесты фронтенда
api/          Точка входа для serverless-функции Vercel
deploy/       Конфигурации Nginx и Caddy для HTTPS
scripts/      PowerShell-скрипты: запуск, остановка, настройка, резервные копии
docs/         Документация, отчёты о проверках, скриншоты
```

## Быстрый старт

Нужны **Python 3.12+** и **Node.js 22**. Скрипты написаны для Windows (PowerShell).

```powershell
# 1. Зависимости бэкенда
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# 2. Зависимости фронтенда
npm --prefix frontend ci

# 3. Настройки
Copy-Item backend/.env.example backend/.env
# Задайте в backend/.env как минимум DJANGO_SECRET_KEY

# 4. Запуск с SQLite и демо-данными
./scripts/launch.ps1 -UseSqlite -SeedDemo
```

После запуска:

- сайт — <http://127.0.0.1:5173>
- проверка API — <http://127.0.0.1:5173/api/health/>

Остановка: `./scripts/stop.ps1`. Журналы пишутся в `.secrets/logs`.

<details>
<summary><b>Параметры <code>launch.ps1</code></b></summary>

| Параметр | Назначение |
| --- | --- |
| `-UseSqlite` | Локальная база `backend/db.sqlite3`. Без него нужен `DATABASE_URL` в `backend/.env` (PostgreSQL). |
| `-SeedDemo` | Заполнить демонстрационными данными. Существующие пароли не меняются. |
| `-BackendPort`, `-FrontendPort` | Порты, по умолчанию 8000 и 5173. |
| `-PythonExecutable`, `-NodeExecutable`, `-PostgresBin` | Пути к интерпретаторам и PostgreSQL, если их нет в PATH. |

Скрипт применяет миграции и запускает процессы в фоне. Режим `-UseSqlite` не переписывает `backend/.env`.

</details>

<details>
<summary><b>Локально с PostgreSQL</b></summary>

Укажите `DATABASE_URL` в `backend/.env` (спецсимволы в пароле — в URL-кодировке) и запустите `./scripts/launch.ps1 -SeedDemo`. Если PostgreSQL установлен не в `C:/Program Files/PostgreSQL/18/bin`, передайте `-PostgresBin`. Тестам нужно право `CREATEDB` у пользователя базы.

</details>

### Только фронтенд

```powershell
npm --prefix frontend run dev      # dev-сервер Vite
npm --prefix frontend run build    # проверка типов и сборка в frontend/dist
```

## Запуск в Docker

Нужен Docker Desktop (Linux engine) с Compose v2.

```powershell
./scripts/setup-env.ps1
docker compose up -d --build
docker compose exec --user root backend python manage.py seed_demo
```

Сайт — <http://localhost:8080>, проверка API — <http://localhost:8080/api/health/>.

- Случайные пароли демо-ролей сохраняются в `.secrets/demo-accounts.txt` (файл не попадает в Git).
- `seed_demo` не запускается автоматически, а повторный запуск не меняет существующие пароли.
- Данные PostgreSQL лежат в томе `postgres_data`: `docker compose down` их сохраняет, `down -v` удаляет.
- Порт 8080 привязан к loopback; браузер обращается к API через Nginx.

## Каталог товаров

Начальный каталог лежит в `backend/shop/data/`. Команды управления:

```powershell
./backend/.venv/Scripts/python.exe backend/manage.py seed_catalog         # базовый каталог
./backend/.venv/Scripts/python.exe backend/manage.py import_pdf_catalog   # импорт из данных PDF-каталога
./backend/.venv/Scripts/python.exe backend/manage.py seed_demo            # демо-аккаунты ролей
```

Обычные правки (цены, описания, категории) удобнее делать через кабинет администратора — см. [руководство](docs/admin-guide.md).

## Настройки

Основные переменные в `backend/.env` (полный список — в `backend/.env.example`):

| Переменная | Описание |
| --- | --- |
| `DJANGO_SECRET_KEY` | Секретный ключ Django. **Обязателен.** |
| `DEBUG` | `true` только для разработки. |
| `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | Домены и origin'ы, с которых открывается сайт. |
| `DATABASE_URL` | Подключение к PostgreSQL. Если пусто, нужен `-UseSqlite`. |
| `FRONTEND_URL` | Адрес фронтенда, используется в ссылках (например, восстановления пароля). |
| `DELIVERY_FEE` | Стоимость доставки. |
| `DEMO_MODE` | Демо-маркировка интерфейса. Сама по себе не меняет содержимое базы. |
| `PASSWORD_RESET_ENABLED` | Восстановление пароля. Включайте только с настроенной почтой. |
| `EMAIL_BACKEND`, `EMAIL_*` | Почта. Консольный backend подходит только для разработки. |

## Тесты

```powershell
./backend/.venv/Scripts/python.exe backend/manage.py test     # бэкенд
npm --prefix frontend test                                    # фронтенд
npm --prefix frontend run build                               # типы и сборка
docker compose config --quiet                                 # проверка compose-файла
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test shop.tests.PostgresConcurrencyTests --verbosity 2
```

`PostgresConcurrencyTests` проверяют, что два одновременных запроса с одним ключом оформления создают единственный заказ. На SQLite они пропускаются, поэтому запускайте их на PostgreSQL. Успешные тесты не заменяют проверку в браузере и сборку Docker-образов.

## Развёртывание

### Vercel + Supabase

Подробная инструкция — [docs/vercel-deployment.md](docs/vercel-deployment.md): переменные окружения, миграции, защита таблиц (RLS) и резервные копии.

### Свой сервер: Docker + HTTPS

1. Направьте домен на сервер и откройте TCP 80 и 443.
2. Выполните `scripts/setup-env.ps1`. В `.env` задайте `DOMAIN`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS=https://ваш-домен` и `FRONTEND_URL=https://ваш-домен`. Оставьте `FRONTEND_BIND=127.0.0.1` и `DEBUG=false`.
3. Настройте SMTP (`EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` и параметры сервера). Пока почта не проверена, держите `PASSWORD_RESET_ENABLED=false`.
4. Запустите:
   ```powershell
   docker compose -f docker-compose.yml -f deploy/compose.https.yml up -d --build
   ```
   Caddy получит сертификат и направит запросы в Nginx.
5. Создайте рабочие учётные записи и проверьте все роли через HTTPS. Демо-пароли в рабочую среду не переносите.

### Перед коммерческим запуском

- подтвердить товары, цены, вес, состав и аллергены;
- проверить адреса, контакты, зону и стоимость доставки;
- утвердить правила отмены и возврата, реквизиты продавца и тексты согласий;
- поставить `DEMO_MODE=false` и заменить демонстрационное наполнение.

## Резервные копии

Скрипты `scripts/backup.ps1` и `scripts/restore.ps1`; порядок действий — в [docs/backup-restore.md](docs/backup-restore.md).

## Документация

| Документ | О чём |
| --- | --- |
| [API](docs/api-contract.md) | Контракт REST API |
| [Руководство администратора](docs/admin-guide.md) | Работа с каталогом и заказами |
| [Резервные копии](docs/backup-restore.md) | Бэкап и восстановление |
| [Vercel и Supabase](docs/vercel-deployment.md) | Публикация |
| [Отчёт MVP](docs/acceptance-report.md) | Приёмка |
| [Последние исправления](docs/stability-report-2026-10-16.md) | Проверки стабильности |
