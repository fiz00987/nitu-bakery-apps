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

test('recipe scaling and outline append to a baking page without replacing its contents', async t => {
  const h = await harness(t, { 0: page('Existing method', { category: 'baking' }) });
  await h.notebook.switchCategory('baking');
  assert.equal(h.math.scale('২৫০', '২', '৩'), 375);
  for (const args of [['250', '0', '3'], ['', '2', '3'], ['250', '2', '-1']]) assert.throws(() => h.math.scale(...args));
  h.el('np-scale-name').value = 'Flour'; h.el('np-scale-quantity').value = '250'; h.el('np-scale-from').value = '2'; h.el('np-scale-to').value = '3';
  h.notebook.insertScale(); h.notebook.template(); await h.notebook.flush();
  assert.match(h.state.pages[0].text, /^Existing method\n\nFlour: 375 g/);
  assert.match(h.state.pages[0].text, /Oven temperature:/);
  assert.deepEqual(h.state.pages[0].photos, ['https://test.invalid/cake.png']);
});

test('switching language updates notebook tabs and labels', async t => {
  const h = await harness(t, { 0: page('Old notes') });
  h.language('bn');
  assert.match(h.el('notepad-tab-cake').textContent, /কেক আইটেম/);
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
  assert.equal(h.el('notepad-shopping').open, false);
  h.input('notepad-text', shopping + '\nItem 21');
  assert.equal(board.children.length, 21, 'preview updates as the note is typed');
  assert.equal(h.state.pages[0].text, shopping, 'preview does not write until the draft is saved');
  await h.notebook.flush();
  assert.equal(h.state.pages[0].text, shopping + '\nItem 21');
});

test('calculator and recipe occupy separate tabs without changing note pages', async t => {
  const original = { 0: page('Shopping'), 1: page('Instructions', { category: 'baking' }) };
  const h = await harness(t, original);
  const tools = h.el('notepad-helper-aside').querySelectorAll('details');
  await h.notebook.switchCategory('calculator');
  assert.equal(h.el('notepad-panel').hidden, true);
  assert.equal(h.el('notepad-tool-host').hidden, false);
  assert.equal(tools[0].hidden, false);
  assert.equal(tools[1].hidden, true);
  await h.notebook.switchCategory('recipe');
  assert.equal(tools[0].hidden, true);
  assert.equal(tools[1].hidden, false);
  await h.notebook.switchCategory('baking');
  assert.equal(h.el('notepad-panel').hidden, false);
  assert.equal(h.el('notepad-edit-details').open, true);
  assert.deepEqual(h.state.pages, original);
  assert.equal(h.writes.length, 0);
});
