const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// One place sets the per-line quantity cap for the cart, the quantity control and the catalog: src/lib.ts.
// The cap is 200 units; no component may keep its own literal limit.
const srcDir = path.join(__dirname, '../src');
const libSource = fs.readFileSync(path.join(srcDir, 'lib.ts'), 'utf8');

test('the per-line quantity cap is 200 units', () => {
  const match = /export const MAX_ORDER_ITEM_QUANTITY = (\d+);/.exec(libSource);
  assert.ok(match, 'lib.ts must export MAX_ORDER_ITEM_QUANTITY as a numeric constant');
  assert.equal(Number(match[1]), 200);
});

for (const file of ['store.tsx', 'ui.tsx']) {
  test(`${file} uses the shared cap and has no literal 99 limit`, () => {
    const text = fs.readFileSync(path.join(srcDir, file), 'utf8');
    assert.match(text, /MAX_ORDER_ITEM_QUANTITY/, `${file} must import the shared cap`);
    assert.doesNotMatch(text, /\b99\b/, `${file} still contains a literal 99`);
  });
}

test('the quantity input accepts three digits so 200 can be typed', () => {
  const text = fs.readFileSync(path.join(srcDir, 'ui.tsx'), 'utf8');
  assert.match(text, /slice\(0, 3\)/);
  assert.doesNotMatch(text, /slice\(0, 2\)/);
});
