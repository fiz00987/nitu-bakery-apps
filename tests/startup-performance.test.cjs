const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('customer startup keeps the full splash and avoids a redundant remote background request', () => {
  const html = read('customer-app/index.html');
  const app = read('customer-app/app.js');

  assert.match(app, /setTimeout\(\(\) => splash\.classList\.add\('gone'\), 4500\)/);
  assert.match(html, /<link rel="preload" as="image" href="logo\.png" fetchpriority="high">/);
  assert.doesNotMatch(html, /images\.unsplash\.com/);
});

test('admin startup keeps the full splash and defers non-critical resources', () => {
  const html = read('admin-app/index.html');
  const app = read('admin-app/app.js');

  assert.match(app, /const MIN_MS = 1800/);
  assert.match(app, /const MAX_MS = 3200/);
  assert.match(html, /background-image: url\('bg-1\.jpg'\)/);
  assert.match(html, /<script defer src="https:\/\/www\.gstatic\.com\/firebasejs\/9\.23\.0\/firebase-messaging-compat\.js"><\/script>/);
  assert.doesNotMatch(html, /images\.unsplash\.com/);
});
