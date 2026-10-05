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
