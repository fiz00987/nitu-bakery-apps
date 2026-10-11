const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');

function storefront(t, { saved, language, design } = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'website/index.html'), 'utf8'), {
    url: 'https://nitu-portfolio.web.app/' + (design ? '?design=' + encodeURIComponent(design) : ''),
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  // Dialog focus/top-layer behavior is checked in a real browser separately.
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  if (saved !== undefined) w.localStorage.setItem('nitu-website-designs', JSON.stringify(saved));
  if (language !== undefined) w.localStorage.setItem('nitu-website-language', JSON.stringify(language));
  w.eval(fs.readFileSync(path.join(root, 'website/app.js'), 'utf8'));
  t.after(() => dom.window.close());
  return { w, el: id => w.document.getElementById(id), click: selector => w.document.querySelector(selector).click(), all: selector => [...w.document.querySelectorAll(selector)] };
}

test('the complete storefront menu uses exactly the live ordering app flavour IDs', t => {
  const appFlavours = vm.runInNewContext(fs.readFileSync(path.join(root, 'customer-app/utils.js'), 'utf8') + '; FLAVOURS.map(f => f.value);');
  const s = storefront(t);
  s.el('flavour-more').click();
  assert.deepEqual(s.all('[data-flavour-open]').map(el => el.dataset.flavourOpen).sort(), Array.from(appFlavours).sort());
  s.click('[data-flavour-filter="ganache"]');
  assert.equal(s.all('.flavour-card').length, 3);
  s.click('[data-flavour-open="double-layer-chocolate"]');
  assert.match(s.el('flavour-dialog-minimum').textContent, /৫০০–৬০০/);
  s.el('flavour-dialog').close();
  s.click('[data-flavour-filter="cheese"]');
  s.click('[data-flavour-open="red-velvet"]');
  assert.match(s.el('flavour-dialog-minimum').textContent, /২ পাউন্ড/);
  assert.match(s.el('flavour-dialog-price').textContent, /২২০০/);
});

test('gallery search, favourites and language changes keep the same chosen design', t => {
  const s = storefront(t);
  s.el('gallery-search').value = 'mathematics';
  s.el('gallery-search').dispatchEvent(new s.w.Event('input'));
  assert.equal(s.all('.gallery-card').length, 1);
  s.click('[data-save-id="design-04"]');
  assert.deepEqual(JSON.parse(s.w.localStorage.getItem('nitu-website-designs')), ['design-04']);
  s.el('language-toggle').click();
  assert.equal(s.w.document.documentElement.lang, 'en');
  assert.equal(s.all('.gallery-card').length, 1);
  assert.equal(s.all('[data-save-id="design-04"]')[0].getAttribute('aria-pressed'), 'true');
  s.el('saved-open').click();
  assert.match(s.el('saved-grid').textContent, /mathematics/);
  s.el('saved-dialog').close();
  s.el('gallery-search').value = '<script>bad search</script>';
  s.el('gallery-search').dispatchEvent(new s.w.Event('input'));
  assert.equal(s.all('.gallery-card').length, 0);
  assert.equal(s.el('gallery-grid').querySelector('script'), null);
  s.click('[data-gallery-reset]');
  assert.equal(s.all('.gallery-card').length, 6);
  assert.equal(s.el('gallery-search').value, '');
});

test('saved design deep links open the real reference image and download file', t => {
  const s = storefront(t, { saved: ['blue-poetry', 'invalid-id'], design: 'blue-poetry' });
  assert.equal(s.el('design-dialog').open, true);
  assert.match(s.el('design-dialog-image').src, /assets\/blue-poetry\.webp$/);
  assert.match(s.el('design-download').href, /assets\/blue-poetry\.webp$/);
  assert.match(s.el('design-download').download, /^nitu-portfolio-design-\d+\.webp$/);
  assert.equal(s.el('saved-count').textContent, '১');
  s.el('design-save').click();
  assert.deepEqual(JSON.parse(s.w.localStorage.getItem('nitu-website-designs')), []);
  s.el('design-dialog').close();
  assert.equal(s.w.document.body.classList.contains('modal-open'), false);
});

test('the order chooser connects directly to the single and multiple live forms', t => {
  const s = storefront(t);
  s.click('[data-order-open]');
  assert.equal(s.el('order-dialog').open, true);
  assert.deepEqual(s.all('.order-choice').map(a => a.href), [
    'https://nitusbakingplanv2-customer.web.app/', 'https://nitusbakingplanv2-multi.web.app/'
  ]);
  for (const link of s.all('a[target="_blank"]')) assert.match(link.rel, /noopener/);
  const liveReview = s.all('a').some(a => a.href === 'https://nitu-review.web.app/');
  assert.equal(liveReview, true);
  assert.equal(s.all('a').some(a => a.href === 'https://maps.app.goo.gl/vAk44BoEWRbppBuz8'), true);
});

test('malformed favourites and language data do not prevent storefront startup', t => {
  const s = storefront(t, { saved: { unexpected: 'value' }, language: { unexpected: 'value' }, design: 'unknown-design' });
  assert.equal(s.w.document.documentElement.lang, 'bn');
  assert.equal(s.el('saved-count').hidden, true);
  assert.equal(s.all('.gallery-card').length, 6);
  assert.equal(s.el('design-dialog').open, false);
});
