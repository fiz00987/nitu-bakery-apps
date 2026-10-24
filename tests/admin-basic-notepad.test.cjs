const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));

function harness(t, initialPages, legacyText = '') {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'admin-app/index.html'), 'utf8'), {
    url: 'https://test.invalid/admin-app/', runScripts: 'outside-only'
  });
  const w = dom.window;
  w.setTimeout = () => 1;
  w.clearTimeout = () => {};
  w.eval(fs.readFileSync(path.join(root, 'admin-app/basic-notepad.js'), 'utf8'));

  const state = { pages: copy(initialPages), text: legacyText };
  const writes = [];
  const valueAt = parts => parts.reduce((value, key) => value && value[key], state) ?? null;
  const snapshot = parts => ({ val: () => copy(valueAt(parts)) });
  const setAt = (parts, value) => {
    const parent = parts.slice(0, -1).reduce((target, key) => target[key] ||= {}, state);
    parent[parts.at(-1)] = copy(value);
    writes.push({ parts, value: copy(value) });
  };
  const ref = parts => ({
    child: key => ref(parts.concat(String(key))),
    once: async () => snapshot(parts),
    set: async value => setAt(parts, value),
    transaction: async transform => {
      const next = transform(copy(valueAt(parts)));
      if (next === undefined) return { committed: false, snapshot: snapshot(parts) };
      setAt(parts, next);
      return { committed: true, snapshot: snapshot(parts) };
    }
  });

  const notebook = w.NituBasicNotepad.create({
    pagesRef: ref(['pages']),
    notesRef: ref(['text']),
    toast() {},
    sync() {},
    confirm: (...args) => args.at(-1)(true),
    language: () => 'en',
    photoUrl: value => value,
    compressPhoto: (_, callback) => callback('data:image/jpeg;base64,photo'),
    openPhoto() {}
  });
  notebook.activate('admin-one');
  t.after(() => dom.window.close());
  return { w, notebook, state, writes, el: id => w.document.getElementById(id) };
}

test('basic mode opens the original simple page list and preserves advanced page fields', async t => {
  const h = harness(t, {
    0: { text: 'Butter 2kg', photos: [], category: 'cake', items: { flour: { name: 'Flour' } }, title: 'Shopping' },
    1: { text: 'Original baking method', photos: [], category: 'baking' }
  });
  await h.notebook.receive(h.state.pages);
  await h.notebook.open();
  h.w.NituNotebookModes.show('basic');

  assert.equal(h.el('notepad-basic-view').hidden, false);
  assert.equal(h.el('notepad-advanced-view').hidden, true);
  assert.equal(h.el('notepad-basic-page-sel').options.length, 2);
  assert.equal(h.el('notepad-basic-text').value, 'Butter 2kg');

  h.el('notepad-basic-text').value = 'Butter 3kg';
  h.el('notepad-basic-text').dispatchEvent(new h.w.Event('input'));
  await h.notebook.flush();

  assert.equal(h.state.pages[0].text, 'Butter 3kg');
  assert.deepEqual(h.state.pages[0].items, { flour: { name: 'Flour' } });
  assert.equal(h.state.pages[0].category, 'cake');
});

test('basic mode can add and switch pages without exposing advanced categories', async t => {
  const h = harness(t, { 0: { text: 'Shopping list', photos: [] } });
  await h.notebook.receive(h.state.pages);
  await h.notebook.open();
  await h.notebook.addPage();

  assert.equal(Object.keys(h.state.pages).length, 2);
  assert.equal(h.el('notepad-basic-page-sel').options.length, 2);
  assert.equal(h.el('notepad-basic-text').value, '');
  await h.notebook.switchPage('0');
  assert.equal(h.el('notepad-basic-text').value, 'Shopping list');
  assert.equal(h.el('notepad-tab-cake').hidden, false, 'the current advanced notebook remains mounted for its own mode');
});

test('the old single-string note appears in basic mode and is materialized only on edit', async t => {
  const h = harness(t, null, 'Legacy shopping list');
  await h.notebook.receive(null);
  await h.notebook.open();
  assert.equal(h.el('notepad-basic-text').value, 'Legacy shopping list');
  assert.equal(h.writes.length, 0);

  h.el('notepad-basic-text').value = 'Updated legacy list';
  h.el('notepad-basic-text').dispatchEvent(new h.w.Event('input'));
  await h.notebook.flush();
  assert.equal(h.state.pages[0].text, 'Updated legacy list');
  assert.equal(h.state.text, 'Updated legacy list');
});

test('notebook mode tabs keep exactly one notebook surface visible', t => {
  const h = harness(t, {});
  h.w.NituNotebookModes.show('basic');
  assert.equal(h.el('notepad-basic-view').hidden, false);
  assert.equal(h.el('notepad-advanced-view').hidden, true);
  assert.equal(h.el('notepad-mode-basic').getAttribute('aria-selected'), 'true');
  assert.equal(h.el('notepad-mode-advanced').getAttribute('aria-selected'), 'false');

  h.w.NituNotebookModes.show('advanced');
  assert.equal(h.el('notepad-basic-view').hidden, true);
  assert.equal(h.el('notepad-advanced-view').hidden, false);
  assert.equal(h.el('notepad-mode-basic').getAttribute('aria-selected'), 'false');
  assert.equal(h.el('notepad-mode-advanced').getAttribute('aria-selected'), 'true');
});
