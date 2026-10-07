const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
function form(t, app) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, app, 'index.html'), 'utf8'), {
    url: 'https://example.invalid/', runScripts: 'outside-only'
  });
  const w = dom.window;
  w.fetch = () => Promise.reject(new Error('offline preview'));
  w.ensureAuthReady = () => Promise.resolve(true);
  w.eval('const db = { ref: () => ({ on: () => {}, once: () => Promise.resolve({ val: () => null }) }) };\n'
    + fs.readFileSync(path.join(root, app, 'utils.js'), 'utf8') + '\n'
    + fs.readFileSync(path.join(root, app, 'app.js'), 'utf8'));
  t.after(() => dom.window.close());
  return { w, el: id => w.document.getElementById(id) };
}

for (const app of ['customer-app', 'customer-multi']) {
  test(`${app}: English delivery and payment details switch back to Bengali`, t => {
    const { w, el } = form(t, app);
    w.setLang('en');
    assert.match(el('pickup-box').textContent, /Self-pickup address:/);
    assert.match(el('calc-box').textContent, /Delivery:/);
    assert.equal(el('f-address').placeholder, 'Enter the full address');
    el('f-cake-price').value = '1000';
    assert.equal(el('adv-opt-bkash').tagName, 'BUTTON', 'payment method is keyboard-activatable');
    w.chooseAdvanceMethod('bkash');
    w.setAdvanceType('50');
    assert.match(el('payment-info').textContent, /Send Money via bKash/);
    assert.equal(el('f-advance').value, '510');
    assert.equal(el('adv-opt-bkash').getAttribute('aria-pressed'), 'true');
    assert.equal(el('opt-50').getAttribute('aria-pressed'), 'true');
    w.setLang('bn');
    assert.match(el('pickup-box').textContent, /সেলফ পিকআপ ঠিকানা:/);
    assert.match(el('payment-info').textContent, /বিকাশ Send Money করুন/);
    assert.equal(el('opt-50').textContent, '৫০% অগ্রিম');
    assert.equal(el('f-advance').value, '510', 'language change preserves the payment');
    w.chooseAdvanceMethod('bank');
    assert.equal(el('adv-opt-bkash').getAttribute('aria-pressed'), 'false');
    assert.equal(el('adv-opt-bank').getAttribute('aria-pressed'), 'true');
    assert.equal(el('f-advance').value, '500', 'switching method recalculates the gateway charge');
  });
}

test('mini cake disables 50% advance as a native button', t => {
  const { w, el } = form(t, 'customer-app');
  el('f-cake-price').value = '1000';
  w.setCakeKind('mini');
  assert.equal(el('opt-50').tagName, 'BUTTON');
  assert.equal(el('opt-50').disabled, true);
  el('opt-50').click();
  assert.equal(el('opt-50').getAttribute('aria-pressed'), 'false');
});

test('multi-cake weight units and <=300 gram mini rule match the single form', t => {
  const { w, el } = form(t, 'customer-multi');
  w.setLang('en');
  w.setCakeCount(2);
  const weight = el('f-weight-2');
  weight.value = '1';
  w.maybeAskWeightUnit(2);
  assert.match(el('weight-unit-msg').textContent, /POUND.*KG.*GRAM/);
  assert.equal(el('weight-unit-popup').classList.contains('show'), true);

  w.chooseWeightUnit('gram');
  assert.equal(weight.value, '1 gram');
  assert.equal(el('weight-unit-popup').classList.contains('show'), false);
  assert.equal(w.isFullOnlyPayment(), true, 'small gram weights require full payment while the notice is open');
  assert.equal(el('opt-50').disabled, true);

  // The real info file is intentionally offline in this DOM harness, but the
  // OK action is still the same state transition the browser uses.
  w.confirmMiniCake();
  assert.equal(weight.value, 'Mini cake');
  assert.equal(weight.disabled, true);
  assert.equal(el('weight-hint-2').textContent, '');

  const writing = el('f-writing-2');
  writing.value = 'Happy';
  w.updateWritingCount(2);
  assert.match(el('writing-count-2').textContent, /^1 \/ 500$/);

  const weight1 = el('f-weight-1');
  weight1.value = '1 pound';
  assert.equal(w.maybeConvertToMini(1), false, '1 pound remains a normal cake');
  weight1.value = '300 gram';
  assert.equal(w.maybeConvertToMini(1), true, 'the 300 gram boundary becomes a mini cake');
  w.confirmMiniCake();
  assert.equal(weight1.value, 'Mini cake');
});

test('multi-cake form waits for anonymous Firebase sign-in before database use', async t => {
  const dom = new JSDOM('', { url: 'https://example.invalid/', runScripts: 'outside-only' });
  const w = dom.window;
  let onAuthChanged, signIns = 0;
  w.firebase = {
    apps: [], initializeApp() {}, database() { return {}; },
    auth() {
      return {
        currentUser: null,
        onAuthStateChanged(callback) { onAuthChanged = callback; },
        signInAnonymously() { signIns++; return Promise.resolve(); }
      };
    }
  };
  w.eval(fs.readFileSync(path.join(root, 'customer-multi/firebase-config.js'), 'utf8'));
  onAuthChanged(null);
  const ready = w.ensureAuthReady();
  assert.ok(signIns > 0);
  onAuthChanged({ uid: 'customer' });
  assert.equal(await ready, true);
  dom.window.close();
  t.after(() => dom.window.close());
});
