const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));

function harness(t, initial = {}) {
  const dom = new JSDOM('<!doctype html><main><div id="view-costing"></div></main>', {
    url: 'https://test.invalid/admin-app/', runScripts: 'outside-only'
  });
  const w = dom.window;
  const state = { monthlyCosting: copy(initial) };
  const listeners = new Map();
  const toasts = [];
  let nextKey = 0;

  const valueAt = parts => parts.reduce((value, key) => value && value[key], state) ?? null;
  const setAt = (parts, value) => {
    const parent = parts.slice(0, -1).reduce((target, key) => target[key] ||= {}, state);
    parent[parts.at(-1)] = copy(value);
  };
  const snapshot = parts => ({ val: () => copy(valueAt(parts)) });
  const ref = parts => ({
    child: key => ref(parts.concat(String(key))),
    on: (event, fn) => listeners.set(parts.join('/'), fn),
    off: (event, fn) => {
      if (!fn || listeners.get(parts.join('/')) === fn) listeners.delete(parts.join('/'));
    },
    update: async patch => {
      const current = copy(valueAt(parts)) || {};
      Object.assign(current, copy(patch));
      setAt(parts, current);
    },
    remove: async () => {
      const parent = parts.slice(0, -1).reduce((target, key) => target && target[key], state);
      if (parent) delete parent[parts.at(-1)];
    },
    push: async value => {
      const key = `entry-${++nextKey}`;
      const current = copy(valueAt(parts)) || {};
      current[key] = copy(value);
      setAt(parts, current);
      return { key };
    }
  });

  w.eval(fs.readFileSync(path.join(root, 'admin-app/monthly-costing.js'), 'utf8'));
  const manager = w.NituMonthlyCosting.create({
    costingRef: ref(['monthlyCosting']),
    getIncome: key => key === '2026-09' ? 10000 : 0,
    language: () => 'en',
    formatMoney: value => String(Math.round(Number(value) || 0)),
    toast: message => toasts.push(message),
    confirm: (...args) => args.at(-1)(true)
  });
  t.after(() => dom.window.close());

  return {
    w, manager, state, listeners, toasts,
    emit() { listeners.get('monthlyCosting')?.({ val: () => copy(state.monthlyCosting) }); },
    el: id => w.document.getElementById(id)
  };
}

test('monthly costing parses Bengali digits and additive amount expressions', () => {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
  dom.window.eval(fs.readFileSync(path.join(root, 'admin-app/monthly-costing.js'), 'utf8'));
  const { parseAmount } = dom.window.NituMonthlyCosting;

  assert.equal(parseAmount('১১৯০ + ১২৯৩').value, 2483);
  assert.deepEqual(Array.from(parseAmount('4585+1294+1064').parts), [4585, 1294, 1064]);
  assert.equal(parseAmount('800 (baki)').value, null);
  dom.window.close();
});

test('monthly costing separates paid and pending expenses from net income', t => {
  const h = harness(t, {
    '2026-09': {
      incomeAdjustment: 500,
      entries: {
        bakery: { category: 'bakery', amount: 2483, source: '1190+1293', status: 'paid', createdAt: 1 },
        grocery: { category: 'grocery', amount: 800, source: '800', status: 'pending', createdAt: 2 }
      }
    }
  });
  h.manager.setMonth('2026-09');
  h.manager.activate('admin-one');
  h.emit();

  const summary = h.manager.summary('2026-09');
  assert.equal(summary.totalIncome, 10500);
  assert.equal(summary.paidExpenses, 2483);
  assert.equal(summary.pendingExpenses, 800);
  assert.equal(summary.cashNet, 8017);
  assert.equal(summary.projectedNet, 7217);
  assert.equal(h.el('costing-income-adjustment').value, '500');
  assert.match(h.el('view-costing').textContent, /Projected net income/);
});

test('monthly costing saves additive entries, toggles status, and reads them back', async t => {
  const h = harness(t);
  h.manager.setMonth('2026-09');
  h.manager.activate('admin-one');
  h.manager.receive({ val: () => copy(h.state.monthlyCosting) });

  h.el('costing-category').value = 'topper';
  h.el('costing-amount').value = '405 + 260';
  h.el('costing-payment-status').value = 'paid';
  h.el('costing-note').value = 'Birthday topper';
  assert.equal(await h.manager.addEntry(), true);

  const savedEntry = h.state.monthlyCosting['2026-09'].entries['entry-1'];
  assert.equal(savedEntry.amount, 665);
  assert.equal(savedEntry.category, 'topper');
  assert.equal(savedEntry.source, '405 + 260');
  assert.equal(h.manager.summary('2026-09').categoryTotals.topper, 665);

  await h.manager.toggleStatus('entry-1');
  assert.equal(h.state.monthlyCosting['2026-09'].entries['entry-1'].status, 'pending');
  assert.equal(h.manager.summary('2026-09').pendingExpenses, 665);

  await h.manager.deleteEntry('entry-1');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state.monthlyCosting['2026-09'].entries['entry-1'], undefined);
  assert.ok(h.toasts.length >= 3);
});
