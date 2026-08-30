
'use strict';

let lang = localStorage.getItem('nitu-cust-lang') || 'bn';
let currentPhotos = [];
let advanceType = '';
let isSurprise = false;
let currentSecurityQ = null;
let pendingPhone = '';
let currentOrderId = '';
let previousOrderHistory = [];
let previousOrderCursor = 0;
let cakeWritingNoticeShown = false;
let downloadPressed = false;
let autoCloseTimer = null;
let autoCloseTick = null;

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
      s.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 4]};` +
        `animation-duration:${(6 + Math.random() * 8).toFixed(1)}s;animation-delay:${(-Math.random() * 12).toFixed(1)}s;` +
        `opacity:${(.4 + Math.random() * .5).toFixed(2)}`;
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
      s.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 4]};` +
        `animation-duration:${(7 + Math.random() * 8).toFixed(1)}s;animation-delay:${(-Math.random() * 12).toFixed(1)}s;` +
        `opacity:${(.3 + Math.random() * .4).toFixed(2)}`;
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
    '#f-trx': 'Transaction ID / Last 3 Digits of Payment Number *', '#f-notes': 'Additional Info (Optional)'
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
  if (!currentSecurityQ) { askSecurityQuestion(); return; }
  await verifySecurity();
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
  currentSecurityQ = getSecurityQuestion();
  const label = document.getElementById('security-label');
  // Bind the answer to the displayed question so display & check can never mismatch
  label.dataset.answer = String(currentSecurityQ.a);
  label.textContent = (lang === 'en' ? 'Security question (anti-bot): ' : 'নিরাপত্তা প্রশ্ন (বট প্রতিরোধ): ') + currentSecurityQ.q;
  document.getElementById('security-box').classList.add('show');
  document.getElementById('entry-btn').textContent = '✓ যাচাই করুন';
  document.getElementById('entry-btn').onclick = verifySecurity;
}

async function verifySecurity() {
  const ans = Number(normalizeDigits(document.getElementById('entry-security').value));
  const expected = Number(currentSecurityQ ? currentSecurityQ.a : NaN);
  const err = document.getElementById('entry-error');
  if (!Number.isFinite(expected) || isNaN(ans) || ans !== expected) {
    err.textContent = 'ভুল উত্তর';
    err.classList.add('show');
    // New question
    askSecurityQuestion();
    document.getElementById('entry-security').value = '';
    return;
  }
  err.classList.remove('show');
  await loadPreviousOrders(pendingPhone);
  proceedToForm(pendingPhone);
}

async function trackOrder() {
  const orderId = document.getElementById('entry-order-id').value.trim().toUpperCase();
  if (!orderId) { showToast('অর্ডার নম্বর লিখুন'); return; }
  try {
    const snap = await db.ref('orders').orderByChild('orderId').equalTo(orderId).once('value');
    if (!snap.exists()) { showToast('অর্ডার পাওয়া যায়নি'); return; }
    const order = Object.values(snap.val())[0];
    document.getElementById('prev-title').textContent = 'আপনার অর্ডার';
    document.getElementById('prev-list').innerHTML = `<div class="previous-order"><strong>${esc(order.orderId)}</strong><br>মোট ৳${order.total || 0}<br>ডেলিভারি: ${esc(fmtDate(order.deliveryDate || ''))}</div>`;
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

// Payment change
function onPaymentChange() {
  const methodId = document.getElementById('f-payment-method').value;
  const info = document.getElementById('payment-info');
  const method = getPaymentMethod(methodId);
  if (method && method.number) {
    const copyField = (label, value) => `<div>${label}: <strong>${value}</strong> <button type="button" class="copy-button" onclick="copyValue('${value}')">কপি</button></div>`;
    const bank = methodId === 'bank' ? `${copyField('ব্যাংক', 'IFIC Bank')} ${copyField('শাখা', 'Amanbazar sub-branch')} ${copyField('রাউটিং', '120 153 224')} ${copyField('SWIFT', 'IFICBDDH')} ${copyField('অ্যাকাউন্টধারী', 'Sabrina Akter Bhuiyan')} ${copyField('যোগাযোগ', '01521400475')}` : '';
    info.innerHTML = `📱 <strong>${method.name}</strong>${copyField(methodId === 'bank' ? 'অ্যাকাউন্ট নম্বর' : 'নম্বর', method.number)}${methodId !== 'bank' ? copyField('নাম', method.regName || '') : ''}${bank}<br><small>${methodId === 'bkash' ? 'বিকাশ Send Money করুন। আপনার অগ্রিমের উপর ১.৮২% চার্জ যোগ হবে।' : methodId === 'nagad' ? 'নগদ Send Money করুন। আপনার অগ্রিমের উপর ১.৪৯% চার্জ যোগ হবে।' : 'পেমেন্টের বিস্তারিত যাচাই করা হবে।'}</small>`;
    info.classList.add('show');
  } else {
    info.classList.remove('show');
  }
  recalcPrice();
}

function copyValue(value) {
  navigator.clipboard.writeText(value).then(() => showToast('কপি হয়েছে'));
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

function setAdvanceType(type) {
  advanceType = type;
  document.querySelectorAll('.advance-opt').forEach(el => el.classList.remove('active'));
  document.getElementById('opt-' + type).classList.add('active');
  lastAutoSend = 0; lastAutoBase = 0;
  if (getOrderTotal() <= 0) document.getElementById('f-advance').value = '';
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
  const m = getPaymentMethod(document.getElementById('f-payment-method').value);
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

function recalcPrice(manualEdit) {
  const wtVal = document.getElementById('f-weight').value;
  const methodId = document.getElementById('f-payment-method').value;
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  const advInput = document.getElementById('f-advance');
  const typedSend = parseFloat(advInput.value) || 0;

  const wt = resolveWeight();
  if (!wt || cakePrice <= 0) {
    document.getElementById('calc-box').classList.remove('show');
    document.getElementById('due-field').classList.remove('show');
    document.getElementById('pay-footnote').classList.remove('show');
    return;
  }

  const rate = getGatewayRate();
  const delivery = document.getElementById('f-fulfilment').value === 'pickup' ? 0 : (parseFloat(document.getElementById('f-delivery-charge').value) || 0);
  const paymentMethod = getPaymentMethod(methodId);
  const total = cakePrice;

  let base, charge, sendAmount, isAuto = false;
  if (advanceType && !manualEdit) {
    // AUTO: base = chosen % of the cake price; send = base + gateway charge
    // (charge rounded up, e.g. 50% of ৳1000 via bKash → 500 + 10 = 510)
    isAuto = true;
    base = advanceType === '50' ? Math.round(cakePrice / 2) : Math.round(cakePrice);
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

  // Top calc box (cake price / delivery / total)
  document.getElementById('calc-base').textContent = '৳' + Math.round(total);
  document.getElementById('calc-delivery').textContent = '৳' + Math.round(delivery) + ' (আলাদা)';
  document.getElementById('calc-total').textContent = '৳' + Math.round(total);
  document.getElementById('calc-box').classList.add('show');

  // Due box — the auto-calculated rest, greyed out and read-only
  const dueField = document.getElementById('due-field');
  if (sendAmount > 0) {
    document.getElementById('f-due').value = '৳' + Math.round(due);
    const dueHint = document.getElementById('due-hint');
    if (due > 0) {
      dueHint.textContent = lang === 'en'
        ? `৳${Math.round(due)} left to pay later` + (delivery > 0 ? ` · delivery charge ৳${Math.round(delivery)} is separate` : '')
        : `বাকি ৳${Math.round(due)} পরে দিতে হবে` + (delivery > 0 ? ` · ডেলিভারি চার্জ ৳${Math.round(delivery)} আলাদা` : '');
    } else if (delivery > 0) {
      dueHint.textContent = lang === 'en' ? `Delivery charge ৳${Math.round(delivery)} is paid separately` : `ডেলিভারি চার্জ ৳${Math.round(delivery)} আলাদা`;
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

function parseWeightText(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const m = text.match(/([\d]+(?:\.\d+)?)\s*(kg|কেজি|kilos?|kilograms?|pounds?|lbs|lb|পাউন্ড)?/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (!num || num <= 0 || num > 200) return null;
  const isKg = /kg|কেজি|kilo/.test(m[2] || '');
  return { num, isKg };
}

function updateWeightHint() {
  const el = document.getElementById('weight-hint');
  const p = parseWeightText(document.getElementById('f-weight').value);
  if (!p) { el.textContent = ''; return; }
  el.textContent = p.isKg ? `≈ ${(p.num * 2.20462).toFixed(1)} pound+` : `≈ ${(p.num / 2.20462).toFixed(2)} KG`;
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

function setWeightPreset(kind, btn) {
  const p = WEIGHT_PRESETS[kind];
  if (!p) return;
  document.getElementById('f-weight').value = lang === 'en' ? p.fillEn : p.fill;
  document.querySelectorAll('.weight-preset').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateWeightHint();
  recalcPrice();
  updateProgress();
  showTextPopup(p.file, lang === 'en' ? p.titleEn : p.title);
}

document.getElementById('f-weight').addEventListener('input', function() {
  // Keep the quick-select highlight in sync when the user edits the box by hand
  if (!isPresetWeight(this.value)) document.querySelectorAll('.weight-preset').forEach(b => b.classList.remove('active'));
});

document.getElementById('f-weight').addEventListener('change', function() {
  if (parseWeightText(this.value)) showTextPopup('base price.txt', 'বেস মূল্য নির্দেশিকা');
});

function onFulfilmentChange() {
  const pickup = document.getElementById('f-fulfilment').value === 'pickup';
  document.getElementById('pickup-box').classList.toggle('show', pickup);
  document.getElementById('delivery-charge-field').style.display = pickup ? 'none' : 'block';
  if (!pickup) showDeliveryPopup();
  if (pickup) document.getElementById('f-delivery-charge').value = '';
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
    document.querySelectorAll('.advance-opt').forEach(el => el.style.opacity = '0.5');
    document.getElementById('opt-full').style.opacity = '1';
  } else {
    document.querySelectorAll('.advance-opt').forEach(el => el.style.opacity = '1');
  }
});

// Progress
function updateProgress() {
  const fields = ['f-name','f-weight','f-cake-price','f-flavour','f-address','f-date','f-timeslot','f-receiver','f-receiver-phone','f-payment-method','f-advance','f-trx'];
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

// Validate
function validate() {
  const req = [
    ['f-name', 'নাম দিন'], ['f-weight', 'ওজন নির্বাচন করুন'], ['f-cake-price', 'কেকের মূল্য দিন'], ['f-flavour', 'ফ্লেভার নির্বাচন করুন'],
    ['f-date', 'তারিখ দিন'],
    ['f-receiver', 'রিসিভারের নাম দিন'],
    ['f-receiver-phone', 'রিসিভারের ফোন দিন'],
    ['f-payment-method', 'পেমেন্ট পদ্ধতি নির্বাচন করুন'],
    ['f-advance', 'অগ্রিম পরিমাণ দিন'], ['f-trx', 'ট্রানজেকশন আইডি দিন']
  ];
  for (const [id, msg] of req) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { showToast(msg); el.focus(); return false; }
  }
  if (!resolveWeight()) { showToast('সঠিক ওজন লিখুন (যেমন: 2 pound বা 1 KG)'); return false; }
  if (document.getElementById('f-fulfilment').value === 'delivery' && !document.getElementById('f-address').value.trim()) { showToast('ঠিকানা দিন'); document.getElementById('f-address').focus(); return false; }
  if (!validateBangladeshPhone(document.getElementById('f-receiver-phone').value.trim())) {
    showToast('সঠিক রিসিভার ফোন দিন'); return false;
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
  return true;
}

function getOrderTotal() {
  const wt = resolveWeight();
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  if (!wt || cakePrice <= 0) return 0;
  return cakePrice;
}

// Submit
function submitOrder() {
  if (!validate()) return;

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
  const subtotal = cakePrice;
  const total = cakePrice;
  const advanceTotal = Math.round(sendAmount);
  const dueAmount = Math.max(0, subtotal - advance);

  const order = {
    orderId: currentOrderId || generateOrderId(),
    customerPhone: phone,
    customerName: customerName,
    category: 'custom',
    categoryName: 'কাস্টম কেক',
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
    basePrice: cakePrice,
    weightPrice: 0,
    cakePrice: cakePrice,
    deliveryCharge: delivery,
    paymentCharges: charge,
    subtotal: subtotal,
    total: total,
    advance: advance,
    advanceTotal: advanceTotal,
    advanceCharge: charge,
    advanceAutoTotal: (advanceType && lastAutoSend > 0 && sendAmount !== lastAutoSend) ? lastAutoSend : null,
    dueAmount: dueAmount,
    fulfilment: document.getElementById('f-fulfilment').value,
    trx: document.getElementById('f-trx').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    lang: lang,
    source: 'customer',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  showLoading(true);
  db.ref('orders').push(order).then(() => {
    showLoading(false);
    try { fireTelegramAlert(order); } catch (_) {}
    showSuccess(order);
  }).catch(err => {
    showLoading(false);
    showToast('সমস্যা হয়েছে, আবার চেষ্টা করুন');
    console.error(err);
  });
}

// ─── Instant Telegram alert on submit (independent safety channel) ──
function _tgEscape(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
async function fireTelegramAlert(order) {
  if (!order) return;
  var FLAV_EN = {
    'vanilla-sponge':'Vanilla Sponge','chocolate-sponge':'Chocolate Sponge','double-layer-chocolate':'Double Layered Chocolate',
    'black-forest':'Black Forest','white-forest':'White Forest','lemon':'Lemon Cake','orange':'Orange Cake','strawberry':'Strawberry Cake',
    'blueberry':'Blueberry','malai':'Malai Cake','butterscotch':'Butterscotch Cake','special-vanilla':'Special Vanilla',
    'chocolate-mud':'Chocolate Mud Cake','red-velvet':'Red Velvet','cream-cheese-fruit':'Cream Cheese Fruit'
  };
  var MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  try {
    var r = await fetch('./telegram-config.json?cb=' + Date.now());
    if (!r.ok) return;
    var cfg = await r.json();
    if (!cfg || !cfg.botToken || !cfg.chatId) return;
    var name  = order.customerName || order.name || 'Unknown';
    var w     = String(order.weightLabel || order.weight || '').trim();
    var flavN = order.flavourName || FLAV_EN[order.flavour] || '';
    var d     = String(order.deliveryDate || order.date || '').trim();
    var when  = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { var p = d.split('-'); when = (+p[2]) + ' ' + MO[(+p[1]) - 1] + ' ' + p[0]; }
    else if (d) { when = d; }
    var msg = '🎂 ' + _tgEscape(name) + ' just placed a ' + _tgEscape((w ? w + ' ' : '') + (flavN || '') + ' cake').trim() +
              (when ? ' for ' + _tgEscape(when) : '') +
              (order.total ? '\n💰 Total: ৳' + Math.round(order.total) : '') +
              '\n🕐 Order ID: ' + _tgEscape(order.orderId || '');
    // Fire-and-forget with a short timeout — must never delay or block the customer's success screen.
    var ctl = new AbortController();
    setTimeout(function(){ ctl.abort(); }, 7000);
    fetch('https://api.telegram.org/bot' + cfg.botToken + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chatId, text: msg }),
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
  summary.innerHTML = `
    <div class="row"><span>অর্ডার আইডি</span><span>${esc(order.orderId)}</span></div>
    <div class="row"><span>নাম</span><span>${esc(order.customerName)}</span></div>
    <div class="row"><span>ফোন</span><span>${esc(order.customerPhone)}</span></div>
    <div class="row"><span>কেক</span><span>${esc(order.weightLabel)} — ${esc(order.flavourName)}</span></div>
    ${order.writing ? `<div class="row"><span>কেকের লেখা</span><span>${esc(order.writing)}</span></div>` : ''}
    <div class="row"><span>তারিখ</span><span>${esc(fmtDate(order.deliveryDate))} · ${esc(order.timeSlotLabel)}</span></div>
    <div class="row"><span>ঠিকানা</span><span>${esc(order.deliveryAddress)}</span></div>
    <div class="row"><span>মোট (আনুমানিক)</span><span>৳${Math.round(order.total)}</span></div>
    <div class="row"><span>প্রদান</span><span style="color:var(--green)">৳${Math.round(order.advanceTotal)}</span></div>
    ${order.dueAmount > 0 ? `<div class="due-alert">⚠️ বাকি: ৳${Math.round(order.dueAmount)}${order.deliveryCharge > 0 ? `<br>🚚 ডেলিভারি চার্জ (আলাদা): ৳${Math.round(order.deliveryCharge)}` : ''}</div>` : '<div class="due-alert" style="background:var(--green-light);border-color:var(--green);color:var(--green)">✅ পূর্ণ পেমেন্ট সম্পন্ন</div>'}
  `;

  // Start a 5-second timer after submitting. If the customer hasn't tapped Download
  // by then, show the auto-close popup. (Downloading simply cancels this timer — the
  // window will then close on its own after the download completes via scheduleWindowClose.)
  downloadPressed = false;
  if (autoCloseTimer) clearTimeout(autoCloseTimer);
  autoCloseTimer = setTimeout(() => {
    autoCloseTimer = null;
    if (downloadPressed) return;
    showAutoClosePopup();
  }, 5000);
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

function scheduleWindowClose() {
  setTimeout(async () => {
    // Clear every cached artifact first so nothing survives a reload either
    try {
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(key => caches.delete(key))); }
      sessionStorage.clear();
      localStorage.clear();
    } catch (err) { /* storage may be unavailable in private mode */ }

    // Close the entire tab/window (works when this page was opened by a script or another window)
    window.open('', '_self');
    window.close();

    // If the browser refuses to close the tab, fall back to a clean fresh load
    setTimeout(() => {
      if (!window.closed) window.location.replace(window.location.href.split('#')[0]);
    }, 500);
  }, 5000);
}

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
  currentPhotos = []; renderPhotos(); advanceType = ''; lastAutoSend = 0; lastAutoBase = 0; isSurprise = false; cakeWritingNoticeShown = false;
  updateWritingCount();
  document.getElementById('calc-box').classList.remove('show');
  document.getElementById('due-field').classList.remove('show');
  document.getElementById('surprise-note').classList.remove('show');
  document.getElementById('payment-info').classList.remove('show');
  document.querySelectorAll('.advance-opt').forEach(el => { el.classList.remove('active'); el.style.opacity = '1'; });
  document.querySelectorAll('.weight-preset').forEach(el => el.classList.remove('active'));
  document.getElementById('entry-btn').textContent = 'অর্ডার শুরু করুন';
  document.getElementById('entry-btn').onclick = handleEntry;
  updateProgress();
}

// Helpers
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
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
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-date').setAttribute('min', today);
}

// Init
(function init() {
  populateDropdowns();
  setLang(lang);
  const savedPhone = localStorage.getItem('nitu-cust-phone');
  if (savedPhone) document.getElementById('entry-phone').value = savedPhone;
  setMinDate();
})();
