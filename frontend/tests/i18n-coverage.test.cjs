const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Loads the real dictionaries from src/i18n.tsx, so a missing or empty string
// fails here even when the TypeScript build is not run.
const source = fs.readFileSync(path.join(__dirname, '../src/i18n.tsx'), 'utf8');
const reactStub = {
  createContext: () => ({}),
  useContext: () => null,
  useCallback: fn => fn,
  useState: value => [value, () => {}],
};
const loaded = {};
const compiled = ts.transpileModule(source + '\nexports.DICT = DICT;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, {
  exports: loaded,
  require: name => {
    if (name === 'react') return reactStub;
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
    throw new Error(`Unexpected import: ${name}`);
  },
  localStorage: { getItem: () => null, setItem() {} },
});

const LANGS = ['kz', 'ru', 'en'];
const DICT = loaded.DICT;

// Keys declared in the Translations interface are the contract every language must meet.
function interfaceKeys() {
  const block = source.match(/export interface Translations \{([\s\S]*?)\n\}/);
  assert.ok(block, 'Translations interface must exist in i18n.tsx');
  return [...block[1].matchAll(/^\s+([A-Za-z0-9_]+)\s*:/gm)].map(match => match[1]);
}

test('the dictionary has exactly the three supported languages', () => {
  assert.deepEqual(Object.keys(DICT).sort(), [...LANGS].sort());
});

test('every interface key has a translation in every language', () => {
  const keys = interfaceKeys();
  assert.ok(keys.length > 50, 'interface should list the full set of UI strings');
  const missing = [];
  for (const lang of LANGS) {
    for (const key of keys) {
      if (!(key in DICT[lang])) missing.push(`${lang}.${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every translation is non-empty text in every language', () => {
  // Plural-style entries are functions of a count; check their output for a few counts.
  const empty = [];
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(DICT[lang])) {
      const samples = typeof value === 'function' ? [0, 1, 2, 5].map(n => value(n)) : [value];
      if (typeof value !== 'string' && typeof value !== 'function') empty.push(`${lang}.${key}`);
      for (const text of samples) {
        if (typeof text !== 'string' || text.trim() === '') empty.push(`${lang}.${key}`);
      }
    }
  }
  assert.deepEqual([...new Set(empty)], []);
});

test('no language carries keys that the other languages lack', () => {
  const reference = new Set(Object.keys(DICT.ru));
  const extra = [];
  for (const lang of LANGS) {
    for (const key of Object.keys(DICT[lang])) {
      if (!reference.has(key)) extra.push(`${lang}.${key}`);
    }
  }
  assert.deepEqual(extra, []);
});
