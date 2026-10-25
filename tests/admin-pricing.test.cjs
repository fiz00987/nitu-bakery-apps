const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
const money = n => '৳' + n.toLocaleString('bn-BD');
const order = overrides => ({
  orderId: 'PRICE-REGRESSION', name: 'Test cake', customerName: 'Test cake',
  customerPhone: '01712345678', source: 'customer', status: 'pending',
  date: '2099-10-03', deliveryDate: '2099-10-03', timeSlot: '3:00 PM',
  weight: '2 pound', flavour: 'vanilla-sponge', fulfilment: 'delivery',
  cakePrice: 2500, basePrice: 2500, total: 2500, subtotal: 2500,
  advance: 2400, advanceTotal: 2400, deliveryAmount: 0, deliveryCharge: 0,
  deliveryPaid: 'unpaid', createdAt: 1, updatedAt: 1, ...overrides
});

// Run the real HTML and app in a DOM. All Firebase calls are in-memory;
// these tests never authenticate with or write to the production database.
function harness(t, initial, initialOrders) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'admin-app/index.html'), 'utf8'), {
    url: 'https://test.invalid/admin-app/', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole
  });
  const w = dom.window;
  const state = { orders: initialOrders ? copy(initialOrders) : { test: copy(initial) } };
  const listeners = new Map();
  const writes = [];
  let authListener;
  let beforeTransaction;
  const valueAt = p => p.split('/').reduce((v, k) => v && v[k], state) ?? null;
  const snapshot = p => ({ val: () => copy(valueAt(p)), exists: () => valueAt(p) != null });
  const write = (p, value) => {
    writes.push({ path: p, value: copy(value) });
    const parts = p.split('/');
    const key = parts.pop();
    let parent = state;
    for (const part of parts) parent = parent[part] ||= {};
    if (value == null) delete parent[key]; else parent[key] = copy(value);
  };
  const ref = (p, field, equal) => ({
    child: key => ref(p + '/' + key),
    on: (event, fn) => listeners.set(p, fn), off: () => listeners.delete(p),
    orderByChild: key => ref(p, key),
    equalTo: value => ref(p, field, value),
    once: () => Promise.resolve(field ? { val: () => Object.fromEntries(Object.entries(valueAt(p) || {}).filter(([, value]) => value[field] === equal)) } : snapshot(p)),
    set: value => { write(p, value); return Promise.resolve(); },
    update: patch => {
      const next = copy(valueAt(p)) || {};
      for (const [key, value] of Object.entries(copy(patch))) {
        const parts = key.split('/');
        const leaf = parts.pop();
        let target = next;
        for (const part of parts) target = target[part] ||= {};
        if (value == null) delete target[leaf]; else target[leaf] = value;
      }
      write(p, next); return Promise.resolve();
    },
    push: value => { write(p + '/new', value); return Promise.resolve({ key: 'new' }); },
    transaction: async fn => {
      // A server change between opening the modal and committing must win.
      if (beforeTransaction) { beforeTransaction(); beforeTransaction = null; }
      const next = fn(copy(valueAt(p)));
      if (next === undefined) return { committed: false, snapshot: snapshot(p) };
      write(p, next);
      return { committed: true, snapshot: snapshot(p) };
    }
  });
  w.firebase = {
    initializeApp() {},
    database: () => ({ ref, goOnline() {} }),
    auth: () => ({ onAuthStateChanged: fn => { authListener = fn; } })
  };
  w.firebase.database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
  w.localStorage.setItem('nitu-lang', 'en');
  w.setTimeout = w.setInterval = () => 1;
  w.clearTimeout = w.clearInterval = () => {};
  w.requestAnimationFrame = () => 1;
  w.requestIdleCallback = fn => fn();
  w.scrollTo = () => {};
  w.fetch = () => Promise.reject(new Error('Network disabled in tests'));
  w.eval(fs.readFileSync(path.join(root, 'admin-app/basic-notepad.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'admin-app/notepad.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'admin-app/monthly-costing.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'admin-app/app.js'), 'utf8'));
  authListener({ uid: 'test-admin', email: 'admin111@gmail.com' });
  const emit = () => {
    listeners.get('orders')(snapshot('orders'));
    assert.deepEqual(errors, [], 'app must render without swallowed runtime errors');
  };
  emit();
  t.after(() => dom.window.close());
  return {
    w, state, writes, emit, listeners,
    orderWrites: () => writes.filter(write => write.path.startsWith('orders/')),
    el: id => w.document.getElementById(id),
    card: () => w.document.getElementById('card-test'),
    race: fn => { beforeTransaction = fn; },
    async save() { w.App.saveOrder(); await new Promise(resolve => setImmediate(resolve)); }
  };
}

test('explicit cake price wins over a stale total, with a visible mismatch', t => {
  const h = harness(t, order({ total: 1900 }));
  assert.equal(h.card().querySelector('.pay-val').textContent, money(2500));
  assert.match(h.card().textContent, /Stored prices disagree/);
  h.w.App.openModal('test');
  assert.equal(h.el('f-total').value, '2500');
  assert.equal(h.el('f-due').value, '100');
  assert.equal(h.orderWrites().length, 0, 'displaying a conflict must not rewrite money');
});

test('customer multi-order submission renders independent admin cards immediately', async t => {
  const { multiForm } = require('./customer-multi-harness.cjs');
  const customer = multiForm(t, [500, 2000]);
  customer.w.setCakeKind(1, 'mini');
  customer.el('same-date-check').checked = false;
  customer.el('f-date-2').value = '2099-10-05';
  await customer.w.submitOrder();
  const h = harness(t, null, customer.state.orders);
  const cards = h.el('view-plan').querySelectorAll('.card');
  assert.equal(cards.length, 2);
  assert.equal(h.el('view-plan').querySelectorAll('.day-group').length, 2);
  for (const [i, card] of [...cards].entries()) {
    assert.equal(card.querySelector('.card-order-id').textContent.replace('🆔 ', ''), customer.orders()[i].orderId);
    assert.equal(card.querySelector('.pay-val').textContent, money(customer.orders()[i].cakePrice));
    assert.equal(card.querySelectorAll('.pay-val')[1].textContent, money(customer.orders()[i].advance));
    assert.equal(card.querySelectorAll('.pay-val')[2].textContent, money(0));
    assert.equal([...card.querySelectorAll('button')].some(button => button.textContent.includes('✂️')), false);
    assert.match(card.textContent, /একই পেমেন্টের অংশ/);
  }
  assert.match(cards[1].textContent, /একই ডেলিভারি — চার্জ/);
  assert.equal(h.orderWrites().length, 0, 'rendering new allocated payments must not rewrite them');
  h.state.orders['cake-2'].deliveryAmount = h.state.orders['cake-2'].deliveryCharge = 200;
  h.emit();
  assert.doesNotMatch(h.el('card-cake-2').textContent, /একই ডেলিভারি — চার্জ/, 'a later separate delivery charge replaces the shared-trip label');
});

test('a price-only cloud update refreshes the card without updatedAt changing', t => {
  const h = harness(t, order({ cakePrice: 1900, total: 1900, basePrice: 1900 }));
  h.state.orders.test.cakePrice = 2500;
  h.state.orders.test.total = 2500;
  h.state.orders.test.basePrice = 2500;
  h.emit();
  assert.equal(h.card().querySelector('.pay-val').textContent, money(2500));
  assert.equal(h.card().querySelectorAll('.pay-val')[2].textContent, money(100));
});

test('cake-only sales do not lose the delivery charge a second time', t => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`;
  const h = harness(t, order({ date, deliveryAmount: 600, deliveryCharge: 600 }));
  h.w.App.switchTab('revenue');
  assert.equal(h.el('view-revenue').querySelector('.rev-num.blue').textContent, money(2500));
});

test('dashboard Total Expense sums current-month Baking Items prices and refreshes from the notebook', t => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  const h = harness(t, order({ date }));
  h.state.shopNotepad = { pages: { 0: {
    category: 'cake', text: 'Snacks for the shop', items: {
      cream: { name: 'Everwhip whipped cream', quantity: '4 piece', price: 2300, expense: { amount: 2300, date }, checked: false },
      powder: { name: 'Baking powder', quantity: '500 gram', price: 400, expense: { amount: 400, date }, checked: false }
    }
  } } };
  h.listeners.get('shopNotepad/pages')({ val: () => copy(h.state.shopNotepad.pages) });
  h.w.App.switchTab('revenue');
  assert.equal(h.el('view-revenue').querySelector('.rev-grid-finance .rev-num.red').textContent, money(2700));
  assert.match(h.el('view-revenue').textContent, /Baking-item prices/);

  h.state.shopNotepad.pages[0].items.powder.price = 500;
  h.state.shopNotepad.pages[0].items.powder.expense.amount = 500;
  h.listeners.get('shopNotepad/pages')({ val: () => copy(h.state.shopNotepad.pages) });
  assert.equal(h.el('view-revenue').querySelector('.rev-grid-finance .rev-num.red').textContent, money(2800));
});

test('customer total including delivery still opens with the cake-only price', t => {
  const h = harness(t, order({ total: 3100, subtotal: 3100, deliveryAmount: 600, deliveryCharge: 600 }));
  assert.equal(h.card().querySelector('.pay-val').textContent, money(2500));
  assert.doesNotMatch(h.card().textContent, /Stored prices disagree/);
  h.w.App.openModal('test');
  assert.equal(h.el('f-total').value, '2500');
  assert.equal(h.el('f-paid').value, '2400');
});

test('legacy total-only orders and legitimate discounted prices are preserved', t => {
  const h = harness(t, order({ cakePrice: undefined, total: 2500 }));
  assert.equal(h.card().querySelector('.pay-val').textContent, money(2500));
  h.state.orders.test = order({ cakePrice: 2250, total: 2250, originalCakePrice: 2500, reviewDiscount: 250, updatedAt: 2 });
  h.emit();
  assert.equal(h.card().querySelector('.pay-val').textContent, money(2250));
});

test('an explicit zero advance is not replaced with a stale paid alias', t => {
  const h = harness(t, order({ advance: 0, paid: 2400 }));
  assert.equal(h.card().querySelectorAll('.pay-val')[1].textContent, money(0));
  assert.equal(h.card().querySelectorAll('.pay-val')[2].textContent, money(2500));
});

test('a stale edit cannot put 1900 back after another admin saved 2500', async t => {
  const h = harness(t, order({ cakePrice: 1900, total: 1900, basePrice: 1900 }));
  h.w.App.openModal('test');
  h.el('f-notes').value = 'Changed note only';
  h.race(() => { h.state.orders.test = order({ updatedAt: 2 }); });
  await h.save();
  assert.equal(h.state.orders.test.cakePrice, 2500);
  assert.equal(h.state.orders.test.total, 2500);
  assert.equal(h.orderWrites().length, 0);
  assert.equal(h.el('btn-save').disabled, false);
  assert.match(h.el('toast').textContent, /changed.*reopen/i);
});

test('an intentional price correction saves aliases, actual payment and an audit entry', async t => {
  const h = harness(t, order({ cakePrice: 1900, total: 1900, basePrice: 1900 }));
  h.w.App.openModal('test');
  h.el('f-total').value = '2500';
  await h.save();
  const saved = h.state.orders.test;
  for (const field of ['cakePrice', 'total', 'basePrice', 'subtotal']) assert.equal(saved[field], 2500);
  assert.equal(saved.advance, 2400);
  assert.equal(saved.dueAmount, 100);
  assert.deepEqual(saved.adminEditLog.at(-1).changes.cakePrice, { from: '1900', to: '2500' });
});

test('an admin-recorded short payment survives a delivered-order reload', t => {
  const h = harness(t, order({ status: 'delivered', paid: 2400,
    adminEdited: true, adminEditedFields: ['advance', 'paid', 'advanceTotal', 'dueAmount'] }));
  assert.equal(h.state.orders.test.advance, 2400);
  assert.equal(h.orderWrites().length, 0, 'opening admin must not invent the missing payment');
});

test('saving an explicitly corrected delivered order keeps the real short payment', async t => {
  const h = harness(t, order({ status: 'delivered', advance: 2500, advanceTotal: 2500, paid: 2500 }));
  h.w.App.openModal('test');
  h.el('f-paid').value = '2400';
  await h.save();
  assert.equal(h.state.orders.test.advance, 2400);
  assert.equal(h.state.orders.test.dueAmount, 100);
});

test('a newer live snapshot does not turn stale form values into an intentional correction', async t => {
  const h = harness(t, order({ cakePrice: 1900, total: 1900, basePrice: 1900 }));
  h.w.App.openModal('test');
  h.state.orders.test = order({ updatedAt: 2 });
  h.emit();
  h.el('f-notes').value = 'Old form, new note';
  await h.save();
  assert.equal(h.state.orders.test.cakePrice, 2500);
  assert.equal(h.orderWrites().length, 0);
  assert.match(h.el('toast').textContent, /changed.*reopen/i);
});

test('deleted orders are not recreated by an old open form', async t => {
  const h = harness(t, order());
  h.w.App.openModal('test');
  h.race(() => { delete h.state.orders.test; });
  await h.save();
  assert.equal(h.state.orders.test, undefined);
  assert.match(h.el('toast').textContent, /deleted.*reopen/i);
});

test('a delivered cake price correction keeps the existing payment across reloads', async t => {
  const h = harness(t, order({ status: 'delivered', cakePrice: 2400, total: 2400, paid: 2400 }));
  h.w.App.openModal('test');
  h.el('f-total').value = '2500';
  await h.save();
  h.emit();
  assert.equal(h.state.orders.test.cakePrice, 2500);
  assert.equal(h.state.orders.test.advance, 2400);
  assert.equal(h.state.orders.test.dueAmount, 100);
});

test('changing only delivery never changes the cake price', t => {
  const h = harness(t, order({ total: 3100, deliveryAmount: 600, deliveryCharge: 600 }));
  h.state.orders.test.deliveryAmount = h.state.orders.test.deliveryCharge = 500;
  h.emit();
  assert.equal(h.card().querySelector('.pay-val').textContent, money(2500));
  assert.match(h.card().textContent, /Stored prices disagree/);
});

test('a declared zero cake price survives a stale nonzero total', t => {
  const h = harness(t, order({ cakePrice: 0, total: 1900, advance: 0 }));
  assert.equal(h.card().querySelector('.pay-val').textContent, money(0));
  assert.match(h.card().textContent, /Stored prices disagree/);
});

test('customer-entered cake price is displayed without a routine price notice', t => {
  const h = harness(t, order({ cakePrice: 1900, total: 1900, advance: 0 }));
  assert.equal(h.card().querySelector('.pay-val').textContent, money(1900));
  assert.doesNotMatch(h.card().textContent, /Customer-entered price/);
  h.w.App.openModal('test');
  assert.equal(h.el('f-price-note').textContent, '');
  assert.equal(h.el('f-price-note').hidden, true);
});

test('fully-paid action updates the advance used by the card and preserves the cake price', async t => {
  const h = harness(t, order({ total: 3100, deliveryAmount: 600, deliveryCharge: 600 }));
  h.w.App.markFullyPaid('test');
  h.w.App.closeConfirm(true);
  await new Promise(resolve => setImmediate(resolve));
  h.emit();
  assert.equal(h.state.orders.test.cakePrice, 2500);
  assert.equal(h.state.orders.test.advance, 2500);
  assert.equal(h.state.orders.test.dueAmount, 600, 'delivery still outstanding');
  assert.equal(h.card().querySelectorAll('.pay-val')[2].textContent, money(0));
});

test('notes-only save does not log a delivery-inclusive total as a cake price change', async t => {
  const h = harness(t, order({ total: 3100, subtotal: 3100, deliveryAmount: 600, deliveryCharge: 600 }));
  h.w.App.openModal('test');
  h.el('f-notes').value = 'New note';
  await h.save();
  assert.equal(h.state.orders.test.cakePrice, 2500);
  assert.equal(h.state.orders.test.adminEditLog.at(-1).changes.cakePrice, undefined);
});

test('blank or negative cake prices cannot silently become zero on save', async t => {
  const h = harness(t, order());
  h.w.App.openModal('test');
  for (const value of ['', '-1']) {
    h.el('f-total').value = value;
    await h.save();
    assert.equal(h.orderWrites().length, 0);
    assert.equal(h.state.orders.test.cakePrice, 2500);
    assert.match(h.el('toast').textContent, /valid cake price/);
  }
});

test('a valid zero-price order can be edited without re-entering its price', async t => {
  const h = harness(t, order({ cakePrice: 0, total: 0, advance: 0, advanceTotal: 0 }));
  h.w.App.openModal('test');
  assert.equal(h.el('f-total').value, '0');
  h.el('f-notes').value = 'Complimentary cake';
  await h.save();
  assert.equal(h.state.orders.test.cakePrice, 0);
  assert.equal(h.state.orders.test.notes, 'Complimentary cake');
});

test('reconciling conflicting price aliases is audited and does not settle a short payment', async t => {
  const h = harness(t, order({ cakePrice: 2500, total: 1900, status: 'delivered' }));
  h.w.App.openModal('test');
  await h.save();
  h.emit();
  assert.equal(h.state.orders.test.cakePrice, 2500);
  assert.equal(h.state.orders.test.total, 2500);
  assert.equal(h.state.orders.test.advance, 2400);
  assert.equal(h.state.orders.test.dueAmount, 100);
  assert.deepEqual(h.state.orders.test.adminEditLog.at(-1).changes.priceReconciliation, {
    from: 'cakePrice=2500, total=1900', to: 'cakePrice=2500, total=2500'
  });
});

test('past cake-paid orders with unpaid delivery are not auto-settled', t => {
  const h = harness(t, order({ date: '2020-01-01', advance: 2500, advanceTotal: 2500,
    total: 3100, deliveryAmount: 600, deliveryCharge: 600 }));
  assert.equal(h.state.orders.test.status, 'pending');
  assert.equal(h.state.orders.test.deliveryPaid, 'unpaid');
  assert.equal(h.orderWrites().length, 0);
});

test('gateway fees affect payment accounting, not the cake price or sales', t => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`;
  const h = harness(t, order({ date, advance: 2400, paid: 2444, advanceTotal: 2444,
    bkashCharge: 44, paymentCharges: 44, deliveryCharge: 600, deliveryAmount: 600, total: 3100 }));
  assert.equal(h.card().querySelector('.pay-val').textContent, money(2500));
  assert.equal(h.card().querySelectorAll('.pay-val')[2].textContent, money(100));
  h.w.App.switchTab('revenue');
  assert.equal(h.el('view-revenue').querySelector('.rev-num.blue').textContent, money(2500));
});

test('new manual orders still save independent cake price and amount paid', async t => {
  const h = harness(t, order());
  h.w.App.openModal(null);
  h.el('f-name').value = 'New test cake';
  h.el('f-date').value = '2099-10-03';
  h.el('f-no-time').checked = true;
  h.el('f-total').value = '2500';
  h.el('f-paid').value = '2400';
  await h.save();
  assert.equal(h.state.orders.new.cakePrice, 2500);
  assert.equal(h.state.orders.new.advance, 2400);
  assert.equal(h.state.orders.new.dueAmount, 100);
});

test('completed-order database and daily popup display cake-only prices', t => {
  const h = harness(t, order({ total: 3100, deliveryCharge: 600, deliveryAmount: 600,
    status: 'delivered', advance: 2500, deliveryPaid: 'paid' }));
  h.w.App.switchTab('cdb');
  assert.equal(h.el('view-cdb').querySelector('.cdb-price').textContent, money(2500));
  h.state.orders.test = order({ total: 3100, deliveryCharge: 600, deliveryAmount: 600, createdAt: Date.now() });
  h.emit();
  h.w.App.showDailyPopup();
  assert.equal(h.w.document.querySelector('.d-price').textContent, money(2500));
});

test('new-order dismissal is permanent on this device and does not edit the order', t => {
  const h = harness(t, order({ createdAt: 1, status: 'pending' }));
  h.w.App.showDailyPopup();
  assert.equal(h.el('daily-popup-list').querySelectorAll('.daily-item').length, 1);
  h.w.App.dismissDailyOrder('test');
  assert.equal(h.el('daily-popup-list').querySelectorAll('.daily-item').length, 0);
  assert.equal(h.state.orders.test.status, 'pending');
  assert.equal(h.orderWrites().length, 0);
  assert.equal(h.w.localStorage.getItem('nitu_daily_dismissed_test'), '1');
  h.w.App.showDailyPopup();
  assert.match(h.el('daily-popup-list').textContent, /No new orders yet/);
});

test('revenue month selection filters plan cards by delivery month', t => {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-20`;
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 20);
  const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-20`;
  const h = harness(t, null, {
    current: order({ orderId: 'CURRENT', date: thisMonth, deliveryDate: thisMonth, advance: 0, advanceTotal: 0 }),
    previous: order({ orderId: 'PREVIOUS', date: previousMonth, deliveryDate: previousMonth, advance: 0, advanceTotal: 0 })
  });
  h.w.App.switchTab('revenue');
  h.w.App.selectMonth(`${previous.getFullYear()}-${previous.getMonth()}`);
  assert.equal(h.el('view-plan').querySelectorAll('.card').length, 1);
  assert.match(h.el('view-plan').textContent, /PREVIOUS/);
  assert.doesNotMatch(h.el('view-plan').textContent, /CURRENT/);
  h.w.App.clearMonthFilter();
  assert.equal(h.el('view-plan').querySelectorAll('.card').length, 2);
});

test('rendering before dayBooks loads never replaces stored capacity limits', t => {
  const h = harness(t, order());
  h.w.App.openCalendar();
  assert.equal(h.writes.filter(w => w.path === 'dayBooks').length, 0);
});

test('capacity reconciliation preserves limits loaded after orders and changed by another admin', t => {
  const h = harness(t, order());
  h.state.dayBooks = { '2099-10-03': { limit: 4, booked: 0 }, '2099-10-04': { limit: 7, booked: 1 } };
  const staleSnapshot = copy(h.state.dayBooks);
  h.state.dayBooks['2099-10-03'].limit = 9; // concurrent change before stale listener callback
  h.listeners.get('dayBooks')({ val: () => staleSnapshot });
  assert.equal(h.state.dayBooks['2099-10-03'].limit, 9);
  assert.equal(h.state.dayBooks['2099-10-04'].limit, 7);
  assert.equal(h.state.dayBooks['2099-10-03'].booked, 1);
  assert.equal(h.state.dayBooks['2099-10-04'].booked, 0);
});

test('legacy phone-scoped orders preserve contact data during admin edits', async t => {
  const h = harness(t, order({ status: 'delivered', notes: 'Keep this note' }));
  h.w.App.openModal('test');
  await h.save();
  assert.equal(h.state.orders.test.customerPhone, '01712345678');
  assert.equal(h.state.orders.test.notes, 'Keep this note');
  assert.equal(h.state.orders.test.status, 'delivered');
});

test('unrelated edits preserve every separate cake delivery setting', async t => {
  const second = { cakeIndex: 2, weight: '2 pound', flavour: 'chocolate-sponge',
    date: '2099-10-05', deliveryDate: '2099-10-05', address: 'Second address', receiver: 'Second receiver', receiverPhone: '01912345678',
    timeSlot: '5:30 PM', deliveryCharge: 150, sameDateAsCake1: false,
    sameAddressAsCake1: false, sameReceiverAsCake1: false, sameTimeAsCake1: false, sameChargeAsCake1: false };
  const h = harness(t, order({ cakeCount: 2, cakes: [{ cakeIndex: 1 }, second] }));
  h.w.App.openModal('test');
  for (const field of ['date', 'address', 'receiver', 'time', 'charge']) assert.equal(h.el('cb-same-' + field + '-2').checked, false);
  h.el('f-notes').value = 'An unrelated edit';
  await h.save();
  for (const field of ['date', 'address', 'receiver', 'receiverPhone', 'timeSlot', 'deliveryCharge']) assert.equal(h.state.orders.test.cakes[1][field], second[field]);
});

for (const surprise of [true, 'yes', false, 'no']) test(`surprise=${surprise} renders and survives admin edits`, async t => {
  const h = harness(t, order({ surprise }));
  const expected = surprise === true || surprise === 'yes';
  assert.equal(h.card().textContent.includes('সারপ্রাইজ'), expected);
  h.w.App.openModal('test');
  assert.equal(h.el('f-surprise').value, expected ? 'yes' : 'no');
  await h.save();
  assert.equal(h.state.orders.test.surprise, expected);
});

test('SRS copy leaves the delivery charge blank when the agency has not provided it', t => {
  const h = harness(t, order({ advance: 2500, advanceTotal: 2500, deliveryAmount: 0, deliveryCharge: 0, deliveryPaid: 'unpaid' }));
  let copied = '';
  Object.defineProperty(h.w.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: value => { copied = value; return Promise.resolve(); } }
  });
  h.w.App.copySrsMessage('test');
  assert.match(copied, /Delivery Charge -\s*\nPickup Time/);
  assert.doesNotMatch(copied, /Delivery Charge -\s*0\/-/);
});

test('admin exposes the monthly costing tab alongside the existing dashboard', t => {
  const h = harness(t, order());
  h.w.App.switchTab('costing');
  assert.equal(h.el('view-costing').classList.contains('hidden'), false);
  assert.match(h.el('view-costing').textContent, /Costs & Net Income/);
  h.w.App.switchTab('revenue');
  assert.equal(h.el('view-revenue').classList.contains('hidden'), false);
  assert.match(h.el('view-revenue').textContent, /Monthly costing & net income/);
});
