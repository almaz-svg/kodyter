# Anasym MVP API contract

Base `/api/`. JSON. Cookie sessions, CSRF header `X-CSRFToken`; GET `/auth/csrf/` returns `{csrfToken}`. Errors `{detail: string}` plus validation fields. All amounts in KZT whole or decimal numeric strings. Lists are arrays (no pagination in MVP).

Roles: `CUSTOMER`, `ADMIN`, `COURIER`, `CASHIER`. Statuses: `NEW`, `CONFIRMED`, `PREPARING`, `READY`, `HANDED_OVER`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`. Cashiers read all orders; couriers read only assigned order details and the separate available queue.

- GET `/auth/me/` returns user or 401. User: `{id,name,email,phone,role,is_active}`.
- POST `/auth/register/` `{name,email,password,phone?}`; POST `/auth/login/` `{email,password}` returns user. POST `/auth/logout/`.
- POST `/auth/password-reset/` `{email}` generic response; POST `/auth/password-reset-confirm/` `{uid,token,password}`.
- GET `/categories/`: `{id,name,slug,description,image,is_visible}`[].
- GET `/products/?category=&search=` and GET `/products/:id/`: `{id,category,name,description,image,price,weight,ingredients,allergens,is_available,is_visible}`.
- GET `/settings/`: `{currency,delivery_fee,demo_mode,payment_method}`.
- POST `/orders/`: `{recipient_name,phone,address,comment,items:[{product_id,quantity,expected_price}],expected_delivery_fee,idempotency_key}`. Returns order. Changed price/availability is HTTP 409. Client refreshes prices then requires a second explicit confirmation.
- GET `/orders/?status=&date=&courier=&search=&limit=` (role scoped); GET `/orders/:id/` (role scoped). Order: `{id,number,created_at,status,recipient_name,phone,address,comment,subtotal,delivery_fee,total,courier,courier_name,courier_is_active (staff only),items,status_history,problems,cancellation_reason}`.
- The orders list is a plain array, newest first: 100 orders by default, `limit` accepts 1-500. Use filters to reach older orders.
- Order item: `{id,product_id,name,price,quantity,image}`. History: `{id,from_status,to_status,created_at,actor_name}`. Problem: `{id,message,created_at,actor_name}`.
- POST `/orders/:id/transition/` `{status,reason?}`; POST `/orders/:id/assign/` `{courier_id}` (before pickup, or for HANDED_OVER/IN_TRANSIT orders whose courier is blocked); POST `/orders/:id/problem/` `{message}`.
- GET/POST `/admin/products/`; PATCH `/admin/products/:id/` same product fields; GET/POST `/admin/categories/`; PATCH `/admin/categories/:id/` same category fields.
- GET/POST `/admin/couriers/`; POST `{name,email,password,phone}`; PATCH `/admin/couriers/:id/` `{is_active,name?,phone?}`.
- PATCH `/auth/profile/` `{name,phone}`.

## Shared courier queue and cashier

- GET `/courier/available-orders/`: active couriers only; unassigned NEW/CONFIRMED/PREPARING/READY orders as `{id,number,status,created_at,total,address,items_count,items:[{name,quantity}]}`. No recipient name, phone or comment before assignment.
- POST `/orders/:id/claim/` `{}`: active courier claims an available order atomically. Returns full order; another courier receives 409. Does not change preparation status.
- GET/POST `/admin/cashiers/`; POST `{name,email,password,phone}`; PATCH `/admin/cashiers/:id/` `{is_active,name?,phone?}`. Admin only.
- Order additionally includes `{payment_status:'UNPAID'|'PAID',paid_at,paid_by,paid_by_name}`. Payment values are server-controlled.
- POST `/orders/:id/payment/` `{method:'CASH',idempotency_key:UUID}`: cashier/admin only, DELIVERED only. Full saved order amount is recorded once. Returns full order (201 first record, 200 existing record); a key reused for another order is 409.
- GET `/cashier/summary/?date=YYYY-MM-DD`: cashier/admin only. `{date,currency:'KZT',cash_received,paid_count,unpaid_delivered_total,unpaid_delivered_count}`. Received amount/count use selected local date; outstanding delivered orders include previous days.

Cashier route `/cashier`; all open order workspaces poll every 5 seconds and refresh on focus. Shared role redirect helper: `roleHome(role)`.

Frontend: React+TS Vite, React Router. Shared `src/lib.ts` exports types, `api<T>(path, options?)` (API-relative slash paths), `money(value)` and `statusLabel`, `statusSteps`. Portals component default export accepts `{user: User, onUserChange:(u:User)=>void}`. All portal markup namespaced `.portal`; own `portals.css`. Routes `/account`, `/admin`, `/courier`, `/cashier`. Root supplies header/footer and auth redirect.

Demo seed image names `/images/croissant.webp`, `/images/cake.webp`, `/images/tart.webp`, `/images/buns.webp`, `/images/catering.webp`; hero `/images/hero.webp`, about `/images/baker.webp`.
