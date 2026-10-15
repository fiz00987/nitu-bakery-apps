const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reviewHtml = fs.readFileSync(path.join(root, 'review-app/index.html'), 'utf8');
const adminHtml = fs.readFileSync(path.join(root, 'admin-app/index.html'), 'utf8');

test('review instructions lead with the unlocked-profile warning and screenshot', () => {
  const important = reviewHtml.indexOf('instruction-important');
  const steps = reviewHtml.indexOf('Facebook অ্যাপে নিচের ৩টি ধাপ');
  assert.ok(important >= 0);
  assert.ok(important < steps, 'the warning must come before the numbered steps');
  assert.match(reviewHtml, /locked-profile\.png/);
  assert.match(reviewHtml, /do not count|will not count/i);
});

test('delivery confirmation tab remains hidden while its implementation stays present', () => {
  assert.match(adminHtml, /id="tab-delivery-confirm"[^>]*\bhidden\b/);
  assert.match(adminHtml, /id="view-delivery-confirm"/);
});
