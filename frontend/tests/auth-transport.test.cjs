const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const sourceRoot = path.join(__dirname, '../src');
const tick = () => new Promise(resolve => setImmediate(resolve));
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const buyer = { id: 1, name: 'Fixture', role: 'CUSTOMER', phone: '' };
const settings = { delivery_fee: '1500.00', currency: 'KZT', demo_mode: true };
const product = { id: 1, name: 'Fixture product', price: '900.00', is_available: true, is_visible: true };

// Only external boundaries are controlled: fetch, storage, timers and React's
// hook scheduler. The source modules, API parser and component handlers are real.
function harness(fetcher, { storageThrows = false } = {}) {
  let slots = [], cursor = 0, effects = [], shop = null;
  const timers = new Map(), navigation = [], storage = new Map();
  let nextTimer = 1;
  const React = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!(i in slots) || deps.some((value, j) => value !== slots[i].deps[j])) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
    useCallback(fn, deps) { const i = cursor++; if (!(i in slots) || deps.some((value, j) => value !== slots[i].deps[j])) slots[i] = { deps, fn }; return slots[i].fn; },
    createContext() { return { Provider: 'context' }; },
    useContext() { return shop; },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const storageApi = {
    getItem(key) { if (storageThrows) throw new Error('SecurityError'); return storage.get(key) || null; },
    setItem(key, value) { if (storageThrows) throw new Error('QuotaExceededError'); storage.set(key, value); },
    removeItem(key) { if (storageThrows) throw new Error('SecurityError'); storage.delete(key); },
  };
  const modules = {
    react: React, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-router-dom': { Link: 'a', useNavigate: () => value => navigation.push(value), useSearchParams: () => [new URLSearchParams('uid=fixture&token=fixture')] },
    'lucide-react': new Proxy({}, { get: () => 'icon' }),
    './ui': { Qty: 'qty', ErrorBox: 'error', Loading: 'loading' },
    // Russian names pass through unchanged, so assertions keep matching the database text.
    './productNames': { productName: product => product.name },
  };
  function load(filename, suffix = '') {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(sourceRoot, filename), 'utf8') + suffix, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, require: name => { if (!(name in modules)) throw new Error(`Unexpected import: ${name}`); return modules[name]; },
      fetch: fetcher, AbortController, DOMException, Headers, crypto: webcrypto,
      localStorage: storageApi, sessionStorage: storageApi,
      setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
      clearTimeout: id => timers.delete(id),
      FormData: class { constructor(values) { this.values = values; } get(key) { return this.values[key]; } [Symbol.iterator]() { return Object.entries(this.values)[Symbol.iterator](); } },
      window: { location: { reload() {} } },
    });
    return exports;
  }
  const lib = modules['./lib'] = load('lib.ts');
  const store = modules['./store'] = load('store.tsx');
  // The real Russian dictionary is used, so assertions match the text users see.
  const i18n = load('i18n.tsx', '\nexports.ru = ru;');
  modules['./i18n'] = { useI18n: () => ({ t: i18n.ru }) };
  const flow = load('ShopFlow.tsx');
  return {
    lib, store, flow, navigation, timers,
    setShop(value) { shop = value; },
    resetHooks() { for (const slot of slots) slot?.cleanup?.(); slots = []; cursor = 0; effects = []; },
    render(component) { cursor = 0; const tree = component(); for (const effect of effects.splice(0)) effect(); return tree; },
    expire() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); } },
  };
}
function nodes(tree, result = []) {
  if (Array.isArray(tree)) tree.forEach(child => nodes(child, result));
  else if (tree && typeof tree === 'object') { result.push(tree); nodes(tree.props?.children, result); }
  return result;
}
const submit = tree => nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { password: 'fixture-long-password' } });
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '');
async function expectTimeout(h, promise) {
  let outcome = null;
  promise.then(value => { outcome = { value }; }, error => { outcome = { error }; });
  await tick();
  h.expire();
  await tick();
  assert.ok(outcome?.error, 'a stalled request must reject after the timeout');
  assert.match(outcome.error.message, /время|долго|дождаться/i);
}

test('stalled GET aborts and releases its timeout', async () => {
  let signal;
  const h = harness((url, options) => { signal = options.signal; return new Promise(() => {}); });
  await expectTimeout(h, h.lib.api('/products/'));
  assert.equal(signal.aborted, true);
  assert.equal(h.timers.size, 0);
});

test('stalled response body is bounded too', async () => {
  const h = harness(async () => ({ ...response(200, {}), json: () => new Promise(() => {}) }));
  await expectTimeout(h, h.lib.api('/products/'));
});

test('stalled CSRF bootstrap never dispatches the mutation', async () => {
  const calls = [];
  const h = harness(url => { calls.push(url); return new Promise(() => {}); });
  await expectTimeout(h, h.lib.api('/orders/', { method: 'POST', body: '{}' }));
  assert.deepEqual(calls, ['/api/auth/csrf/']);
});

test('timed-out POST is never automatically repeated; explicit retry keeps its body', async () => {
  const writes = [];
  const h = harness((url, options) => {
    if (url.endsWith('/csrf/')) return Promise.resolve(response(200, { csrfToken: 'fixture' }));
    writes.push(options.body);
    return writes.length === 1 ? new Promise(() => {}) : Promise.resolve(response(200, { id: 7 }));
  });
  const options = { method: 'POST', body: '{"idempotency_key":"fixture"}' };
  await expectTimeout(h, h.lib.api('/orders/', options));
  assert.equal(writes.length, 1);
  assert.equal((await h.lib.api('/orders/', options)).id, 7);
  assert.deepEqual(writes, [options.body, options.body]);
});

test('caller cancellation stays an AbortError, including during CSRF', async () => {
  const h = harness((url, options) => new Promise((resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  const controller = new AbortController();
  const pending = h.lib.api('/orders/', { method: 'POST', signal: controller.signal });
  let outcome;
  pending.catch(error => { outcome = error; });
  await tick(); controller.abort();
  await tick();
  assert.equal(outcome?.name, 'AbortError', 'caller cancellation must reach the bootstrap and retain its cause');
  assert.equal(h.timers.size, 0);
});

test('a protected401 clears the provider user;403 and network failures do not', async () => {
  let result = 200;
  const h = harness(async url => url.endsWith('/auth/me/') ? response(200, buyer) : url.endsWith('/settings/') ? response(200, settings) : result === 0 ? Promise.reject(new Error('offline')) : response(result, { detail: 'fixture' }));
  const render = () => h.render(() => h.store.ShopProvider({ children: null })).props.value;
  render(); await tick(); assert.equal(render().user.id, 1);
  for (const status of [403, 0]) { result = status; await assert.rejects(h.lib.api('/orders/')); assert.equal(render().user.id, 1); }
  result = 401; await assert.rejects(h.lib.api('/orders/')); assert.equal(render().user, null);
});

for (const outcome of ['success', 'failure']) test(`late startup auth ${outcome} cannot overwrite a newer login`, async () => {
  const pending = deferred();
  const h = harness(url => url.endsWith('/auth/me/') ? pending.promise : Promise.resolve(response(200, settings)));
  const render = () => h.render(() => h.store.ShopProvider({ children: null })).props.value;
  render().setUser(buyer);
  outcome === 'success' ? pending.resolve(response(200, { ...buyer, id: 99, role: 'ADMIN' })) : pending.reject(new Error('late offline'));
  await tick();
  assert.equal(render().user.id, 1);
  assert.equal(render().authError, '');
  assert.equal(render().authLoading, false);
});

test('a delayed401 from an old session cannot sign out the new login', async () => {
  const pending = deferred();
  const h = harness(url => url.endsWith('/orders/') ? pending.promise : Promise.resolve(response(200, url.endsWith('/auth/me/') ? buyer : settings)));
  const render = () => h.render(() => h.store.ShopProvider({ children: null })).props.value;
  render(); await tick();
  const oldRequest = h.lib.api('/orders/');
  render().setUser({ ...buyer, id: 2 });
  pending.resolve(response(401, { detail: 'Expired old session' }));
  await assert.rejects(oldRequest);
  assert.equal(render().user.id, 2);
});

test('initial anonymous401 finishes auth loading and makes the login form reachable', async () => {
  const h = harness(async url => response(url.endsWith('/auth/me/') ? 401 : 200, settings));
  const render = () => h.render(() => h.store.ShopProvider({ children: null })).props.value;
  render(); await tick();
  assert.equal(render().authLoading, false);
  assert.equal(render().authError, '');
  assert.equal(render().user, null);
});

test('a rejected password-reset attempt cannot leave startup auth loading forever', async () => {
  const pending = deferred();
  const h = harness(url => url.endsWith('/auth/me/') ? pending.promise : Promise.resolve(response(url.endsWith('/password-reset-confirm/') ? 400 : 200, url.endsWith('/csrf/') ? { csrfToken: 'fixture' } : settings)));
  const render = () => h.render(() => h.store.ShopProvider({ children: null })).props.value;
  render();
  await assert.rejects(h.lib.api('/auth/password-reset-confirm/', { method: 'POST' }));
  pending.resolve(response(401, { detail: 'No initial session' }));
  await tick();
  assert.equal(render().authLoading, false);
});

for (const endpoint of ['login', 'logout', 'password-reset-confirm']) test(`late ${endpoint} success cannot replace a newer identity`, async () => {
  const pending = deferred();
  const h = harness(url => url.endsWith(`/auth/${endpoint}/`) ? pending.promise : Promise.resolve(response(200, url.endsWith('/csrf/') ? { csrfToken: 'fixture' } : url.endsWith('/auth/me/') ? buyer : settings)));
  const render = () => h.render(() => h.store.ShopProvider({ children: null })).props.value;
  render(); await tick();
  let returned = false;
  const oldRequest = h.lib.api(`/auth/${endpoint}/`, { method: 'POST' }).then(() => { returned = true; }, () => {});
  await tick(); render().setUser({ ...buyer, id: 2 });
  pending.resolve(response(200, buyer)); await oldRequest;
  assert.equal(returned, false, 'stale auth success must not reach the component success handler');
  assert.equal(render().user.id, 2);
});

test('a newer auth attempt cancels the earlier request before its response can restore old identity', async () => {
  const first = deferred(), second = deferred();
  const signals = [];
  const h = harness((url, options) => {
    if (url.endsWith('/csrf/')) return Promise.resolve(response(200, { csrfToken: 'fixture' }));
    signals.push(options.signal);
    return signals.length === 1 ? first.promise : second.promise;
  });
  let oldAccepted = false;
  const old = h.lib.api('/auth/login/', { method: 'POST' }).then(() => { oldAccepted = true; }, () => {});
  await tick();
  const current = h.lib.api('/auth/login/', { method: 'POST' });
  await tick();
  first.resolve(response(200, { ...buyer, id: 99 })); await old;
  second.resolve(response(200, buyer));
  assert.equal((await current).id, 1);
  assert.equal(oldAccepted, false);
  assert.equal(signals[0].aborted, true);
});

test('password reset success clears stale auth before following the login link', async () => {
  const h = harness(async url => response(200, url.endsWith('/csrf/') ? { csrfToken: 'fixture' } : {}));
  const shop = { user: buyer, setUser(value) { this.user = value; } };
  shop.setUser = value => { shop.user = value; };
  h.setShop(shop);
  await submit(h.render(h.flow.ResetPassword));
  assert.equal(shop.user, null);
  h.resetHooks(); h.render(h.flow.Auth);
  assert.equal(h.navigation.length, 0);
});

test('auth form waits for initial identity check', () => {
  const h = harness(async () => response(200, {}));
  h.setShop({ user: null, authLoading: true, authError: '' });
  const tree = h.render(h.flow.Auth);
  assert.equal(nodes(tree).some(node => node.type === 'form'), false);
});

test('unavailable localStorage preserves the in-memory cart with one persistent warning', async () => {
  const h = harness(async url => response(url.endsWith('/auth/me/') ? 401 : 200, settings), { storageThrows: true });
  const render = () => h.render(() => h.store.ShopProvider({ children: null })).props.value;
  const shop = render();
  shop.add(product, 3);
  const updated = render();
  assert.equal(updated.cart[0].quantity, 3);
  assert.match(updated.storageWarning, /перезагруз/i);
  await tick();
  assert.equal(render().storageWarning, updated.storageWarning);
});

test('unavailable sessionStorage keeps the same checkout key across remounts and cannot undo order success', async () => {
  const posts = [], shop = { user: buyer, cart: [{ product, quantity: 2 }], settings, settingsError: '', total: 1800, storageWarning: '', refreshSettings: async () => settings, replaceCart: items => { shop.cart = items; }, clear: () => { shop.cart = []; }, setUser() {}, reportStorageFailure: () => { shop.storageWarning = 'Не сохраняется после перезагрузки'; } };
  let fail = true;
  const h = harness(async (url, options) => {
    if (url.endsWith('/csrf/')) return response(200, { csrfToken: 'fixture' });
    if (url.endsWith('/products/')) return response(200, [product]);
    posts.push(JSON.parse(options.body));
    if (fail) throw new Error('connection lost');
    return response(201, { id: 7, number: 'fixture', total: '3300.00' });
  }, { storageThrows: true });
  h.setShop(shop);
  h.render(h.flow.Checkout); await tick();
  await submit(h.render(h.flow.Checkout));
  h.resetHooks(); h.render(h.flow.Checkout); await tick();
  fail = false; await submit(h.render(h.flow.Checkout));
  assert.equal(posts.length, 2);
  assert.equal(posts[0].idempotency_key, posts[1].idempotency_key);
  assert.equal(shop.cart.length, 0);
  assert.match(text(h.render(h.flow.Checkout)), /Заказ принят/);
  assert.match(shop.storageWarning, /перезагруз/);
});
