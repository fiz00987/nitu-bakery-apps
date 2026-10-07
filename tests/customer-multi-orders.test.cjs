const test = require('node:test');
const assert = require('node:assert/strict');
const { multiForm } = require('./customer-multi-harness.cjs');

const sum = (records, field) => records.reduce((total, record) => total + record[field], 0);

test('multi-cake checkout immediately saves separate orders with each cake’s delivery and payment', async t => {
  const h = multiForm(t);
  for (const kind of ['address', 'receiver', 'phone', 'date', 'time', 'charge']) h.el('same-' + kind + '-check').checked = false;
  h.el('f-address-2').value = 'Second address';
  h.el('f-receiver-2').value = 'Second receiver';
  h.el('f-receiver-phone-2').value = '01912345678';
  h.el('f-date-2').value = '2099-10-05';
  h.el('f-timeslot-2').value = '5.30';
  h.el('f-time-ampm-2').value = 'PM';
  h.el('f-delivery-charge-2').value = '150';
  h.w.testPhotos();
  const sent = Number(h.el('f-advance').value);
  const group = h.el('form-order-id').textContent;
  await h.w.submitOrder();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].type, 'update', 'save the whole group atomically');
  const [first, second] = h.orders();
  assert.equal(h.orders().length, 2);
  assert.equal(first.orderId, group + '-1');
  assert.equal(second.orderId, group + '-2');
  assert.equal(first.splitGroupId, group);
  assert.equal(second.splitOf, '2/2');
  for (const record of h.orders()) {
    assert.equal(record.cakeCount, 1);
    assert.equal(record.cakes, undefined);
    assert.equal(record.status, 'pending');
    assert.equal(record.paid, undefined, 'customer writes satisfy the no-paid database rule');
    assert.equal(record.total, record.cakePrice);
    assert.equal(record.payShot, 'data:image/png;base64,cHJvb2Y=');
  }
  assert.equal(first.cakePrice, 1000);
  assert.equal(second.cakePrice, 2000);
  assert.equal(first.advance, 500);
  assert.equal(second.advance, 1000);
  assert.equal(second.date, '2099-10-05');
  assert.equal(second.timeSlotLabel, '5:30 PM');
  assert.equal(second.receiver, 'Second receiver');
  assert.equal(second.receiverPhone, '01912345678');
  assert.equal(second.address, 'Second address');
  assert.equal(second.writing, 'Cake 2');
  assert.equal(second.photoNote, 'Photo note 2');
  assert.equal(second.photo, 'data:image/png;base64,dHdv');
  assert.equal(sum(h.orders(), 'cakePrice'), 3000);
  assert.equal(sum(h.orders(), 'advanceTotal'), sent);
  assert.equal(sum(h.orders(), 'paymentCharges'), sent - 1500);
  assert.equal(sum(h.orders(), 'deliveryCharge'), 250);
  assert.equal(sum(h.orders(), 'dueAmount'), 1750);
  assert.match(h.el('order-summary').textContent, new RegExp(second.orderId));
  // The legacy tracker is still callable even though the current entry screen
  // uses phone history. Exercise its order-ID lookup with its original field.
  const trackInput = h.w.document.createElement('input');
  trackInput.id = 'entry-order-id';
  trackInput.value = group;
  h.w.document.body.appendChild(trackInput);
  await h.w.trackOrder();
  assert.equal(h.el('prev-list').querySelectorAll('.previous-order').length, 2, 'the original group ID still tracks both cakes');
  await h.w.showPreviousOrders();
  assert.match(h.el('previous-order-position').textContent, /1 of 2/);
  assert.match(h.el('previous-orders-content').textContent, /2000/);
});

test('five cakes preserve rounded shared payment totals and charge for one trip only once', async t => {
  const h = multiForm(t, [301, 503, 707, 911, 1103]);
  const sent = Number(h.el('f-advance').value);
  await h.w.submitOrder();
  const records = h.orders();
  assert.equal(records.length, 5);
  assert.equal(sum(records, 'cakePrice'), 3525);
  assert.equal(sum(records, 'advance'), 1763);
  assert.equal(sum(records, 'advanceTotal'), sent);
  assert.equal(sum(records, 'deliveryCharge'), 100);
  records.slice(1).forEach(record => {
    assert.equal(record.deliveryChargeSharedWith, records[0].orderId);
    assert.equal(record.deliveryCharge, 0);
    assert.equal(record.date, records[0].date);
    assert.equal(record.address, records[0].address);
  });
});

test('a mini cake keeps all cake payments full and pays delivery without inflating cake advances', async t => {
  const h = multiForm(t, [500, 2000]);
  h.w.setCakeKind(1, 'mini');
  const sent = Number(h.el('f-advance').value);
  await h.w.submitOrder();
  const records = h.orders();
  assert.equal(records.length, 2);
  assert.equal(records[0].weightLabel, 'Mini cake');
  assert.equal(sum(records, 'advance'), 2500);
  assert.equal(sum(records, 'deliveryAdvance'), 100);
  assert.equal(sum(records, 'advanceTotal'), sent);
  assert.equal(sum(records, 'dueAmount'), 0);
  assert.equal(records[0].deliveryPaid, 'paid');
  assert.equal(records[1].deliveryPaid, 'paid');
});

test('single-cake pickup stays one unsuffixed order', async t => {
  const h = multiForm(t, [1500]);
  h.el('f-fulfilment').value = 'pickup';
  h.w.onFulfilmentChange();
  h.w.chooseAdvanceMethod('bank');
  h.w.setAdvanceType('full');
  const id = h.el('form-order-id').textContent;
  await h.w.submitOrder();
  assert.equal(h.writes[0].type, 'push');
  const [record] = h.orders();
  assert.equal(h.orders().length, 1);
  assert.equal(record.orderId, id);
  assert.equal(record.splitGroupId, undefined);
  assert.equal(record.advance, 1500);
  assert.equal(record.deliveryPaid, 'na');
  assert.equal(record.deliveryCharge, 0);
  assert.equal(record.dueAmount, 0);
});

test('custom shared payment keeps every taka without duplicating the gateway fee', async t => {
  const h = multiForm(t);
  h.el('f-advance').value = '1001';
  h.w.recalcPrice(true);
  await h.w.submitOrder();
  const records = h.orders();
  assert.equal(records.length, 2);
  assert.equal(sum(records, 'advanceTotal'), 1001);
  assert.equal(sum(records, 'advance') + sum(records, 'paymentCharges'), 1001);
  assert.equal(sum(records, 'deliveryAdvance'), 0);
  assert.equal(sum(records, 'dueAmount'), 3100 - sum(records, 'advance'));
  assert.ok(records.every(record => record.advanceAutoTotal != null));
});

test('editing a mini-cake payment below the full amount cannot create paid orders', async t => {
  const h = multiForm(t, [500, 2000]);
  h.w.setCakeKind(1, 'mini');
  h.el('f-advance').value = '1000';
  h.w.recalcPrice(true);
  await h.w.submitOrder();
  assert.equal(h.writes.length, 0);
  assert.match(h.el('toast').textContent, /full payment/);
});

test('per-cake prices survive language changes and a missing price stops submission', async t => {
  const h = multiForm(t, [1000, 0]);
  h.w.setLang('bn');
  h.w.setLang('en');
  assert.equal(h.el('f-cake-price-1').value, '1000');
  assert.equal(h.el('f-cake-price').readOnly, true);
  assert.equal(h.el('cake-columns-container').querySelectorAll('.cake-col').length, 2);
  await h.w.submitOrder();
  assert.equal(h.writes.length, 0);
  assert.match(h.el('toast').textContent, /agreed price/);
  h.el('f-cake-price-2').value = '2000';
  h.w.onCakePriceInput();
  assert.equal(h.el('f-cake-price').value, '3000');
  h.w.setCakeCount(1);
  assert.equal(h.el('f-cake-price').value, '1000');
  assert.equal(h.el('f-cake-price').readOnly, false);
});

test('a rejected batch leaves no partial order and the form can be retried', async t => {
  const h = multiForm(t, [1000, 2000], { rejectWrite: true });
  await h.w.submitOrder();
  assert.equal(h.writes.length, 1);
  assert.equal(h.orders().length, 0);
  assert.equal(h.el('success-screen').classList.contains('active'), false);
  assert.equal(h.el('loading').classList.contains('show'), false);
  await h.w.submitOrder();
  assert.equal(h.writes.length, 2, 'failure releases the submit lock');
});

test('rapid repeat submissions create only one batch while authentication is pending', async t => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const h = multiForm(t, [1000, 2000], { auth: () => ready });
  const first = h.w.submitOrder();
  const second = h.w.submitOrder();
  release(true);
  await Promise.all([first, second]);
  assert.equal(h.writes.length, 1);
  assert.equal(h.orders().length, 2);
});

test('daily capacity checks count every separate cake on its delivery date', async t => {
  const h = multiForm(t, [1000, 2000, 3000], {
    state: { dayBooks: { '2099-10-03': { limit: 4, booked: 2 } } }
  });
  await h.w.submitOrder();
  assert.equal(h.writes.length, 0, 'three cakes cannot use two remaining slots');
  h.state.dayBooks['2099-10-03'].limit = 5;
  await h.w.submitOrder();
  assert.equal(h.orders().length, 3);
});
