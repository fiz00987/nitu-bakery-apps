
'use strict';

let lang = localStorage.getItem('nitu-cust-lang') || 'bn';
let currentPhotos = [];
let advanceType = '';
let isSurprise = false;
let currentSecurityQ = null;
let pendingPhone = '';
// ─── Captcha state (customer app entry) ──────────────────────
let captchaPassed = false;
let currentCaptcha = null;
// ─── OTP login state (customer app only) ─────────────────────────
// Data stays keyed by phone number: customers/<phone> holds profile +
// points-ready fields; orders keep customerPhone as today. When Firebase
// Phone Auth is enabled (needs Blaze for real SMS), the verified E.164
// number (+880...) maps to the same phone key, so nothing migrates.
let otpMode = 'security'; // 'security' (active today) | 'otp' (after Blaze)
let otpConfirmation = null;
let otpRecaptcha = null;
let otpCooldownUntil = 0;
let otpTimerTick = null;
function phoneKeyOf(phone) { return String(phone || '').replace(/[\s\-]/g, ''); }
function toE164BD(phone) {
  const d = phoneKeyOf(phone);
  if (/^01[3-9]\d{8}$/.test(d)) return '+880' + d.slice(1);
  if (/^\+8801[3-9]\d{8}$/.test(String(phone || '').trim())) return String(phone).trim();
  return null;
}
let currentOrderId = '';
let previousOrderHistory = [];
let previousOrderCursor = 0;
let cakeWritingNoticeShown = false;
let advanceMethod = ''; // gateway used to send the advance: bkash | nagad | bank
let downloadPressed = false;
let autoCloseTimer = null;
let autoCloseTick = null;
let flavourNoticeShown = false; // "select the exact flavour" notice — once per session

// ─── Client photo backgrounds (random per app open) ──────────
// Three positions get their own random pick: splash, order form and the
// post-submission order card the client screenshots.
(function initClientPhotos() {
  const CLIENT_BGS = ['./client-bg-1.jpg', './client-bg-2.jpg', './client-bg-3.jpg', './client-bg-4.jpg', './client-bg-5.jpg', './client-bg-6.jpg'];
  const pick = () => CLIENT_BGS[Math.floor(Math.random() * CLIENT_BGS.length)];
  try {
    // 1 · Loading screen (under the logo/chip — CSS keeps content above)
    const sb = document.getElementById('splash-bg');
    if (sb) sb.style.backgroundImage = `url('${pick()}')`;
    // 2 · Order form page background (light veil stays from the base CSS)
    const fb = pick();
    document.body.style.backgroundImage =
      `linear-gradient(rgba(247,244,246,.88),rgba(247,244,246,.93)), url('${fb}')`;
    // 3 · Order card background (photo behind the strong logo + order info)
    const oc = document.getElementById('opc-photo');
    if (oc) oc.style.backgroundImage = `url('${pick()}')`;
  } catch (e) {}
})();

// ─── Splash screen (~2.5s welcome, then fade to the entry screen) ──
(function initSplash() {
  const splash = document.getElementById('splash-screen');
  if (!splash) return;
  // Sprinkles + orbit dots
  const fx = document.getElementById('splash-fx');
  if (fx) {
    const cols = ['#e09642', '#2f8f77', '#d6783c', '#c9a227'];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.className = 'splash-spr';
      // Random drift + spin + size per sprinkle — no two fall the same way
      const dx = (a, b) => Math.round(a + Math.random() * (b - a));
      const r = Math.random();
      s.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 4]};` +
        `--dx1:${dx(-80, 80)}px;--dx2:${dx(-80, 80)}px;--dx3:${dx(-40, 40)}px;--op:${(.4 + Math.random() * .5).toFixed(2)};` +
        `width:${(2 + r * 2.5).toFixed(1)}px;height:${(7 + r * 8).toFixed(0)}px;` +
        `animation-duration:${(6 + Math.random() * 8).toFixed(1)}s;animation-delay:${(-Math.random() * 12).toFixed(1)}s` +
        ``;
      fx.appendChild(s);
    }
    const orbit = document.createElement('div');
    orbit.className = 'splash-orbit';
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('i');
      d.style.cssText = `background:${cols[i % 4]};transform:rotate(${i * 45}deg) translateX(${150}px)`;
      orbit.appendChild(d);
    }
    fx.appendChild(orbit);
  }
  // Entry screen gets the same drifting blobs + sprinkles
  const efx = document.getElementById('entry-bgfx');
  if (efx) {
    const cols = ['#e09642', '#2f8f77', '#d6783c', '#c9a227'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      s.className = 'splash-spr';
      // Random drift + spin + size per sprinkle — no two fall the same way
      const dx = (a, b) => Math.round(a + Math.random() * (b - a));
      const r = Math.random();
      s.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 4]};` +
        `--dx1:${dx(-80, 80)}px;--dx2:${dx(-80, 80)}px;--dx3:${dx(-40, 40)}px;--op:${(.3 + Math.random() * .4).toFixed(2)};` +
        `width:${(2 + r * 2.5).toFixed(1)}px;height:${(7 + r * 8).toFixed(0)}px;` +
        `animation-duration:${(7 + Math.random() * 8).toFixed(1)}s;animation-delay:${(-Math.random() * 12).toFixed(1)}s`;
      efx.appendChild(s);
    }
  }
  // Fade out after ~4.5s so the welcome animation plays fully and lingers
  if (!splash.classList.contains('gone')) {
    setTimeout(() => splash.classList.add('gone'), 4500);
  }
})();

// Populate dropdowns from utils.js
function populateDropdowns() {
  const fl = document.getElementById('f-flavour');
  FLAVOURS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.value;
    opt.textContent = lang === 'en' ? f.labelEn : f.label;
    fl.appendChild(opt);
  });

  const pm = document.getElementById('f-payment-method');
  PAYMENT_METHODS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = lang === 'en' ? p.nameEn : p.name;
    pm.appendChild(opt);
  });
}

// Language
function setLang(l) {
  lang = l;
  localStorage.setItem('nitu-cust-lang', l);
  document.getElementById('lang-bn').classList.toggle('active', l === 'bn');
  document.getElementById('lang-en').classList.toggle('active', l === 'en');
  document.documentElement.lang = l;
  document.querySelectorAll('[data-bn][data-en]').forEach(el => {
    el.textContent = l === 'en' ? el.dataset.en : el.dataset.bn;
  });
  const labels = l === 'en' ? {
    '#entry-phone': 'Phone Number *', '#f-weight': 'Weight *',
    '#f-flavour': 'Flavour *', '#f-address': 'Delivery Address *', '#f-date': 'Delivery Date *',
    '#f-timeslot': 'Delivery Time *', '#f-receiver': 'Receiver Name *', '#f-receiver-phone': 'Receiver Phone *',
    '#f-fulfilment': 'Fulfilment *', '#f-surprise': 'Surprise Cake?', '#f-payment-method': 'Payment Method *',
    '#f-writing': 'Cake writing text (Optional)',
    '#f-notes': 'Additional Info (Optional)'
  } : {};
  Object.entries(labels).forEach(([selector, text]) => {
    const field = document.querySelector(selector);
    if (field && field.parentElement) field.parentElement.querySelector('label').textContent = text;
  });
  if (l === 'en') {
    document.getElementById('f-cake-price').placeholder = 'Enter cake price';
    document.getElementById('f-weight').placeholder = 'Example: 2 pound, 2.5 pound, 1 KG';
    document.getElementById('f-timeslot').placeholder = 'Example: 3.00';
    document.getElementById('f-writing').placeholder = 'Example: Your smile is our home\'s light';
    document.querySelector('#f-flavour option[value=""]').textContent = 'Select flavour';
    document.querySelector('#f-payment-method option[value=""]').textContent = 'Select payment method';
    document.querySelector('#f-fulfilment option[value="delivery"]').textContent = 'Delivery';
    document.querySelector('#f-fulfilment option[value="pickup"]').textContent = 'Self pickup';
  document.querySelector('#f-surprise option[value="no"]').textContent = 'No';
    document.querySelector('#f-surprise option[value="yes"]').textContent = 'Yes - surprise';
    FLAVOURS.forEach(f => { const option = document.querySelector(`#f-flavour option[value="${f.value}"]`); if (option) option.textContent = f.labelEn; });
    PAYMENT_METHODS.forEach(p => { const option = document.querySelector(`#f-payment-method option[value="${p.id}"]`); if (option) option.textContent = p.nameEn; });
  } else {
    document.getElementById('f-cake-price').placeholder = 'কেকের মূল্য লিখুন';
    document.getElementById('f-weight').placeholder = 'যেমন: 2 pound, 2.5 pound, 1 KG';
    document.getElementById('f-timeslot').placeholder = 'যেমন: 3.00';
    document.getElementById('f-writing').placeholder = 'যেমন: তোমার হাসিই আমাদের ঘরের আলো';
    FLAVOURS.forEach(f => { const option = document.querySelector(`#f-flavour option[value="${f.value}"]`); if (option) option.textContent = f.label; });
    PAYMENT_METHODS.forEach(p => { const option = document.querySelector(`#f-payment-method option[value="${p.id}"]`); if (option) option.textContent = p.name; });
  }
}

function t(key) { return lang === 'en' ? (translationsEn[key] || key) : (translations[key] || key); }

// ─── Admin quote redemption (?quote=TOKEN) — single-cake form ─────
// The admin app creates quotes/<TOKEN>; the cake spec + money fields are
// taken from the quote node at submit time (tamper-proof). Name & phone
// stay editable; the link token is the customer's only "login".
let quoteToken = '';
let quoteData = null;

function quoteTotalOf(q) {
  if (q.cakePrice != null) return Number(q.cakePrice) || 0;
  if (q.total != null) return Number(q.total) || 0;
  return Number(q.cakeTotal) || 0;
}
function quoteBannerEl() { return document.getElementById('quote-banner'); }
function showQuoteBanner(html, ok) {
  const b = quoteBannerEl();
  if (!b) return;
  b.innerHTML = html;
  b.className = 'quote-banner show ' + (ok ? 'ok' : 'err');
}
function lockEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled = true;
  el.classList.add('locked-field');
}
function applyQuoteLockVisual() {
  if (!quoteData) return;
  lockEl('f-weight');
  lockEl('f-flavour');
  lockEl('f-cake-price');
  lockEl('f-delivery-charge');
  lockEl('f-fulfilment');
}
function applyQuoteToForm() {
  const q = quoteData;
  const qc = (Array.isArray(q.cakes) ? q.cakes : [])[0] || {};
  const wEl = document.getElementById('f-weight');
  if (wEl) wEl.value = String(qc.weightLabel || qc.weight || '').trim();
  const sel = document.getElementById('f-flavour');
  if (sel) {
    const fv = String(qc.flavour || '').trim();
    const fn = String(qc.flavourName || '').trim();
    const opts = Array.prototype.slice.call(sel.options || []);
    const hit = opts.find(o => o.value === fv) ||
      opts.find(o => (o.textContent || '').trim() === (fn || fv));
    sel.value = hit ? hit.value : '';
  }
  const wr = document.getElementById('f-writing');
  if (wr && (qc.writing || qc.cakeWriting)) wr.value = qc.writing || qc.cakeWriting;
  const cp = document.getElementById('f-cake-price');
  if (cp) cp.value = quoteTotalOf(q);
  const ful = document.getElementById('f-fulfilment');
  if (ful) { ful.value = q.fulfilment || 'delivery'; if (typeof onFulfilmentChange === 'function') onFulfilmentChange(); }
  const dc = document.getElementById('f-delivery-charge');
  if (dc) dc.value = (q.fulfilment === 'pickup') ? '' : (Number(q.deliveryCharge) || 0);
  // Name & phone pre-filled from the quote but fully editable
  const nm = document.getElementById('f-name');
  if (nm && q.customer && !nm.value) nm.value = q.customer;
  if (q.customerPhone) document.getElementById('entry-phone').value = q.customerPhone;
  applyQuoteLockVisual();
  const parts = ((String(qc.weightLabel || qc.weight || '').trim() + ' ' + (qc.flavourName || qc.flavour || '')).trim()) || 'কেক';
  const del = q.fulfilment === 'pickup' ? 0 : (Number(q.deliveryCharge) || 0);
  showQuoteBanner('🔒 এডমিনের দেওয়া কোটেশন: ' + esc(parts) +
    ' — মোট ৳' + (quoteTotalOf(q) + del) +
    (del ? ' (ডেলিভারি চার্জ ৳' + del + ' সহ)' : ''), true);
}
async function bootQuote() {
  let token = '';
  try { token = (new URLSearchParams(location.search).get('quote') || '').trim(); } catch (e) { token = ''; }
  if (!token) return;
  quoteToken = token;
  let q = null;
  try { const snap = await db.ref('quotes/' + token).once('value'); q = snap ? snap.val() : null; }
  catch (e) { q = null; }
  if (!q || (q.status && q.status !== 'open') || (q.expiresAt && Date.now() > q.expiresAt)) {
    showQuoteBanner('❌ লিংকটি মেয়াদোত্তীর্ণ বা ভুল — সাধারণ ফর্মে অর্ডার করুন।', false);
    showToast('লিংকটি মেয়াদোত্তীর্ণ বা ভুল');
    quoteToken = '';
    quoteData = null;
    return;
  }
  quoteData = q;
  applyQuoteToForm();
}
async function validateQuoteLock() {
  if (!quoteToken || !quoteData) return { ok: true };
  let fresh = null;
  try { const snap = await db.ref('quotes/' + quoteToken).once('value'); fresh = snap ? snap.val() : null; }
  catch (e) { fresh = null; }
  if (!fresh || (fresh.status && fresh.status !== 'open') || (fresh.expiresAt && Date.now() > fresh.expiresAt)) {
    return { ok: false, msg: '❌ কোটেশনটি আর কার্যকর নেই (ইতিমধ্যে ব্যবহৃত বা মেয়াদ শেষ)' };
  }
  const qc = (Array.isArray(fresh.cakes) ? fresh.cakes : [])[0] || {};
  const expW = String(qc.weightLabel || qc.weight || '').trim().toLowerCase();
  const gotW = String(document.getElementById('f-weight').value || '').trim().toLowerCase();
  if (expW && gotW !== expW) return { ok: false, msg: '❌ ওজন মিলছে না (কোটেশন: ' + (qc.weightLabel || qc.weight) + ')' };
  const expF = String(qc.flavour || '').trim();
  const fEl = document.getElementById('f-flavour');
  const gotF = fEl ? String(fEl.value).trim() : '';
  const gotFTxt = (fEl && fEl.selectedIndex >= 0) ? String(fEl.options[fEl.selectedIndex].textContent || '').trim() : '';
  if (expF && gotF !== expF && gotFTxt !== expF) return { ok: false, msg: '❌ ফ্লেভার মিলছে না' };
  const expTotal = quoteTotalOf(fresh);
  const gotTotal = parseFloat(document.getElementById('f-cake-price').value) || 0;
  if (expTotal !== gotTotal) return { ok: false, msg: '❌ কেকের মূল্য মিলছে না (কোটেশন: ৳' + expTotal + ')' };
  if ((fresh.fulfilment || 'delivery') !== 'pickup') {
    const expDel = Number(fresh.deliveryCharge) || 0;
    const gotDel = parseFloat(document.getElementById('f-delivery-charge').value) || 0;
    if (expDel !== gotDel) return { ok: false, msg: '❌ ডেলিভারি চার্জ মিলছে না (কোটেশন: ৳' + expDel + ')' };
  }
  return { ok: true };
}

// ─── Customer profile keyed by PHONE (points-ready) ────────────
// customers/<01XXXXXXXXX> = { phone, name, lastLoginAt, createdAt,
//   pointsBalance, totalEarned, totalRedeemed }. Orders are NOT moved:
// they keep customerPhone and are queried the same way as today.
async function upsertCustomerProfile(phone) {
  const key = phoneKeyOf(phone);
  if (!key) return;
  try {
    const ref = db.ref('customers/' + key);
    const snap = await ref.once('value');
    const now = Date.now();
    if (snap.exists()) {
      const cur = snap.val() || {};
      const patch = { phone: key, lastLoginAt: now };
      if (!cur.createdAt) patch.createdAt = now;
      if (cur.pointsBalance == null) patch.pointsBalance = 0;
      if (cur.totalEarned == null) patch.totalEarned = 0;
      if (cur.totalRedeemed == null) patch.totalRedeemed = 0;
      await ref.update(patch);
    } else {
      await ref.set({
        phone: key, name: (localStorage.getItem('nitu-cust-name') || ''),
        createdAt: now, lastLoginAt: now,
        pointsBalance: 0, totalEarned: 0, totalRedeemed: 0
      });
    }
  } catch (e) { console.error('customer profile upsert failed', e); }
}

// ─── OTP via Firebase Phone Auth (needs Blaze for real SMS) ───
// Console checklist: Blaze billing → Auth → enable Phone provider →
// authorized domain nitusbakingplanv2-customer.web.app → optional test
// numbers. Then call enableOtpLogin() and entry switches to OTP.
function enableOtpLogin() {
  otpMode = 'otp';
  currentSecurityQ = null;
  document.getElementById('security-box').classList.remove('show');
  const btn = document.getElementById('entry-btn');
  btn.textContent = lang === 'en' ? '📱 Send OTP' : '📱 OTP পাঠান';
  btn.onclick = sendOtp;
}
function otpErrorText(code) {
  const en = lang === 'en';
  if (code === 'auth/quota-exceeded') return en ? 'SMS limit reached — try again later.' : 'SMS সীমা শেষ — পরে আবার চেষ্টা করুন।';
  if (code === 'auth/too-many-requests') return en ? 'Too many tries — wait 1 hour.' : 'অনেকবার চেষ্টা হয়েছে — ১ ঘণ্টা পর চেষ্টা করুন।';
  if (code === 'auth/invalid-verification-code' || code === 'auth/code-expired') return en ? 'Wrong or expired code — resend it.' : 'ভুল বা মেয়াদোত্তীর্ণ কোড — আবার পাঠান।';
  if (code === 'auth/billing-not-enabled' || code === 'auth/operation-not-allowed') return en ? 'OTP is not enabled yet (needs Blaze + Phone provider).' : 'OTP এখনো চালু হয়নি (Blaze + Phone provider লাগবে)।';
  return en ? 'Could not send OTP. Check internet and try again.' : 'OTP পাঠানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।';
}
function startOtpCooldown(sec) {
  otpCooldownUntil = Date.now() + sec * 1000;
  const resend = document.getElementById('otp-resend');
  const timer = document.getElementById('otp-timer');
  if (otpTimerTick) clearInterval(otpTimerTick);
  const paint = () => {
    const left = Math.max(0, Math.ceil((otpCooldownUntil - Date.now()) / 1000));
    if (resend) resend.disabled = left > 0;
    if (timer) timer.textContent = left > 0 ? (lang === 'en' ? ('Resend code in ' + left + 's') : (left + ' সেকেন্ড পর আবার পাঠান')) : '';
    if (left <= 0 && otpTimerTick) { clearInterval(otpTimerTick); otpTimerTick = null; }
  };
  paint();
  otpTimerTick = setInterval(paint, 1000);
}

// ─── Visual captcha: emoji picker only (varied targets, not just cake) ──
// Customer taps the picture we ask for. Targets + distractors rotate, and the
// tile order shuffles every render — no "bot prevention" wording is shown.
const CAP_EMOJI_SETS = [
  { target: '🎂', label: 'কেক',      wrong: ['🍕','🚗','🌸','⚽'] },
  { target: '🌸', label: 'ফুল',      wrong: ['🎂','🚗','📱','⚽'] },
  { target: '☕', label: 'চা/কফি',   wrong: ['🎂','🌸','📱','🧸'] },
  { target: '🍎', label: 'আপেল',     wrong: ['🎂','🚗','🌸','🎧'] },
  { target: '🐱', label: 'বিড়াল',   wrong: ['🎂','📱','🌸','⚽'] },
  { target: '🌙', label: 'চাঁদ',     wrong: ['🎂','🚗','☕','🎧'] },
  { target: '🎈', label: 'বেলুন',    wrong: ['🎂','📱','🌸','🧸'] },
  { target: '📱', label: 'মোবাইল',   wrong: ['🎂','🚗','🌸','⚽'] }
];

function renderCaptcha() {
  const wrap = document.getElementById('captcha-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const set = CAP_EMOJI_SETS[Math.floor(Math.random() * CAP_EMOJI_SETS.length)];
  const wrong = set.wrong.slice().sort(() => Math.random() - 0.5);
  const tiles = [set.target, ...wrong.slice(0, 3)].sort(() => Math.random() - 0.5);
  currentCaptcha = { kind: 'emoji', target: set.target, label: set.label };
  wrap.innerHTML = `<div style="text-align:center;font-size:13px;color:var(--text2);margin-bottom:8px">👉 <strong>${set.label}</strong> ছবিটা চাপুন</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${tiles.map((t, i) =>
      `<button type="button" class="cap-emoji" data-v="${t}" onclick="checkEmojiCaptcha(this)" style="font-size:26px;padding:12px 4px;border:2px solid var(--border);border-radius:12px;background:var(--surface);cursor:pointer">${t}</button>`
    ).join('')}</div>
    <div class="cap-feedback" id="cap-feedback"></div>`;
}

function checkEmojiCaptcha(btn) {
  const fb = document.getElementById('cap-feedback');
  if (btn.dataset.v === currentCaptcha.target) {
    if (fb) { fb.style.color = 'var(--green)'; fb.textContent = '✅ ঠিক আছে!'; }
    captchaPassed = true;
    setTimeout(proceedAfterCaptcha, 350);
  } else {
    if (fb) { fb.style.color = 'var(--red)'; fb.textContent = '❌ ভুল হয়েছে — আবার চেষ্টা করুন'; }
    setTimeout(renderCaptcha, 500);   // new puzzle, harder to script
  }
}

// Entry handler
async function handleEntry() {
  const phone = document.getElementById('entry-phone').value.trim();
  const err = document.getElementById('entry-error');
  err.classList.remove('show');

  if (!validateBangladeshPhone(phone)) {
    err.textContent = 'সঠিক বাংলাদেশি ফোন নম্বর দিন (যেমন: 01712345678)';
    err.classList.add('show');
    return;
  }

    pendingPhone = phone;
  if (!captchaPassed) { askSecurityQuestion(); return; }
  await proceedAfterCaptcha();
}

async function checkReturningCustomer(phone) {
  try {
    const snap = await db.ref('orders').orderByChild('customerPhone').equalTo(phone).limitToFirst(1).once('value');
    return snap.exists();
  } catch (e) { console.error(e); return false; }
}

const BN_DIGITS = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
function normalizeDigits(str) {
  return String(str || '').trim().replace(/[০-৯]/g, d => BN_DIGITS[d]).replace(/[^0-9-]/g, '');
}

function askSecurityQuestion() {
  // Now a friendly visual captcha instead of a math question — no
  // "bot prevention" wording is shown to the customer.
  captchaPassed = false;
  currentCaptcha = null;
  renderCaptcha();
  document.getElementById('security-box').classList.add('show');
  const label = document.getElementById('security-label');
  label.textContent = lang === 'en' ? 'One quick check before we start:' : 'শুরু করার আগে একটা ছোট্ট কাজ:';
  document.getElementById('entry-btn').textContent = lang === 'en' ? '✓ Continue' : '✓ চালিয়ে যান';
  document.getElementById('entry-btn').onclick = verifySecurity;
}

// After a correct captcha → straight into the order form.
async function proceedAfterCaptcha() {
  document.getElementById('security-box').classList.remove('show');
  await loadPreviousOrders(pendingPhone);
  await upsertCustomerProfile(pendingPhone);
  proceedToForm(pendingPhone);
}

async function sendOtp() {
  const phone = document.getElementById('entry-phone').value.trim();
  const err = document.getElementById('entry-error');
  err.classList.remove('show');
  if (!validateBangladeshPhone(phone)) {
    err.textContent = lang === 'en' ? 'Enter a valid Bangladeshi number (e.g. 01712345678)' : 'সঠিক বাংলাদেশি ফোন নম্বর দিন (যেমন: 01712345678)';
    err.classList.add('show');
    return;
  }
  const e164 = toE164BD(phone);
  if (!e164 || !window.firebase || !firebase.auth) { err.textContent = otpErrorText('auth/operation-not-allowed'); err.classList.add('show'); return; }
  if (Date.now() < otpCooldownUntil) return;
  const btn = document.getElementById('entry-btn');
  btn.disabled = true;
  btn.textContent = lang === 'en' ? 'Sending…' : 'পাঠানো হচ্ছে…';
  try {
    if (!otpRecaptcha) otpRecaptcha = new firebase.auth.RecaptchaVerifier('entry-btn', { size: 'invisible' });
    otpConfirmation = await firebase.auth().signInWithPhoneNumber(e164, otpRecaptcha);
    pendingPhone = phoneKeyOf(phone);
    document.getElementById('otp-box').classList.add('show');
    document.getElementById('entry-otp').value = '';
    document.getElementById('entry-otp').focus();
    btn.textContent = lang === 'en' ? 'Verify code' : 'কোড যাচাই করুন';
    btn.onclick = verifyOtp;
    startOtpCooldown(60);
    showToast(lang === 'en' ? 'OTP sent — wait up to 1 minute' : 'OTP পাঠানো হয়েছে — ১ মিনিট পর্যন্ত অপেক্ষা করুন');
  } catch (e) {
    console.error('sendOtp failed', e);
    err.textContent = otpErrorText(e && e.code);
    err.classList.add('show');
    try { if (otpRecaptcha) { otpRecaptcha.clear(); otpRecaptcha = null; } } catch (_) {}
  } finally { btn.disabled = false; }
}
async function verifyOtp() {
  const code = (document.getElementById('entry-otp').value || '').trim();
  const err = document.getElementById('entry-error');
  err.classList.remove('show');
  if (!/^\d{6}$/.test(code)) { err.textContent = lang === 'en' ? 'Enter the 6-digit code' : '৬ সংখ্যার কোড দিন'; err.classList.add('show'); return; }
  if (!otpConfirmation) { err.textContent = otpErrorText('auth/code-expired'); err.classList.add('show'); return; }
  const btn = document.getElementById('entry-btn');
  btn.disabled = true;
  try {
    const cred = await otpConfirmation.confirm(code);
    const verifiedE164 = (cred && cred.user && cred.user.phoneNumber) || toE164BD(pendingPhone);
    const local = verifiedE164 && verifiedE164.indexOf('+880') === 0 ? '0' + verifiedE164.slice(4) : pendingPhone;
    document.getElementById('otp-box').classList.remove('show');
    await loadPreviousOrders(local);
    await upsertCustomerProfile(local);
    proceedToForm(local);
  } catch (e) {
    console.error('verifyOtp failed', e);
    err.textContent = otpErrorText(e && e.code);
    err.classList.add('show');
  } finally { btn.disabled = false; }
}
async function resendOtp() {
  if (Date.now() < otpCooldownUntil) return;
  try { if (otpRecaptcha) { otpRecaptcha.clear(); otpRecaptcha = null; } } catch (_) {}
  otpConfirmation = null;
  await sendOtp();
}

async function verifySecurity() {
  // Captcha gate. Passes only by tapping the requested picture tile;
  // the Continue button just reminds them if they haven't tapped yet.
  if (captchaPassed) { await proceedAfterCaptcha(); return; }
  const err = document.getElementById('entry-error');
  err.classList.remove('show');
  err.textContent = lang === 'en' ? 'Please tap the requested picture first.' : 'আগে চাওয়া ছবিটা চাপুন।';
  err.classList.add('show');
}

async function trackOrder() {
  const orderId = document.getElementById('entry-order-id').value.trim().toUpperCase();
  if (!orderId) { showToast('অর্ডার নম্বর লিখুন'); return; }
  try {
    const snap = await db.ref('orders').orderByChild('orderId').equalTo(orderId).once('value');
    if (!snap.exists()) { showToast('অর্ডার পাওয়া যায়নি'); return; }
    const order = Object.values(snap.val())[0];
    const dAmt = Number(order.deliveryAmount != null ? order.deliveryAmount : order.deliveryCharge) || 0;
    const dPaid = String(order.deliveryPaid || '');
    const dPickup = (order.fulfilment || 'delivery') === 'pickup' || dPaid === 'na';
    const dLine = dPickup ? 'প্রযোজ্য নয় (সেল্ফ পিকআপ)' : (dAmt > 0 ? `৳${Math.round(dAmt)} — ${dPaid === 'paid' ? 'পরিশোধিত ✅' : 'অপরিশোধিত ⏳'}` : `${dPaid === 'paid' ? 'পরিশোধিত ✅' : 'অপরিশোধিত ⏳ (চার্জ ফাঁকা — এজেন্টকে দিতে হবে)'}`);
    document.getElementById('prev-title').textContent = 'আপনার অর্ডার';
    document.getElementById('prev-list').innerHTML = `<div class="previous-order"><strong>${esc(order.orderId)}</strong><br>মোট ৳${order.total || 0}<br>ডেলিভারি চার্জ: ${esc(dLine)}<br>ডেলিভারি: ${esc(fmtDate(order.deliveryDate || ''))}</div>`;
    document.getElementById('previous-orders').classList.add('show');
  } catch (e) { showToast('অর্ডার খুঁজতে সমস্যা হয়েছে'); console.error(e); }
}

async function loadPreviousOrders(phone) {
  try {
    const snap = await db.ref('orders').orderByChild('customerPhone').equalTo(phone).once('value');
    const orders = [];
    snap.forEach(c => orders.push(c.val()));
    orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (orders.length === 0) return;

    document.getElementById('prev-title').textContent = `আপনার পূর্ববর্তী ${orders.length}টি অর্ডার:`;
    const list = document.getElementById('prev-list');
    list.innerHTML = orders.slice(0, 5).map(o => `
      <div class="previous-order">
        <div style="font-weight:600">${esc(o.customerName || o.name || '')} · ${esc(o.weightLabel || o.weight || '')} · ${esc(o.flavourName || o.flavour || '')}</div>
        <div style="color:#888;margin-top:2px">📅 ${esc(fmtDate(o.deliveryDate || o.date || ''))} · 💰 ৳${o.total || 0}</div>
        <div style="color:#888">🚚 ডেলিভারি চার্জ: ${(o.fulfilment || 'delivery') === 'pickup' || o.deliveryPaid === 'na' ? 'প্রযোজ্য নয় (পিকআপ)' : ((()=>{const _a=Math.round(Number(o.deliveryAmount != null ? o.deliveryAmount : o.deliveryCharge) || 0); return _a>0 ? `৳${_a} — ${o.deliveryPaid === 'paid' ? 'পরিশোধিত ✅' : 'অপরিশোধিত ⏳'}` : `${o.deliveryPaid === 'paid' ? 'পরিশোধিত ✅' : 'অপরিশোধিত ⏳ (চার্জ ফাঁকা)'}`;})())}</div>
      </div>
    `).join('');
    document.getElementById('previous-orders').classList.add('show');
  } catch (e) { console.error(e); }
}

function previousOrderDateValue(order) {
  const raw = order.deliveryDate || order.date || '';
  const match = String(raw).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return new Date(+match[1], +match[2] - 1, +match[3]).getTime();
  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? Number(order.createdAt || 0) : parsed;
}

function renderPreviousOrder() {
  const order = previousOrderHistory[previousOrderCursor];
  const content = document.getElementById('previous-orders-content');
  const nav = document.getElementById('previous-orders-nav');
  if (!order) {
    content.innerHTML = `<p style="text-align:center;color:var(--text3);padding:18px 0">${lang === 'en' ? 'No previous orders found for this phone number.' : 'এই ফোন নম্বরে কোনো পূর্ববর্তী অর্ডার পাওয়া যায়নি।'}</p>`;
    nav.hidden = true;
    return;
  }

  // Recompute the payment figures fresh from the order instead of trusting the
  // stale advanceTotal/dueAmount saved at submit time. This way any payment
  // amount corrected by the bakery (admin edit) is reflected here immediately.
  // `paid` counts only money that went toward the cake — cash-out fees
  // (bKash/Nagad) sent with the transfer are excluded, matching the bakery's
  // own books (admin subtracts the same charge from `paid`).
  const total = Number(order.total != null ? order.total : order.cakePrice) || 0;
  const sent = Number(order.advanceTotal != null ? order.advanceTotal : (order.advance != null ? order.advance : order.paid)) || 0;
  const fee = Number(order.paymentCharges != null ? order.paymentCharges : order.bkashCharge) || 0;
  const paid = Math.max(0, sent - fee);
  const due = Math.max(0, total - paid);
  const cake = [order.weightLabel || order.weight, order.flavourName || order.flavour].filter(Boolean).join(' · ') || '—';
  const writing = order.writing || order.cakeWriting || '';
  const deliveryDate = fmtDate(order.deliveryDate || order.date || '') || 'তারিখ নির্ধারিত হয়নি';
  const deliveryTime = order.timeSlotLabel || order.time || '';
  const address = order.deliveryAddress || order.address || '—';
  // Delivery charge status — visible for delivery orders: paid / not paid
  const delAmt = Number(order.deliveryAmount != null ? order.deliveryAmount : order.deliveryCharge) || 0;
  const dpaid = String(order.deliveryPaid || '');
  const isPickupOrd = (order.fulfilment || 'delivery') === 'pickup' || dpaid === 'na';
  const delLine = isPickupOrd
    ? (lang === 'en' ? 'Not applicable (self pickup)' : 'প্রযোজ্য নয় (সেল্ফ পিকআপ)')
    : (delAmt > 0
      ? `৳${Math.round(delAmt)} — ${dpaid === 'paid' ? (lang === 'en' ? 'Paid ✅' : 'পরিশোধিত ✅') : (lang === 'en' ? 'Not paid ⏳ (pay the delivery agent)' : 'অপরিশোধিত ⏳ (এজেন্টকে দিতে হবে)')}`
      : `${dpaid === 'paid' ? (lang === 'en' ? 'Paid ✅' : 'পরিশোধিত ✅') : (lang === 'en' ? 'Not paid ⏳ (charge blank — pay the agent)' : 'অপরিশোধিত ⏳ (চার্জ ফাঁকা — এজেন্টকে দিতে হবে)')}`);

  content.innerHTML = `
    <article class="order-history-card">
      <div class="order-history-date">📅 ${esc(deliveryDate)}${deliveryTime ? ` · ${esc(deliveryTime)}` : ''}</div>
      <div class="order-history-row"><span>${lang === 'en' ? 'Order ID' : 'অর্ডার নম্বর'}</span><span>${esc(order.orderId || '—')}</span></div>
      <div class="order-history-row"><span>${lang === 'en' ? 'Cake' : 'কেক'}</span><span>${esc(cake)}</span></div>
      ${writing ? `<div class="order-history-row"><span>${lang === 'en' ? 'Cake writing' : 'কেকের লেখা'}</span><span>${esc(writing)}</span></div>` : ''}
      <div class="order-history-row"><span>${lang === 'en' ? 'Address' : 'ঠিকানা'}</span><span>${esc(address)}</span></div>
      <div class="order-history-row"><span>${lang === 'en' ? 'Total' : 'মোট'}</span><span>৳${Math.round(total)}</span></div>
      <div class="order-history-row"><span>${lang === 'en' ? 'Paid' : 'প্রদান'}</span><span>৳${Math.round(paid)}</span></div>
      <div class="order-history-row"><span>${lang === 'en' ? 'Due' : 'বাকি'}</span><span>৳${Math.round(due)}</span></div>
      <div class="order-history-row"><span>${lang === 'en' ? 'Delivery charge' : 'ডেলিভারি চার্জ'}</span><span>${esc(delLine)}</span></div>
    </article>`;
  nav.hidden = false;
  document.getElementById('previous-order-position').textContent = lang === 'en'
    ? `${previousOrderCursor + 1} of ${previousOrderHistory.length}`
    : `${previousOrderCursor + 1} / ${previousOrderHistory.length}`;
  const back = document.getElementById('previous-order-back');
  const next = document.getElementById('previous-order-next');
  back.textContent = lang === 'en' ? '← Previous' : '← আগেরটি';
  next.textContent = lang === 'en' ? 'Next →' : 'পরেরটি →';
  back.disabled = previousOrderCursor === 0;
  next.disabled = previousOrderCursor === previousOrderHistory.length - 1;
}

async function showPreviousOrders() {
  const phone = localStorage.getItem('nitu-cust-phone') || '';
  if (!phone) { showToast(lang === 'en' ? 'Enter and verify your phone number first.' : 'আগে আপনার ফোন নম্বর যাচাই করুন।'); return; }

  const popup = document.getElementById('previous-orders-popup');
  const content = document.getElementById('previous-orders-content');
  popup.classList.add('show');
  content.innerHTML = `<p style="text-align:center;color:var(--text3);padding:18px 0">${lang === 'en' ? 'Loading orders…' : 'অর্ডার লোড হচ্ছে…'}</p>`;
  document.getElementById('previous-orders-nav').hidden = true;

  try {
    const snap = await db.ref('orders').orderByChild('customerPhone').equalTo(phone).once('value');
    previousOrderHistory = [];
    snap.forEach(child => previousOrderHistory.push(child.val()));
    // Newest delivery date first; creation time is the fallback if a legacy order has no date.
    previousOrderHistory.sort((a, b) => previousOrderDateValue(b) - previousOrderDateValue(a));
    previousOrderCursor = 0;
    document.getElementById('previous-orders-title').textContent = lang === 'en' ? 'Your Previous Orders' : 'আপনার পূর্ববর্তী অর্ডার';
    renderPreviousOrder();
  } catch (error) {
    console.error(error);
    popup.classList.remove('show');
    showToast(lang === 'en' ? 'Could not load previous orders. Please try again.' : 'পূর্ববর্তী অর্ডার লোড করা যায়নি। আবার চেষ্টা করুন।');
  }
}

function changePreviousOrder(direction) {
  const nextIndex = previousOrderCursor + direction;
  if (nextIndex < 0 || nextIndex >= previousOrderHistory.length) return;
  previousOrderCursor = nextIndex;
  renderPreviousOrder();
}

function closePreviousOrders(event) {
  if (!event || event.target === document.getElementById('previous-orders-popup')) {
    document.getElementById('previous-orders-popup').classList.remove('show');
  }
}

function proceedToForm(phone) {
  localStorage.setItem('nitu-cust-phone', phone);
  document.getElementById('entry-screen').classList.add('hidden');
  document.getElementById('form-screen').classList.add('active');
  // Fresh form: delivery charge unlocked & blank — the estimate fills it once
  // the address is typed (autoDeliveryCharge).
  const dci = document.getElementById('f-delivery-charge');
  if (dci) { dci.value = ''; dci.readOnly = false; dci.disabled = false; dci.classList.remove('locked-field'); }
  const dn = document.getElementById('dc-note'); if (dn) { dn.style.display = 'none'; dn.innerHTML = ''; }
  const de = document.getElementById('dc-edit-btn'); if (de) de.style.display = 'none';
  currentOrderId = generateOrderId();
  document.getElementById('form-order-id').textContent = currentOrderId;
  setMinDate();
  updateProgress();
  // Pre-fill name from last order
  const lastName = localStorage.getItem('nitu-cust-name');
  if (lastName) document.getElementById('f-name').value = lastName;
}

// Photo
const MAX_PHOTOS = 4;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(ev) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX = 800; let w = img.width, h = img.height;
        if (w > MAX) { h = h * MAX / w; w = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handlePhoto(e) {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  const slots = MAX_PHOTOS - currentPhotos.length;
  if (slots <= 0) { showToast(`সর্বোচ্চ ${MAX_PHOTOS}টি ছবি দেওয়া যাবে`); return; }
  if (files.length > slots) showToast(`প্রথম ${slots}টি ছবি নেওয়া হলো`);
  for (const file of files.slice(0, slots)) {
    if (file.size > 5 * 1024 * 1024) { showToast(`${file.name || 'ছবি'}: ৫MB এর কম হতে হবে`); continue; }
    try { currentPhotos.push(await compressImage(file)); } catch (_) { showToast('ছবি লোড করা যায়নি'); }
  }
  renderPhotos();
}

function renderPhotos() {
  document.getElementById('photo-grid').innerHTML = currentPhotos.map((src, i) => `
    <div class="photo-thumb">
      <img src="${src}" alt="">
      <button type="button" class="photo-remove" onclick="removePhoto(${i})">✕</button>
    </div>`).join('');
}

function removePhoto(i) {
  currentPhotos.splice(i, 1);
  renderPhotos();
}

// ─── Payment screenshot (mandatory proof-of-payment) ───────────
// Same compressor as reference photos (≤ ~80KB JPEG data URL).
let payShot = '';

async function handlePayShot(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('ছবি ৫MB এর কম হতে হবে'); return; }
  try { payShot = await compressImage(file); } catch (_) { showToast('ছবি লোড করা যায়নি'); return; }
  renderPayShot();
  updateProgress();
}
function renderPayShot() {
  document.getElementById('payshot-grid').innerHTML = payShot ? `
    <div class="photo-thumb">
      <img src="${payShot}" alt="পেমেন্ট স্ক্রিনশট">
      <button type="button" class="photo-remove" onclick="removePayShot()">✕</button>
    </div>` : '';
}
function removePayShot() {
  payShot = '';
  renderPayShot();
}

// Payment change — the grid (bKash/Nagad/Bank buttons) is the picker;
// the hidden select is only kept in sync for the charge math + submit.
function onPaymentChange() {
  const methodId = document.getElementById('f-payment-method').value;
  showPaymentInfo(methodId);
  // Keep the button grid in sync if the select was changed programmatically.
  if (methodId) {
    advanceMethod = methodId;
    document.querySelectorAll('.adv-method-opt').forEach(el => el.classList.remove('active'));
    const gridOpt = document.getElementById('adv-opt-' + methodId);
    if (gridOpt) gridOpt.classList.add('active');
  }
  recalcPrice();
}

// Number / account details shown right below the buttons.
// bKash/Nagad: copy button beside the NUMBER only. Bank: copy beside ALL info.
function showPaymentInfo(methodId) {
  const info = document.getElementById('payment-info');
  if (!info) return;
  const method = getPaymentMethod(methodId);
  if (method && method.number) {
    const copyField = (label, value) => `<div class="pay-line"><span>${label}: <strong>${value}</strong></span> <button type="button" class="copy-button" onclick="copyValue('${value}', this)">কপি</button></div>`;
    const plainField = (label, value) => `<div class="pay-line"><span>${label}: <strong>${value}</strong></span></div>`;
    let body = '';
    if (methodId === 'bank') {
      body = copyField('অ্যাকাউন্ট নম্বর', method.number)
        + copyField('ব্যাংক', 'IFIC Bank')
        + copyField('শাখা', 'Hathazari')
        + copyField('রাউটিং', '120 153 224')
        + copyField('SWIFT', 'IFICBDDH')
        + copyField('অ্যাকাউন্টধারী', 'Sabrina Akter Bhuiyan')
        + copyField('যোগাযোগ', '01521400475');
    } else {
      body = copyField('নম্বর', method.number)
        + (method.regName ? plainField('নাম', method.regName) : '');
    }
    info.innerHTML = `📱 <strong>${method.name}</strong>${body}<br><small>${methodId === 'bkash' ? 'বিকাশ Send Money করুন। আপনার অগ্রিমের উপর ১.৮২% চার্জ যোগ হবে।' : methodId === 'nagad' ? 'নগদ Send Money করুন। আপনার অগ্রিমের উপর ১.৪৯% চার্জ যোগ হবে।' : 'পেমেন্টের বিস্তারিত যাচাই করা হবে।'}</small>`;
    info.classList.add('show');
  } else {
    info.classList.remove('show');
    info.innerHTML = '';
  }
}

function copyValue(value, btn) {
  const done = () => {
    showToast('কপি হয়েছে');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = old; }, 1200);
    }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
    } else {
      fallbackCopy(value, done);
    }
  } catch (e) { fallbackCopy(value, done); }
}

function fallbackCopy(value, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch (e) { showToast('কপি হয়নি — নম্বরটি লিখে নিন'); }
}

let popupText = '';
const textPopupCache = {}; // .txt contents cached in memory after first load
async function showTextPopup(fileName, title) {
  try {
    // Cached after first load -> popup opens instantly on every later click
    if (!textPopupCache[fileName]) {
      const response = await fetch(`./${encodeURIComponent(fileName)}`);
      if (!response.ok) throw new Error('Text file unavailable');
      textPopupCache[fileName] = await response.text();
    }
    popupText = textPopupCache[fileName];
    document.getElementById('popup-title').textContent = title;
    document.getElementById('popup-content').textContent = popupText;
    document.getElementById('text-popup').classList.add('show');
  } catch (e) { showToast('তথ্য লোড করা যায়নি'); }
}

// Prefetch the guide texts in the background so even the FIRST click is instant
['base price.txt', 'flavours.txt', 'mini cake.txt', 'medium cake.txt'].forEach(f => {
  fetch(`./${encodeURIComponent(f)}`)
    .then(r => r.ok ? r.text() : '')
    .then(t => { if (t && !textPopupCache[f]) textPopupCache[f] = t; })
    .catch(() => {});
});

function showDeliveryPopup() {
  document.getElementById('popup-title').textContent = 'ডেলিভারি তথ্য';
  popupText = 'শুধুমাত্র চট্টগ্রাম মেট্রো শহরের মধ্যে ডেলিভারি দেওয়া হয়।\n\nডেলিভারি চার্জ নির্দিষ্ট নয়। ডেলিভারি এজেন্ট দূরত্ব এবং কেকের ওজন দেখে চার্জ নির্ধারণ করেন।\n\nআমরা এজেন্টের সঙ্গে যোগাযোগ করে চার্জ জানার পর Facebook পেজে আপনাকে জানাব। চার্জ জানলে নিচের Delivery Charge ঘরে লিখুন।\n\nএই ডেলিভারি চার্জ কেকের দামের সঙ্গে যোগ হবে না; সম্পূর্ণ টাকা ডেলিভারি এজেন্টকে দিতে হবে।';
  document.getElementById('popup-content').textContent = popupText;
  document.getElementById('text-popup').classList.add('show');
}

function showFlavourPopup() {
  // Always available: fires on flavour change AND via the ❗ info button
  showTextPopup('flavours.txt', 'ফ্লেভার নির্দেশিকা');
}

// ─── "Select the exact flavour" notice ──────────────────────
// Customers often pick a pricier flavour than the one discussed in the
// Facebook chat (e.g. Chocolate Sponge agreed, Chocolate Mud selected),
// forcing a price re-negotiation afterwards. A single friendly popup on the
// first tap of the flavour dropdown reminds them to match the chat. Full
// flavour details stay available via the ❗ button and the link in the popup.
function showFlavourNotice() {
  if (flavourNoticeShown) return; // only once per session
  flavourNoticeShown = true;
  // Close the native dropdown picker so the notice is read first
  document.getElementById('f-flavour').blur();
  const bn = lang !== 'en';
  document.getElementById('flavour-notice-title').textContent = bn ? 'মনোযোগ' : 'Attention';
  document.getElementById('flavour-notice-body').innerHTML = bn
    ? 'অনুগ্রহ করে ঠিক সেই ফ্লেভারটি সিলেক্ট করুন যেটি নিয়ে Facebook-এ আমাদের সাথে কথা হয়েছিল। ভিন্ন ফ্লেভার সিলেক্ট করলে কেকের মূল্য বেড়ে যেতে পারে।'
    : 'Please select the exact flavour that was talked about in the Facebook conversation. Choosing a different flavour might change the price.';
  document.getElementById('flavour-notice-ok').textContent = bn ? 'ঠিক আছে' : 'OK';
  document.getElementById('flavour-notice-link').textContent = bn ? 'সব ফ্লেভারের বিবরণ দেখুন' : 'See all flavour details';
  document.getElementById('flavour-notice-popup').classList.add('show');
}

function closeFlavourNotice(event) {
  if (event && event.target !== document.getElementById('flavour-notice-popup')) return;
  document.getElementById('flavour-notice-popup').classList.remove('show');
}

// "See all flavour details" link inside the notice → the full flavours.txt
// guide (the same popup as the ❗ button beside the dropdown)
function openFlavourGuideFromNotice() {
  closeFlavourNotice();
  showFlavourPopup();
}

// ─── Cake writing: 500-word limit ─────────────────────────────
const WRITING_MAX_WORDS = 500;
let writingLimitWarned = false;

function countWritingWords(text) {
  const t = String(text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

function updateWritingCount() {
  const el = document.getElementById('f-writing');
  if (!el) return;
  let words = countWritingWords(el.value);
  if (words > WRITING_MAX_WORDS) {
    // Hard-trim back to the first 500 words (keeps any trailing space mid-typing)
    el.value = el.value.trim().split(/\s+/).slice(0, WRITING_MAX_WORDS).join(' ') + (/\s$/.test(el.value) ? ' ' : '');
    words = WRITING_MAX_WORDS;
    if (!writingLimitWarned) {
      writingLimitWarned = true;
      showToast(lang === 'en' ? 'Maximum 500 words allowed' : 'সর্বোচ্চ ৫০০ শব্দ পর্যন্ত লেখা যাবে');
    }
  } else if (words < WRITING_MAX_WORDS) {
    writingLimitWarned = false; // re-arm the warning once back under the limit
  }
  const counter = document.getElementById('writing-count');
  if (counter) counter.textContent = `${words} / ${WRITING_MAX_WORDS}`;
}

function showCakeWritingPolicy() {
  // Always available — used by the ❗ info button and the first-focus auto-popup
  document.getElementById('popup-title').textContent = lang === 'en' ? 'Cake Writing Policy' : 'কেকের লেখার নীতিমালা';
  popupText = lang === 'en'
    ? 'From our religious perspective, we do not write birthday, anniversary, or any “Happy ...” message on cakes.\n\nYou may write cute notes, meaningful quotes, names, duas, or memorable words said by the customer. Please keep the text respectful and short so it fits neatly on the cake.'
    : 'আমাদের ধর্মীয় দৃষ্টিকোণ থেকে কেকে জন্মদিন, বার্ষিকী বা “Happy ...” ধরনের কোনো লেখা লেখা হয় না।\n\nআপনি চাইলে সুন্দর নোট, অর্থপূর্ণ কোট, নাম, দোয়া বা কাস্টমারের বলা কোনো স্মরণীয় কথা লিখতে পারেন। লেখাটি সম্মানজনক ও সংক্ষিপ্ত রাখুন, যাতে কেকের ওপর সুন্দরভাবে বসানো যায়।';
  document.getElementById('popup-content').textContent = popupText;
  document.getElementById('text-popup').classList.add('show');
}

function showCakeWritingNotice() {
  if (cakeWritingNoticeShown) return; // auto-popup only once per session
  cakeWritingNoticeShown = true;
  showCakeWritingPolicy();
}

function closeTextPopup(event) {
  if (!event || event.target === document.getElementById('text-popup')) document.getElementById('text-popup').classList.remove('show');
}

function copyPopupText() {
  navigator.clipboard.writeText(popupText).then(() => showToast('তথ্য কপি হয়েছে'));
}

function getCakeWritingError(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (countWritingWords(raw) > WRITING_MAX_WORDS) {
    return lang === 'en'
      ? 'Cake writing can be at most 500 words.'
      : 'কেকের লেখা সর্বোচ্চ ৫০০ শব্দের হতে পারবে।';
  }
  const normalized = raw.toLowerCase().replace(/[.,!?;:()\[\]{}'"“”‘’_-]+/g, ' ').replace(/\s+/g, ' ');
  const blocked = [
    /\bhappy\b/,
    /\bbirthday\b/,
    /\banniversary\b/,
    /\banyversery\b/,
    /\baniversery\b/,
    /জন্মদিন/,
    /বার্ষিকী/,
    /বিবাহবার্ষিকী/,
    /এনিভার্সারি/,
    /হ্যাপি/,
    /শুভ\s*জন্মদিন/
  ];
  return blocked.some(pattern => pattern.test(normalized))
    ? (lang === 'en'
      ? 'Please remove birthday, anniversary, or “Happy ...” wording from the cake writing text.'
      : 'কেকের লেখায় জন্মদিন, বার্ষিকী বা “Happy ...” ধরনের শব্দ রাখা যাবে না। অনুগ্রহ করে লেখাটি পরিবর্তন করুন।')
    : '';
}

// ─── Cake weight (single free input) ──────────────────────────
// Mini is automatic, not a visible option. Below 300 gram the order becomes
// a mini cake: the mini info popup opens, and OK locks 50% so the customer
// pays 100% + delivery charge. A bare number (1/2/3/4/5) asks the unit
// (pound / KG / gram) explicitly.
let cakeKind = 'normal';   // 'normal' | 'mini' (auto only)
let miniNoticeShown = false;
let miniPending = false;

const MINI_FILL_BN = '\u09ae\u09bf\u09a8\u09bf \u0995\u09c7\u0995';
const MINI_FILL_EN = 'Mini cake';

function getCakeKind() {
  return cakeKind;
}

function setCakeKind(kind, opts) {
  opts = opts || {};
  cakeKind = (kind === 'mini') ? 'mini' : 'normal';
  const wEl = document.getElementById('f-weight');
  const hintEl = document.getElementById('weight-hint');
  if (cakeKind === 'mini') {
    // Mini cake: no pound/KG to type — the input is locked to the size name.
    wEl.value = lang === 'en' ? MINI_FILL_EN : MINI_FILL_BN;
    wEl.disabled = true;
    wEl.style.display = 'none';
    wEl.classList.add('locked-field');
    if (hintEl) hintEl.textContent = '';
  } else if (!opts.keepValue) {
    // Back to a normal cake: free the input again.
    wEl.value = opts.value != null ? opts.value : '';
    wEl.disabled = false;
    wEl.style.display = '';
    wEl.classList.remove('locked-field');
  } else {
    wEl.disabled = false;
    wEl.style.display = '';
    wEl.classList.remove('locked-field');
  }
  updateWeightHint();
  syncFullOnlyPayment();   // mini => 50% locked off too
  if (cakeKind === 'mini') setAdvanceType('full');   // mini auto-selects 100% (50% greyed out)
  recalcPrice();
  updateProgress();
}

// ─── 300-gram mini-cake rule ────────────────────────────────
// Any weight at or below 300 g converts to a mini cake: the mini info popup
// shows first, and OK applies the lock (50% off, 100% + delivery).
function weightInGrams(parsed) {
  if (!parsed) return null;
  if (parsed.isGram) return parsed.num;
  if (parsed.isKg) return parsed.num * 1000;
  return parsed.num * 453.592;   // pounds → grams
}

function maybeConvertToMini() {
  const wEl = document.getElementById('f-weight');
  if (!wEl) return false;
  const raw = String(wEl.value || '').trim();
  if (!raw || isPresetWeight(raw) || cakeKind === 'mini') return cakeKind === 'mini';
  const p = parseWeightText(raw);
  if (!p) return false;
  const grams = weightInGrams(p);
  if (grams == null || grams > 300) return false;   // above 300 g → stays a normal cake
  // At/below 300 g → mini cake: show the info popup, OK applies the lock.
  miniPending = true;
  miniNoticeShown = false;
  showMiniCakeInfo();
  return true;
}

// Mini info popup with an explicit OK gate (instead of a passive popup):
// OK converts the weight to the mini size name and locks 50% off.
function showMiniCakeInfo() {
  const p = WEIGHT_PRESETS.mini;
  showTextPopup(p.file, lang === 'en' ? p.titleEn : p.title);
  miniNoticeShown = true;
  // Append an OK button to the currently open popup (re-render safe: only one).
  const pop = document.querySelector('#text-popup .popup');
  if (pop && !pop.querySelector('#mini-ok-btn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'mini-ok-btn';
    btn.className = 'btn-primary';
    btn.style.margin = '0 18px 18px';
    btn.textContent = lang === 'en' ? 'OK — Mini cake' : 'ঠিক আছে — মিনি কেক';
    btn.onclick = confirmMiniCake;
    pop.appendChild(btn);
  }
}

function confirmMiniCake() {
  const pop = document.getElementById('text-popup');
  if (pop) pop.classList.remove('show');
  miniPending = false;
  miniNoticeShown = true;
  setCakeKind('mini');            // locks the input + 100% + delivery flow
  showToast(lang === 'en'
    ? 'Mini cake — 100% payment with delivery charge'
    : 'মিনি কেক — ডেলিভারি চার্জসহ ১০০% পেমেন্ট');
}

// A payment that is ALWAYS full: surprise cakes and mini cakes. For these the
// total counts the 100% cake price PLUS the delivery charge. Everything else
// (normal cake, not surprise) keeps the normal 50% / 100% choice.
function isFullOnlyPayment() {
  if (isSurprise) return true;
  if (getCakeKind() === 'mini') return true;
  return false;
}

// Total payment = 100% of the cake price + the delivery charge (if any).
// This is what a "full payment" must cover; the locked 50% option can't
// be picked while isFullOnlyPayment().
function getFullBase() {
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  const delivery = getDeliveryCharge();
  return Math.round(cakePrice) + Math.round(delivery);
}

// Grey out the 50% option (locked, untappable) whenever only full payment
// is allowed; restore it otherwise.
function syncFullOnlyPayment() {
  const lock = isFullOnlyPayment();
  const opt50 = document.getElementById('opt-50');
  if (opt50) {
    opt50.classList.toggle('adv-locked', lock);
    opt50.style.opacity = lock ? '0.4' : '';
    opt50.style.pointerEvents = lock ? 'none' : '';
  }
  if (lock && advanceType === '50') {
    advanceType = 'full';
    document.querySelectorAll('.advance-opt').forEach(el => el.classList.remove('active'));
    const full = document.getElementById('opt-full');
    if (full) full.classList.add('active');
    lastAutoSend = 0; lastAutoBase = 0;
  }
  return lock;
}

function setAdvanceType(type) {
  if (type === '50' && isFullOnlyPayment()) {
    showToast(lang === 'en'
      ? 'Only full payment for surprise / mini cake'
      : 'সারপ্রাইজ / মিনি কেকে শুধু ১০০% পেমেন্ট');
    return;   // 50% stays locked
  }
  advanceType = type;
  document.querySelectorAll('.advance-opt').forEach(el => el.classList.remove('active'));
  document.getElementById('opt-' + type).classList.add('active');
  lastAutoSend = 0; lastAutoBase = 0;
  const price = parseFloat(document.getElementById('f-cake-price').value) || 0;
  if (price <= 0) document.getElementById('f-advance').value = '';
  // No popup: the gateway is picked from the inline payment section
  // (method select + bKash/Nagad/Bank grid) — recalc right away.
  recalcPrice(); // auto path fills the grey box with the charge-inclusive amount
}

// ─── Advance auto-calculation (grey bold box + read-only due box) ──
// #f-advance holds what the customer SENDS now: base advance + gateway
// charge, e.g. 50% of ৳1000 via bKash → ৳500 + ৳10 charge = ৳510. It is
// editable, but tapping it pops a warning: the figure was auto-calculated
// with the gateway charge — inform the admin before changing it.
// #f-due (greyed out, read-only) auto-shows the rest (total − base).
let lastAutoSend = 0;   // most recent auto-calculated send amount
let lastAutoBase = 0;   // matching base advance (without the charge)

function getGatewayRate() {
  const id = advanceMethod || document.getElementById('f-payment-method').value;
  const m = getPaymentMethod(id);
  return m && m.charges > 0 ? m.charges : 0;
}

// Split a typed send-amount into base advance + gateway charge, preferring the
// exact admin model (charge = ceil(base × rate), base + charge = send).
function splitSend(sendAmount, rate) {
  let base = Math.round(sendAmount / (1 + rate));
  for (const b of [base, base - 1, base + 1]) {
    if (b >= 0 && b + Math.ceil(b * rate) === sendAmount) return { base: b, charge: sendAmount - b };
  }
  base = Math.max(0, base);
  return { base, charge: Math.max(0, sendAmount - base) };
}

function closeAdvanceWarn() {
  document.getElementById('advance-warn-popup').classList.remove('show');
}

// Tapping the grey payment box → warn that the amount was auto-calculated
function onAdvanceClick() {
  if (advanceType) showAdvanceWarn();
}

// ─── "How did you pay?" gateway chooser ──────────────────────
// DISABLED popup: the gateway is picked from the inline payment section
// (method select + bKash/Nagad/Bank grid above the amount box).
// Kept as no-ops so old onclick handlers can't open anything.
function openAdvanceMethodPopup() {
  return;
}

function closeAdvanceMethodPopup(event) {
  const pop = document.getElementById('adv-method-popup');
  if (pop) pop.classList.remove('show');
}

function chooseAdvanceMethod(id) {
  const m = getPaymentMethod(id);
  if (!m) return;
  advanceMethod = id;
  const pop = document.getElementById('adv-method-popup');
  if (pop) pop.classList.remove('show');
  document.querySelectorAll('.adv-method-opt').forEach(el => el.classList.remove('active'));
  const gridOpt = document.getElementById('adv-opt-' + id);
  if (gridOpt) gridOpt.classList.add('active');
  // Hidden select stays in sync (charge math + submit read it),
  // details render right below the buttons.
  const sel = document.getElementById('f-payment-method');
  if (sel) {
    if (!sel.options.length || sel.options.length <= 1) fillPaymentOptions();
    sel.value = id;
  }
  showPaymentInfo(id);
  recalcPrice();   // always — so the gateway charge applies even before 50%/100% is tapped
  updateProgress();
}

// Options for the (now hidden) select — kept so charge math + order save keep working.
function fillPaymentOptions() {
  const sel = document.getElementById('f-payment-method');
  if (!sel) return;
  if (sel.options.length > 1) return;
  PAYMENT_METHODS.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = lang === 'en' ? p.nameEn : p.name;
    sel.appendChild(o);
  });
}

function showAdvanceWarn() {
  const methodId = document.getElementById('f-payment-method').value;
  const reason = lang === 'en'
    ? (methodId === 'bkash' ? 'This payment was <strong>auto-calculated</strong> including the <strong>bKash charge</strong>.'
       : methodId === 'nagad' ? 'This payment was <strong>auto-calculated</strong> including the <strong>Nagad charge</strong>.'
       : 'This payment was <strong>auto-calculated</strong> for you.')
    : (methodId === 'bkash' ? 'এই পেমেন্ট <strong>অটোমেটিক</strong> হিসাব করা হয়েছে — <strong>বিকাশ চার্জসহ</strong>।'
       : methodId === 'nagad' ? 'এই পেমেন্ট <strong>অটোমেটিক</strong> হিসাব করা হয়েছে — <strong>নগদ চার্জসহ</strong>।'
       : 'এই পেমেন্ট <strong>অটোমেটিক</strong> হিসাব করা হয়েছে।');
  const inform = lang === 'en'
    ? 'If you need to change it, please <strong>inform the admin first</strong>.'
    : 'পরিবর্তন করার আগে <strong>অ্যাডমিনকে জানান</strong>।';
  document.getElementById('advance-warn-msg').innerHTML = reason + '<br>' + inform;
  document.getElementById('advance-warn-ok').textContent = lang === 'en' ? 'Got it' : 'বুঝেছি';
  document.getElementById('advance-warn-popup').classList.add('show');
}

// Grey-box amounts always use the CURRENT cake price + delivery, so a price
// or delivery edit never leaves a stale auto figure sitting in the box.
function getDeliveryCharge() {
  return document.getElementById('f-fulfilment').value === 'pickup'
    ? 0
    : (parseFloat(document.getElementById('f-delivery-charge').value) || 0);
}

function recalcPrice(manualEdit) {
  const methodId = advanceMethod || document.getElementById('f-payment-method').value;
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  const delivery = getDeliveryCharge();
  // NOTE: no early-return on blank delivery — the grey auto-box must fill
  // with cake-only math (delivery treated as 0) so tapping 50%/100% never
  // leaves a blank box. Submit-time validation still requires delivery.
  const advInput = document.getElementById('f-advance');
  const typedSend = parseFloat(advInput.value) || 0;

  // 50% lock can come and go as surprise / cake-kind / fulfilment change,
  // so re-check it on every recalculation (not just on option taps).
  // (Lock state only — the math below always uses the cake+delivery total.)
  syncFullOnlyPayment();

  // The payment preview needs a cake price AND (for delivery orders) a
  // delivery charge — so the auto-count works as soon as both are typed,
  // even if the details section above is still empty.
  if (cakePrice <= 0) {
    document.getElementById('calc-box').classList.remove('show');
    document.getElementById('due-field').classList.remove('show');
    document.getElementById('pay-footnote').classList.remove('show');
    return;
  }

  const rate = getGatewayRate();
  const paymentMethod = getPaymentMethod(methodId);
  // Total payment = cake price + delivery charge, always. (No separate note.)
  const total = Math.round(cakePrice) + Math.round(delivery);

  let base, charge, sendAmount, isAuto = false;
  if (advanceType && !manualEdit) {
    // AUTO: base = chosen % of the TOTAL (cake + delivery); send = base + gateway charge
    // (charge rounded up, e.g. 50% of 1100 via bKash -> 550 + 11 = 561)
    isAuto = true;
    base = advanceType === '50' ? Math.round(total / 2) : Math.round(total);
    charge = rate > 0 ? Math.ceil(base * rate) : 0;
    sendAmount = base + charge;
    lastAutoBase = base;
    lastAutoSend = sendAmount;
    advInput.value = sendAmount;
  } else {
    // Manual: the customer tapped the grey box and typed — keep their amount
    // and split it into base advance + charge (base + charge = what they send).
    sendAmount = Math.round(typedSend);
    const split = splitSend(sendAmount, rate);
    base = split.base;
    charge = split.charge;
  }

  const due = Math.max(0, total - base);
  const methodName = paymentMethod ? paymentMethod.name : '';

  // Hint under the grey box showing where the bold figure came from
  const hint = document.getElementById('advance-hint');
  if (advanceType) {
    const pctLabel = advanceType === '50' ? (lang === 'en' ? '50% advance' : '৫০% অগ্রিম') : (lang === 'en' ? 'full payment' : 'পুরো পেমেন্ট');
    const chargePart = charge > 0 ? ` + ${methodName} ${lang === 'en' ? 'charge' : 'চার্জ'} ৳${charge}` : '';
    hint.textContent = (isAuto ? (lang === 'en' ? 'Auto-calculated: ' : 'অটো হিসাব: ') : (lang === 'en' ? 'Custom amount: ' : 'নিজের হিসাব: '))
      + `${pctLabel} ৳${base}${chargePart} = ${lang === 'en' ? 'send' : 'পাঠাতে হবে'} ৳${sendAmount}`;
  } else {
    hint.textContent = '';
  }

  // Footnote spelling out which gateway charge is added (bKash/Nagad) or free (bank)
  const footnote = document.getElementById('pay-footnote');
  const fnTxt = lang === 'en'
    ? (methodId === 'bkash' ? `Payment is calculated including the bKash charge.` 
       : methodId === 'nagad' ? `Payment is calculated including the Nagad charge.` 
       : methodId === 'bank' ? `Bank payment — no charge, it's free.` : '')
    : (methodId === 'bkash' ? `পেমেন্ট বিকাশ চার্জসহ হিসাব করা হয়েছে।` 
       : methodId === 'nagad' ? `পেমেন্ট নগদ চার্জসহ হিসাব করা হয়েছে।` 
       : methodId === 'bank' ? `ব্যাংকে পেমেন্ট — চার্জ নেই, সম্পূর্ণ ফ্রি।` : '');
  if (fnTxt) { footnote.textContent = fnTxt; footnote.classList.add('show'); }
  else { footnote.classList.remove('show'); }

  // Top calc box (cake price / delivery / total — delivery folded into total)
  document.getElementById('calc-base').textContent = '৳' + Math.round(cakePrice);
  const isPickupCalc = document.getElementById('f-fulfilment').value === 'pickup';
  document.getElementById('calc-delivery').textContent = isPickupCalc ? 'প্রযোজ্য নয় (পিকআপ)' : '৳' + Math.round(delivery);
  document.getElementById('calc-total').textContent = '৳' + Math.round(total);
  document.getElementById('calc-box').classList.add('show');

  // Due box — the auto-calculated rest, greyed out and read-only
  const dueField = document.getElementById('due-field');
  if (sendAmount > 0) {
    document.getElementById('f-due').value = '৳' + Math.round(due);
    const dueHint = document.getElementById('due-hint');
    if (due > 0) {
      dueHint.textContent = lang === 'en'
        ? `৳${Math.round(due)} left to pay later`
        : `বাকি ৳${Math.round(due)} পরে দিতে হবে`;
    } else {
      dueHint.textContent = '';
    }
    dueField.classList.add('show');
  } else {
    dueField.classList.remove('show');
  }
}

function resolveWeight() {
  const raw = document.getElementById('f-weight').value.trim();
  if (!raw) return null;
  // Any non-empty weight text is accepted (the bakery confirms the exact
  // weight/price manually anyway). This guarantees the auto-advance count
  // always runs regardless of format the customer types.
  return { value: raw.toLowerCase(), label: raw, price: 0 };
}

// ─── Delivery-charge zone memory ─────────────────────────────
// Prices learned from SRS Express quotes (WhatsApp) + this bakery's own
// order history (34 orders with real DC). Zones match by KEYWORD in the
// typed address (Bengali or English). Admin can override any price by
// writing dcConfig/<key> = { base, kw } in the Realtime Database.
const DC_ZONES = [
  { key: 'oxygen',      name: 'অক্সিজেন মোড়',        base: 160, kw: ['oxygen', 'অক্সিজেন', 'roufabad', 'শাহ আমানত', 'shah amanat'] },
  { key: 'katalganj',   name: 'কাটালগঞ্জ',            base: 170, kw: ['katalganj', 'কাটালগঞ্জ', 'shulokbahar', 'শুলকবাহার'] },
  { key: 'mehedibag',   name: 'মেহেদিবাগ',            base: 180, kw: ['mehedibag', 'মেহেদিবাগ'] },
  { key: 'chandgaon',   name: 'চান্দগাঁও',            base: 250, kw: ['chandgaon', 'চান্দগাঁও', 'চাঁদগাঁও'] },
  { key: 'muradpur',    name: 'মুরাদপুর',             base: 180, kw: ['muradpur', 'মুরাদপুর', '2no gate', '২নং গেট'] },
  { key: 'gec',         name: 'জিইসি মোড়',           base: 200, kw: ['gec', 'জিইসি'] },
  { key: 'chawkbazar',  name: 'চকবাজার / চাঁদনীপুরা', base: 200, kw: ['chawkbazar', 'চকবাজার', 'chandanpura', 'চাঁদনীপুরা', 'dewan bazar', 'দেওয়ান বাজার', 'wasa', 'ওয়াসা', 'green village', 'গ্রিন ভিলেজ', 'rahmatganj', 'রহমতগঞ্জ'] },
  { key: 'rahattarpul', name: 'রাহাত্তারপুল',         base: 200, kw: ['rahattarpul', 'রাহাত্তারপুল', 'sholakbahar', 'শোলকবাহার'] },
  { key: 'bahaddarhat', name: 'বহদ্দারহাট',           base: 190, kw: ['bahaddarhat', 'বহদ্দারহাট'] },
  { key: 'panchlaish',  name: 'পাচলাইশ / পাহাড়তলী',   base: 230, kw: ['panchlaish', 'পাচলাইশ', 'পাঞ্চলাইশ', 'pahartali', 'পাহাড়তলী', 'akborshah', 'আকবরশাহ', 'medical'] },
  { key: 'nasirabad',   name: 'নাসিরাবাদ',            base: 210, kw: ['nasirabad', 'নাসিরাবাদ', 'ispahani'] },
  { key: 'khulshi',     name: 'খুলশী',                base: 240, kw: ['khulshi', 'খুলশী'] },
  { key: 'halishahar',  name: 'হালিশহর',              base: 320, kw: ['halishahar', 'হালিশহর'] },
  { key: 'bandar',      name: 'বান্দর / মেরিটাইম',     base: 400, kw: ['bandar', 'বান্দর', 'maritime', 'মেরিটাইম', 'solgola', 'সিমেন্ট'] },
  { key: 'agrbad',      name: 'আগ্রাবাদ',             base: 280, kw: ['agrabad', 'আগ্রাবাদ', 'mujib road', 'মুজিব রোড', 'double mooring'] },
  { key: 'hathazari',   name: 'হাটহাজারী / শহরের বাইরে', base: 400, kw: ['hathazari', 'হাটহাজারী', 'nandir', 'নন্দির হাট', 'amanbazar', 'আমানবাজার'] },
  { key: 'cu',          name: 'চট্টগ্রাম বিশ্ববিদ্যালয়', base: 550, kw: ['university', 'বিশ্ববিদ্যালয়'] },
  { key: 'patenga',     name: 'পতেঙ্গা',              base: 550, kw: ['patenga', 'পতেঙ্গা'] }
];
const DC_DEFAULT_BASE = 250;   // area not recognised — admin confirms the exact charge
let dcZoneOverrides = {};      // reserved: dcConfig from Firebase merged in later

// Weight → band extra (SRS: 1/1.5 pound পর্যন্ত একই চার্জ; এরপর বাড়ে)
function dcWeightExtra() {
  const kind = (typeof getCakeKind === 'function') ? getCakeKind() : 'normal';
  if (kind === 'mini') return 0;
  const p = parseWeightText(document.getElementById('f-weight').value);
  if (!p) return 0;
  const lb = p.isGram ? p.num / 453.592 : p.isKg ? p.num * 2.2 : p.num;
  if (lb <= 1.6) return 0;
  if (lb <= 2.6) return 20;
  if (lb <= 3.6) return 80;
  return 80 + Math.ceil(lb - 3.6) * 40;
}

function detectDcZone() {
  const addr = String(document.getElementById('f-address').value || '').toLowerCase();
  if (!addr.trim()) return null;
  for (const z of DC_ZONES) {
    if ((z.kw || []).some(k => addr.includes(String(k).toLowerCase()))) return z;
  }
  return null;
}

// True when the delivery-charge box still holds the app's own locked estimate
// (the customer has NOT taken ownership by editing/unlocking it).
let dcManuallySet = false;   // set when the customer unlocks / edits the box
function dcIsAutoEstimate() {
  const el = document.getElementById('f-delivery-charge');
  return !!el && el.readOnly === true && !dcManuallySet;
}

function parseWeightText(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const m = text.match(/([\d]+(?:\.\d+)?)\s*(grams?|gm|gms|গ্রাম|kg|কেজি|kilos?|kilograms?|pounds?|lbs|lb|পাউন্ড)?/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (!num || num <= 0) return null;
  const unitRaw = m[2] || '';
  const isKg = /kg|কেজি|kilo/.test(unitRaw);
  const isGram = !isKg && /^(grams?|gms?|gm|গ্রাম)$/.test(unitRaw.trim());
  if (!isKg && !isGram && num > 200) return null;      // pounds capped at 200
  if (isKg && num > 100) return null;                  // KG capped at 100
  if (isGram && num > 100000) return null;             // grams capped at 100 KG
  return { num, isKg, isGram };
}

function updateWeightHint() {
  const el = document.getElementById('weight-hint');
  if (!el) return;
  const raw = document.getElementById('f-weight').value;
  const p = parseWeightText(raw);
  if (!p) { el.textContent = ''; el.dataset.mode = ''; el.dataset.unit=''; return; }
  const curUnit = p.isGram ? 'g' : p.isKg ? 'kg' : 'lb';
  // Unit changed (e.g. pound → gram via unit popup) → back to default mode
  if (el.dataset.unit && el.dataset.unit !== curUnit) el.dataset.mode = '';
  el.dataset.unit = curUnit;
  const mode = el.dataset.mode || 'auto';
  if (p.isGram) {
    // Gram always shows BOTH conversions so nothing looks irrelevant:
    // 300 gram = 0.30 KG = 0.66 pound
    const kg = (p.num / 1000);
    const lb = (p.num / 453.592);
    el.textContent = lang === 'en'
      ? `${p.num} gram = ${kg.toFixed(2)} KG = ${lb.toFixed(2)} pound`
      : `${p.num} গ্রাম = ${kg.toFixed(2)} KG = ${lb.toFixed(2)} পাউন্ড`;
    return;
  }
  if (p.isKg) {
    // KG → pound by default, tap the hint to flip to KG → gram
    if (mode === 'alt') {
      el.textContent = lang === 'en'
        ? `${p.num} KG = ${Math.round(p.num * 1000)} gram`
        : `${p.num} KG = ${Math.round(p.num * 1000)} গ্রাম`;
    } else {
      el.textContent = `${p.num} KG = ${(p.num * 2.20462).toFixed(1)} pound`;
    }
    return;
  }
  // pound → KG by default, tap the hint to flip to pound → gram
  if (mode === 'alt') {
    el.textContent = lang === 'en'
      ? `${p.num} pound = ${Math.round(p.num * 453.592)} gram`
      : `${p.num} পাউন্ড = ${Math.round(p.num * 453.592)} গ্রাম`;
  } else {
    el.textContent = lang === 'en'
      ? `${p.num} pound = ${(p.num / 2.20462).toFixed(2)} KG`
      : `${p.num} পাউন্ড = ${(p.num / 2.20462).toFixed(2)} KG`;
  }
}

// Tap the footnote to switch the conversion mode:
// pound ⇄ gram, KG ⇄ gram (gram itself always shows both).
function toggleWeightHintMode() {
  const el = document.getElementById('weight-hint');
  if (!el || !el.textContent) return;
  el.dataset.mode = (el.dataset.mode === 'alt') ? '' : 'alt';
  updateWeightHint();
}

// Admin can correct any zone price without code changes: write
// dcConfig/<key> = { base, kw, name } in the Realtime Database and it is
// merged over the built-in DC_ZONES on next app load.
function loadDcConfig() {
  try {
    db.ref('dcConfig').once('value').then(snap => {
      const cfg = snap.val();
      if (!cfg) return;
      Object.entries(cfg).forEach(([key, v]) => {
        if (!v || typeof v !== 'object') return;
        const z = DC_ZONES.find(z => z.key === key);
        if (z) { if (v.base > 0) z.base = Math.round(v.base); if (Array.isArray(v.kw)) z.kw = z.kw.concat(v.kw); }
        else if (Array.isArray(v.kw) && v.base > 0) DC_ZONES.push({ key, name: v.name || key, base: Math.round(v.base), kw: v.kw });
      });
      if (typeof autoDeliveryCharge === 'function') autoDeliveryCharge(); // re-estimate with fresh prices
    }).catch(() => {});
  } catch (e) {}
}

// Auto-fill the delivery charge from area + weight, then lock the box.
// The note tells the customer: এটা আনুমানিক — এজেন্সি সঠিক চার্জ কনফার্ম করবে।
function autoDeliveryCharge() {
  const input = document.getElementById('f-delivery-charge');
  if (!input) return;
  if (typeof quoteToken !== 'undefined' && quoteToken) return;   // quote DC is locked by admin
  const fulfil = document.getElementById('f-fulfilment').value;
  if (fulfil === 'pickup') return;                                // pickup: stays disabled/blank
  const addr = document.getElementById('f-address').value.trim();
  if (!addr) {
    // Address cleared → drop the auto estimate so a stale charge can't be
    // submitted (only when the box is still the app's own locked estimate).
    if (input.readOnly) {
      input.value = '';
      input.readOnly = false;
      input.classList.remove('locked-field');
      const n = document.getElementById('dc-note'); if (n) { n.style.display = 'none'; n.innerHTML = ''; }
      const b = document.getElementById('dc-edit-btn'); if (b) b.style.display = 'none';
      recalcPrice();
    }
    return;
  }
  const zone = detectDcZone();
  const charge = (zone ? zone.base : DC_DEFAULT_BASE) + dcWeightExtra();
  const weightTxt = String(document.getElementById('f-weight').value || '').trim() || 'কেক';
  const note = document.getElementById('dc-note');
  const areaTxt = zone ? zone.name : 'অজানা এলাকা (এডমিন নিশ্চিত করবে)';
  input.value = charge;
  input.readOnly = true;
  input.classList.add('locked-field');
  if (note) note.style.display = 'block';
  const eb = document.getElementById('dc-edit-btn');
  if (eb) eb.style.display = '';
  if (note) note.innerHTML = `📍 এলাকা: <strong>${areaTxt}</strong> · ${esc(weightTxt)} → <strong>আনুমানিক ৳${charge}</strong><br>` +
    `এটি এই এলাকার আগের অর্ডার থেকে অটো হিসাব করা আনুমানিক চার্জ। ডেলিভারি এজেন্সি সঠিক চার্জ কনফার্ম করবে। ` +
    `<strong>এজেন্সি থেকে সঠিক পরিমাণ জানা না পেলে পরিবর্তন করবেন না।</strong>`;
  recalcPrice();
}

// "I have the exact charge from the agency" → unlock the box for manual edit
function unlockDeliveryCharge() {
  const input = document.getElementById('f-delivery-charge');
  if (!input) return;
  input.readOnly = false;
  input.classList.remove('locked-field');
  dcManuallySet = true;   // customer took ownership → no "অটো হিসাব" note on the order
  const eb = document.getElementById('dc-edit-btn');
  if (eb) eb.style.display = 'none';
  const note = document.getElementById('dc-note');
  if (note) note.innerHTML = `⚠️ <strong>সাবধান:</strong> ডেলিভারি এজেন্সি কনফার্ম করা <strong>সঠিক চার্জ ছাড়া এই ঘর পরিবর্তন করবেন না</strong> — নাহলে রাইডারের কাছে টাকা কম-বেশি হয়ে যেতে পারে। সঠিক চার্জ পেলে সেটাই লিখুন।`;
  showToast(lang === 'en' ? 'Unlocked — enter the agency-confirmed charge' : 'আনলক হয়েছে — এজেন্সির কনফার্ম করা চার্জ লিখুন');
  input.focus();
}

// ─── Mini / Medium cake quick-select ─────────────────────────
// One-tap options for the small sizes that don't fit the pound/KG box.
// Fills the weight with the size name and opens the matching info popup
// (mini cake.txt / medium cake.txt) with size, weight range and price range.
const WEIGHT_PRESETS = {
  mini:   { file: 'mini cake.txt',   title: 'মিনি কেক তথ্য',    titleEn: 'Mini Cake Info',    fill: 'মিনি কেক',     fillEn: 'Mini cake' },
  medium: { file: 'medium cake.txt', title: 'মিডিয়াম কেক তথ্য', titleEn: 'Medium Cake Info',  fill: 'মিডিয়াম কেক', fillEn: 'Medium cake' }
};

// Accepted spellings (spaces removed, lowercase) so the submit validation
// also accepts the size name — and close variants — typed or filled.
const WEIGHT_PRESET_ALIASES = ['মিনিকেক', 'মিনি', 'মিডিয়ামকেক', 'মিডিয়াম', 'মিডিয়ামসাইজকেক', 'minicake', 'mini', 'mediumcake', 'medium', 'mediumsizecake'];

function isPresetWeight(raw) {
  return WEIGHT_PRESET_ALIASES.includes(String(raw || '').toLowerCase().replace(/\s+/g, ''));
}

// ─── Mini cake info popup (shown when the mini kind is picked) ──
function showMiniCakeInfo() {
  const p = WEIGHT_PRESETS.mini;
  showTextPopup(p.file, lang === 'en' ? p.titleEn : p.title);
}

function setWeightPreset(kind, btn) {
  const p = WEIGHT_PRESETS[kind];
  if (!p) return;
  document.getElementById('f-weight').value = lang === 'en' ? p.fillEn : p.fill;
  updateWeightHint();
  recalcPrice();
  updateProgress();
  showTextPopup(p.file, lang === 'en' ? p.titleEn : p.title);
}

document.getElementById('f-weight').addEventListener('change', function() {
  if (cakeKind === 'mini') return;   // locked mini name — no unit to check
  // A ≤300 g weight becomes a mini cake first (popup → OK converts).
  if (maybeConvertToMini()) return;
  // Bare numbers (e.g. "1") get the POUND/KG/GRAM unit popup on blur instead
  if (!isBareNumberWeight(this.value) && parseWeightText(this.value)) showTextPopup('base price.txt', 'বেস মূল্য নির্দেশিকা');
});

document.getElementById('f-weight').addEventListener('blur', function() {
  if (cakeKind === 'mini') return;
  // A ≤300 g weight becomes a mini cake first (popup → OK converts).
  if (maybeConvertToMini()) return;
  // Leaving the field with a bare number (e.g. "1" or "2.5") → ask the unit
  if (isBareNumberWeight((this.value || '').trim())) maybeAskWeightUnit();
});

// ─── Weight-unit popup (POUND / KG / GRAM) for bare numbers like "1" ──
let weightUnitPending = false;

function isBareNumberWeight(raw) {
  const norm = String(raw || '').trim().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).toLowerCase();
  return /^\d+(?:\.\d+)?$/.test(norm);
}

function maybeAskWeightUnit() {
  const el = document.getElementById('f-weight');
  if (!el || cakeKind === 'mini') return;
  const raw = (el.value || '').trim();
  if (!raw || isPresetWeight(raw) || !isBareNumberWeight(raw)) return;
  if (weightUnitPending) return; // popup already open
  weightUnitPending = true;
  const norm = raw.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  document.getElementById('weight-unit-msg').textContent = lang === 'en'
    ? 'You typed ' + norm + ' — is that ' + norm + ' POUND, ' + norm + ' KG, or ' + norm + ' GRAM?'
    : 'আপনি ' + norm + ' লিখেছেন — এটি কি ' + norm + ' পাউন্ড, ' + norm + ' KG, নাকি ' + norm + ' গ্রাম?';
  document.getElementById('weight-unit-popup').classList.add('show');
}

function chooseWeightUnit(unit) {
  const el = document.getElementById('f-weight');
  const norm = (el.value || '').trim().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const m = norm.match(/^(\d+(?:\.\d+)?)$/);
  if (m) el.value = unit === 'kg' ? m[1] + ' KG' : unit === 'gram' ? m[1] + ' gram' : m[1] + ' pound';
  closeWeightUnitPopup();
  // A gram choice at/below 300 g converts to a mini cake immediately.
  if (!maybeConvertToMini()) { updateWeightHint(); recalcPrice(); updateProgress(); }
}

function closeWeightUnitPopup(event) {
  const pop = document.getElementById('weight-unit-popup');
  if (event && event.target !== pop) return;
  pop.classList.remove('show'); weightUnitPending = false;
}

function onFulfilmentChange() {
  const pickup = document.getElementById('f-fulfilment').value === 'pickup';
  document.getElementById('pickup-box').classList.toggle('show', pickup);
  // Delivery charge stays VISIBLE always — for self pickup it just shows
  // "প্রযোজ্য নয়" and the input is disabled.
  const dcf = document.getElementById('delivery-charge-field');
  if (dcf) dcf.style.display = 'block';
  const dci = document.getElementById('f-delivery-charge');
  if (pickup) {
    if (dci) { dci.value = ''; dci.disabled = true; dci.placeholder = 'প্রযোজ্য নয় — সেল্ফ পিকআপ'; }
    const pn = document.getElementById('dc-note'); if (pn) { pn.style.display = 'none'; }
    const pe = document.getElementById('dc-edit-btn'); if (pe) pe.style.display = 'none';
  } else {
    if (dci && !quoteToken) { dci.disabled = false; dci.placeholder = 'ঠিকানা লিখলে আনুমানিক চার্জ অটো হিসাব হবে'; }
    autoDeliveryCharge();
  }
  document.getElementById('f-address').required = !pickup;
  if (pickup) document.getElementById('f-address').value = 'Rongdhonu apartment, Khoshalshah road, Amanbazar, Hathazari Road, Chattogram';
  recalcPrice();
}

// Surprise
document.getElementById('f-surprise').addEventListener('change', function() {
  isSurprise = this.value === 'yes';
  document.getElementById('surprise-note').classList.toggle('show', isSurprise);
  if (isSurprise) {
    setAdvanceType('full');
    // 50% locks while surprise is on (sync also re-locks on every recalc)
    document.querySelectorAll('.advance-opt').forEach(el => el.style.opacity = '0.5');
    document.getElementById('opt-full').style.opacity = '1';
  } else {
    document.querySelectorAll('.advance-opt').forEach(el => el.style.opacity = '1');
  }
  syncFullOnlyPayment();
});

// Progress
function updateProgress() {
  const fields = ['f-name','f-weight','f-cake-price','f-flavour','f-address','f-date','f-timeslot','f-receiver','f-receiver-phone','f-payment-method','f-advance'];
  let filled = 0;
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim()) filled++;
  });
  document.getElementById('progress-bar').style.width = Math.round((filled / fields.length) * 100) + '%';
}

document.querySelectorAll('#form-screen input, #form-screen select, #form-screen textarea').forEach(el => {
  el.addEventListener('input', updateProgress);
  el.addEventListener('change', updateProgress);
});

// ─── Terms & conditions gate ───
function onTermsChange() {
  const cb = document.getElementById('f-terms');
  if (cb && cb.checked) document.getElementById('terms-box').classList.remove('error');
}
function checkTerms() {
  const cb = document.getElementById('f-terms');
  if (!cb || !cb.checked) {
    document.getElementById('terms-box').classList.add('error');
    showToast(lang === 'en'
      ? 'Please agree to the terms & conditions of “Nitu Baburchir Portfolio”'
      : 'অনুগ্রহ করে “নিতুবাবুর্চীর পোর্টফোলিও”-এর নিয়ম ও শর্তাবলীতে সম্মত হোন');
    document.getElementById('terms-box').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }
  return true;
}

// Validate
function validate() {
  const req = [
    ['f-name', 'নাম দিন'], ['f-weight', 'ওজন নির্বাচন করুন'], ['f-cake-price', 'কেকের মূল্য দিন'], ['f-flavour', 'ফ্লেভার নির্বাচন করুন'],
    ['f-date', 'তারিখ দিন'],
    ['f-receiver', 'রিসিভারের নাম দিন'],
    ['f-receiver-phone', 'রিসিভারের ফোন দিন'],
    ['f-payment-method', 'পেমেন্ট পদ্ধতি নির্বাচন করুন'],
    ['f-advance', 'অগ্রিম পরিমাণ দিন']
  ];
  for (const [id, msg] of req) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { showToast(msg); el.focus(); return false; }
  }
  // Payment screenshot is mandatory — the proof of payment
  if (!payShot) {
    showToast('💳 পেমেন্টের স্ক্রিনশট দিন — bKash / Nagad / ব্যাংক কনফার্মেশন পেজের ছবি');
    document.getElementById('f-payshot').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }
  if (!resolveWeight()) { showToast('সঠিক ওজন লিখুন (যেমন: 2 pound বা 1 KG)'); return false; }
  // A ≤300 g weight is a mini cake: show the popup first — OK converts + locks 50%.
  if (cakeKind !== 'mini' && maybeConvertToMini()) return false;
  // The typed weight must be a real amount (e.g. "2 pound", "1 KG", "250 gram").
  // Bare numbers get converted by the POUND/KG/GRAM popup; size names stay allowed.
  if (getCakeKind() === 'normal') {
    const wRaw = document.getElementById('f-weight').value.trim();
    if (wRaw && !isPresetWeight(wRaw) && !parseWeightText(wRaw)) {
      showToast(lang === 'en'
        ? 'Write the weight with a unit (2 pound / 1 KG)'
        : 'ওজন এককসহ লিখুন (2 pound / 1 KG)');
      maybeAskWeightUnit();
      document.getElementById('f-weight').focus();
      return false;
    }
  }
  if (document.getElementById('f-fulfilment').value === 'delivery' && !document.getElementById('f-address').value.trim()) { showToast('ঠিকানা দিন'); document.getElementById('f-address').focus(); return false; }
  // Delivery charge is REQUIRED — it always joins the total payment.
  if (document.getElementById('f-fulfilment').value === 'delivery' && !(getDeliveryCharge() > 0)) {
    showToast(lang === 'en'
      ? 'Enter the delivery charge — type the full address and it auto-calculates'
      : 'ডেলিভারি চার্জ দিন — সম্পূর্ণ ঠিকানা লিখলে আনুমানিক চার্জ অটো হিসাব হয়ে যাবে');
    document.getElementById('f-delivery-charge').focus();
    return false;
  }
  if (!validateBangladeshPhone(document.getElementById('f-receiver-phone').value.trim())) {
    showToast('সঠিক রিসিভার ফোন দিন'); return false;
  }
  if (!advanceMethod) {
    showToast(lang === 'en' ? 'Select the payment method (bKash / Nagad / Bank)' : 'আপনি কিভাবে পেমেন্ট করেছেন সেটা নির্বাচন করুন');
    document.getElementById('adv-method-grid').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }
  const timeError = getTimeError();
if (timeError) { showToast(timeError); document.getElementById('f-timeslot').focus(); return false; }
  const writingError = getCakeWritingError(document.getElementById('f-writing').value);
  if (writingError) { showToast(writingError); document.getElementById('f-writing').focus(); return false; }
  if (isSurprise) {
    const adv = parseFloat(document.getElementById('f-advance').value) || 0;
    const total = getOrderTotal();
    if (adv < total) { showToast('সারপ্রাইজের জন্য পূর্ণ পেমেন্ট দিন'); return false; }
  }
  // Mini cake / delivery orders: 100% of the cake price + the delivery
  // charge must be covered (the gateway charge sits on top of that).
  if (isFullOnlyPayment()) {
    const cake = Math.round(parseFloat(document.getElementById('f-cake-price').value) || 0);
    const del  = Math.round(getDeliveryCharge());
    const need = cake + del;
    const send = Math.round(parseFloat(document.getElementById('f-advance').value) || 0);
    if (send < need) {
      showToast((lang === 'en'
        ? 'Full payment needed: cake ৳' + cake + (del ? ' + delivery ৳' + del : '') + ' = ৳' + need
        : 'পূর্ণ পেমেন্ট দিতে হবে: কেক ৳' + cake + (del ? ' + ডেলিভারি ৳' + del : '') + ' = ৳' + need));
      document.getElementById('f-advance').focus();
      return false;
    }
  }
  return true;
}

function getOrderTotal() {
  const wt = resolveWeight();
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  if (!wt || cakePrice <= 0) return 0;
  // Total payment = cake price + delivery charge, always (no separate note).
  const delivery = getDeliveryCharge();
  return Math.round(cakePrice) + Math.round(delivery);
}

// Submit
async function submitOrder() {
  if (!checkTerms()) return;
  if (!validate()) return;
  if (quoteToken && quoteData) {
    showLoading(true);
    const chk = await validateQuoteLock();
    showLoading(false);
    if (!chk.ok) { showToast(chk.msg); return; }
  }

  const phone = localStorage.getItem('nitu-cust-phone') || '';
  const customerName = document.getElementById('f-name').value.trim();
  localStorage.setItem('nitu-cust-name', customerName);

  const wt = resolveWeight();
  const fl = getFlavour(document.getElementById('f-flavour').value);
  const timeSlot = getSelectedTime();
  const method = getPaymentMethod(document.getElementById('f-payment-method').value);
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  const sendAmount = parseFloat(document.getElementById('f-advance').value) || 0;

  const delivery = document.getElementById('f-fulfilment').value === 'pickup' ? 0 : (parseFloat(document.getElementById('f-delivery-charge').value) || 0);
  // f-advance holds what the customer sends (base advance + gateway charge).
  // Derive the base advance so the admin bookkeeping stays exact.
  const rate = method && method.charges > 0 ? method.charges : 0;
  let advance, charge;
  if (advanceType && lastAutoSend > 0 && sendAmount === lastAutoSend) {
    advance = lastAutoBase;                      // untouched auto value
    charge = Math.max(0, Math.round(sendAmount) - advance);
  } else {
    const split = splitSend(Math.round(sendAmount), rate);
    advance = split.base;
    charge = split.charge;
  }
  const subtotal = Math.round(cakePrice) + Math.round(delivery);
  const total = subtotal;
  const advanceTotal = Math.round(sendAmount);
  const dueAmount = Math.max(0, subtotal - advance);
  // Delivery is always collected online as part of the total, so any delivery
  // amount covered by the advance counts as settled with the cake.
  const deliverySettled = delivery > 0 && advance >= (Math.round(cakePrice) + Math.round(delivery));

  const order = {
    orderId: currentOrderId || generateOrderId(),
    customerPhone: phone,
    customerName: customerName,
    category: 'custom',
    categoryName: cakeKind === 'mini' ? 'মিনি কেক' : 'কাস্টম কেক',
    cakeKind: cakeKind,
    weight: wt.value,
    weightLabel: wt.label,
    flavour: fl.value,
    flavourName: fl.label,
    photo: currentPhotos[0] || '',
    photos: currentPhotos,
    photoNote: document.getElementById('f-photo-note').value.trim(),
    writing: document.getElementById('f-writing').value.trim(),
    cakeWriting: document.getElementById('f-writing').value.trim(),
    address: document.getElementById('f-address').value.trim(),
    deliveryAddress: document.getElementById('f-address').value.trim(),
    date: document.getElementById('f-date').value,
    deliveryDate: document.getElementById('f-date').value,
    timeSlot: timeSlot,
    timeSlotLabel: timeSlot,
    receiver: document.getElementById('f-receiver').value.trim(),
    receiverPhone: document.getElementById('f-receiver-phone').value.trim(),
    surprise: isSurprise,
    paymentMethod: method.id,
    paymentMethodName: method.name,
    advanceMethod: advanceMethod || '',
    advanceMethodName: method.name,
    basePrice: cakePrice,
    weightPrice: 0,
    cakePrice: cakePrice,
    deliveryCharge: delivery,
    deliveryAmount: delivery,
    // Mark orders whose delivery charge was the app's own area estimate, so
    // admin sees the "অটো হিসাব (আনুমানিক)" warning on the card.
    dcAuto: dcIsAutoEstimate(),
    dcAutoNote: dcIsAutoEstimate() ? `আনুমানিক (এলাকা অটো-হিসাব) — এজেন্সি কনফার্ম করবে` : null,
    // Delivery is always part of the total and collected online — never separate.
    deliveryPaid: document.getElementById('f-fulfilment').value === 'pickup' ? 'na' : (deliverySettled ? 'paid' : 'unpaid'),
    paymentCharges: charge,
    subtotal: subtotal,
    total: total,
    advance: advance,
    advanceTotal: advanceTotal,
    advanceCharge: charge,
    advanceAutoTotal: (advanceType && lastAutoSend > 0 && sendAmount !== lastAutoSend) ? lastAutoSend : null,
    dueAmount: dueAmount,
    fulfilment: document.getElementById('f-fulfilment').value,
    payShot,
    notes: document.getElementById('f-notes').value.trim(),
    lang: lang,
    source: 'customer',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Quotation mode: the cake spec & money come from the quote node, never
  // from form values the customer could edit.
  if (quoteToken && quoteData) {
    const qc = (Array.isArray(quoteData.cakes) ? quoteData.cakes : [])[0] || {};
    order.weight = order.weightLabel = String(qc.weightLabel || qc.weight || order.weight || '').trim();
    order.flavour = String(qc.flavour || order.flavour).trim();
    order.flavourName = String(qc.flavourName || order.flavourName).trim();
    order.cakePrice = order.basePrice = quoteTotalOf(quoteData);
    // Delivery is always part of the total — quote total = cake + delivery.
    order.subtotal = order.total = quoteTotalOf(quoteData) + ((quoteData.fulfilment === 'pickup') ? 0 : (Number(quoteData.deliveryCharge) || 0));
    if (quoteData.fulfilment === 'pickup') { order.fulfilment = 'pickup'; order.deliveryCharge = 0; }
    else { order.fulfilment = 'delivery'; order.deliveryCharge = Number(quoteData.deliveryCharge) || 0; }
    order.quoteToken = quoteToken;
  }

  showLoading(true);
  // The database requires a signed-in (anonymous) user — make sure the token
  // exists before writing so the order can never be silently rejected.
  const okAuth = window.ensureAuthReady ? await window.ensureAuthReady() : true;
  if (!okAuth) {
    showLoading(false);
    showToast(lang === 'en'
      ? 'Connection check failed — please reopen the page (or turn off the in-app browser).'
      : 'সংযোগ যাচাই করা যায়নি — পেজটা আবার খুলুন (হলে Facebook/Messenger-এর ভেতরের ব্রাউজার বন্ধ করে Chrome-এ খুলুন)।');
    return;
  }
  db.ref('orders').push(order).then(snap => {
    showLoading(false);
    if (order.quoteToken) {
      db.ref('quotes/' + order.quoteToken).update({ status: 'used', usedAt: Date.now(), usedOrderId: (snap && snap.key) || order.orderId }).catch(e => console.error(e));
    }
    try { fireNtfyAlert(order); } catch (_) {}
    showSuccess(order);
  }).catch(err => {
    showLoading(false);
    showToast('সমস্যা হয়েছে, আবার চেষ্টা করুন');
    console.error(err);
  });
}

// ─── Instant push alert on submit (independent safety channel) ──
// Publishes straight to the bakery's private ntfy.sh topic the moment the
// order is placed, so the owner's phone rings within seconds even when the
// admin app is fully CLOSED (ntfy app on Android/iOS). No Telegram, no
// account, no phone number involved.
function _escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
async function fireNtfyAlert(order) {
  if (!order) return;
  var FLAV_EN = {
    'vanilla-sponge':'Vanilla Sponge','chocolate-sponge':'Chocolate Sponge','double-layer-chocolate':'Double Layered Chocolate',
    'black-forest':'Black Forest','white-forest':'White Forest','lemon':'Lemon Cake','orange':'Orange Cake','strawberry':'Strawberry Cake',
    'blueberry':'Blueberry','malai':'Malai Cake','butterscotch':'Butterscotch Cake','special-vanilla':'Special Vanilla',
    'chocolate-mud':'Chocolate Mud Cake','red-velvet':'Red Velvet','cream-cheese-fruit':'Cream Cheese Fruit'
  };
  var MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  try {
    var r = await fetch('./notify-config.json?cb=' + Date.now());
    if (!r.ok) return;
    var cfg = await r.json();
    if (!cfg || !cfg.ntfyTopic) return;
    var server = (cfg.ntfyServer || 'https://ntfy.sh').replace(/\/+$/, '');
    var name  = order.customerName || order.name || 'Unknown';
    var w     = String(order.weightLabel || order.weight || '').trim();
    var flavN = order.flavourName || FLAV_EN[order.flavour] || '';
    var d     = String(order.deliveryDate || order.date || '').trim();
    var when  = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { var p = d.split('-'); when = (+p[2]) + ' ' + MO[(+p[1]) - 1] + ' ' + p[0]; }
    else if (d) { when = d; }
    var msg = (name) + ' just placed a ' + ((w ? w + ' ' : '') + (flavN || '') + ' cake').trim() +
              (when ? ' for ' + when : '') +
              (order.total ? '\n💰 Total: ৳' + Math.round(order.total) : '') +
              (order.advanceTotal ? '\n💳 Advance via ' + (order.advanceMethodName || order.advanceMethod || '—') + ': ৳' + Math.ceil(order.advanceTotal) : '') +
              (order.dueAmount > 0 ? '\n⚠️ Due: ৳' + Math.round(order.dueAmount) : '') +
              '\n🕐 Order ID: ' + (order.orderId || '');
    // Fire-and-forget with a short timeout — must never delay or block the customer's success screen.
    var ctl = new AbortController();
    setTimeout(function(){ ctl.abort(); }, 7000);
    fetch(server + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic:    cfg.ntfyTopic,
        title:    '🎂 নতুন অর্ডার: ' + name,
        message:  msg,
        priority: 4,   // 'high' — ntfy's JSON API wants an integer, not a string
        tags:     ['cake']
      }),
      signal: ctl.signal,
      keepalive: true
    }).catch(function(){});
  } catch (_) {}
}

// ─── Delivery time: auto-minutes + AM/PM ─────────────────────
// ─── Delivery time: auto-minutes + AM/PM ─────────────────────
function parseTimeParts(raw) {
  const t = String(raw || '').trim().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const m = t.match(/^(\d{1,2})(?:\s*[:.\-]\s*(\d{1,2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] != null ? parseInt(m[2], 10) : null;
  if (h < 1 || h > 12) return null;
  if (min != null && min > 59) return null;
  return { h, min };
}

function normalizeTimeInput() {
  const el = document.getElementById('f-timeslot');
  if (!el) return;
  const raw = el.value.trim();
  if (!raw) return;
  // If the customer typed AM/PM manually, drop it — there is a selector now
  const cleaned = raw.replace(/\s*(?:a\.?m\.?|p\.?m\.?|এএম|পিএম)\.?$/i, '').trim();
  const p = parseTimeParts(cleaned);
  if (!p) return; // leave as-is; validation will catch it
  // Minutes missing? Auto-set them to 00 (e.g. "3" or "3." -> "3.00")
  el.value = `${p.h}.${String(p.min == null ? 0 : p.min).padStart(2, '0')}`;
}

function getSelectedTime() {
  const p = parseTimeParts(document.getElementById('f-timeslot').value);
  const apEl = document.getElementById('f-time-ampm');
  const ap = apEl ? apEl.value : '';
  if (!p || !ap) return '';
  return `${p.h}:${String(p.min == null ? 0 : p.min).padStart(2, '0')} ${ap}`;
}

function getTimeError() {
  const raw = document.getElementById('f-timeslot').value.trim();
  const apEl = document.getElementById('f-time-ampm');
  const ap = apEl ? apEl.value : '';
  if (!raw && !ap) {
    return lang === 'en' ? 'Please enter the delivery time' : 'ডেলিভারির সময় দিন';
  }
  const cleaned = raw.replace(/\s*(?:a\.?m\.?|p\.?m\.?|এএম|পিএম)\.?$/i, '').trim();
  if (!parseTimeParts(cleaned)) {
    return lang === 'en'
      ? 'Enter a valid time like 3.00 (hour 1-12, minutes 0-59)'
      : 'সঠিক সময় লিখুন — যেমন 3.00 (ঘণ্টা ১-১২, মিনিট ০-৫৯)';
  }
  if (!ap) {
    return lang === 'en' ? 'Please select AM or PM' : 'AM অথবা PM নির্বাচন করুন';
  }
  return '';
}

// Success
function showSuccess(order) {
  document.getElementById('form-screen').classList.remove('active');
  document.getElementById('success-screen').classList.add('active');
  const summary = document.getElementById('order-summary');
  // Payment breakdown the way the customer reads it:
  //  কেকের মূল্য · ডেলিভারি চার্জ (approx if auto, else the confirmed figure)
  //  অগ্রিম / প্রদান (with channel: বিকাশ/নগদ/ব্যাংক) · বাকি (DC excluded).
  const dcAmt = Math.round(Number(order.deliveryAmount != null ? order.deliveryAmount : order.deliveryCharge) || 0);
  const isPickup = (order.fulfilment === 'pickup' || order.deliveryPaid === 'na');
  const fee = Math.round(Number(order.paymentCharges != null ? order.paymentCharges : order.bkashCharge) || 0);
  const sentTotal = Math.round(Number(order.advanceTotal != null ? order.advanceTotal : order.advance) || 0);
  const advCake = Math.max(0, sentTotal - fee);
  const dcCovered = (order.deliveryPaid === 'paid' && !isPickup) ? dcAmt : 0;
  const advTowardCake = Math.max(0, advCake - dcCovered);
  const cakePrice = Math.round(Number(order.cakePrice != null ? order.cakePrice : order.basePrice) || (order.total - dcAmt) || order.total || 0);
  const cakeDue = Math.max(0, cakePrice - advTowardCake);
  const methodName = order.paymentMethodName || order.advanceMethodName || '';
  const dcTxt = isPickup
    ? 'প্রযোজ্য নয় (সেল্ফ পিকআপ)'
    : (order.dcAuto ? `৳${dcAmt}/- (approx)` : `৳${dcAmt}/-`);
  summary.innerHTML = `
    <div class="row"><span>অর্ডার আইডি</span><span>${esc(order.orderId)}</span></div>
    <div class="row"><span>নাম</span><span>${esc(order.customerName)}</span></div>
    <div class="row"><span>ফোন</span><span>${esc(order.customerPhone)}</span></div>
    <div class="row"><span>কেক</span><span>${esc(order.weightLabel)} — ${esc(order.flavourName)}</span></div>
    ${order.writing ? `<div class="row"><span>কেকের লেখা</span><span>${esc(order.writing)}</span></div>` : ''}
    <div class="row"><span>তারিখ</span><span>${esc(fmtDate(order.deliveryDate))} · ${esc(order.timeSlotLabel)}</span></div>
    <div class="row"><span>ঠিকানা</span><span>${esc(order.deliveryAddress)}</span></div>
    <div class="row"><span>কেকের মূল্য</span><span>৳${cakePrice}</span></div>
    <div class="row"><span>ডেলিভারি চার্জ</span><span>${dcTxt}</span></div>
    <div class="row"><span>অগ্রিম / প্রদান</span><span style="color:var(--green)">৳${advTowardCake}${methodName ? ` (${esc(methodName)})` : ''}</span></div>
    ${cakeDue > 0 ? `<div class="due-alert">⚠️ বাকি: ৳${cakeDue} (ডেলিভারি চার্জ ছাড়া)</div>` : '<div class="due-alert" style="background:var(--green-light);border-color:var(--green);color:var(--green)">✅ পূর্ণ পেমেন্ট সম্পন্ন</div>'}
  `;

  // Manual flow: no auto-download, no auto-close popup. The customer takes a
  // screenshot of this summary and sends it to the Facebook page — the admin
  // rechecks everything and confirms the order. Once submitted, closing the
  // tab wipes all cached data automatically (see wipeOnTabClose).
  try { sessionStorage.setItem('nitu-order-submitted', '1'); } catch (e) {}
  window.addEventListener('pagehide', wipeOnTabClose);
}

function showAutoClosePopup() {
  const pop = document.getElementById('auto-close-pop');
  if (!pop) return;
  if (autoCloseTick) { clearInterval(autoCloseTick); autoCloseTick = null; }
  pop.classList.add('show');
  document.getElementById('auto-close-sec').textContent = '৫';
  let remain = 5;
  const secDisp = document.getElementById('auto-close-sec');
  autoCloseTick = setInterval(() => {
    remain--;
    if (remain <= 0) {
      clearInterval(autoCloseTick);
      autoCloseTick = null;
      hideAutoClosePopup();
      scheduleWindowClose();
      return;
    }
    secDisp.textContent = '৫৪৩২১'.charAt(5 - remain);
  }, 1000);
}

function hideAutoClosePopup() {
  const pop = document.getElementById('auto-close-pop');
  if (pop) pop.classList.remove('show');
}

function keepWindowOpen() {
  downloadPressed = true;
  if (autoCloseTick) { clearInterval(autoCloseTick); autoCloseTick = null; }
  hideAutoClosePopup();
  showToast('উইন্ডো খোলা রাখা হয়েছে');
}

// Download the order card as an image, then close the window + clear cache after 5 seconds
async function downloadOrderCard() {
  downloadPressed = true;
  if (autoCloseTick) { clearInterval(autoCloseTick); autoCloseTick = null; }
  hideAutoClosePopup();
  const summary = document.getElementById('order-summary');
  if (!window.html2canvas) { showToast('ডাউনলোড টুল লোড হয়নি'); return; }
  showToast('অর্ডার কার্ড তৈরি হচ্ছে...');
  try {
    const rect = summary.getBoundingClientRect();
    let scale = 2;
    // iOS Safari silently fails above ~16.7M canvas pixels — shrink scale to stay under it
    const MAX_AREA = 16777216;
    while (rect.width * scale * rect.height * scale > MAX_AREA && scale > 0.5) scale -= 0.25;
    const canvas = await html2canvas(summary, { backgroundColor: '#ffffff', scale, useCORS: true, logging: false });
    const fileName = `${orderIdForScreenshot()}.png`;

    if (canvas.toBlob) {
      canvas.toBlob(async (blob) => {
        if (!blob) { showToast('অর্ডার কার্ড তৈরিতে সমস্যা হয়েছে'); return; }
        const saved = await saveOrderCardToDevice(blob, fileName);
        if (saved === false) return; // user cancelled or download blocked — keep the window open
        showToast('ডাউনলোড শুরু হয়েছে');
        scheduleWindowClose();
      }, 'image/png');
    } else {
      // Very old browsers without toBlob
      const url = canvas.toDataURL('image/png');
      triggerAnchorDownload(url, fileName);
      scheduleWindowClose();
    }
  } catch (err) {
    console.error(err);
    showToast('ডাউনলোডে সমস্যা হয়েছে, আবার চেষ্টা করুন');
  }
}

async function saveOrderCardToDevice(blob, fileName) {
  // iOS Safari ignores <a download> — offer the native share sheet first ("Save Image" / share to Messenger)
  try {
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'নিতুর বেকারি অর্ডার' });
      return true;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return false; // user closed the share sheet
    // fall through to the direct-download fallback below
  }

  // Android / desktop / iOS fallback: real file download via blob URL
  const url = URL.createObjectURL(blob);
  triggerAnchorDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

function triggerAnchorDownload(url, fileName) {
  try {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch (err) { return false; }
}

// Submitted orders are wiped the moment the customer leaves this page — the
// order form and every cached artifact disappear when the tab closes, so the
// next visit always starts with a completely fresh form.
function wipeSubmittedData() {
  try {
    if ('caches' in window) { caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {}); }
    sessionStorage.clear();
    localStorage.clear();
  } catch (err) { /* storage may be unavailable in private mode */ }
}

function wipeOnTabClose() {
  try {
    if (sessionStorage.getItem('nitu-order-submitted') !== '1') return;
  } catch (err) { return; }
  wipeSubmittedData();
}

// Legacy name — now simply wipes the submitted data immediately.
function scheduleWindowClose() { wipeSubmittedData(); }

function orderIdForScreenshot() { return currentOrderId || 'nitu-bakery-order'; }

function resetForm() {
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
  if (autoCloseTick) { clearInterval(autoCloseTick); autoCloseTick = null; }
  downloadPressed = true;
  hideAutoClosePopup();
  document.getElementById('success-screen').classList.remove('active');
  document.getElementById('entry-screen').classList.remove('hidden');
  document.getElementById('form-screen').classList.remove('active');
  document.getElementById('previous-orders').classList.remove('show');
  document.getElementById('security-box').classList.remove('show');
  document.getElementById('entry-security').value = '';
  document.querySelectorAll('#form-screen input:not(#entry-phone), #form-screen textarea').forEach(el => el.value = '');
  document.querySelectorAll('#form-screen select').forEach(el => el.selectedIndex = 0);
  const tb = document.getElementById('f-terms');
  if (tb) tb.checked = false;
  const tbBox = document.getElementById('terms-box');
  if (tbBox) tbBox.classList.remove('error');
  // Delivery-charge estimate state back to blank/unlocked for the new order
  const rdci = document.getElementById('f-delivery-charge');
  if (rdci) { rdci.readOnly = false; rdci.disabled = false; rdci.classList.remove('locked-field'); }
  dcManuallySet = false;
  const rdn = document.getElementById('dc-note'); if (rdn) { rdn.style.display = 'none'; rdn.innerHTML = ''; }
  const rde = document.getElementById('dc-edit-btn'); if (rde) rde.style.display = 'none';
  currentPhotos = []; renderPhotos(); payShot = ''; renderPayShot(); advanceType = ''; lastAutoSend = 0; lastAutoBase = 0; isSurprise = false; cakeWritingNoticeShown = false;
  advanceMethod = '';
  flavourNoticeShown = false; // show the "exact flavour" notice again on a new order
  document.querySelectorAll('.adv-method-opt').forEach(el => el.classList.remove('active'));
  updateWritingCount();
  document.getElementById('calc-box').classList.remove('show');
  document.getElementById('due-field').classList.remove('show');
  document.getElementById('surprise-note').classList.remove('show');
  document.getElementById('payment-info').classList.remove('show');
  document.querySelectorAll('.advance-opt').forEach(el => { el.classList.remove('active', 'adv-locked'); el.style.opacity = ''; el.style.pointerEvents = ''; });
  // Cake kind back to "normal" + weight box unlocked & cleared
  cakeKind = 'normal';
  miniNoticeShown = false;
  miniPending = false;
  const wEl = document.getElementById('f-weight');
  if (wEl) { wEl.disabled = false; wEl.style.display = ''; wEl.classList.remove('locked-field'); }
  syncFullOnlyPayment();   // fresh form → 50% available again
  document.getElementById('entry-btn').textContent = 'অর্ডার শুরু করুন';
  document.getElementById('entry-btn').onclick = handleEntry;
  updateProgress();
}

// Helpers
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function showToast(msg) {
  const t = document.getElementById('toast');
  // Clear any previous timer so a rapid second toast isn't hidden early.
  clearTimeout(showToast._t);
  t.textContent = msg; t.classList.add('show');
  showToast._t = setTimeout(() => t.classList.remove('show'), 3000);
}
function showLoading(on) { document.getElementById('loading').classList.toggle('show', on); }
function fmtDate(s) {
  if (!s) return '';
  const MONTHS = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টে','অক্টো','নভে','ডিসে'];
  // input type=date gives YYYY-MM-DD; also tolerate other forms
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const yy = +m[1], mm = +m[2], dd = +m[3];
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) return `${dd} ${MONTHS[mm - 1]} ${yy}`; // date month year
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return s;
}
function setMinDate() {
  // Local date, NOT UTC. The old toISOString() version rolled over to
  // "tomorrow" after 18:00 in Bangladesh (UTC+6), blocking same-day orders
  // in the evening — exactly when customers order next-day cakes.
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  document.getElementById('f-date').setAttribute('min', today);
}

// Init
(function init() {
  populateDropdowns();
  // Load the admin's zone-price overrides once auth is ready so the read
  // passes the security rules (falls back to built-in prices otherwise).
  if (window.ensureAuthReady) { window.ensureAuthReady().then(loadDcConfig); } else { loadDcConfig(); }
  setLang(lang);
  const savedPhone = localStorage.getItem('nitu-cust-phone');
  if (savedPhone) document.getElementById('entry-phone').value = savedPhone;
  setMinDate();
  bootQuote();
})();
