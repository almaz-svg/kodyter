const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real panel and its date handler without a browser or network.
function panel(initialDate = '') {
  const state = [];
  let cursor = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = index === 0 ? { ...initial, date: initialDate } : initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef: value => ({ current: value }),
    useEffect() {},
    useCallback: value => value,
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/Portals.tsx'), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const calls = [];
  const context = {
    exports: {}, URLSearchParams, Intl, Date,
    require(name) {
      if (name === 'react') return hooks;
      if (name === './lib') return { statusSteps: [], statusLabel: {}, money: value => String(value) };
      if (name === 'lucide-react' || name === './portals.css') return {};
      if (name === './ui') return { LazyImage: 'img' };
      return require(name);
    },
    remote(requestPath) { calls.push(requestPath); return { data: null, loading: false, error: '', retry() {}, replace() {} }; },
  };
  vm.createContext(context);
  vm.runInContext(`${javascript}\nuseRemote = remote; exports.panel = OrdersPanel;`, context);
  const render = () => { cursor = 0; calls.length = 0; return context.exports.panel({ user: { role: 'CASHIER' } }); };
  const findDate = node => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'input' && node.props.type === 'date') return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = findDate(child); if (found) return found; }
    return null;
  };
  return {
    render, calls,
    date: () => findDate(render()),
    change(value, badInput = false) {
      const input = { value, validity: { badInput } };
      findDate(render()).props.onChange({ target: input, currentTarget: input });
      return render();
    },
  };
}

test('cashier rejects extended years and invalid calendar dates without crashing or requesting them', () => {
  for (const value of ['10000-01-01', '0000-01-01', '2026-02-30', '2026-13-01', 'not-a-date']) {
    const view = panel(value);
    assert.doesNotThrow(() => view.render(), value);
    const orderPath = view.calls.find(value => value?.startsWith('/orders/'));
    assert.equal(new URL(orderPath, 'http://localhost').searchParams.has('date'), false, value);
    assert.ok(!view.calls.some(requestPath => requestPath?.includes(`date=${value}`)), value);
  }
});

test('an invalid or incomplete edit preserves the last valid date filter', () => {
  const view = panel();
  view.change('2024-02-29');
  assert.ok(view.calls.includes('/cashier/summary/?date=2024-02-29'));
  for (const [value, incomplete] of [['10000-01-01', false], ['2026-02-30', false], ['', true]]) {
    assert.doesNotThrow(() => view.change(value, incomplete));
    assert.ok(view.calls.includes('/orders/?date=2024-02-29'));
    assert.ok(view.calls.includes('/cashier/summary/?date=2024-02-29'));
  }
  view.change('2026-10-16');
  assert.ok(view.calls.includes('/orders/?date=2026-10-16'));
  view.change('');
  assert.ok(view.calls.includes('/orders/?'));
});

test('valid date boundaries remain available and constrain the native date control', () => {
  for (const value of ['0001-01-01', '2024-02-29', '9999-12-31']) {
    const view = panel(value);
    assert.doesNotThrow(() => view.render());
    assert.ok(view.calls.includes(`/orders/?date=${value}`));
    assert.ok(view.calls.includes(`/cashier/summary/?date=${value}`));
  }
  const input = panel().date();
  assert.equal(input.props.min, '0001-01-01');
  assert.equal(input.props.max, '9999-12-31');
});
