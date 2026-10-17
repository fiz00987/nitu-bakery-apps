const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
const page = (text, extra = {}) => ({ text, photos: ['https://test.invalid/cake.png'], createdAt: 123, extraField: 'preserve me', ...extra });

async function harness(t, initial, legacy = '') {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'admin-app/index.html'), 'utf8'), { url: 'https://test.invalid/', runScripts: 'outside-only' });
  const w = dom.window;
  w.setTimeout = () => 1; w.clearTimeout = () => {};
  w.eval(fs.readFileSync(path.join(root, 'admin-app/notepad.js'), 'utf8'));
  const state = { pages: copy(initial), text: legacy };
  const writes = [];
  let before, failure = false, photoCallback, uid = 0;
  const valueAt = parts => parts.reduce((value, key) => value && value[key], state) ?? null;
  const snapshot = parts => ({ val: () => copy(valueAt(parts)) });
  const ref = parts => ({
    child: key => ref(parts.concat(key)),
    push: () => ({ key: 'item-' + ++uid }),
    once: async () => snapshot(parts),
    set: async value => {
      const parent = parts.slice(0, -1).reduce((value, key) => value[key], state);
      parent[parts.at(-1)] = copy(value); writes.push({ parts, value: copy(value) });
    },
    transaction: async transform => {
      if (before) { const fn = before; before = null; fn(); }
      if (failure) { failure = false; throw Error('network'); }
      const next = transform(copy(valueAt(parts)));
      if (next === undefined) return { committed: false, snapshot: snapshot(parts) };
      const parent = parts.slice(0, -1).reduce((value, key) => value[key] ||= {}, state);
      parent[parts.at(-1)] = copy(next); writes.push({ parts, value: copy(next) });
      return { committed: true, snapshot: snapshot(parts) };
    }
  });
  let lang = 'en';
  const notebook = w.NituNotepad.create({
    pagesRef: ref(['pages']), notesRef: ref(['text']), toast() {}, sync() {},
    confirm: (...args) => args.at(-1)(true), language: () => lang,
    photoUrl: value => value, openPhoto() {}, compressPhoto: (_, callback) => { photoCallback = callback; }
  });
  notebook.activate('admin-one');
  await notebook.receive(copy(state.pages));
  await notebook.open();
  t.after(() => dom.window.close());
  return {
    notebook, state, writes, w, math: w.NituNotepad,
    el: id => w.document.getElementById(id),
    expenseInput: (itemKey, field) => w.document.querySelector(`#notepad-checklist input[data-item-key="${itemKey}"][data-expense-field="${field}"]`),
    input(id, value) { const node = w.document.getElementById(id); node.value = value; node.dispatchEvent(new w.Event('input')); },
    emit: () => notebook.receive(copy(state.pages)),
    race: fn => { before = fn; }, fail: () => { failure = true; },
    finishPhoto: async value => { await photoCallback(value); },
    language(value) { lang = value; notebook.render(); }
  };
}

test('opening legacy array pages categorizes them visually without any data writes', async t => {
  const original = [page('Butter 2kg'), page('Original baking method')];
  const h = await harness(t, original, 'Original legacy text');
  assert.deepEqual(h.state.pages, original);
  assert.equal(h.state.text, 'Original legacy text');
  assert.equal(h.writes.length, 0);
  assert.equal(h.el('notepad-text').value, 'Butter 2kg');
  assert.equal(h.el('notepad-tab-cake').getAttribute('aria-selected'), 'true');
  assert.equal(h.el('notepad-page-sel').options.length, 2);
});

test('moving a sparse object page preserves keys, text, photos and unknown fields', async t => {
  const original = { 0: page('Shopping'), 7: page('Bake at 160°C') };
  const h = await harness(t, original);
  await h.notebook.switchPage('7');
  await h.notebook.movePage('baking');
  assert.deepEqual(h.state.pages[0], original[0]);
  assert.deepEqual(h.state.pages[7], { ...original[7], category: 'baking', updatedAt: h.state.pages[7].updatedAt });
  assert.equal(h.el('notepad-page-sel').options.length, 1);
  assert.equal(h.el('notepad-text').value, 'Bake at 160°C');
  await h.notebook.close(); await h.notebook.open();
  assert.equal(h.el('notepad-text').value, 'Shopping', 'shopping must open first');
});

test('each tab creates its own page and server-side concurrent pages are retained', async t => {
  const h = await harness(t, { 0: page('Existing shopping') });
  await h.notebook.switchCategory('baking');
  assert.equal(h.el('notepad-empty').hidden, false);
  h.race(() => { h.state.pages[3] = page('Added by another admin', { category: 'other' }); });
  await h.notebook.addPage();
  assert.equal(h.state.pages[0].text, 'Existing shopping');
  assert.equal(h.state.pages[3].text, 'Added by another admin');
  assert.equal(h.state.pages[4].category, 'baking');
  await h.notebook.switchCategory('other'); await h.notebook.addPage();
  assert.equal(h.state.pages[5].category, 'other');
  assert.equal(h.el('notepad-page-sel').options.length, 2);
});

test('switching pages saves a blurred text draft without overwriting a concurrent different page', async t => {
  const h = await harness(t, { 0: page('First'), 1: page('Second') });
  h.input('notepad-text', 'Edited first');
  h.race(() => { h.state.pages[1].text = 'Second from another device'; h.state.pages[0].photos.push('https://test.invalid/new.png'); });
  await h.notebook.switchPage('1');
  assert.equal(h.state.pages[0].text, 'Edited first');
  assert.equal(h.state.pages[0].photos.length, 2);
  assert.equal(h.state.pages[1].text, 'Second from another device');
  assert.equal(h.state.text, 'Edited first');
  assert.equal(h.writes.filter(write => write.parts.length === 1 && write.parts[0] === 'pages').length, 0);
});

test('same-page conflict keeps the cloud text and local draft, with separate-copy recovery', async t => {
  const h = await harness(t, { 0: page('Original') });
  h.input('notepad-text', 'My draft');
  h.race(() => { h.state.pages[0].text = 'Other admin text'; });
  assert.equal(await h.notebook.flush(), false);
  assert.equal(h.state.pages[0].text, 'Other admin text');
  assert.equal(h.el('notepad-text').value, 'My draft');
  assert.equal(h.el('notepad-draft-alert').hidden, false);
  await h.notebook.recover();
  assert.equal(h.state.pages[0].text, 'Other admin text');
  assert.equal(h.state.pages[1].text, 'My draft');
  assert.deepEqual(h.state.pages[1].photos, ['https://test.invalid/cake.png']);
});

test('failed note saves keep the draft across account transitions and can be retried', async t => {
  const h = await harness(t, { 0: page('Original') });
  h.input('notepad-text', 'Offline draft'); h.fail();
  assert.equal(await h.notebook.flush(), false);
  h.notebook.activate('admin-two'); await h.emit();
  assert.equal(h.el('notepad-text').value, 'Original');
  h.notebook.activate('admin-one'); await h.emit();
  assert.equal(h.el('notepad-text').value, 'Offline draft');
  await h.notebook.retry();
  assert.equal(h.state.pages[0].text, 'Offline draft');
});

test('legacy single-string text is displayed without writes and retained when first adding a page', async t => {
  const h = await harness(t, null, 'Precious old shopping list');
  assert.equal(h.el('notepad-text').value, 'Precious old shopping list');
  assert.equal(h.writes.length, 0);
  await h.notebook.switchCategory('baking'); await h.notebook.addPage();
  assert.equal(h.state.pages[0].text, 'Precious old shopping list');
  assert.equal(h.state.pages[1].category, 'baking');
  assert.equal(h.state.text, 'Precious old shopping list');
});

test('adding and checking shopping items retains old notes and photos', async t => {
  const original = page('Keep my old handwritten list');
  const h = await harness(t, { 0: original });
  h.el('notepad-item-name').value = 'Butter'; h.el('notepad-item-detail').value = '2 kg';
  await h.notebook.addItem();
  await h.notebook.toggleItem('item-1', true);
  assert.equal(h.state.pages[0].text, original.text);
  assert.deepEqual(h.state.pages[0].photos, original.photos);
  assert.equal(h.state.pages[0].items['item-1'].checked, true);
  assert.match(h.el('notepad-check-progress').textContent, /1\/1 bought/);
});

test('baking item rows save name, quantity and total price for the monthly expense list', async t => {
  const h = await harness(t, { 0: page('Keep this additional info') });
  h.el('notepad-item-name').value = 'Everwhip whipped cream';
  h.el('notepad-item-detail').value = '4 piece';
  h.el('notepad-item-price').value = '2300';
  assert.equal(await h.notebook.addItem(), true);
  h.el('notepad-item-name').value = 'Baking powder';
  h.el('notepad-item-detail').value = '500 gram';
  h.el('notepad-item-price').value = '400';
  assert.equal(await h.notebook.addItem(), true);

  const items = Object.values(h.state.pages[0].items);
  assert.deepEqual(items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })), [
    { name: 'Everwhip whipped cream', quantity: '4 piece', price: 2300 },
    { name: 'Baking powder', quantity: '500 gram', price: 400 }
  ]);
  assert.equal(items.every(item => item.expense?.amount === item.price && item.expense?.date), true);
  assert.equal(h.el('notepad-checklist').querySelectorAll('.np-check-row').length, 2);
  assert.equal(JSON.stringify(h.notebook.getExpenses().map(item => item.amount)), JSON.stringify([2300, 400]));
  assert.equal(h.state.pages[0].text, 'Keep this additional info');
});

test('additional info is an editable note and does not create a fake baking item', async t => {
  const h = await harness(t, { 0: page('Old note') });
  h.input('notepad-text', 'Snacks and vegetables for the shop');
  assert.equal(await h.notebook.flush(), true);
  assert.equal(h.state.pages[0].text, 'Snacks and vegetables for the shop');
  assert.equal(h.state.pages[0].items, undefined);
  assert.equal(h.state.text, 'Snacks and vegetables for the shop');
  assert.equal(h.el('notepad-text').value, 'Snacks and vegetables for the shop');
});

test('baking item pages enforce the 30-item limit inside the transaction', async t => {
  const items = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`item-${i}`, {
    name: `Item ${i + 1}`, quantity: '1 piece', price: i + 1,
    expense: { amount: i + 1, date: '2026-10-15' }, checked: false
  }]));
  const h = await harness(t, { 0: page('Full list', { items }) });
  h.el('notepad-item-name').value = 'Too many';
  h.el('notepad-item-detail').value = '1 piece';
  h.el('notepad-item-price').value = '999';
  assert.equal(await h.notebook.addItem(), false);
  assert.equal(Object.keys(h.state.pages[0].items).length, 30);
  assert.equal(h.el('notepad-shopping').querySelector('.np-add-item button').disabled, true);

  const h2 = await harness(t, { 0: page('Race', { items: Object.fromEntries(Array.from({ length: 29 }, (_, i) => [`item-${i}`, { name: `Item ${i}`, quantity: '1', checked: false }])) }) });
  h2.race(() => {
    h2.state.pages[0].items['item-29'] = { name: 'Concurrent item', quantity: '1', checked: false };
  });
  assert.equal(await h2.notebook.addItem({ name: 'Racing item', quantity: '1', price: '1' }), false);
  assert.equal(Object.keys(h2.state.pages[0].items).length, 30);
});

test('asynchronous photo upload stays on the originating page after switching tabs', async t => {
  const h = await harness(t, { 0: page('Shopping'), 1: page('Recipe', { category: 'baking' }) });
  h.notebook.addPhoto({ files: [{}], value: 'image.png' });
  await h.notebook.switchCategory('baking');
  await h.finishPhoto('https://test.invalid/added.png');
  assert.equal(h.state.pages[0].photos.length, 2);
  assert.equal(h.state.pages[1].photos.length, 1);
  assert.equal(h.el('notepad-text').value, 'Recipe');
});

test('calculations handle precedence, decimal arithmetic and Bengali digits safely', async t => {
  const h = await harness(t, { 0: page('Original') });
  assert.equal(h.math.calculate('(২৫০ + ১২৫) × ২'), 750);
  assert.equal(h.math.calculate('10 - 2 * 3'), 4);
  assert.equal(h.math.calculate('-12 / (2 + 4)'), -2);
  assert.equal(h.math.calculate('0.1 + 0.2'), 0.3);
  for (const invalid of ['1/0', 'alert(1)', '2(3)', '1..2', '(1+2', '']) assert.throws(() => h.math.calculate(invalid));
  h.input('np-calc-input', '250 + 125'); h.notebook.insertCalculation();
  await h.notebook.flush();
  assert.equal(h.state.pages[0].text, 'Original\n\n250 + 125 = 375');
});

test('a recipe outline appends to a baking page without replacing its contents', async t => {
  const h = await harness(t, { 0: page('Existing method', { category: 'baking' }) });
  await h.notebook.switchCategory('baking');
  h.notebook.template(); await h.notebook.flush();
  assert.match(h.state.pages[0].text, /^Existing method\n\nRecipe:/);
  assert.match(h.state.pages[0].text, /Oven temperature:/);
  assert.deepEqual(h.state.pages[0].photos, ['https://test.invalid/cake.png']);
});

test('switching language updates notebook tabs and labels', async t => {
  const h = await harness(t, { 0: page('Old notes') });
  h.language('bn');
  assert.match(h.el('notepad-tab-cake').textContent, /বেকিং আইটেম/);
  h.language('en');
  assert.match(h.el('notepad-tab-baking').textContent, /Baking Instructions/);
  assert.equal(h.writes.length, 0);
});

test('an untouched focused note follows cloud changes before appending a calculation', async t => {
  const h = await harness(t, { 0: page('Original') });
  h.el('notepad-text').focus();
  h.state.pages[0].text = 'Latest cloud note'; await h.emit();
  assert.equal(h.el('notepad-text').value, 'Latest cloud note');
  h.input('np-calc-input', '2+3'); h.notebook.insertCalculation(); await h.notebook.flush();
  assert.equal(h.state.pages[0].text, 'Latest cloud note\n\n2+3 = 5');
});

test('renaming one page retains concurrent changes to other page fields', async t => {
  const h = await harness(t, { 0: page('Original shopping') });
  h.input('notepad-title', 'Weekly shopping');
  h.race(() => { h.state.pages[0].text = 'Updated elsewhere'; h.state.pages[0].newField = 'Also keep this'; });
  await h.notebook.flush();
  assert.equal(h.state.pages[0].title, 'Weekly shopping');
  assert.equal(h.state.pages[0].text, 'Updated elsewhere');
  assert.equal(h.state.pages[0].newField, 'Also keep this');
  assert.equal(h.state.pages[0].extraField, 'preserve me');
});

test('mobile shopping board shows every line without changing stored notes', async t => {
  const shopping = Array.from({ length: 20 }, (_, i) => `Item ${i + 1} with a long ingredient name`).join('\n');
  const h = await harness(t, { 0: page(shopping) });
  const board = h.el('np-cake-board');
  assert.equal(board.children.length, 20);
  assert.equal(board.children[19].textContent, 'Item 20 with a long ingredient name');
  assert.equal(h.el('notepad-shopping').open, true);
  h.input('notepad-text', shopping + '\nItem 21');
  assert.equal(board.children.length, 21, 'preview updates as the note is typed');
  assert.equal(h.state.pages[0].text, shopping, 'preview does not write until the draft is saved');
  await h.notebook.flush();
  assert.equal(h.state.pages[0].text, shopping + '\nItem 21');
});

test('the four-tab notebook calculator and keyboard navigation leave saved pages intact', async t => {
  const original = { 0: page('Shopping'), 1: page('Instructions', { category: 'baking' }) };
  const h = await harness(t, original);
  const tools = h.el('notepad-helper-aside').querySelectorAll('details');
  assert.equal(h.w.document.querySelectorAll('.np-tab').length, 4);
  assert.equal(h.el('notepad-tab-recipe'), null);
  assert.equal(h.w.document.querySelector('[id^="np-scale-"]'), null);
  assert.equal(h.math.scale, undefined);
  assert.equal(h.notebook.scaleUi, undefined);
  assert.equal(h.notebook.insertScale, undefined);
  assert.equal(tools.length, 1);
  await h.notebook.switchCategory('calculator');
  assert.equal(h.el('notepad-panel').hidden, true);
  assert.equal(h.el('notepad-tool-host').hidden, false);
  assert.equal(tools[0].hidden, false);
  h.input('np-calc-input', '250 + 125');
  assert.equal(h.el('np-calc-result').textContent, '375');
  h.el('notepad-tab-calculator').dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.el('notepad-tab-cake').getAttribute('aria-selected'), 'true');
  assert.equal(h.w.document.activeElement, h.el('notepad-tab-cake'));
  for (const [tab, key, selected] of [
    ['cake', 'ArrowLeft', 'calculator'],
    ['calculator', 'Home', 'cake'],
    ['cake', 'End', 'calculator']
  ]) {
    h.el('notepad-tab-' + tab).dispatchEvent(new h.w.KeyboardEvent('keydown', { key, bubbles: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.el('notepad-tab-' + selected).getAttribute('aria-selected'), 'true');
    assert.equal(h.w.document.activeElement, h.el('notepad-tab-' + selected));
  }
  await h.notebook.switchCategory('baking');
  await h.notebook.switchCategory('recipe');
  assert.equal(h.el('notepad-tab-baking').getAttribute('aria-selected'), 'true');
  assert.equal(h.el('notepad-panel').hidden, false);
  assert.equal(h.el('notepad-edit-details').open, true);
  assert.deepEqual(h.state.pages, original);
  assert.equal(h.writes.length, 0);
});

test('cake checklist expenses persist without losing item fields and are exposed by the API', async t => {
  const original = page('Shopping', {
    items: { flour: { name: 'Flour', detail: '2 kg', checked: false, extra: 'keep me' } }
  });
  const h = await harness(t, { 0: original });
  assert.equal(await h.notebook.setItemExpense('flour', { amount: '125.50', date: '2026-10-13' }), true);
  assert.deepEqual(h.state.pages[0].items.flour, {
    name: 'Flour', detail: '2 kg', checked: false, extra: 'keep me',
    expense: { amount: 125.5, date: '2026-10-13' }
  });
  assert.equal(JSON.stringify(h.notebook.getExpenses()), JSON.stringify([{
    pageKey: '0', itemKey: 'flour', name: 'Flour', amount: 125.5, date: '2026-10-13'
  }]));
  assert.equal(await h.notebook.setItemExpense('flour', { amount: '-1' }), false);
  assert.equal(h.state.pages[0].items.flour.expense.amount, 125.5);
});

test('checking a cake item defaults a missing expense date without inventing a price', async t => {
  const h = await harness(t, { 0: page('Shopping', {
    items: { sugar: { name: 'Sugar', detail: '1 kg', checked: false } }
  }) });
  await h.notebook.toggleItem('sugar', true);
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(h.state.pages[0].items.sugar.checked, true);
  assert.equal(h.state.pages[0].items.sugar.expense.date, expected);
  assert.equal(Object.hasOwn(h.state.pages[0].items.sugar.expense, 'amount'), false);
  assert.equal(JSON.stringify(h.notebook.getExpenses()), '[]');
});

test('a price typed before blur survives live receives and preserves other-device fields', async t => {
  const h = await harness(t, { 0: page('Shopping', {
    items: { flour: { name: 'Flour', checked: false, expense: { amount: 10, date: '2026-10-10' } } }
  }) });
  const amount = h.expenseInput('flour', 'amount');
  amount.focus(); amount.value = '125.50'; amount.dispatchEvent(new h.w.Event('input'));
  h.state.pages[0].items.flour.detail = 'Updated elsewhere';
  h.state.pages[0].items.flour.expense.date = '2026-10-12';
  h.state.pages[0].items.flour.expense.receipt = 'Keep this receipt';
  await h.emit();
  assert.equal(h.expenseInput('flour', 'amount').value, '125.50');
  assert.equal(h.w.document.activeElement, h.expenseInput('flour', 'amount'));
  assert.equal(h.expenseInput('flour', 'date').value, '2026-10-12', 'untouched fields must follow the cloud');
  assert.equal(h.state.pages[0].items.flour.expense.amount, 10, 'receiving must not save the draft');
  assert.equal(await h.notebook.flush(), true);
  assert.deepEqual(h.state.pages[0].items.flour, {
    name: 'Flour', checked: false, detail: 'Updated elsewhere',
    expense: { amount: 125.5, date: '2026-10-12', receipt: 'Keep this receipt' }
  });
});

test('an expense date typed before blur survives rendering and retains a concurrent price', async t => {
  const h = await harness(t, { 0: page('Shopping', {
    items: { flour: { name: 'Flour', expense: { amount: 10, date: '2026-10-10' } } }
  }) });
  const date = h.expenseInput('flour', 'date');
  date.focus(); date.value = '2026-10-13'; date.dispatchEvent(new h.w.Event('input'));
  h.notebook.render();
  assert.equal(h.expenseInput('flour', 'date').value, '2026-10-13');
  h.race(() => { h.state.pages[0].items.flour.expense.amount = 99; });
  assert.equal(await h.notebook.flush(), true);
  assert.deepEqual(h.state.pages[0].items.flour.expense, { amount: 99, date: '2026-10-13' });
});

test('editing a second expense field uses its latest cloud value as the conflict base', async t => {
  const h = await harness(t, { 0: page('Shopping', {
    items: { flour: { name: 'Flour', expense: { amount: 10, date: '2026-10-10' } } }
  }) });
  const amount = h.expenseInput('flour', 'amount');
  amount.value = '20'; amount.dispatchEvent(new h.w.Event('change'));
  h.state.pages[0].items.flour.expense.date = '2026-10-12'; await h.emit();
  assert.equal(h.expenseInput('flour', 'date').value, '2026-10-12');
  const date = h.expenseInput('flour', 'date');
  date.value = '2026-10-13'; date.dispatchEvent(new h.w.Event('change'));
  assert.equal(await h.notebook.flush(), true);
  assert.deepEqual(h.state.pages[0].items.flour.expense, { amount: 20, date: '2026-10-13' });
});

test('same-field expense conflicts preserve the cloud value and the account-scoped input draft', async t => {
  const h = await harness(t, { 0: page('Shopping', {
    items: { flour: { name: 'Flour', expense: { amount: 10, date: '2026-10-10' } } }
  }) });
  const amount = h.expenseInput('flour', 'amount');
  amount.value = '20'; amount.dispatchEvent(new h.w.Event('input'));
  h.race(() => { h.state.pages[0].items.flour.expense = { amount: 99, date: '2026-10-12' }; });
  assert.equal(await h.notebook.flush(), false);
  assert.deepEqual(h.state.pages[0].items.flour.expense, { amount: 99, date: '2026-10-12' });
  assert.equal(h.expenseInput('flour', 'amount').value, '20');
  h.notebook.activate('admin-two'); await h.emit();
  assert.equal(h.expenseInput('flour', 'amount').value, '99');
  h.notebook.activate('admin-one'); await h.emit();
  assert.equal(h.expenseInput('flour', 'amount').value, '20');
  assert.equal(h.expenseInput('flour', 'date').value, '2026-10-12');
  assert.equal(await h.notebook.flush(), false);
  assert.equal(h.state.pages[0].items.flour.expense.amount, 99);
});

test('invalid expense input is kept through live rendering until it is corrected', async t => {
  const h = await harness(t, { 0: page('Shopping', {
    items: { flour: { name: 'Flour', expense: { amount: 10, date: '2026-10-10' } } }
  }) });
  const amount = h.expenseInput('flour', 'amount');
  amount.value = '-1'; amount.dispatchEvent(new h.w.Event('input')); await h.emit();
  assert.equal(h.expenseInput('flour', 'amount').value, '-1');
  assert.equal(await h.notebook.flush(), false);
  assert.equal(h.state.pages[0].items.flour.expense.amount, 10);
  const corrected = h.expenseInput('flour', 'amount');
  corrected.value = '15'; corrected.dispatchEvent(new h.w.Event('input'));
  assert.equal(await h.notebook.flush(), true);
  assert.equal(h.state.pages[0].items.flour.expense.amount, 15);
});
