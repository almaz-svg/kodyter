import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Banknote, Check, ChefHat, ChevronRight, CircleCheck, Crop, FileText, FlaskConical, Image as ImageIcon, Settings, Upload, Clock3, HandCoins, Eye, EyeOff, KeyRound, LayoutGrid, LockKeyhole, MapPin, Package, Pencil, Phone, Plus, RefreshCw, Search, ShoppingBag, Store, Trash2, Truck, UserRound, Wallet, X } from 'lucide-react';
import { api, ApiError, money, statusLabel, statusSteps, type User, type Product, type Category, type Order, type AvailableOrder, type TeamOrders, type CashierSummary, type AdminOverview, type Debts, type DebtOrder, type MyDebt } from './lib';
import { LazyImage, PhoneInput, phoneDigits, formatPhone } from './ui';
import { uploadProductPhoto } from './imageUpload';
import { PhotoCropper } from './photoCropper';
import './portals.css';

type Props = { user: User; onUserChange: (user: User) => void };
type Tab = 'orders' | 'kitchen' | 'products' | 'categories' | 'couriers' | 'cashiers' | 'pastry' | 'businesses' | 'cash' | 'debts' | 'profile';
const terminal = (order: Order) => ['DELIVERED', 'CANCELLED'].includes(order.status);
const dateTime = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const failure = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить запрос. Проверьте подключение и попробуйте ещё раз.';
const json = (value: unknown, method = 'POST'): RequestInit => ({ method, body: JSON.stringify(value) });
const localToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Qyzylorda', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
};
const isPortalDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || value > '9999-12-31') return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// Match DEFAULT_ORDER_LIST_LIMIT and MAX_ORDER_LIST_LIMIT in backend/shop/order_views.py.
const ORDER_PAGE_SIZE = 100;
// Admin status filter: "Подтверждённые" also covers orders that are being prepared.
const adminStatusFilters = [['NEW', 'Новые'], ['CONFIRMED,PREPARING', 'Подтверждённые'], ['DELIVERED', 'Доставлен'], ['CANCELLED', 'Отменён']];
const MAX_ORDER_LIMIT = 500;

function useRemote<T>(path: string | null, poll = false) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const hasData = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  const retry = useCallback(() => refreshRef.current(), []);
  const replace = useCallback((value: T) => { revision.current += 1; hasData.current = true; setData(value); setError(''); }, []);
  useEffect(() => {
    let alive = true;
    let running = false;
    let queued = false;
    const controller = new AbortController();
    hasData.current = false;
    setData(null);
    setLoading(Boolean(path));
    setError('');
    if (!path) return;
    const fetchData = async () => {
      if (running) { queued = true; return; }
      running = true;
      if (!hasData.current) { setLoading(true); setError(''); }
      const currentRevision = revision.current;
      try {
        const result = await api<T>(path, { signal: controller.signal });
        if (alive && currentRevision === revision.current) { hasData.current = true; setData(result); setError(''); }
      } catch (err) {
        if (alive && currentRevision === revision.current && !controller.signal.aborted) {
          if (err instanceof ApiError && [401, 403, 404].includes(err.status)) { hasData.current = false; setData(null); }
          setError(failure(err));
        }
      } finally {
        running = false;
        if (alive) setLoading(false);
        if (alive && queued) { queued = false; void fetchData(); }
      }
    };
    refreshRef.current = () => { void fetchData(); };
    void fetchData();
    const refreshVisible = () => { if (document.visibilityState === 'visible') void fetchData(); };
    const timer = poll ? window.setInterval(refreshVisible, 5000) : undefined;
    if (poll) { window.addEventListener('focus', refreshVisible); document.addEventListener('visibilitychange', refreshVisible); }
    return () => {
      alive = false; controller.abort(); refreshRef.current = () => {};
      if (timer) window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [path, poll]);
  return { data, loading, error, retry, replace };
}

function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  if (!message) return null;
  return <div className="portal-notice portal-error" role="alert"><span>{message}</span>{retry && <button type="button" onClick={retry}><RefreshCw size={15} aria-hidden="true" /> Повторить</button>}</div>;
}

function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="portal-empty"><span className="portal-empty-icon">{icon}</span><h3>{title}</h3><p>{children}</p></div>;
}

function Status({ status, customer = false }: { status: Order['status']; customer?: boolean }) {
  // Customers only need to know whether the order has arrived; staff see the full workflow status.
  if (customer && status !== 'CANCELLED') {
    const delivered = status === 'DELIVERED';
    return <span className={`portal-status ${delivered ? 'status-delivered' : 'status-pending'}`}><i />{delivered ? 'Доставлен' : 'Не доставлен'}</span>;
  }
  return <span className={`portal-status status-${status.toLowerCase()}`}><i />{statusLabel[status] || status}</span>;
}

function useEditorReveal(key: string | number | null) {
  const ref = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (key === null && !opened.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (key !== null) {
        opened.current = true;
        ref.current?.focus({ preventScroll: true });
        ref.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else {
        opened.current = false;
        if (trigger.current?.isConnected) {
          trigger.current.focus({ preventScroll: true });
          trigger.current.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);
  return { ref, rememberTrigger: (element: HTMLElement) => { trigger.current = element; } };
}

export default function Portals({ user, onUserChange }: Props) {
  const [tab, setTab] = useState<Tab>(user.role === 'PASTRY' ? 'kitchen' : 'orders');
  const isAdmin = user.role === 'ADMIN';
  const isCourier = user.role === 'COURIER';
  const isCashier = user.role === 'CASHIER';
  const isPastry = user.role === 'PASTRY';
  const tabs: { value: Tab; name: string; icon: ReactNode }[] = isAdmin
    ? [{ value: 'orders', name: 'Заказы', icon: <ShoppingBag size={18} aria-hidden="true" /> }, { value: 'kitchen', name: 'Кухня', icon: <ChefHat size={18} aria-hidden="true" /> }, { value: 'products', name: 'Товары', icon: <Package size={18} aria-hidden="true" /> }, { value: 'categories', name: 'Категории', icon: <LayoutGrid size={18} aria-hidden="true" /> }, { value: 'pastry', name: 'Кондитеры', icon: <ChefHat size={18} aria-hidden="true" /> }, { value: 'couriers', name: 'Курьеры', icon: <Truck size={18} aria-hidden="true" /> }, { value: 'cashiers', name: 'Кассиры', icon: <Banknote size={18} aria-hidden="true" /> }, { value: 'cash', name: 'Касса', icon: <Wallet size={18} aria-hidden="true" /> }, { value: 'debts', name: 'Долг', icon: <HandCoins size={18} aria-hidden="true" /> }, { value: 'businesses', name: 'Заведения', icon: <Store size={18} aria-hidden="true" /> }]
    : [...(isPastry ? [{ value: 'kitchen' as Tab, name: 'Кухня', icon: <ChefHat size={18} aria-hidden="true" /> }] : []), { value: 'orders', name: isCourier ? 'Доставки' : isCashier ? 'Заказы и касса' : isPastry ? 'Все заказы' : 'Мои заказы', icon: isPastry ? <ChefHat size={18} aria-hidden="true" /> : isCourier ? <Truck size={18} aria-hidden="true" /> : isCashier ? <Banknote size={18} aria-hidden="true" /> : <ShoppingBag size={18} aria-hidden="true" /> }, ...(isCourier ? [{ value: 'debts' as Tab, name: 'Долг', icon: <HandCoins size={18} aria-hidden="true" /> }] : []), { value: 'profile', name: 'Личные данные', icon: <UserRound size={18} aria-hidden="true" /> }];
  const myDebt = useRemote<MyDebt>(user.role === 'CUSTOMER' ? '/debts/mine/' : null, true);
  return <main className="portal">
    <div className="portal-heading"><div>
      <p className="portal-eyebrow">ANASYM / {isAdmin ? 'УПРАВЛЕНИЕ ПЕКАРНЕЙ' : isCourier ? 'КАБИНЕТ КУРЬЕРА' : isCashier ? 'КАБИНЕТ КАССИРА' : isPastry ? 'КАБИНЕТ КОНДИТЕРА' : 'ЛИЧНЫЙ КАБИНЕТ'}</p>
      <h1>{isAdmin ? 'Панель управления' : isCourier ? 'Ваши доставки' : isCashier ? 'Касса и заказы' : isPastry ? 'Заказы на кухне' : `Здравствуйте, ${user.name.split(' ')[0] || 'гость'}.`}</h1>
      <p className="portal-heading-copy">{isAdmin ? 'Заказы, товары, категории и сотрудники. Всё, что нужно для работы сайта, — здесь.' : isCourier ? 'Выберите свободный заказ в разделе «Доступные» или посмотрите свои активные доставки.' : isCashier ? 'Заказы и наличные, полученные за доставки. Сводка кассы — за выбранный день.' : isPastry ? 'Все заказы пекарни. Подтвердите новый заказ, начните приготовление и отметьте, когда заказ готов к выдаче курьеру.' : 'Здесь видно все ваши заказы и их статус.'}</p>
    </div></div>
    {myDebt.data && myDebt.data.count > 0 && <div className="portal-debt-banner" role="status"><HandCoins size={26} aria-hidden="true" /><div><strong>У вас долг: {money(myDebt.data.total)}</strong><p>{myDebt.data.count === 1 ? 'Заказ' : 'Заказы'} {myDebt.data.orders.map(item => `№${item.number}`).join(', ')} {myDebt.data.count === 1 ? 'доставлен' : 'доставлены'} в долг. Оплатите курьеру или в пекарне — после оплаты эта плашка исчезнет.</p></div></div>}
    <nav className={`portal-tabs ${isAdmin ? 'portal-admin-tabs' : ''}`} aria-label="Разделы личного кабинета">{tabs.map(item => <button type="button" key={item.value} className={tab === item.value ? 'active' : ''} aria-current={tab === item.value ? 'page' : undefined} onClick={() => setTab(item.value)}>{item.icon}{item.name}</button>)}</nav>
    {tab === 'orders' && <OrdersPanel user={user} />}
    {tab === 'kitchen' && (isAdmin || isPastry) && <KitchenPanel user={user} />}
    {tab === 'profile' && <Profile user={user} onUserChange={onUserChange} />}
    {isAdmin && tab === 'products' && <ProductsPanel />}
    {isAdmin && tab === 'categories' && <CategoriesPanel />}
    {isAdmin && tab === 'couriers' && <StaffPanel key="couriers" kind="couriers" />}
    {isAdmin && tab === 'businesses' && <BusinessPanel />}
    {isAdmin && tab === 'cashiers' && <StaffPanel key="cashiers" kind="cashiers" />}
    {isAdmin && tab === 'pastry' && <StaffPanel key="pastry" kind="pastry-chefs" />}
    {isAdmin && tab === 'cash' && <CashPanel />}
    {(isAdmin || isCourier) && tab === 'debts' && <DebtsPanel user={user} />}
  </main>;
}
function Profile({ user, onUserChange }: Props) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(phoneDigits(user.phone));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try { const updated = await api<User>('/auth/profile/', json({ name: name.trim(), phone: formatPhone(phone) }, 'PATCH')); onUserChange(updated); setName(updated.name); setPhone(phoneDigits(updated.phone)); setSaved(true); }
    catch (err) { setError(failure(err)); }
    finally { setBusy(false); }
  };
  return <section className="portal-profile portal-card"><div className="portal-section-title"><div><p className="portal-eyebrow">ВАШ ПРОФИЛЬ</p><h2>Давайте познакомимся</h2></div><UserRound size={27} aria-hidden="true" /></div><form onSubmit={save} className="portal-form"><fieldset className="portal-form-fields" disabled={busy}><label>Имя<input value={name} onChange={e => { setName(e.target.value); setSaved(false); }} required maxLength={120} autoComplete="name" /></label><label>Телефон<PhoneInput digits={phone} onChange={value => { setPhone(value); setSaved(false); }} required={user.role === 'CUSTOMER'} /></label><label>Электронная почта<input type="email" value={user.email} readOnly /><small>Почта используется для входа в аккаунт.</small></label>{user.account_type === 'BUSINESS' && <p className="portal-queue-note">{user.business_approved ? `Заведение «${user.company_name || ''}»: оптовые цены открыты.` : 'Заявка заведения на проверке. Пока действуют розничные цены, оптовые откроются после одобрения администратором.'}</p>}<ErrorNotice message={error} />{saved && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" /> Личные данные сохранены.</p>}<button className="portal-button" disabled={busy || !name.trim()}>{busy ? 'Сохраняем…' : 'Сохранить изменения'}<ArrowRight size={17} aria-hidden="true" /></button></fieldset></form></section>;
}

const positions = (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'позиция' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'позиции' : 'позиций'}`;

// Progress bar on the order card, with steps that fit each role.
// Customers see plain-language steps; admins see the exact workflow status on the current step;
// couriers follow the pickup and the road; the cashier's last step is the cash being received.
type ProgressStep = { label: string; statuses: Order['status'][]; icon: ReactNode };
const progressSteps: Record<User['role'], ProgressStep[]> = {
  CUSTOMER: [{ label: 'Ваш заказ в обработке', statuses: ['NEW'], icon: <Package size={18} aria-hidden="true" /> }, { label: 'Заказ подтверждён', statuses: ['CONFIRMED', 'PREPARING', 'READY'], icon: <CircleCheck size={18} aria-hidden="true" /> }, { label: 'Заказ передан курьеру', statuses: ['HANDED_OVER', 'IN_TRANSIT'], icon: <Truck size={18} aria-hidden="true" /> }, { label: 'Завершён', statuses: ['DELIVERED'], icon: <Check size={18} aria-hidden="true" /> }],
  ADMIN: [{ label: 'Новый', statuses: ['NEW'], icon: <Package size={18} aria-hidden="true" /> }, { label: 'Готовится', statuses: ['CONFIRMED', 'PREPARING', 'READY'], icon: <ChefHat size={18} aria-hidden="true" /> }, { label: 'В доставке', statuses: ['HANDED_OVER', 'IN_TRANSIT'], icon: <Truck size={18} aria-hidden="true" /> }, { label: 'Доставлен', statuses: ['DELIVERED'], icon: <Check size={18} aria-hidden="true" /> }],
  COURIER: [{ label: 'Готовится в пекарне', statuses: ['NEW', 'CONFIRMED', 'PREPARING'], icon: <ChefHat size={18} aria-hidden="true" /> }, { label: 'Готов к выдаче', statuses: ['READY'], icon: <Package size={18} aria-hidden="true" /> }, { label: 'Забран, в пути', statuses: ['HANDED_OVER', 'IN_TRANSIT'], icon: <Truck size={18} aria-hidden="true" /> }, { label: 'Доставлен', statuses: ['DELIVERED'], icon: <Check size={18} aria-hidden="true" /> }],
  PASTRY: [{ label: 'Новый', statuses: ['NEW'], icon: <Package size={18} aria-hidden="true" /> }, { label: 'Подтверждён', statuses: ['CONFIRMED'], icon: <CircleCheck size={18} aria-hidden="true" /> }, { label: 'Готовится', statuses: ['PREPARING'], icon: <ChefHat size={18} aria-hidden="true" /> }, { label: 'Готов к выдаче', statuses: ['READY'], icon: <Package size={18} aria-hidden="true" /> }, { label: 'Передан курьеру', statuses: ['HANDED_OVER', 'IN_TRANSIT', 'DELIVERED'], icon: <Truck size={18} aria-hidden="true" /> }],
  CASHIER: [{ label: 'Заказ принят', statuses: ['NEW', 'CONFIRMED', 'PREPARING', 'READY'], icon: <Package size={18} aria-hidden="true" /> }, { label: 'В доставке', statuses: ['HANDED_OVER', 'IN_TRANSIT'], icon: <Truck size={18} aria-hidden="true" /> }, { label: 'Доставлен', statuses: ['DELIVERED'], icon: <Check size={18} aria-hidden="true" /> }, { label: 'Оплачен', statuses: [], icon: <Banknote size={18} aria-hidden="true" /> }],
};

function OrderProgress({ order, role }: { order: Order; role: User['role'] }) {
  const steps = progressSteps[role] || progressSteps.CUSTOMER;
  // The cashier's "Оплачен" step has no order status: it is reached once the payment exists.
  const current = role === 'CASHIER' && order.payment_status === 'PAID' ? steps.length - 1 : steps.findIndex(step => step.statuses.includes(order.status));
  const reachedAt = (step: ProgressStep, index: number) => !step.statuses.length ? order.paid_at || undefined : index === 0 && step.statuses.includes('NEW') ? order.created_at : order.status_history.find(entry => step.statuses.includes(entry.to_status as Order['status']))?.created_at;
  const exact = role === 'ADMIN';
  return <ol className="portal-progress" style={{ ['--steps' as string]: steps.length }} aria-label={`Статус заказа: ${exact ? statusLabel[order.status] : steps[current]?.label}`}>
    {steps.map((step, index) => { const at = index <= current ? reachedAt(step, index) : undefined; return <li key={step.label} className={index < current ? 'done' : index === current ? 'current' : ''}>
      <span className="portal-progress-dot">{step.icon}</span><strong>{index === current && exact ? statusLabel[order.status] : step.label}</strong>{at && <small>{dateTime(at)}</small>}
    </li>; })}
  </ol>;
}

// "Кухня" tab for the pastry chef and the administrator: the kitchen board, with the chosen order opened below it.
function KitchenPanel({ user }: { user: User }) {
  const remote = useRemote<Order[]>('/orders/', true);
  const couriers = useRemote<User[]>(user.role === 'ADMIN' ? '/admin/couriers/' : null, true);
  const [selected, setSelected] = useState<number | null>(null);
  const refresh = () => { remote.retry(); couriers.retry(); };
  return <section aria-label="Кухня">
    <ErrorNotice message={remote.error} retry={remote.retry} />
    {remote.loading && !remote.data ? <div className="portal-loading" role="status"><RefreshCw size={22} aria-hidden="true" /> Загружаем заказы кухни…</div> : <KitchenBoard orders={remote.data || []} onOpen={setSelected} onChanged={refresh} />}
    {selected && <div className="kitchen-detail"><OrderDetail key={selected} id={selected} user={user} couriers={couriers.data || []} onChange={refresh} onClose={() => setSelected(null)} /></div>}
  </section>;
}

// Pastry kitchen dashboard: every product to cook across confirmed and preparing orders, summed up,
// with a tick per receipt (or for the whole product) that every pastry chef sees.
function KitchenBoard({ orders, onOpen, onChanged }: { orders: Order[]; onOpen: (id: number) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const kitchen = orders.filter(order => order.status === 'CONFIRMED' || order.status === 'PREPARING');
  const fresh = orders.filter(order => order.status === 'NEW');
  const ready = orders.filter(order => order.status === 'READY');
  const groups = new Map<string, { key: string; name: string; image: string; total: number; left: number; lines: { orderId: number; number: string; itemId: number; quantity: number; prepared: boolean; started: boolean }[] }>();
  for (const order of kitchen) for (const item of order.items) {
    const key = String(item.product_id || item.name);
    const group = groups.get(key) || { key, name: item.name, image: item.image, total: 0, left: 0, lines: [] };
    group.total += item.quantity;
    if (!item.is_prepared) group.left += item.quantity;
    group.lines.push({ orderId: order.id, number: order.number, itemId: item.id, quantity: item.quantity, prepared: !!item.is_prepared, started: order.status === 'PREPARING' });
    groups.set(key, group);
  }
  // A fixed alphabetical order: a card must not jump to another place when it is marked done, or the next tap lands on a different product.
  const rows = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.key.localeCompare(b.key));
  const left = rows.reduce((sum, row) => sum + row.left, 0);
  const cooked = kitchen.filter(order => order.items.length > 0 && order.items.every(item => item.is_prepared));
  const mark = async (ids: number[], prepared: boolean, key: string, label: string) => {
    if (busy) return;
    setBusy(key); setError(''); setNotice('');
    try { await api('/kitchen/prepared/', json({ item_ids: ids, prepared })); setNotice(prepared ? `Отмечено готовым: ${label}` : `Возвращено в работу: ${label}`); onChanged(); }
    catch (err) { setError(failure(err)); onChanged(); }
    finally { setBusy(null); }
  };
  return <section className="kitchen-board" aria-label="Пульт кухни">
    <div className="portal-section-title"><div><p className="portal-eyebrow">ПУЛЬТ КУХНИ</p><h2>Что приготовить</h2></div><ChefHat size={26} aria-hidden="true" /></div>
    <div className="kitchen-stats">
      <article className={fresh.length ? 'is-alert' : ''}><span>Ждут подтверждения</span><strong>{fresh.length}</strong><small>новых заказов</small></article>
      <article><span>В работе</span><strong>{kitchen.length}</strong><small>подтверждены или готовятся</small></article>
      <article className="is-main"><span>Осталось приготовить</span><strong>{left} шт.</strong><small>{rows.filter(row => row.left > 0).length} позиций</small></article>
      <article><span>Готовы к выдаче</span><strong>{ready.length}</strong><small>ждут курьера</small></article>
    </div>
    {fresh.length > 0 && <div className="kitchen-strip"><span>Новые заказы — откройте и подтвердите:</span>{fresh.map(order => <button type="button" key={order.id} onClick={() => onOpen(order.id)}>№{order.number}<ChevronRight size={15} aria-hidden="true" /></button>)}</div>}
    {cooked.length > 0 && <div className="kitchen-strip is-done"><span><Check size={16} aria-hidden="true" /> Всё приготовлено — отметьте заказ готовым к выдаче:</span>{cooked.map(order => <button type="button" key={order.id} onClick={() => onOpen(order.id)}>№{order.number}<ChevronRight size={15} aria-hidden="true" /></button>)}</div>}
    <ErrorNotice message={error} />
    {notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    {rows.length ? <div className="kitchen-list">{rows.map(row => { const done = row.left === 0; const percent = Math.round(((row.total - row.left) / row.total) * 100); return <article key={row.key} className={`kitchen-item${done ? ' is-done' : ''}`}>
      <div className="kitchen-item-photo">{row.image ? <LazyImage src={row.image} alt="" /> : <ChefHat size={22} aria-hidden="true" />}</div>
      <div className="kitchen-item-main">
        <div className="kitchen-item-head"><h3>{row.name}</h3><span className="kitchen-item-count">{done ? 'Готово' : <>Осталось <b>{row.left}</b> из {row.total} шт.</>}</span></div>
        <div className="kitchen-progress" aria-hidden="true"><i style={{ width: `${percent}%` }} /></div>
        <div className="kitchen-lines">{row.lines.map(line => <button type="button" key={line.itemId} className={`kitchen-line${line.prepared ? ' is-done' : ''}`} disabled={busy !== null} aria-pressed={line.prepared} title={line.prepared ? 'Снять отметку' : 'Отметить приготовленным'} onClick={() => void mark([line.itemId], !line.prepared, `line-${line.itemId}`, `«${row.name}» в заказе №${line.number}`)}>{line.prepared ? <Check size={14} aria-hidden="true" /> : <i aria-hidden="true" />}<span>№{line.number}</span><b>{line.quantity} шт.</b>{!line.started && !line.prepared && <em>не начат</em>}</button>)}</div>
      </div>
      <button type="button" className={`portal-button portal-button-small kitchen-all${done ? ' is-undo' : ''}`} disabled={busy !== null} onClick={() => void mark(row.lines.filter(line => line.prepared === done).map(line => line.itemId), !done, row.key, `«${row.name}»`)}>{busy === row.key ? 'Сохраняем…' : done ? 'Вернуть в работу' : 'Всё готово'}</button>
    </article>; })}</div> : <EmptyState icon={<ChefHat size={30} aria-hidden="true" />} title="Сейчас готовить нечего">Подтверждённые заказы появятся здесь, сложенные по товарам.</EmptyState>}
  </section>;
}

function PaymentStatusLabel({ order }: { order: Order }) {
  const debt = order.payment_status === 'DEBT';
  return <span className={`portal-status ${order.payment_status === 'PAID' ? 'status-delivered' : debt ? 'status-debt' : 'status-unpaid'}`}>{debt ? <HandCoins size={12} aria-hidden="true" /> : <Banknote size={12} aria-hidden="true" />}{order.payment_status === 'PAID' ? (order.on_credit ? 'Долг оплачен' : 'Оплачено наличными') : debt ? 'В долгу' : 'Не оплачено'}</span>;
}

function OrdersPanel({ user }: { user: User }) {
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '', courier: '', search: '' });
  const [dateInput, setDateInput] = useState({ date_from: '', date_to: '' });
  const [dateInvalid, setDateInvalid] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<'available' | 'active' | 'history' | 'team'>('available');
  const [customerView, setCustomerView] = useState<'all' | 'active' | 'done'>('all');
  const [claiming, setClaiming] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const claimLock = useRef(false);
  const [claimError, setClaimError] = useState('');
  const [notice, setNotice] = useState('');
  const isAdmin = user.role === 'ADMIN';
  const isCourier = user.role === 'COURIER';
  const isCashier = user.role === 'CASHIER';
  const isPastry = user.role === 'PASTRY';
  const isStaff = isAdmin || isCourier || isCashier || isPastry;
  const fromDate = isPortalDate(filters.date_from) ? filters.date_from : '';
  const toDate = isPortalDate(filters.date_to) ? filters.date_to : '';
  const [orderLimit, setOrderLimit] = useState(ORDER_PAGE_SIZE);
  const params = new URLSearchParams(Object.entries({ ...filters, date_from: fromDate, date_to: toDate }).filter(([, value]) => value));
  if (orderLimit > ORDER_PAGE_SIZE) params.set('limit', String(orderLimit));
  const remote = useRemote<Order[]>(`/orders/?${params.toString()}`, true);
  const available = useRemote<AvailableOrder[]>(isCourier ? '/courier/available-orders/' : null, true);
  const team = useRemote<TeamOrders>(isCourier ? '/courier/team-orders/' : null, true);
  const couriers = useRemote<User[]>(isAdmin ? '/admin/couriers/' : null, true);
  const summaryFrom = fromDate || toDate || localToday();
  const summaryTo = toDate && toDate >= summaryFrom ? toDate : summaryFrom;
  const summary = useRemote<CashierSummary>(isCashier ? `/cashier/summary/?date_from=${summaryFrom}&date_to=${summaryTo}` : null, true);
  const dayLabel = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const summaryTitle = summaryFrom === summaryTo ? `за ${dayLabel(summaryFrom)}` : `с ${dayLabel(summaryFrom)} по ${dayLabel(summaryTo)}`;
  const overview = useRemote<AdminOverview>(isAdmin ? '/admin/overview/' : null, true);
  useEffect(() => { const timer = window.setTimeout(() => setFilters(value => ({ ...value, search })), 350); return () => window.clearTimeout(timer); }, [search]);
  const allOrders = remote.data || [];
  const isCustomer = user.role === 'CUSTOMER';
  const orders = isCourier ? allOrders.filter(order => terminal(order) === (view === 'history')) : (isCustomer || isPastry) && customerView !== 'all' ? allOrders.filter(order => terminal(order) === (customerView === 'done')) : allOrders;
  const active = allOrders.filter(order => !terminal(order)).length;
  const showAvailable = isCourier && view === 'available';
  useEffect(() => { setSelected(null); setOrderLimit(ORDER_PAGE_SIZE); }, [filters.status, filters.date_from, filters.date_to, filters.courier, filters.search]);
  useEffect(() => { if (remote.data && selected !== null && !remote.data.some(order => order.id === selected)) setSelected(null); }, [remote.data, selected]);
  const updateFilter = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const changeDate = (key: 'date_from' | 'date_to') => (event: ChangeEvent<HTMLInputElement>) => {
    const { value, validity } = event.currentTarget;
    const next = { ...dateInput, [key]: value };
    const valid = !validity.badInput && (!value || isPortalDate(value)) && !(next.date_from && next.date_to && next.date_to < next.date_from);
    setDateInput(next); setDateInvalid(!valid);
    if (valid) setFilters(current => ({ ...current, date_from: next.date_from, date_to: next.date_to }));
  };
  const refresh = () => { remote.retry(); available.retry(); team.retry(); summary.retry(); if (isAdmin) { couriers.retry(); overview.retry(); } };
  const claim = async (order: AvailableOrder) => {
    if (claimLock.current) return;
    claimLock.current = true; setClaiming(order.id); setClaimError(''); setNotice('');
    try {
      const updated = await api<Order>(`/orders/${order.id}/claim/`, json({}));
      remote.replace([updated, ...(remote.data || []).filter(item => item.id !== updated.id)]);
      available.replace((available.data || []).filter(item => item.id !== updated.id));
      setView('active'); setSelected(updated.id); setNotice(`Заказ №${updated.number} принят. Он появился в ваших доставках.`);
      refresh();
    } catch (err) {
      setClaimError(failure(err));
      if (err instanceof ApiError && err.status === 409) available.replace((available.data || []).filter(item => item.id !== order.id));
      refresh();
    } finally { claimLock.current = false; setClaiming(null); }
  };
  const togglePick = (id: number) => setPicked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const claimPicked = async () => {
    if (claimLock.current) return;
    const queue = (available.data || []).filter(order => picked.includes(order.id));
    if (!queue.length) return;
    claimLock.current = true; setClaiming(-1); setClaimError(''); setNotice('');
    const taken: Order[] = []; const missed: string[] = [];
    // One request per order: each claim is atomic on the server, so a race lost on one order does not undo the others.
    for (const order of queue) {
      try { taken.push(await api<Order>(`/orders/${order.id}/claim/`, json({}))); }
      catch { missed.push(`№${order.number}`); }
    }
    const takenIds = taken.map(order => order.id);
    remote.replace([...taken, ...(remote.data || []).filter(item => !takenIds.includes(item.id))]);
    available.replace((available.data || []).filter(item => !queue.some(order => order.id === item.id)));
    setPicked([]);
    if (taken.length) { setView('active'); setSelected(null); setNotice(`Принято заказов: ${taken.length}. Они появились в ваших доставках.`); }
    if (missed.length) setClaimError(`Не удалось принять ${missed.join(', ')}: их уже забрал другой курьер или они больше недоступны.`);
    claimLock.current = false; setClaiming(null);
    refresh();
  };
  useEffect(() => { setPicked(current => current.filter(id => (available.data || []).some(order => order.id === id))); }, [available.data]);
  const chooseView = (next: typeof view) => { setView(next); setSelected(null); setClaimError(''); setNotice(''); setPicked([]); };
  return <section aria-label={isCourier ? 'Ваши доставки' : isCashier ? 'Касса и заказы' : 'Ваши заказы'}>
    {isAdmin && <section className="portal-cash-summary portal-attention" aria-label="Что требует внимания">
      <div className="portal-section-title"><div><p className="portal-eyebrow">СЕГОДНЯ НА ПЕКАРНЕ</p><h2>Что требует внимания</h2></div><ShoppingBag size={26} aria-hidden="true" /></div>
      <ErrorNotice message={overview.error} retry={overview.retry} />
      {overview.loading ? <p role="status" className="portal-help">Считаем заказы…</p> : overview.data && <div className="portal-summary-grid portal-attention-grid">
        <article><span>Новые заказы</span><strong>{overview.data.new}</strong><small>Ждут подтверждения. Откройте заказ и нажмите «Подтвердить заказ».</small></article>
        <article><span>Без курьера</span><strong>{overview.data.unassigned}</strong><small>Заказы, которые ещё не принял курьер. Назначьте курьера в карточке заказа или дождитесь, пока курьер примет сам.</small></article>
        <article><span>В пути</span><strong>{overview.data.on_the_way}</strong><small>Переданы курьеру или уже едут к клиенту.</small></article>
        <article><span>Не оплачены или в долгу</span><strong>{overview.data.unpaid_delivered}</strong><small>Доставлены без отметки об оплате. Долги — во вкладке «Долг».</small></article>
      </div>}
    </section>}
    {isCashier && <section className="portal-cash-summary" aria-label="Сводка кассы">
      <div className="portal-section-title"><div><p className="portal-eyebrow">НАЛИЧНЫЕ ПОД КОНТРОЛЕМ</p><h2>Касса {summaryTitle}</h2></div><Banknote size={26} aria-hidden="true" /></div>
      <ErrorNotice message={summary.error} retry={summary.retry} />
      {summary.loading ? <p role="status" className="portal-help">Загружаем сводку кассы…</p> : summary.data && <div className="portal-summary-grid">
        <article><span>Получено наличными за день</span><strong>{money(summary.data.cash_received)}</strong><small>Оплаченных заказов: {summary.data.paid_count}</small></article>
        <article><span>Не оплачены или в долгу</span><strong>{money(summary.data.unpaid_delivered_total)}</strong><small>За все дни · заказов: {summary.data.unpaid_delivered_count}{summary.data.debt_count ? ` · в долгу: ${money(summary.data.debt_total ?? 0)} (${summary.data.debt_count})` : ''}</small></article>
        {(summary.data.in_delivery_count ?? 0) > 0 ? <article className="portal-cash-live"><span><Truck size={16} aria-hidden="true" />Сейчас в доставке</span><strong>{money(summary.data.in_delivery_total ?? 0)}</strong><small>Курьеры везут заказов: {summary.data.in_delivery_count}. Деньги поступят после доставки.</small><ul>{summary.data.in_delivery_orders?.map(item => <li key={item.id}><b>№{item.number}</b><span>{item.status === 'HANDED_OVER' ? 'Курьер забрал' : 'В пути'}{item.courier_name ? ` · ${item.courier_name}` : ''}</span><em>{money(item.total)}</em></li>)}</ul></article> : <article className="portal-cash-live portal-cash-live-empty"><span><Truck size={16} aria-hidden="true" />Сейчас в доставке</span><strong>{money(0)}</strong><small>Сейчас ни один курьер не везёт заказ.</small></article>}
      </div>}
      <p className="portal-help">В кассе отражаются только подтверждённые наличные. Для сводки за другой день выберите дату ниже.</p>
    </section>}
    <div className="portal-section-title"><div><p className="portal-eyebrow">{isCourier ? 'ДОСТАВКА ANASYM' : 'СВЕЖЕЕ И ВОВРЕМЯ'}</p><h2>{isCourier ? showAvailable ? 'Доступные заказы' : view === 'team' ? 'Заказы курьеров' : view === 'history' ? 'История доставок' : 'Мои активные доставки' : isPastry ? 'Заказы на кухне' : isAdmin || isCashier ? 'Все заказы' : 'Ваши заказы'}<span className="portal-count">{showAvailable ? available.data?.length || 0 : view === 'team' ? team.data?.orders.length || 0 : orders.length}</span></h2></div><div className="portal-refresh"><span><i />Обновляем каждые 5 секунд</span><button className="portal-icon-button" type="button" onClick={refresh} aria-label="Обновить заказы"><RefreshCw size={18} aria-hidden="true" /></button></div></div>
    {isCourier && <div className="portal-segment portal-courier-tabs" aria-label="Разделы доставок">
      <button type="button" className={view === 'available' ? 'active' : ''} aria-pressed={view === 'available'} onClick={() => chooseView('available')}>Доступные <span>{available.data?.length || 0}</span></button>
      <button type="button" className={view === 'active' ? 'active' : ''} aria-pressed={view === 'active'} onClick={() => chooseView('active')}>Мои активные <span>{active}</span></button>
      <button type="button" className={view === 'history' ? 'active' : ''} aria-pressed={view === 'history'} onClick={() => chooseView('history')}>История <span>{allOrders.length - active}</span></button>
      <button type="button" className={view === 'team' ? 'active' : ''} aria-pressed={view === 'team'} onClick={() => chooseView('team')}>Заказы <span>{team.data?.orders.length || 0}</span></button>
    </div>}
    {(isCustomer || isPastry) && allOrders.length > 0 && <div className="portal-chip-filters" role="group" aria-label="Какие заказы показать">{([['all', 'Все заказы', <ShoppingBag size={15} aria-hidden="true" />], ['active', 'Активные', <Truck size={15} aria-hidden="true" />], ['done', 'Завершённые', <Check size={15} aria-hidden="true" />]] as const).map(([value, label, icon]) => <button type="button" key={value} className={customerView === value ? 'active' : ''} aria-pressed={customerView === value} onClick={() => { setCustomerView(value); setSelected(null); }}>{icon}{label}</button>)}</div>}
    {(isAdmin || isCashier) && <div className={`portal-filters ${isCashier ? 'portal-cashier-filters' : ''}`}>
      <label className="portal-search"><Search size={18} aria-hidden="true" /><input name="order-search" autoComplete="off" aria-label="Поиск по номеру заказа или телефону" placeholder="Номер заказа или телефон" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label><span>Статус</span><select value={filters.status} onChange={e => updateFilter('status', e.target.value)}><option value="">Все статусы</option>{(isAdmin ? adminStatusFilters : [...statusSteps, 'CANCELLED'].map(status => [status, statusLabel[status]])).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="portal-date-range" role="group" aria-label="Период заказов и сводки кассы"><span>Период</span><div><input type="date" min="0001-01-01" max={dateInput.date_to || "9999-12-31"} aria-label="С даты" aria-invalid={dateInvalid || undefined} aria-describedby={dateInvalid ? 'portal-date-error' : undefined} value={dateInput.date_from} onChange={changeDate('date_from')} /><span aria-hidden="true">—</span><input type="date" min={dateInput.date_from || "0001-01-01"} max="9999-12-31" aria-label="По дату" aria-invalid={dateInvalid || undefined} aria-describedby={dateInvalid ? 'portal-date-error' : undefined} value={dateInput.date_to} onChange={changeDate('date_to')} /></div>{dateInvalid && <small id="portal-date-error" className="portal-danger-text">Укажите существующие даты; дата «по» не может быть раньше даты «с». Последний выбранный фильтр сохранён.</small>}</div>
      {isAdmin && <label><span>Курьер</span><select value={filters.courier} onChange={e => updateFilter('courier', e.target.value)}><option value="">Все курьеры</option>{couriers.data?.map(courier => <option key={courier.id} value={courier.id}>{courier.name}{!courier.is_active ? ' (заблокирован)' : ''}</option>)}</select></label>}
      {(Object.values(filters).some(Boolean) || dateInvalid) && <button type="button" className="portal-text-button" onClick={() => { setFilters({ status: '', date_from: '', date_to: '', courier: '', search: '' }); setDateInput({ date_from: '', date_to: '' }); setDateInvalid(false); setSearch(''); }}>Сбросить</button>}
    </div>}
    <ErrorNotice message={claimError} />
    {notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    {isCourier && view === 'team' ? <TeamOrdersView user={user} team={team} onTransferred={message => { setNotice(message); refresh(); }} /> : showAvailable ? <>
      <p className="portal-queue-note">Эти заказы видят все активные курьеры. Заказ закрепляется за тем, кто первым его примет. Можно взять сразу несколько: отметьте нужные заказы и нажмите «Принять выбранные».</p>
      {picked.length > 0 && <div className="portal-pick-bar" role="status"><span>Выбрано заказов: <b>{picked.length}</b></span><div><button type="button" className="portal-text-button" disabled={claiming !== null} onClick={() => setPicked([])}>Снять выбор</button><button type="button" className="portal-button portal-button-small" disabled={claiming !== null} onClick={() => void claimPicked()}>{claiming === -1 ? 'Принимаем…' : `Принять выбранные (${picked.length})`}<ArrowRight size={17} aria-hidden="true" /></button></div></div>}
      <ErrorNotice message={available.error} retry={available.retry} />
      {available.loading ? <div className="portal-loading" role="status"><RefreshCw size={22} aria-hidden="true" /> Загружаем доступные заказы…</div> : available.data && <div className="portal-available-grid">
        {available.data.length ? available.data.map(order => <article className={`portal-available-card${picked.includes(order.id) ? ' is-picked' : ''}`} key={order.id}>
          <div className="portal-order-card-top"><strong>Заказ №{order.number}</strong><label className="portal-pick"><input type="checkbox" checked={picked.includes(order.id)} disabled={claiming !== null} onChange={() => togglePick(order.id)} aria-label={`Выбрать заказ №${order.number}`} /><span>Выбрать</span></label></div>
          <p className="portal-order-date">{dateTime(order.created_at)}</p><Status status={order.status} />
          <p className="portal-queue-address"><MapPin size={17} aria-hidden="true" /><span>{order.address}</span></p>
          <ul className="portal-queue-items">{order.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name}</span><b>{item.quantity} шт.</b></li>)}</ul>
          <div className="portal-order-card-bottom"><span>{order.items_count} шт.</span><strong>{money(order.total)}</strong></div>
          <button type="button" className="portal-button" disabled={claiming !== null} onClick={() => void claim(order)}>{claiming === order.id ? 'Принимаем…' : 'Принять заказ'}<ArrowRight size={17} aria-hidden="true" /></button>
          <p className="portal-help">Контакты получателя откроются после принятия заказа.</p>
        </article>) : <EmptyState icon={<Truck size={32} aria-hidden="true" />} title="Свободных заказов пока нет">Новый заказ появится здесь автоматически, как только покупатель оформит его.</EmptyState>}
      </div>}
    </> : <>
      <ErrorNotice message={remote.error} retry={remote.retry} />{isAdmin && <ErrorNotice message={couriers.error} retry={couriers.retry} />}
      {remote.loading ? <div className="portal-loading" role="status"><RefreshCw size={22} aria-hidden="true" /> Загружаем заказы…</div> : remote.data && <div className={`portal-orders-layout ${selected ? 'has-selection' : ''} ${!orders.length && !selected ? 'portal-empty-layout' : ''}`}>
        <div className="portal-order-list portal-order-list-fancy">{orders.length ? orders.map(order => <button type="button" key={order.id} className={`portal-order-card ${selected === order.id ? 'selected' : ''}`} aria-pressed={selected === order.id} onClick={() => setSelected(order.id)}>
          <div className="portal-order-card-top"><span className="portal-order-icon" aria-hidden="true"><Package size={20} strokeWidth={1.6} /></span><strong>Заказ №{order.number}</strong><ChevronRight size={19} aria-hidden="true" /></div><div className="portal-order-date">{dateTime(order.created_at)}</div>
          <div className="portal-order-badges"><Status status={order.status} customer={!isStaff} /><PaymentStatusLabel order={order} /></div>
          {isStaff && <p className="portal-order-recipient">{order.recipient_name}<span>{order.address}</span></p>}
          {!isCourier && isStaff && (order.courier_name ? <p className="portal-order-courier"><Truck size={14} aria-hidden="true" /><span>Курьер:</span> <strong>{order.courier_name}</strong></p> : !terminal(order) && <p className="portal-order-courier is-waiting"><Clock3 size={14} aria-hidden="true" /><span>Ищем свободного курьера</span></p>)}
          <div className="portal-order-card-bottom"><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} шт.</span><strong>{money(order.total)}</strong></div>
        </button>) : <EmptyState icon={isCourier ? <Truck size={32} aria-hidden="true" /> : <ShoppingBag size={32} aria-hidden="true" />} title={isPastry ? 'Заказов пока нет' : isCourier ? view === 'history' ? 'Доставки ещё впереди' : 'Пока нет активных доставок' : isAdmin || isCashier ? 'Заказы не найдены' : 'Здесь будет ваша история'}>{isPastry ? 'Новые заказы появятся здесь автоматически.' : isCourier ? view === 'history' ? 'Завершённые доставки появятся здесь.' : 'Откройте доступные заказы и примите подходящую доставку.' : isAdmin || isCashier ? 'Измените фильтры или дождитесь нового заказа.' : <>Выберите что-нибудь к чаю — и первый заказ появится здесь. <a href="/catalog">Перейти в каталог <ArrowRight size={15} aria-hidden="true" /></a></>}</EmptyState>}{allOrders.length >= orderLimit && orderLimit < MAX_ORDER_LIMIT && <button type="button" className="portal-text-button" onClick={() => setOrderLimit(limit => Math.min(limit + ORDER_PAGE_SIZE, MAX_ORDER_LIMIT))}>Показать ещё</button>}{allOrders.length >= MAX_ORDER_LIMIT && <p className="portal-help">Показаны последние {MAX_ORDER_LIMIT} заказов. Более ранние можно найти через фильтры.</p>}</div>
        {selected ? <OrderDetail key={selected} id={selected} user={user} couriers={couriers.data || []} onChange={refresh} onClose={() => setSelected(null)} /> : orders.length > 0 && <div className="portal-detail-placeholder"><ShoppingBag size={34} strokeWidth={1.3} aria-hidden="true" /><h3>Всё о вашем заказе</h3><p>Выберите заказ, чтобы увидеть состав, адрес и историю статусов.</p></div>}
      </div>}
    </>}
  </section>;
}
function OrderDetail({ id, user, couriers, onChange, onClose }: { id: number; user: User; couriers: User[]; onChange: () => void; onClose: () => void }) {
  const remote = useRemote<Order>(`/orders/${id}/`, true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState('');
  const [courier, setCourier] = useState('');
  const [paymentConfirm, setPaymentConfirm] = useState(false);
  const [cashConfirm, setCashConfirm] = useState(false);
  // Second step before an order goes on credit: the courier confirms it once more and ticks the box.
  const [creditConfirm, setCreditConfirm] = useState(false);
  const [creditAgreed, setCreditAgreed] = useState(false);
  const [agreed, setAgreed] = useState(false);
  useEffect(() => { setAgreed(false); setCreditConfirm(false); setCreditAgreed(false); }, [remote.data?.status]);
  const paymentKey = useRef<string | null>(null);
  const mutationLock = useRef(false);
  const assignmentChanged = useRef(false);
  const detailRef = useRef<HTMLElement>(null);
  const order = remote.data;
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const bounds = detailRef.current?.getBoundingClientRect();
      if (bounds && (bounds.top < 0 || bounds.top > window.innerHeight - 120)) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [id]);
  useEffect(() => { if (order && !assignmentChanged.current) setCourier(order.courier ? String(order.courier) : ''); }, [order]);
  useEffect(() => { if (order?.payment_status === 'PAID') { setPaymentConfirm(false); setError(''); } }, [order?.payment_status]);
  const mutate = async (suffix: string, payload: unknown, success: string) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await api<Order>(`/orders/${id}/${suffix}/`, json(payload));
      remote.replace(updated); setNotice(success);
      if (suffix === 'assign') assignmentChanged.current = false;
      if (suffix === 'problem') setProblem('');
      if (suffix === 'payment') setPaymentConfirm(false);
      if (updated.status === 'CANCELLED') { setCancel(false); setReason(''); }
      onChange();
    }
    catch (err) { setError(failure(err)); if (err instanceof ApiError && [403, 404, 409].includes(err.status)) { remote.retry(); onChange(); } }
    finally { mutationLock.current = false; setBusy(false); }
  };
  if (!order) return <article ref={detailRef} className="portal-card portal-order-detail"><div className="portal-section-title"><h3>Заказ</h3><button type="button" className="portal-icon-button" onClick={onClose} aria-label="Закрыть детали заказа"><X size={19} aria-hidden="true" /></button></div>{remote.loading && <p role="status">Загружаем детали…</p>}<ErrorNotice message={remote.error} retry={remote.retry} /></article>;
  const courierBlocked = ['HANDED_OVER', 'IN_TRANSIT'].includes(order.status) && order.courier_is_active === false;
  const isAdmin = user.role === 'ADMIN';
  const isCourier = user.role === 'COURIER';
  const isCashier = user.role === 'CASHIER';
  const isPastry = user.role === 'PASTRY';
  const nextStatuses: Record<string, string> = isAdmin ? { NEW: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY' } : isPastry ? { NEW: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY' } : isCourier ? { READY: 'HANDED_OVER', HANDED_OVER: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED' } : {};
  const next = nextStatuses[order.status];
  const nextLabels: Record<string, string> = { CONFIRMED: 'Подтвердить заказ', PREPARING: 'Начать приготовление', READY: 'Заказ готов', HANDED_OVER: 'Забрать заказ из пекарни', IN_TRANSIT: 'Начать доставку', DELIVERED: 'Подтвердить доставку' };
  return <article ref={detailRef} className="portal-card portal-order-detail portal-detail-fancy"><div className="portal-section-title"><div><p className="portal-eyebrow">{dateTime(order.created_at)}</p><h2>Заказ №{order.number}</h2></div><button type="button" className="portal-icon-button" onClick={onClose} aria-label="Закрыть детали заказа"><X size={20} aria-hidden="true" /></button></div>{order.status !== 'CANCELLED' ? <OrderProgress order={order} role={user.role} /> : <Status status={order.status} customer={user.role === 'CUSTOMER'} />}<ErrorNotice message={remote.error} retry={remote.retry} />
    <section className="portal-detail-section"><h3><ShoppingBag size={17} aria-hidden="true" /> Состав заказа<span className="portal-items-count">{positions(order.items.length)}</span></h3><ul className="portal-order-items">{order.items.map(item => <li key={item.id}><div className="portal-item-thumb">{item.image && <LazyImage src={item.image} alt="" />}<em aria-hidden="true">×{item.quantity}</em></div><div><strong>{item.name}</strong><span><mark>{item.quantity} шт.</mark> по {money(item.price)}</span></div><b>{money(Number(item.price) * item.quantity)}</b></li>)}</ul><dl className="portal-totals"><div><dt>Выпечка</dt><dd>{money(order.subtotal)}</dd></div><div><dt>Доставка</dt><dd>{Number(order.delivery_fee) ? money(order.delivery_fee) : 'Бесплатно'}</dd></div><div className="portal-total"><dt>Итого</dt><dd>{money(order.total)}</dd></div></dl></section>
    {order.cancellation_reason && <div className="portal-notice portal-error"><div><strong>Причина отмены</strong><p>{order.cancellation_reason}</p></div></div>}
    <div className="portal-detail-grid">
    <section className="portal-detail-section portal-detail-delivery"><h3><MapPin size={17} aria-hidden="true" /> Куда доставить</h3><dl className="portal-delivery"><div><dt>Адрес</dt><dd className="portal-delivery-address">{order.address}</dd></div><div><dt>Получатель</dt><dd className="portal-delivery-name">{order.recipient_name}</dd></div><div><dt>Телефон</dt><dd><a className="portal-phone" href={`tel:${order.phone}`}><Phone size={14} aria-hidden="true" />{order.phone}</a></dd></div>{user.role !== 'CUSTOMER' && (order.courier_name || !['DELIVERED', 'CANCELLED'].includes(order.status)) && <div><dt>Курьер</dt><dd className={`portal-delivery-courier${order.courier_name ? '' : ' is-waiting'}`}><Truck size={16} aria-hidden="true" />{order.courier_name || 'Ещё не назначен — заказ уйдёт первому свободному курьеру'}</dd></div>}</dl>{order.comment && <div className="portal-comment"><span>Комментарий к заказу</span><p>{order.comment}</p></div>}</section>
    <div className="portal-detail-side">
    <section className="portal-detail-section portal-payment"><h3><Banknote size={17} aria-hidden="true" /> Оплата заказа</h3><PaymentStatusLabel order={order} />{order.payment_status === 'PAID' ? <p className="portal-payment-receipt">Получено наличными: <strong>{money(order.total)}</strong>{order.paid_at && <span>{dateTime(order.paid_at)}{order.paid_by_name ? ` · ${order.paid_by_name}` : ''}</span>}</p> : order.payment_status === 'DEBT' ? <p className="portal-payment-receipt portal-payment-debt">Записан в долг: <strong>{money(order.total)}</strong>{order.credit_at && <span>{dateTime(order.credit_at)}{order.credit_by_name ? ` · курьер ${order.credit_by_name}` : ''}</span>}</p> : <p className="portal-help">{order.status === 'CANCELLED' ? 'Заказ отменён, оплата не требуется.' : `К оплате наличными: ${money(order.total)}. Получение наличных подтверждает кассир или администратор после доставки.`}</p>}</section>
    <section className="portal-detail-section"><h3><Clock3 size={17} aria-hidden="true" /> История заказа</h3><ol className="portal-timeline">{order.status_history.length ? order.status_history.map((entry, index) => <li key={entry.id} className={index === order.status_history.length - 1 ? 'current' : ''}><span className="portal-timeline-dot"><Check size={10} aria-hidden="true" /></span><div><strong>{statusLabel[entry.to_status] || entry.to_status}</strong><span>{dateTime(entry.created_at)}{(isAdmin || isCourier || isCashier || isPastry) && entry.actor_name ? ` · ${entry.actor_name}` : ''}</span></div></li>) : <li className="current"><span className="portal-timeline-dot" /><div><strong>{statusLabel[order.status]}</strong><span>{dateTime(order.created_at)}</span></div></li>}</ol></section>
    </div>
    </div>
    {user.role === 'CUSTOMER' && (order.status === 'NEW' || notice || error) && <div className="portal-order-actions portal-customer-actions"><ErrorNotice message={error} />{notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
      {order.status === 'NEW' && (cancel ? <form className="portal-form portal-cancel" onSubmit={event => { event.preventDefault(); void mutate('cancel', { reason: reason.trim() }, 'Заказ отменён.'); }}><h3>Отменить заказ №{order.number}?</h3><p className="portal-help">Заказ ещё не подтвердили, поэтому его можно отменить. После подтверждения отменить заказ можно будет только через пекарню.</p><label>Причина отмены (необязательно)<textarea disabled={busy} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} placeholder="Например: передумал(а), ошибся адресом" /></label><div className="portal-form-actions"><button className="portal-button portal-button-danger" disabled={busy}>{busy ? 'Отменяем…' : 'Да, отменить заказ'}</button><button className="portal-text-button" type="button" disabled={busy} onClick={() => setCancel(false)}>Не отменять</button></div></form> : <button type="button" className="portal-text-button portal-danger-text" disabled={busy} onClick={() => { setCancel(true); setError(''); setNotice(''); }}><X size={16} aria-hidden="true" />Отменить заказ</button>)}
    </div>}
    {(isAdmin || isCourier || isCashier || isPastry) && <div className="portal-order-actions"><ErrorNotice message={error} />{notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
      {(isAdmin || isCashier) && order.status === 'DELIVERED' && order.payment_status !== 'PAID' && (paymentConfirm ? <form className="portal-payment-confirm" onSubmit={event => { event.preventDefault(); paymentKey.current ||= crypto.randomUUID(); void mutate('payment', { method: 'CASH', idempotency_key: paymentKey.current }, 'Оплата наличными подтверждена. Сумма учтена в кассе.'); }}><h3>Подтвердите получение наличных</h3><p>За заказ №{order.number} получена полная сумма <strong>{money(order.total)}</strong>?</p><p className="portal-help">Сумма заказа фиксирована. Подтвердите только после получения денег.</p><div className="portal-form-actions"><button className="portal-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Подтвердить получение'}<Banknote size={17} aria-hidden="true" /></button><button type="button" className="portal-text-button" disabled={busy} onClick={() => setPaymentConfirm(false)}>Отмена</button></div></form> : <button type="button" className="portal-button portal-next" disabled={busy} onClick={() => { setPaymentConfirm(true); setError(''); setNotice(''); }}>{order.payment_status === 'DEBT' ? 'Отметить оплату долга' : 'Отметить оплату наличными'}<Banknote size={17} aria-hidden="true" /></button>)}
      {isCourier && ['NEW', 'CONFIRMED', 'PREPARING'].includes(order.status) && <p className="portal-waiting"><Clock3 size={19} aria-hidden="true" /><span>Заказ закреплён за вами. Ожидайте, пока пекарня подготовит его к выдаче.</span></p>}
      {isAdmin && courierBlocked && <p className="portal-help">Курьер заблокирован. Назначьте другого курьера, чтобы завершить доставку.</p>}
      {isAdmin && !order.courier && ['NEW', 'CONFIRMED', 'PREPARING', 'READY'].includes(order.status) && <p className="portal-waiting"><Clock3 size={19} aria-hidden="true" /><span>Все курьеры заняты. Заказ автоматически уйдёт первому, кто освободится.</span></p>}{isAdmin && courierBlocked && <form className="portal-assign" onSubmit={event => { event.preventDefault(); void mutate('assign', { courier_id: Number(courier) }, 'Курьер назначен.'); }}><label>Курьер<select disabled={busy} value={courier} onChange={event => { assignmentChanged.current = true; setCourier(event.target.value); }} required><option value="">Выберите курьера</option>{couriers.filter(person => person.is_active || person.id === order.courier).map(person => <option value={person.id} key={person.id} disabled={!person.is_active}>{person.name}{!person.is_active ? ' (заблокирован)' : ''}</option>)}</select></label><button className="portal-button portal-button-small" disabled={busy || !courier || Number(courier) === order.courier}>Назначить</button></form>}
      {next === 'DELIVERED' && cashConfirm && creditConfirm && <form className="portal-payment-confirm portal-credit-confirm" onSubmit={event => { event.preventDefault(); if (!creditAgreed) return; setCashConfirm(false); setCreditConfirm(false); void mutate('transition', { status: 'DELIVERED', on_credit: true }, `Заказ доставлен и записан в долг клиенту: ${money(order.total)}. Он появится во вкладке «Долг».`); }}><h3><HandCoins size={19} aria-hidden="true" /> Точно записать в долг?</h3><p>Заказ №{order.number} будет завершён, а клиент <strong>{order.recipient_name}</strong> останется должен <strong>{money(order.total)}</strong>. Отменить запись в долг потом нельзя — только отметить оплату.</p><label className="portal-step-agree"><input type="checkbox" checked={creditAgreed} disabled={busy} onChange={event => setCreditAgreed(event.target.checked)} /><span>Я передал(а) заказ клиенту, денег не получил(а). Клиент оплатит позже.</span></label><div className="portal-form-actions"><button className="portal-button portal-debt-confirm-button" disabled={busy || !creditAgreed}>{busy ? 'Сохраняем…' : 'Да, записать в долг'}<HandCoins size={17} aria-hidden="true" /></button><button type="button" className="portal-text-button" disabled={busy} onClick={() => { setCreditConfirm(false); setCreditAgreed(false); }}>Назад</button></div></form>}
      {next === 'DELIVERED' && cashConfirm && !creditConfirm && <form className="portal-payment-confirm" onSubmit={event => { event.preventDefault(); setCashConfirm(false); void mutate('transition', { status: 'DELIVERED', cash_received: true }, 'Доставка и оплата подтверждены. Заказ отмечен как оплаченный — сдайте наличные в кассу.'); }}><h3>Клиент оплатил заказ?</h3><p>Заказ №{order.number} оплачивается наличными при получении. Возьмите у клиента <strong>{money(order.total)}</strong> и только потом подтвердите доставку.</p><div className="portal-form-actions"><button className="portal-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Да, деньги получены'}<Banknote size={17} aria-hidden="true" /></button><button type="button" className="portal-button portal-button-outline portal-debt-button" disabled={busy} onClick={() => { setCreditConfirm(true); setCreditAgreed(false); setError(''); }}>Записать в долг<HandCoins size={17} aria-hidden="true" /></button><button type="button" className="portal-text-button" disabled={busy} onClick={() => setCashConfirm(false)}>Назад</button></div><p className="portal-help">Если клиент оплатит позже, нажмите «Записать в долг»: заказ будет завершён, а сумма появится в долге клиента.</p></form>}
      {next && !isAdmin && !(next === 'DELIVERED' && cashConfirm) && <label className="portal-step-agree"><input type="checkbox" checked={agreed} disabled={busy} onChange={event => setAgreed(event.target.checked)} /><span>Я проверил(а) заказ №{order.number} и подтверждаю следующий шаг: <strong>«{nextLabels[next]}»</strong></span></label>}
      {next && !(next === 'DELIVERED' && cashConfirm) && <button className="portal-button portal-next" disabled={busy || (next === 'HANDED_OVER' && !order.courier) || (!isAdmin && !agreed)} onClick={() => { if (next === 'DELIVERED' && order.payment_status !== 'PAID') { setCashConfirm(true); setError(''); setNotice(''); } else void mutate('transition', { status: next }, 'Статус заказа обновлён.'); }}>{busy ? 'Сохраняем…' : nextLabels[next]}<ArrowRight size={17} aria-hidden="true" /></button>}
      {next === 'HANDED_OVER' && !order.courier && <p className="portal-help">Для передачи заказа сначала назначьте курьера.</p>}
      {isAdmin && !terminal(order) && (cancel ? <form className="portal-form portal-cancel" onSubmit={event => { event.preventDefault(); if (reason.trim()) void mutate('transition', { status: 'CANCELLED', reason: reason.trim() }, 'Заказ отменён.'); }}><label>Причина отмены<textarea disabled={busy} value={reason} onChange={e => setReason(e.target.value)} required maxLength={2000} placeholder="Укажите причину — её увидит покупатель" /></label><div className="portal-form-actions"><button className="portal-button portal-button-danger" disabled={busy || !reason.trim()}>Подтвердить отмену</button><button className="portal-text-button" type="button" disabled={busy} onClick={() => setCancel(false)}>Не отменять</button></div></form> : <button className="portal-text-button portal-danger-text" disabled={busy} onClick={() => setCancel(true)}>Отменить заказ</button>)}
      {isCourier && !terminal(order) && <form className="portal-form portal-problem" onSubmit={event => { event.preventDefault(); if (problem.trim()) void mutate('problem', { message: problem.trim() }, 'Сообщение о проблеме отправлено администратору.'); }}><label>Возникла проблема?<textarea disabled={busy} value={problem} onChange={e => setProblem(e.target.value)} required maxLength={2000} placeholder="Например, получатель не отвечает на звонок" /></label><button className="portal-button portal-button-outline" disabled={busy || !problem.trim()}>Сообщить администратору</button></form>}
      {!!order.problems.length && <section className="portal-problems"><h3>Сообщения о доставке</h3>{order.problems.map(item => <div className="portal-comment" key={item.id}><span>{dateTime(item.created_at)}{item.actor_name ? ` · ${item.actor_name}` : ''}</span><p>{item.message}</p></div>)}</section>}
    </div>}
  </article>;
}

type ProductDraft = { name: string; category: string; description: string; image: string; price: string; wholesale_price: string; weight: string; pieces: string; ingredients: string; allergens: string; is_visible: boolean; is_available: boolean };
const newProduct: ProductDraft = { name: '', category: '', description: '', image: '', price: '', wholesale_price: '', weight: '', pieces: '', ingredients: '', allergens: '', is_visible: true, is_available: true };
function ProductsPanel() {
  const remote = useRemote<Product[]>('/admin/products/');
  const categories = useRemote<Category[]>('/admin/categories/');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const editor = useEditorReveal(editing === 'new' ? 'new' : editing?.id ?? null);
  const [draft, setDraft] = useState<ProductDraft>(newProduct);
  const [photoBusy, setPhotoBusy] = useState(false);
  // A chosen file (or the current photo) opens in the cropper first; only the framed result is uploaded.
  const [cropSource, setCropSource] = useState<File | string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState<number | null>(null);
  const start = (product: Product | 'new', trigger: HTMLElement) => { editor.rememberTrigger(trigger); setEditing(product); setError(''); setNotice(''); setDraft(product === 'new' ? { ...newProduct, category: String(categories.data?.[0]?.id || '') } : { ...product, category: String(product.category), price: String(product.price), wholesale_price: product.wholesale_price == null ? '' : String(product.wholesale_price), pieces: product.pieces == null ? '' : String(product.pieces) }); };
  const field = (key: keyof ProductDraft, value: string | boolean) => setDraft(current => ({ ...current, [key]: value }));
  const choosePhoto = (file?: File) => {
    if (!file) return;
    setError('');
    setCropSource(file);
  };
  const uploadFramed = async (photo: Blob) => {
    setCropSource(null);
    setPhotoBusy(true);
    setError('');
    try { field('image', await uploadProductPhoto(new File([photo], 'photo.jpg', { type: 'image/jpeg' }))); }
    catch (err) { setError((err as Error).message); }
    finally { setPhotoBusy(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await api(`/admin/products/${editing !== 'new' && editing ? `${editing.id}/` : ''}`, json({ ...draft, name: draft.name.trim(), category: Number(draft.category), wholesale_price: draft.wholesale_price.trim() ? draft.wholesale_price.trim() : null, pieces: draft.pieces.trim() ? Number(draft.pieces) : null }, editing === 'new' ? 'POST' : 'PATCH')); setEditing(null); setNotice('Товар сохранён.'); remote.retry(); }
    catch (err) { setError(failure(err)); }
    finally { setBusy(false); }
  };
  const toggle = async (product: Product, key: 'is_visible' | 'is_available') => {
    setError(''); setBusy(true); setNotice('');
    try { await api(`/admin/products/${product.id}/`, json({ [key]: !product[key] }, 'PATCH')); remote.retry(); }
    catch (err) { setError(failure(err)); }
    finally { setBusy(false); }
  };
  const remove = async (product: Product) => {
    setError(''); setBusy(true); setNotice('');
    try { await api(`/admin/products/${product.id}/`, { method: 'DELETE' }); setConfirming(null); setNotice(`Товар «${product.name}» удалён.`); remote.retry(); }
    catch (err) { setError(failure(err)); setConfirming(null); }
    finally { setBusy(false); }
  };
  const products = (remote.data || []).filter(product => product.name.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')));
  return <section><div className="portal-section-title"><div><p className="portal-eyebrow">ВИТРИНА ПЕКАРНИ</p><h2>Наша выпечка <span className="portal-count">{remote.data?.length || 0}</span></h2></div><button className="portal-button" disabled={busy} onClick={event => start('new', event.currentTarget)}><Plus size={17} aria-hidden="true" /> Добавить товар</button></div><ErrorNotice message={remote.error} retry={remote.retry} /><ErrorNotice message={categories.error} retry={categories.retry} />{!editing && <ErrorNotice message={error} />}{notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    {editing && <section ref={editor.ref} tabIndex={-1} className="portal-editor product-editor"><div className="portal-section-title"><h3>{editing === 'new' ? 'Новый товар' : `Редактировать: ${editing.name}`}</h3></div><form className="portal-form" onSubmit={save}><fieldset className="portal-form-fields" disabled={busy}>
      <div className="product-editor-grid">
        <div className="product-editor-main">
          <section className="product-card"><h4><Package size={20} aria-hidden="true" />Основная информация</h4><div className="product-fields">
            <label><span>Название <i>*</i></span><input value={draft.name} onChange={e => field('name', e.target.value)} required maxLength={160} /></label>
            <label><span>Категория <i>*</i></span><select value={draft.category} onChange={e => field('category', e.target.value)} required><option value="">Выберите категорию</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label><span>Цена, ₸ <i>*</i></span><input type="number" min="0" step="0.01" value={draft.price} onChange={e => field('price', e.target.value)} required /></label>
            <label><span>Оптовая цена для заведений, ₸ <small>(необязательно)</small></span><input type="number" min="0.01" step="0.01" value={draft.wholesale_price} onChange={e => field('wholesale_price', e.target.value)} /></label>
            <label>Вес или объём<input value={draft.weight} onChange={e => field('weight', e.target.value)} placeholder="120 г" maxLength={80} /></label>
            <label><span>Количество, шт. <small>(необязательно)</small></span><input type="number" min="1" max="1000" step="1" inputMode="numeric" value={draft.pieces} onChange={e => field('pieces', e.target.value)} placeholder="6" /></label>
          </div></section>
          <section className="product-card"><h4><FileText size={20} aria-hidden="true" />Описание</h4><label className="product-full"><span className="sr-only">Описание</span><textarea value={draft.description} onChange={e => field('description', e.target.value)} placeholder="Описание товара" maxLength={5000} /></label></section>
          <section className="product-card"><h4><FlaskConical size={20} aria-hidden="true" />Состав и аллергены</h4><div className="product-fields">
            <label>Состав<textarea value={draft.ingredients} onChange={e => field('ingredients', e.target.value)} maxLength={3000} /></label>
            <label>Аллергены<textarea value={draft.allergens} onChange={e => field('allergens', e.target.value)} placeholder="Глютен, молоко, яйца" maxLength={2000} /></label>
          </div></section>
        </div>
        <div className="product-editor-side">
          <section className="product-card"><h4><ImageIcon size={20} aria-hidden="true" />Фотография товара</h4>
            <div className="product-photo-preview">{draft.image ? <img src={draft.image} alt="" /> : <span><ImageIcon size={34} strokeWidth={1.3} aria-hidden="true" />Фото ещё не выбрано</span>}</div>{draft.image && <p className="product-photo-note">Так фото выглядит в каталоге.</p>}
            <label className={`product-dropzone${photoBusy ? ' is-busy' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choosePhoto(event.dataTransfer.files?.[0]); }}>
              <Upload size={22} aria-hidden="true" />
              <span className="product-dropzone-button">{photoBusy ? 'Загружаем фото…' : draft.image ? 'Заменить фото' : 'Выбрать файл'}</span>
              <small>или перетащите фото сюда</small>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={e => { choosePhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {draft.image && <button type="button" className="product-secondary product-reframe" disabled={photoBusy} onClick={() => setCropSource(draft.image)}><Crop size={16} aria-hidden="true" />Изменить кадр текущего фото</button>}
            <p className="product-hint">JPEG, PNG или WebP. После выбора можно подвинуть, приблизить и повернуть фото.</p>
          </section>
          <section className="product-card"><h4><Settings size={20} aria-hidden="true" />Настройки</h4><div className="product-switches">
            <label><input type="checkbox" checked={draft.is_visible} onChange={e => field('is_visible', e.target.checked)} />Показывать в каталоге</label>
            <label><input type="checkbox" checked={draft.is_available} onChange={e => field('is_available', e.target.checked)} />Доступен для заказа</label>
          </div></section>
        </div>
      </div>
      <ErrorNotice message={error} />
      {cropSource && <PhotoCropper source={cropSource} onCancel={() => setCropSource(null)} onDone={photo => void uploadFramed(photo)} />}
      <div className="product-actions"><button className="portal-button product-save" disabled={busy || !draft.name.trim()}><Check size={18} aria-hidden="true" />{busy ? 'Сохраняем…' : 'Сохранить товар'}</button><button type="button" className="product-secondary" disabled={busy} onClick={() => setEditing(null)}>Отмена</button><button type="button" className="product-secondary product-close" disabled={busy} onClick={() => setEditing(null)} aria-label="Закрыть редактирование товара"><X size={17} aria-hidden="true" />Закрыть</button></div>
    </fieldset></form></section>}
    <label className="portal-search portal-product-search"><Search size={18} aria-hidden="true" /><input name="product-search" autoComplete="off" aria-label="Найти товар по названию" placeholder="Найти любимую выпечку" value={search} onChange={e => setSearch(e.target.value)} /></label>
    {remote.loading ? <p className="portal-loading" role="status">Загружаем товары…</p> : remote.data && <div className="portal-products">{products.length ? products.map(product => <article className={`portal-product ${!product.is_visible ? 'is-hidden' : ''}`} key={product.id}><div className="portal-product-image">{product.image ? <LazyImage src={product.image} alt={product.name} /> : <Package size={36} aria-hidden="true" />}{!product.is_available && <span>Нет в наличии</span>}</div><div className="portal-product-content"><p>{categories.data?.find(category => category.id === product.category)?.name || 'Категория'}</p><h3>{product.name}</h3><div className="portal-product-price"><strong>{money(product.price)}</strong><span>{product.weight}</span></div>{confirming === product.id ? <div className="portal-product-confirm"><p>Удалить «{product.name}» навсегда? Это действие нельзя отменить.</p><div><button className="portal-button portal-button-danger" disabled={busy} onClick={() => void remove(product)}>{busy ? 'Удаляем…' : 'Удалить'}<Trash2 size={16} aria-hidden="true" /></button><button type="button" className="portal-text-button" disabled={busy} onClick={() => setConfirming(null)}>Отмена</button></div></div> : <><div className="portal-product-actions"><button className="portal-text-button" disabled={busy} onClick={event => start(product, event.currentTarget)}><Pencil size={15} aria-hidden="true" />Изменить</button><span className="portal-product-icons"><button className="portal-icon-button" disabled={busy} onClick={() => void toggle(product, 'is_visible')} aria-label={`${product.is_visible ? 'Скрыть' : 'Показать'} товар «${product.name}»`} title={product.is_visible ? 'Скрыть из каталога' : 'Показать в каталоге'}>{product.is_visible ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}</button><button className="portal-icon-button portal-delete" disabled={busy} onClick={() => { setConfirming(product.id); setError(''); setNotice(''); }} aria-label={`Удалить товар «${product.name}»`} title="Удалить товар навсегда"><Trash2 size={17} aria-hidden="true" /></button></span></div><button className="portal-stock-toggle" disabled={busy} onClick={() => void toggle(product, 'is_available')}><i className={product.is_available ? 'available' : ''} />{product.is_available ? 'В наличии · убрать' : 'Нет в наличии · вернуть'}</button>{!product.is_visible && <p className="portal-help">Скрыт из каталога</p>}</>}</div></article>) : <EmptyState icon={<Package size={30} aria-hidden="true" />} title="Товары не найдены">{search ? 'Попробуйте другое название.' : 'Добавьте первый товар, чтобы наполнить витрину.'}</EmptyState>}</div>}
  </section>;
}

type CategoryDraft = { name: string; slug: string; description: string; image: string; is_visible: boolean };
const newCategory: CategoryDraft = { name: '', slug: '', description: '', image: '', is_visible: true };
function CategoriesPanel() {
  const remote = useRemote<Category[]>('/admin/categories/');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const editor = useEditorReveal(editing === 'new' ? 'new' : editing?.id ?? null);
  const [draft, setDraft] = useState(newCategory);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  // Same upload as product photos: the photo is shrunk in the browser, stored by the server, and its URL saved here.
  const chooseCategoryPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    try { const url = await uploadProductPhoto(file); setDraft(current => ({ ...current, image: url })); }
    catch (err) { setError((err as Error).message); }
    finally { setPhotoBusy(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await api(`/admin/categories/${editing !== 'new' && editing ? `${editing.id}/` : ''}`, json({ ...draft, name: draft.name.trim(), slug: draft.slug.trim() }, editing === 'new' ? 'POST' : 'PATCH')); setEditing(null); setNotice('Категория сохранена.'); remote.retry(); }
    catch (err) { setError(failure(err)); }
    finally { setBusy(false); }
  };
  const start = (category: Category | 'new', trigger: HTMLElement) => { editor.rememberTrigger(trigger); setEditing(category); setDraft(category === 'new' ? newCategory : category); setError(''); setNotice(''); };
  const toggle = async (category: Category) => {
    setError(''); setBusy(true);
    try { await api(`/admin/categories/${category.id}/`, json({ is_visible: !category.is_visible }, 'PATCH')); remote.retry(); }
    catch (err) { setError(failure(err)); }
    finally { setBusy(false); }
  };
  const remove = async (category: Category) => {
    setError(''); setNotice(''); setBusy(true);
    try { await api(`/admin/categories/${category.id}/`, { method: 'DELETE' }); setConfirming(null); setNotice(`Категория «${category.name}» удалена.`); remote.retry(); }
    catch (err) { setError(failure(err)); setConfirming(null); }
    finally { setBusy(false); }
  };
  return <section><div className="portal-section-title"><div><p className="portal-eyebrow">ПОРЯДОК НА ВИТРИНЕ</p><h2>Категории</h2></div><button className="portal-button" disabled={busy} onClick={event => start('new', event.currentTarget)}><Plus size={17} aria-hidden="true" /> Добавить категорию</button></div><ErrorNotice message={remote.error} retry={remote.retry} />{!editing && <ErrorNotice message={error} />}{notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    {editing && <section ref={editor.ref} tabIndex={-1} className="portal-card portal-editor"><div className="portal-section-title"><h3>{editing === 'new' ? 'Новая категория' : 'Редактировать категорию'}</h3><button className="portal-icon-button" disabled={busy} aria-label="Закрыть редактирование категории" onClick={() => setEditing(null)}><X size={20} aria-hidden="true" /></button></div><form className="portal-form" onSubmit={save}><fieldset className="portal-form-fields" disabled={busy}><div className="portal-form-grid"><label>Название<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required maxLength={120} /></label><label>Адрес категории<input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} required pattern="[a-z0-9_\-]+" placeholder="croissants" maxLength={50} /><small>Латинские буквы, цифры, дефис или подчёркивание.</small></label><label className="portal-wide">Описание<textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} maxLength={3000} /></label><div className="portal-wide portal-photo"><span>Фотография категории</span>{draft.image && <img src={draft.image} alt="" className="portal-photo-preview" />}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={e => { void chooseCategoryPhoto(e.target.files?.[0]); e.target.value = ''; }} /><small>{photoBusy ? 'Загружаем фото…' : 'JPEG, PNG или WebP с компьютера или телефона. Фото автоматически уменьшится.'}</small></div></div><div className="portal-checks"><label><input type="checkbox" checked={draft.is_visible} onChange={e => setDraft({ ...draft, is_visible: e.target.checked })} /> Показывать в каталоге</label></div><ErrorNotice message={error} /><div className="portal-form-actions"><button className="portal-button" disabled={busy || photoBusy || !draft.name.trim()}>{busy ? 'Сохраняем…' : 'Сохранить категорию'}</button><button type="button" className="portal-text-button" disabled={busy} onClick={() => setEditing(null)}>Отмена</button></div></fieldset></form></section>}
    {remote.loading ? <p className="portal-loading" role="status">Загружаем категории…</p> : remote.data && <div className="portal-manage-list">{remote.data?.length ? remote.data.map(category => <article className="portal-manage-row" key={category.id}><div className="portal-category-image">{category.image ? <LazyImage src={category.image} alt="" /> : <LayoutGrid size={23} aria-hidden="true" />}</div><div className="portal-manage-main"><h3>{category.name}</h3><p>{category.description || `/${category.slug}`}</p><span className="portal-help">{category.is_visible ? 'Видна в каталоге' : 'Скрыта из каталога'}</span>{confirming === category.id && <div className="portal-product-confirm portal-category-confirm"><p>Удалить категорию «{category.name}» навсегда? Это действие нельзя отменить. Категорию с товарами удалить нельзя — сначала перенесите или удалите товары.</p><div><button className="portal-button portal-button-danger" disabled={busy} onClick={() => void remove(category)}>{busy ? 'Удаляем…' : 'Удалить'}<Trash2 size={16} aria-hidden="true" /></button><button type="button" className="portal-text-button" disabled={busy} onClick={() => setConfirming(null)}>Отмена</button></div></div>}</div><div className="portal-row-actions"><button className="portal-icon-button" disabled={busy} aria-label={`Изменить категорию «${category.name}»`} onClick={event => start(category, event.currentTarget)}><Pencil size={18} aria-hidden="true" /></button><button className="portal-icon-button" disabled={busy} aria-label={`${category.is_visible ? 'Скрыть' : 'Показать'} категорию «${category.name}»`} onClick={() => void toggle(category)}>{category.is_visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}</button><button className="portal-icon-button portal-delete" disabled={busy} aria-label={`Удалить категорию «${category.name}»`} title="Удалить категорию" onClick={() => { setConfirming(category.id); setError(''); setNotice(''); }}><Trash2 size={18} aria-hidden="true" /></button></div></article>) : <EmptyState icon={<LayoutGrid size={30} aria-hidden="true" />} title="Первая категория ждёт">Добавьте категории, чтобы покупателям было проще найти любимую выпечку.</EmptyState>}</div>}
  </section>;
}

type BusinessAccount = { id: number; name: string; email: string; phone: string; company_name: string; business_approved: boolean };

/** Administrator's list of business accounts. Wholesale prices open only after approval here. */
function BusinessPanel() {
  const remote = useRemote<BusinessAccount[]>('/admin/businesses/');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const setApproved = async (account: BusinessAccount, approved: boolean) => {
    if (lock.current) return;
    lock.current = true; setError(''); setBusy(true); setNotice('');
    try {
      const updated = await api<BusinessAccount>(`/admin/businesses/${account.id}/`, json({ business_approved: approved }, 'PATCH'));
      remote.replace((remote.data || []).map(item => item.id === updated.id ? updated : item));
      setNotice(approved ? 'Оптовые цены открыты для заведения.' : 'Оптовые цены закрыты для заведения.'); remote.retry();
    } catch (err) { setError(failure(err)); }
    finally { lock.current = false; setBusy(false); }
  };
  const accounts = remote.data || [];
  return <section><div className="portal-section-title"><div><p className="portal-eyebrow">ОПТОВЫЕ ЦЕНЫ</p><h2>Заведения <span className="portal-count">{accounts.length}</span></h2></div></div>
    <ErrorNotice message={remote.error} retry={remote.retry} />{error && <ErrorNotice message={error} />}{notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    <p className="portal-queue-note">Заведение получает оптовые цены только после одобрения. Сама регистрация их не открывает.</p>
    {accounts.length === 0 && !remote.loading && <p>Пока нет заведений.</p>}
    <ul className="portal-business-list">{accounts.map(account => <li key={account.id} className="portal-card">
      <div><strong>{account.company_name || 'Без названия'}</strong><span>{account.name} · {account.email}{account.phone ? ` · ${account.phone}` : ''}</span></div>
      <span className={`portal-status ${account.business_approved ? 'status-delivered' : 'status-unpaid'}`}>{account.business_approved ? 'Одобрено' : 'На проверке'}</span>
      <button className="portal-button" disabled={busy} onClick={() => setApproved(account, !account.business_approved)}>{account.business_approved ? 'Закрыть оптовые цены' : 'Одобрить'}</button>
    </li>)}</ul></section>;
}

const staffText = {
  couriers: { title: 'Курьеры', add: 'Добавить курьера', added: 'Курьер добавлен в команду.', form: 'Новый курьер', formHint: 'Курьер будет принимать и доставлять заказы в своём кабинете.', icon: <Truck size={22} />, empty: 'Соберите команду доставки', emptyText: 'Добавьте курьера, чтобы он мог принимать заказы из общей очереди.', note: 'Курьер входит под своим аккаунтом, видит общую очередь заказов и сам принимает их. Назначить курьера вручную можно в карточке заказа. Заблокированный курьер не видит очередь.' },
  cashiers: { title: 'Кассиры', add: 'Добавить кассира', added: 'Кассир добавлен в команду.', form: 'Новый кассир', formHint: 'Кассир будет видеть заказы и отмечать оплату наличными.', icon: <Banknote size={22} />, empty: 'Добавьте первого кассира', emptyText: 'Создайте отдельный аккаунт для учёта полученных наличных.', note: 'Кассир видит все заказы и подтверждает получение наличных за доставленные заказы.' },
  'pastry-chefs': { title: 'Кондитеры', add: 'Добавить кондитера', added: 'Кондитер добавлен в команду.', form: 'Новый кондитер', formHint: 'Кондитер будет подтверждать заказы и вести их на кухне.', icon: <ChefHat size={22} />, empty: 'Добавьте первого кондитера', emptyText: 'Кондитер получит свой кабинет: подтверждение заказов и кухня.', note: 'Кондитер видит все заказы, подтверждает новые, начинает приготовление и отмечает, когда заказ готов к выдаче курьеру. Курьеров, оплату и отмену он не меняет.' },
};

function StaffPanel({ kind }: { kind: keyof typeof staffText }) {
  const text = staffText[kind];
  const endpoint = `/admin/${kind}/`;
  const remote = useRemote<User[]>(endpoint);
  const [adding, setAdding] = useState(false);
  const editor = useEditorReveal(adding ? 'new' : null);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '', password: '' });
  const [repeat, setRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const mismatch = repeat.length > 0 && repeat !== draft.password;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const staffTitle = text.title;
  const addLabel = text.add;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current) return;
    if (draft.password !== repeat) { setError('Пароли не совпадают. Введите пароль ещё раз.'); return; }
    lock.current = true; setError(''); setBusy(true);
    try {
      const created = await api<User>(endpoint, json({ ...draft, name: draft.name.trim(), email: draft.email.trim(), phone: formatPhone(draft.phone) }));
      remote.replace([...(remote.data || []), created]); setAdding(false); setDraft({ name: '', email: '', phone: '', password: '' }); setRepeat(''); setShowPassword(false);
      setNotice(text.added); remote.retry();
    } catch (err) { setError(failure(err)); }
    finally { lock.current = false; setBusy(false); }
  };
  // Deleting takes two confirmations: the first asks, the second warns it cannot be undone.
  const [removing, setRemoving] = useState<{ id: number; step: 1 | 2 } | null>(null);
  const remove = async (person: User) => {
    if (lock.current) return;
    lock.current = true; setError(''); setBusy(true); setNotice('');
    try {
      const result = await api<{ moved_orders: number; waiting_orders: number }>(`${endpoint}${person.id}/`, { method: 'DELETE' });
      remote.replace((remote.data || []).filter(item => item.id !== person.id));
      const moved = result?.moved_orders ? ` Незавершённые заказы переданы другим курьерам: ${result.moved_orders}.` : '';
      const waiting = result?.waiting_orders ? ` Ждут свободного курьера: ${result.waiting_orders}.` : '';
      setRemoving(null); setNotice(`${person.name} удалён(а) из команды. В истории заказов и чеках имя сохранено.${moved}${waiting}`); remote.retry();
    } catch (err) { setRemoving(null); setError(failure(err)); }
    finally { lock.current = false; setBusy(false); }
  };
  const toggle = async (person: User) => {
    if (lock.current) return;
    lock.current = true; setError(''); setBusy(true); setNotice('');
    try {
      const updated = await api<User>(`${endpoint}${person.id}/`, json({ is_active: !person.is_active }, 'PATCH'));
      remote.replace((remote.data || []).map(item => item.id === updated.id ? updated : item));
      setNotice(person.is_active ? 'Доступ сотрудника заблокирован.' : 'Доступ сотрудника восстановлен.'); remote.retry();
    } catch (err) { setError(failure(err)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section><div className="portal-section-title"><div><p className="portal-eyebrow">НАША КОМАНДА</p><h2>{staffTitle} <span className="portal-count">{remote.data?.length || 0}</span></h2></div><button className="portal-button" disabled={busy} onClick={event => { editor.rememberTrigger(event.currentTarget); setAdding(true); setError(''); setNotice(''); }}><Plus size={17} aria-hidden="true" />{addLabel}</button></div><ErrorNotice message={remote.error} retry={remote.retry} />{!adding && <ErrorNotice message={error} />}{notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    <p className="portal-queue-note">{text.note}</p>
    {adding && <section ref={editor.ref} tabIndex={-1} className="portal-card portal-editor staff-editor">
      <header className="staff-editor-head"><span className="staff-editor-icon" aria-hidden="true">{text.icon}</span><div><h3>{text.form}</h3><p>{text.formHint}</p></div><button type="button" className="portal-icon-button" disabled={busy} aria-label="Закрыть форму нового сотрудника" onClick={() => setAdding(false)}><X size={20} aria-hidden="true" /></button></header>
      <form className="portal-form" onSubmit={save}><fieldset className="portal-form-fields" disabled={busy}>
        <section className="staff-block"><h4><UserRound size={18} aria-hidden="true" />Контакты</h4><div className="staff-fields">
          <label><span>Имя и фамилия <i>*</i></span><input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required maxLength={120} autoComplete="off" placeholder="Например, Айдана Сериккызы" /></label>
          <label><span>Телефон <i>*</i></span><PhoneInput digits={draft.phone} onChange={value => setDraft(current => ({ ...current, phone: value }))} required /></label>
          <label className="staff-wide"><span>Электронная почта <i>*</i></span><input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} required maxLength={254} autoComplete="off" placeholder="name@example.com" /><small>Это логин сотрудника для входа в кабинет.</small></label>
        </div></section>
        <section className="staff-block"><h4><KeyRound size={18} aria-hidden="true" />Вход в кабинет</h4><div className="staff-fields">
          <label><span>Пароль <i>*</i></span><span className="portal-password"><input type={showPassword ? 'text' : 'password'} value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} required minLength={10} maxLength={128} autoComplete="new-password" placeholder="Не менее 10 символов" /><button type="button" className="portal-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></span></label>
          <label><span>Повторите пароль <i>*</i></span><span className="portal-password"><input type={showPassword ? 'text' : 'password'} value={repeat} onChange={e => setRepeat(e.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" aria-invalid={mismatch || undefined} placeholder="Ещё раз тот же пароль" /><button type="button" className="portal-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></span>{mismatch ? <small className="portal-danger-text">Пароли не совпадают.</small> : repeat && <small className="portal-password-ok"><Check size={14} aria-hidden="true" /> Пароли совпадают</small>}</label>
        </div><p className="staff-note"><LockKeyhole size={15} aria-hidden="true" />Передайте пароль сотруднику лично — он войдёт по почте и этому паролю.</p></section>
        <ErrorNotice message={error} />
        <div className="staff-actions"><button type="button" className="product-secondary" disabled={busy} onClick={() => setAdding(false)}>Отмена</button><button className="portal-button" disabled={busy || !draft.name.trim() || mismatch}>{busy ? 'Добавляем…' : addLabel}<Plus size={17} aria-hidden="true" /></button></div>
      </fieldset></form>
    </section>}
    {remote.loading ? <p className="portal-loading" role="status">Загружаем команду…</p> : remote.data && <div className="portal-manage-list">{remote.data.length ? remote.data.map(person => <article className="portal-manage-row" key={person.id}><div className="portal-avatar">{person.name.charAt(0).toUpperCase()}</div><div className="portal-manage-main"><h3>{person.name}</h3><p>{person.email}</p><a href={`tel:${person.phone}`}>{person.phone}</a></div><div className="portal-courier-controls"><span className={`portal-status ${person.is_active ? 'status-delivered' : 'status-cancelled'}`}><i />{person.is_active ? 'Активен' : 'Заблокирован'}</span><button className="portal-text-button" disabled={busy} onClick={() => void toggle(person)}>{person.is_active ? 'Заблокировать' : 'Восстановить доступ'}</button>{removing?.id !== person.id && <button type="button" className="portal-text-button portal-danger-text" disabled={busy} onClick={() => { setRemoving({ id: person.id, step: 1 }); setError(''); setNotice(''); }}>Удалить</button>}</div>{removing?.id === person.id && <div className="portal-staff-delete" role="alertdialog" aria-label={`Удаление сотрудника ${person.name}`}>{removing.step === 1 ? <><p>Удалить сотрудника <strong>{person.name}</strong> ({person.email})?</p><div className="portal-form-actions"><button type="button" className="portal-button portal-button-small portal-button-danger" disabled={busy} onClick={() => setRemoving({ id: person.id, step: 2 })}>Да, удалить</button><button type="button" className="portal-text-button" disabled={busy} onClick={() => setRemoving(null)}>Отмена</button></div></> : <><p><strong>Точно удалить {person.name}?</strong> Сотрудник больше не сможет войти и пропадёт из списка, восстановить аккаунт будет нельзя. В истории заказов и чеках его имя останется.{kind === 'couriers' ? ' Заказы, которые он сейчас везёт или ещё не забрал, сразу перейдут другим свободным курьерам.' : ''}</p><div className="portal-form-actions"><button type="button" className="portal-button portal-button-small portal-button-danger" disabled={busy} onClick={() => void remove(person)}>{busy ? 'Удаляем…' : 'Удалить навсегда'}</button><button type="button" className="portal-text-button" disabled={busy} onClick={() => setRemoving(null)}>Не удалять</button></div></>}</div>}</article>) : <EmptyState icon={kind === 'cashiers' ? <Banknote size={30} aria-hidden="true" /> : kind === 'pastry-chefs' ? <ChefHat size={30} aria-hidden="true" /> : <Truck size={30} aria-hidden="true" />} title={text.empty}>{text.emptyText}</EmptyState>}</div>}
  </section>;
}

const shiftDay = (value: string, days: number) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const periodDay = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));

// Admin cash desk: purchases and cash received for any period.
function CashPanel() {
  const today = localToday();
  const [range, setRange] = useState({ from: today, to: today });
  const valid = isPortalDate(range.from) && isPortalDate(range.to) && range.from <= range.to;
  const summary = useRemote<CashierSummary>(valid ? `/cashier/summary/?date_from=${range.from}&date_to=${range.to}` : null, true);
  const presets: [string, string][] = [['Сегодня', today], ['Вчера', shiftDay(today, -1)], ['7 дней', shiftDay(today, -6)], ['30 дней', shiftDay(today, -29)], ['С начала месяца', `${today.slice(0, 8)}01`]];
  const choose = (label: string, from: string) => setRange({ from, to: label === 'Вчера' ? from : today });
  const title = range.from === range.to ? periodDay(range.from) : `с ${periodDay(range.from)} по ${periodDay(range.to)}`;
  const data = summary.data;
  return <section aria-label="Касса">
    <div className="portal-section-title"><div><p className="portal-eyebrow">ПРОДАЖИ И НАЛИЧНЫЕ</p><h2>Касса</h2></div></div>
    <div className="portal-cash-period">
      <div className="portal-date-range" role="group" aria-label="Период кассы"><span>Период</span><div><input type="date" aria-label="С даты" max={range.to || today} value={range.from} onChange={e => setRange(value => ({ ...value, from: e.target.value }))} /><span aria-hidden="true">—</span><input type="date" aria-label="По дату" min={range.from} value={range.to} onChange={e => setRange(value => ({ ...value, to: e.target.value }))} /></div></div>
      <div className="portal-cash-presets">{presets.map(([label, from]) => { const active = range.from === from && range.to === (label === 'Вчера' ? from : today); return <button type="button" key={label} className={active ? 'active' : ''} aria-pressed={active} onClick={() => choose(label, from)}>{label}</button>; })}</div>
    </div>
    {!valid && <p className="portal-danger-text">Укажите обе даты; дата «по» не может быть раньше даты «с».</p>}
    <ErrorNotice message={summary.error} retry={summary.retry} />
    {valid && <section className="portal-cash-summary">
      <p className="portal-eyebrow">{title}</p>
      {summary.loading && !data ? <p role="status" className="portal-help">Считаем кассу…</p> : data && <div className="portal-summary-grid portal-cash-grid">
        <article className="portal-cash-main"><span>Выручка за период</span><strong>{money(data.orders_total)}</strong><small>Оплачено заказов: {data.orders_count} · товаров: {data.items_count} шт.{data.cancelled_count ? ` · отменено: ${data.cancelled_count} (не входят в сумму)` : ''}</small></article>
        <article className="portal-cash-pending"><span>Ещё не доставлены</span><strong>{money(data.pending_total ?? 0)}</strong><small>{data.pending_count ? `Заказов в работе: ${data.pending_count}. Сумма попадёт в выручку в день, когда подтвердят оплату.` : 'Все заказы за период доставлены или отменены.'}</small></article>
        <article><span>Долги оплачены за период</span><strong>{money(data.debt_paid_total ?? 0)}</strong><small>{data.debt_paid_count ? `Заказов: ${data.debt_paid_count}. Уже входят в выручку.` : 'За эти дни долги не оплачивали.'}</small></article>
        <article><span>Не оплачены или в долгу</span><strong>{money(data.unpaid_delivered_total)}</strong><small>За все дни · заказов: {data.unpaid_delivered_count}{data.debt_count ? ` · в долгу: ${money(data.debt_total ?? 0)} (${data.debt_count})` : ''}</small></article>
        {(data.in_delivery_count ?? 0) > 0 ? <article className="portal-cash-live"><span><Truck size={16} aria-hidden="true" />Сейчас в доставке</span><strong>{money(data.in_delivery_total ?? 0)}</strong><small>Курьеры везут заказов: {data.in_delivery_count}. Деньги поступят после доставки.</small><ul>{data.in_delivery_orders?.map(item => <li key={item.id}><b>№{item.number}</b><span>{item.status === 'HANDED_OVER' ? 'Курьер забрал' : 'В пути'}{item.courier_name ? ` · ${item.courier_name}` : ''}</span><em>{money(item.total)}</em></li>)}</ul></article> : <article className="portal-cash-live portal-cash-live-empty"><span><Truck size={16} aria-hidden="true" />Сейчас в доставке</span><strong>{money(0)}</strong><small>Сейчас ни один курьер не везёт заказ.</small></article>}
      </div>}
      <p className="portal-help">Учитываются заказы, оформленные за выбранный период. «Выручка» — деньги, полученные за выбранные дни: считается день, когда подтвердили оплату. Наличные при доставке попадают в день доставки, а заказ в долг — в день, когда долг отметили оплаченным. «Ещё не доставлены» — заказы, оформленные за период, которые готовятся или едут к клиенту.</p>
    </section>}
  </section>;
}

// "Долг": customers who received orders on credit, and marking those debts paid.
function DebtsPanel({ user }: { user: User }) {
  const [state, setState] = useState<'open' | 'paid'>('open');
  const [search, setSearch] = useState('');
  const debts = useRemote<Debts>(`/debts/?state=${state}`, true);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isAdmin = user.role === 'ADMIN';
  const open = (id: number | null) => { setConfirm(id); setAgreed(false); setError(''); };
  const pay = async (order: DebtOrder) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await api(`/debts/${order.id}/pay/`, json({})); setNotice(`Долг по заказу №${order.number} (${money(order.total)}) оплачен.`); open(null); debts.retry(); }
    catch (err) { setError(failure(err)); debts.retry(); }
    finally { setBusy(false); }
  };
  const data = debts.data;
  const query = search.trim().toLowerCase();
  const customers = (data?.customers || []).filter(row => !query || [row.name, row.company_name, row.phone, row.email, ...row.orders.map(item => item.number)].some(value => value?.toLowerCase().includes(query)));
  return <section aria-label="Долг" className="portal-debts">
    <div className="portal-section-title"><div><p className="portal-eyebrow">ЗАКАЗЫ В ДОЛГ</p><h2>Долг</h2><p className="portal-help">{isAdmin ? 'Клиенты и заведения, которым заказ доставили без оплаты.' : 'Заказы, которые вы доставили в долг.'} Когда деньги получены, отметьте оплату — у клиента пропадёт плашка о долге.</p></div></div>
    {data && <div className="portal-summary-grid portal-debt-summary">
      <article className="portal-debt-open"><span>Сейчас в долгу</span><strong>{money(data.open_total)}</strong><small>Заказов: {data.open_count}</small></article>
      <article><span>Долги оплачены</span><strong>{money(data.paid_total)}</strong><small>Заказов: {data.paid_count}</small></article>
    </div>}
    <div className="portal-debt-toolbar">
      <div className="portal-chip-filters" role="group" aria-label="Какие долги показать">{([['open', 'В долгу', data?.open_count], ['paid', 'Оплаченные', data?.paid_count]] as const).map(([value, label, count]) => <button type="button" key={value} className={state === value ? 'active' : ''} aria-pressed={state === value} onClick={() => { setState(value); open(null); setNotice(''); }}>{value === 'open' ? <HandCoins size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{label}{count !== undefined ? ` · ${count}` : ''}</button>)}</div>
      <label className="portal-search"><Search size={18} aria-hidden="true" /><input name="debt-search" autoComplete="off" aria-label="Поиск по клиенту, телефону или номеру заказа" placeholder="Клиент, телефон или номер заказа" value={search} onChange={e => setSearch(e.target.value)} /></label>
    </div>
    <ErrorNotice message={debts.error || error} retry={debts.error ? debts.retry : undefined} />
    {notice && <p className="portal-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    {debts.loading && !data ? <p role="status" className="portal-help">Загружаем долги…</p> : data && !customers.length ? <EmptyState icon={<HandCoins size={28} aria-hidden="true" />} title={query ? 'Никого не нашли' : state === 'open' ? 'Долгов нет' : 'Оплаченных долгов пока нет'}>{query ? 'Проверьте имя, телефон или номер заказа.' : state === 'open' ? 'Все доставленные заказы оплачены.' : 'Здесь появятся долги, по которым уже получены деньги.'}</EmptyState> : <div className="portal-debt-list">{customers.map(row => <article key={row.id} className="portal-card portal-debt-card">
      <header className="portal-debt-head"><span className="portal-debt-avatar" aria-hidden="true">{row.company_name ? <Store size={20} /> : <UserRound size={20} />}</span><div><h3>{row.company_name || row.name}</h3><p>{row.company_name ? `${row.name} · ` : ''}{row.phone || row.email}</p></div><div className="portal-debt-total">{state === 'open' ? <><span>Должен</span><strong>{money(row.debt_total)}</strong></> : <><span>Оплачено</span><strong>{money(row.paid_total)}</strong></>}</div></header>
      <ul className="portal-debt-orders">{row.orders.map(item => <li key={item.id}>
        <div className="portal-debt-order"><div><strong>№{item.number}</strong><span>{item.credit_at ? `В долг ${dateTime(item.credit_at)}` : dateTime(item.created_at)}{item.credit_by_name ? ` · курьер ${item.credit_by_name}` : ''}</span><span>{item.address}</span>{item.payment_status === 'PAID' && <span className="portal-debt-paid"><Check size={13} aria-hidden="true" />Оплачено{item.paid_at ? ` ${dateTime(item.paid_at)}` : ''}{item.paid_by_name ? ` · отметил(а) ${item.paid_by_name}` : ''}</span>}</div><b>{money(item.total)}</b></div>
        {item.payment_status === 'DEBT' && (confirm === item.id ? <form className="portal-payment-confirm portal-debt-confirm" onSubmit={event => { event.preventDefault(); void pay(item); }}><h4>Подтвердите оплату долга</h4><p>За заказ №{item.number} получена полная сумма <strong>{money(item.total)}</strong>?</p>{!isAdmin && <label className="portal-step-agree"><input type="checkbox" checked={agreed} disabled={busy} onChange={event => setAgreed(event.target.checked)} /><span>Я получил(а) деньги от клиента за заказ №{item.number}</span></label>}<div className="portal-form-actions"><button className="portal-button" disabled={busy || (!isAdmin && !agreed)}>{busy ? 'Сохраняем…' : 'Да, оплачено'}<Banknote size={17} aria-hidden="true" /></button><button type="button" className="portal-text-button" disabled={busy} onClick={() => open(null)}>Отмена</button></div></form> : <button type="button" className="portal-button portal-button-outline portal-debt-pay" onClick={() => { open(item.id); setNotice(''); }}>Отметить оплату<Banknote size={16} aria-hidden="true" /></button>)}
      </li>)}</ul>
    </article>)}</div>}
  </section>;
}

// Courier "Заказы" tab: who carries which order, and handing one's own order to a colleague.
function TeamOrdersView({ user, team, onTransferred }: { user: User; team: { data: TeamOrders | null; error: string; loading: boolean; retry: () => void }; onTransferred: (message: string) => void }) {
  const [target, setTarget] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const nameOf = (id: string | undefined) => team.data?.couriers.find(courier => courier.id === Number(id))?.name || 'другому курьеру';
  const transfer = async (orderId: number, number: string) => {
    const courierId = Number(target[orderId]);
    if (!courierId || lock.current) return;
    const name = nameOf(target[orderId]);
    lock.current = true; setBusy(orderId); setError('');
    try {
      await api(`/orders/${orderId}/transfer/`, json({ courier_id: courierId }));
      setTarget(current => { const next = { ...current }; delete next[orderId]; return next; }); setConfirming(null);
      onTransferred(`Заказ №${number} передан курьеру ${name}.`);
    } catch (err) { setError(failure(err)); team.retry(); }
    finally { lock.current = false; setBusy(null); }
  };
  const orders = team.data?.orders || [];
  const colleagues = team.data?.couriers || [];
  return <>
    <p className="portal-queue-note">Здесь видно, какой курьер везёт какой заказ. Свой заказ можно передать другому курьеру — он сразу появится у него в «Мои активные».</p>
    <ErrorNotice message={team.error} retry={team.retry} />
    <ErrorNotice message={error} />
    {team.loading && !team.data ? <div className="portal-loading" role="status"><RefreshCw size={22} aria-hidden="true" /> Загружаем заказы курьеров…</div> : <div className="portal-available-grid portal-team-grid">
      {orders.length ? orders.map(order => { const mine = order.courier === user.id; return <article key={order.id} className={`portal-available-card portal-team-card${mine ? ' is-mine' : ''}`}>
        <div className="portal-order-card-top"><strong>Заказ №{order.number}</strong>{mine && <span className="portal-team-mine">Ваш заказ</span>}</div>
        <p className="portal-order-date">{dateTime(order.created_at)}</p><Status status={order.status} />
        <p className="portal-team-courier"><Truck size={17} aria-hidden="true" /><span>Курьер:</span><strong>{mine ? `${order.courier_name} (вы)` : order.courier_name}</strong></p>
        <p className="portal-queue-address"><MapPin size={17} aria-hidden="true" /><span>{order.address}</span></p>
        <div className="portal-order-card-bottom"><span>{order.items_count} шт.</span><strong>{money(order.total)}</strong></div>
        {mine && (colleagues.length ? <div className="portal-team-transfer"><label><span>Передать курьеру</span><select value={target[order.id] || ''} disabled={busy !== null} onChange={event => { setConfirming(null); setTarget(current => ({ ...current, [order.id]: event.target.value })); }}><option value="">Выберите курьера</option>{colleagues.map(courier => <option key={courier.id} value={courier.id}>{courier.name}</option>)}</select></label>{confirming === order.id ? <div className="portal-payment-confirm"><p>Передать заказ №{order.number} курьеру <strong>{nameOf(target[order.id])}</strong>? Заказ исчезнет из ваших активных доставок.</p><div className="portal-form-actions"><button type="button" className="portal-button portal-button-small" disabled={busy !== null} onClick={() => void transfer(order.id, order.number)}>{busy === order.id ? 'Передаём…' : 'Да, передать'}<ArrowRight size={16} aria-hidden="true" /></button><button type="button" className="portal-text-button" disabled={busy !== null} onClick={() => setConfirming(null)}>Отмена</button></div></div> : <button type="button" className="portal-button portal-button-small" disabled={busy !== null || !target[order.id]} onClick={() => { setConfirming(order.id); setError(''); }}>Передать<ArrowRight size={16} aria-hidden="true" /></button>}</div> : <p className="portal-help">Других активных курьеров сейчас нет.</p>)}
      </article>; }) : <EmptyState icon={<Truck size={32} aria-hidden="true" />} title="Сейчас никто не везёт заказы">Здесь появятся заказы, которые курьеры взяли в работу.</EmptyState>}
    </div>}
  </>;
}
