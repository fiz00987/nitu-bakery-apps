const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const copy = value => JSON.parse(JSON.stringify(value));

function multiForm(t, prices = [1000, 2000], options = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'customer-multi/index.html'), 'utf8'), {
    url: 'https://test.invalid/customer-multi/', runScripts: 'outside-only'
  });
  const w = dom.window;
  const state = { orders: {}, offDays: {}, dayBooks: {}, ...options.state };
  const writes = [];
  let nextKey = 0;
  const snapshot = value => ({ val: () => value, exists: () => value != null });
  const valueAt = p => p.split('/').reduce((value, key) => value && value[key], state) ?? null;
  const ref = (p, field, equal) => ({
    key: p.split('/').pop(),
    child: key => ref(p + '/' + key),
    on() {},
    orderByChild: key => ref(p, key),
    equalTo: value => ref(p, field, value),
    once: async () => {
      const value = valueAt(p);
      if (!field) return snapshot(value);
      const selected = Object.fromEntries(Object.entries(value || {}).filter(([, record]) => record[field] === equal));
      return { ...snapshot(selected), forEach: callback => Object.entries(selected).forEach(([key, record]) => callback({ key, val: () => record })) };
    },
    push: value => {
      const key = 'cake-' + (++nextKey);
      if (value === undefined) return { key };
      writes.push({ type: 'push', value: copy(value) });
      state.orders[key] = copy(value);
      return Promise.resolve({ key });
    },
    update: async values => {
      writes.push({ type: 'update', value: copy(values) });
      if (options.rejectWrite) throw new Error('write rejected');
      Object.assign(state.orders, copy(values));
    }
  });
  w.__db = { ref };
  w.fetch = () => Promise.reject(new Error('Network disabled in tests'));
  w.ensureAuthReady = options.auth || (() => Promise.resolve(true));
  w.console.error = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.eval('const db = window.__db;\n'
    + fs.readFileSync(path.join(root, 'customer-multi/utils.js'), 'utf8') + '\n'
    + fs.readFileSync(path.join(root, 'customer-multi/app.js'), 'utf8')
    + "\nwindow.testProof = () => { payShot = 'data:image/png;base64,cHJvb2Y='; payShotVerified = true; payAmountMatch = true; };"
    + "\nwindow.testPhotos = () => { currentPhotos = ['data:image/png;base64,b25l']; extraPhotos[2] = ['data:image/png;base64,dHdv']; };");
  w.fireNtfyAlert = () => {};
  const el = id => w.document.getElementById(id);
  w.setLang('en');
  w.localStorage.setItem('nitu-cust-phone', '01712345678');
  w.proceedToForm('01712345678');
  w.setCakeCount(prices.length);
  el('f-name').value = 'Multi Cake Customer';
  el('f-cake-price').value = prices.reduce((a, b) => a + b, 0);
  prices.forEach((price, index) => {
    const i = index + 1;
    el('f-cake-price-' + i).value = price;
    el('f-weight-' + i).value = i + ' pound';
    el('f-flavour-' + i).value = i % 2 ? 'vanilla-sponge' : 'chocolate-sponge';
    el('f-writing-' + i).value = 'Cake ' + i;
    el('f-photo-note-' + i).value = 'Photo note ' + i;
  });
  el('f-date').value = '2099-10-03';
  el('f-timeslot').value = '3.00';
  el('f-time-ampm').value = 'PM';
  el('f-address').value = 'First address';
  el('f-receiver').value = 'First receiver';
  el('f-receiver-phone').value = '01812345678';
  el('f-delivery-charge').value = '100';
  el('f-terms').checked = true;
  w.testProof();
  w.onCakePriceInput();
  w.chooseAdvanceMethod('bkash');
  w.setAdvanceType('50');
  t.after(() => dom.window.close());
  return { w, el, state, writes, orders: () => Object.values(state.orders) };
}

module.exports = { multiForm };
