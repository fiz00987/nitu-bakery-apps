const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

function snapshot(records) {
  return {
    forEach(callback) {
      Object.entries(records || {}).forEach(([key, value]) => callback({ key, val: () => value }));
    }
  };
}

function reviewApp(t, state) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'review-app/index.html'), 'utf8'), {
    url: 'https://nitu-review.web.app/',
    runScripts: 'outside-only'
  });
  const w = dom.window;
  const db = {
    ref(pathName) {
      let field = null;
      let equal = null;
      const chain = {
        orderByChild(nextField) { field = nextField; return chain; },
        equalTo(nextEqual) { equal = nextEqual; return chain; },
        once: async () => {
          const source = state[pathName] || {};
          const records = Object.fromEntries(Object.entries(source).filter(([, value]) => !field || value[field] === equal));
          return snapshot(records);
        }
      };
      return chain;
    }
  };
  w.__db = db;
  w.authReady = Promise.resolve(true);
  w.console.error = () => {};
  w.eval('const db = window.__db; const authReady = window.authReady;\n' +
    fs.readFileSync(path.join(root, 'review-app/app.js'), 'utf8'));
  t.after(() => dom.window.close());
  return { w, el: id => w.document.getElementById(id) };
}

test('review lookup only shows delivered orders and keeps exact order records distinct', async t => {
  const h = reviewApp(t, {
    orders: {
      deliveredOne: {
        orderId: 'NB-42', phoneKey: '01712345678', customerPhone: '01712345678',
        customerName: '<img src=x onerror=alert(1)>', status: 'delivered'
      },
      deliveredTwo: {
        orderId: 'NB-42', phoneKey: '01712345678', customerPhone: '01712345678',
        customerName: 'Second customer', status: 'completed'
      },
      notDelivered: {
        orderId: 'NB-43', phoneKey: '01712345678', customerPhone: '01712345678',
        customerName: 'Not ready', status: 'out for delivery'
      }
    },
    reviewClaims: {
      existing: { orderKey: 'deliveredOne', orderId: 'NB-42', phoneKey: '01712345678', status: 'rejected', reviewText: 'old claim' }
    }
  });

  h.el('phone').value = '01712345678';
  await h.w.find();

  const shown = [...h.el('orders').querySelectorAll('.order')];
  assert.equal(shown.length, 1, 'the exact claimed record is hidden, but the duplicate display ID remains independently selectable');
  assert.equal(shown[0].textContent, 'NB-42Second customer');
  assert.equal(shown[0].querySelector('img'), null, 'customer text is escaped before insertion');
  assert.equal(h.el('workspace').classList.contains('hidden'), false);
});

test('review lookup accepts international phone input while querying canonical storage', async t => {
  const h = reviewApp(t, {
    orders: {
      order: { orderId: 'NB-1', phoneKey: '01712345678', customerPhone: '01712345678', status: 'done', customerName: 'Customer' }
    },
    reviewClaims: {}
  });
  h.el('phone').value = '+8801712345678';
  await h.w.find();
  assert.equal(h.el('orders').querySelectorAll('.order').length, 1);
});
