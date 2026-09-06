
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
let advanceMethod = ''; // gateway used to send the advance: bkash | nagad | bank
let downloadPressed = false;
let autoCloseTimer = null;
let autoCloseTick = null;
let flavourNoticeShown = false;
let cakeCount = 1;            // how many cakes (1-5)
let extraPhotos = {};         // { [i]: [photos] } for cakes 2-5 // "select the exact flavour" notice — once per session

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
  const pm = document.getElementById('f-payment-method');
  if (pm) {
    PAYMENT_METHODS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = lang === 'en' ? p.nameEn : p.name;
      pm.appendChild(opt);
    });
  }
}

// Language
function setLang(l) {
  lang = l;
  localStorage.setItem('nitu-cust-lang', l);
  const langBn = document.getElementById('lang-bn');
  const langEn = document.getElementById('lang-en');
  if (langBn) langBn.classList.toggle('active', l === 'bn');
  if (langEn) langEn.classList.toggle('active', l === 'en');
  document.documentElement.lang = l;
  document.querySelectorAll('[data-bn][data-en]').forEach(el => {
    el.textContent = l === 'en' ? el.dataset.en : el.dataset.bn;
  });
  renderCakeColumns();
  const labelMap = l === 'en' ? {
    'f-address': 'Delivery Address *',
    'f-receiver': 'Receiver Name *',
    'f-receiver-phone': 'Receiver Phone *',
    'f-date': 'Delivery Date *',
    'f-timeslot': 'Delivery Time *',
    'f-alt-phone': 'Alternate phone number',
    'f-surprise': 'Surprise Cake?',
    'f-fulfilment': 'Fulfilment type *',
    'f-payment-method': 'Payment Method *',
    'f-trx': 'Transaction ID / Last 3 Digits of Payment Number *',
    'f-notes': 'Additional Info (Optional)'
  } : {};
  Object.entries(labelMap).forEach(([id, text]) => {
    const field = document.getElementById(id);
    if (field && field.parentElement) {
      const lab = field.parentElement.querySelector('label');
      if (lab) lab.textContent = text;
    }
  });
  if (l === 'en') {
    const cp = document.getElementById('f-cake-price'); if (cp) cp.placeholder = 'Enter cake price';
    const ts = document.getElementById('f-timeslot'); if (ts) ts.placeholder = 'Example: 3.00';
    const pmSel = document.getElementById('f-payment-method');
    if (pmSel) { const d = pmSel.querySelector('option[value=""]'); if (d) d.textContent = 'Select payment method'; }
    const ful = document.getElementById('f-fulfilment');
    if (ful) {
      const d2 = ful.querySelector('option[value="delivery"]'); if (d2) d2.textContent = 'Deliveryman';
      const d3 = ful.querySelector('option[value="pickup"]'); if (d3) d3.textContent = 'Self pickup';
    }
  } else {
    const cp = document.getElementById('f-cake-price'); if (cp) cp.placeholder = 'কেকের মূল্য লিখুন';
    const ts = document.getElementById('f-timeslot'); if (ts) ts.placeholder = 'যেমন: 3.00';
    const ts2 = document.getElementById('f-timeslot-2'); if (ts2) ts2.placeholder = 'যেমন: 3.00';
  }
}
// ─── Multi-cake state & helpers ─────────────────────────────────
const MAX_CAKES = 5;
const BN_CAKE_DIGITS = ['', '১', '২', '৩', '৪', '৫'];
function bnCake(n) { return BN_CAKE_DIGITS[n] || String(n); }
function cakeEl(kind, i) { return document.getElementById(kind + '-' + i); }
function weightEl(i)     { return cakeEl('f-weight', i); }
function weightHintEl(i) { return cakeEl('weight-hint', i); }
function flavourEl(i)    { return cakeEl('f-flavour', i); }
function writingEl(i)    { return cakeEl('f-writing', i); }
function writingCountEl(i){ return cakeEl('writing-count', i); }
function photoNoteEl(i)  { return cakeEl('f-photo-note', i); }
function photoGridEl(i)  { return cakeEl('photo-grid', i); }
function timeSlotEl(i)   { return document.getElementById(i === 1 ? 'f-timeslot' : 'f-timeslot-' + i); }
// ─── Order mode toggle (Single / Multiple) ─────────────────────
function setOrderMode(mode) {
  document.getElementById('mode-single').classList.toggle('active', mode === 'single');
  document.getElementById('mode-multiple').classList.toggle('active', mode === 'multiple');
  const picker = document.getElementById('cake-count-picker');
  if (mode === 'single') {
    picker.classList.remove('show');
    setCakeCount(1);
  } else {
    picker.classList.add('show');
    if (cakeCount < 2) setCakeCount(2);
  }
}

function setCakeCount(n) {
  n = Math.max(1, Math.min(MAX_CAKES, parseInt(n, 10) || 1));
  cakeCount = n;
  for (let i = 2; i <= MAX_CAKES; i++) {
    const btn = document.getElementById('cc-btn-' + i);
    if (btn) btn.classList.toggle('active', i === n);
  }
  renderCakeColumns();
  updateProgress();
}

// Render cake 1 & 2 side-by-side, then 3 & 4, then 5
function renderCakeColumns() {
  const container = document.getElementById('cake-columns-container');
  if (!container) return;
  const saved = {};
  const photosSaved = {};
  for (let i = 1; i <= MAX_CAKES; i++) {
    saved[i] = {
      weight: weightEl(i) ? weightEl(i).value : '',
      flavour: flavourEl(i) ? flavourEl(i).value : '',
      writing: writingEl(i) ? writingEl(i).value : '',
      photoNote: photoNoteEl(i) ? photoNoteEl(i).value : ''
    };
  }
  for (let k in extraPhotos) photosSaved[k] = extraPhotos[k].slice();
  const cake1Photos = currentPhotos.slice();

  let html = '';
  html += '<div class="cake-row">' + cakeColumnHtml(1);
  if (cakeCount >= 2) html += cakeColumnHtml(2);
  html += '</div>';
  for (let i = 3; i <= cakeCount; i += 2) {
    const second = i + 1 <= cakeCount;
    html += '<div class="cake-row">' + cakeColumnHtml(i) + (second ? cakeColumnHtml(i + 1) : '') + '</div>';
  }
  container.innerHTML = html;

  currentPhotos = cake1Photos;
  for (let k in photosSaved) extraPhotos[k] = photosSaved[k];

  for (let i = 1; i <= cakeCount; i++) {
    const sv = saved[i] || {};
    if (sv.weight) weightEl(i).value = sv.weight;
    if (sv.writing) writingEl(i).value = sv.writing;
    if (sv.photoNote) photoNoteEl(i).value = sv.photoNote;
    populateFlavourDropdown(i);
    if (sv.flavour) flavourEl(i).value = sv.flavour;
    wireWeightEvents(i);
    updateWeightHint(i);
    updateWritingCount(i);
    renderPhotos(i);
  }
  syncCake2DeliveryBlocks();
  reconnectDeliveryListeners();
  updateProgress();
}
function cakeColumnHtml(i) {
  const isBn = lang !== 'en';
  const p = (bn, en) => isBn ? bn : en;
  const num = bnCake(i);
  const single = '-' + i;
  return ''
    + '<div class="cake-col">'
    + '<div class="col-header">🎂 ' + p('কেক ' + num, 'Cake ' + num) + '</div>'
    + '<div class="form-group">'
    + '<label>' + p('ওজন * (পাউন্ড বা KG)', 'Weight * (pound or KG)') + '</label>'
    + '<input type="text" id="f-weight' + single + '" placeholder="' + p('যেমন: 2 pound, 1 KG', 'e.g. 2 pound, 1 KG') + '" autocomplete="off" oninput="updateWeightHint(' + i + ');recalcPrice()" onchange="maybeAskWeightUnit(' + i + ')">'
    + '<div class="weight-presets">'
    + '<button type="button" class="weight-preset weight-preset' + single + '" onclick="setWeightPreset(\'mini\', this, ' + i + ')">🍰 ' + p('মিনি কেক', 'Mini') + '</button>'
    + '<button type="button" class="weight-preset weight-preset' + single + '" onclick="setWeightPreset(\'medium\', this, ' + i + ')">🎂 ' + p('মিডিয়াম কেক', 'Medium') + '</button>'
    + '</div>'
    + '<div class="hint-box" id="weight-hint' + single + '"></div>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>' + p('ফ্লেভার *', 'Flavour *') + '</label>'
    + '<select id="f-flavour' + single + '" onfocus="showFlavourNotice(' + i + ')"><option value="">' + p('নির্বাচন করুন', 'Select flavour') + '</option></select>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>' + p('কেকে কী লিখবেন? (ঐচ্ছিক)', 'Cake writing (Optional)') + '</label>'
    + '<textarea id="f-writing' + single + '" rows="2" oninput="updateWritingCount(' + i + ');updateProgress()" onfocus="showCakeWritingNotice()"></textarea>'
    + '<div id="writing-count' + single + '" style="font-size:10.5px;color:var(--text3);text-align:right;margin-top:3px">0 / 500</div>'
    + '</div>'
    + '<div class="form-group">'
    + '<label>' + p('রেফারেন্স ছবি (ঐচ্ছিক)', 'Reference Photo (Optional)') + '</label>'
    + '<input type="file" id="f-photo' + single + '" accept="image/*" multiple style="display:none" onchange="handlePhoto(event, ' + i + ')">'
    + '<div class="photo-upload" onclick="document.getElementById(\'f-photo' + single + '\').click()">📎<div>' + p('ছবি আপলোড', 'Upload photo') + '</div></div>'
    + '<div class="photo-grid" id="photo-grid' + single + '"></div>'
    + '<label style="font-size:11px;color:var(--text3);margin-top:6px">' + p('ছবির নোট (ঐচ্ছিক)', 'Photo Note (Optional)') + '</label>'
    + '<textarea id="f-photo-note' + single + '" rows="2"></textarea>'
    + '</div>'
    + '</div>';
}

function populateFlavourDropdown(i) {
  const sel = flavourEl(i);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">' + (lang === 'en' ? 'Select flavour' : 'নির্বাচন করুন') + '</option>';
  FLAVOURS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.value;
    opt.textContent = lang === 'en' ? f.labelEn : f.label;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

function wireWeightEvents(i) {
  const el = weightEl(i);
  if (!el) return;
  el.addEventListener('input', function () {
    document.querySelectorAll('.weight-preset' + (i === 1 ? '' : '-' + i)).forEach(b => b.classList.remove('active'));
  });
  el.addEventListener('change', function () {
    const raw = (el.value || '').trim();
    if (isBareNumberWeight(raw)) { maybeAskWeightUnit(i); return; }
    if (parseWeightText(raw)) showTextPopup('base price.txt', 'বেস মূল্য নির্দেশিকা');
  });
}
// ─── Same-as-cake-1 delivery toggles ───────────────────────────
function syncCake2DeliveryBlocks() {
  const ids = ['cake2-address-block', 'cake2-receiver-block', 'cake2-phone-block',
               'cake2-date-block', 'cake2-time-block', 'cake2-charge-block'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && cakeCount < 2) el.classList.add('field-hidden');
  });
  if (cakeCount >= 2) {
    toggleCake2('same-address-check', 'cake2-address-block', true);
    toggleCake2('same-receiver-check', 'cake2-receiver-block', true);
    toggleCake2('same-phone-check', 'cake2-phone-block', true);
    toggleCake2('same-date-check', 'cake2-date-block', true);
    toggleCake2('same-time-check', 'cake2-time-block', true);
    toggleCake2('same-charge-check', 'cake2-charge-block', true);
  }
}
function toggleCake2(checkId, blockId, isSame) {
  const check = document.getElementById(checkId);
  const block = document.getElementById(blockId);
  if (!check || !block) return;
  const hide = isSame ? check.checked : !check.checked;
  block.classList.toggle('field-hidden', hide);
}
function toggleSameAddress() { toggleCake2('same-address-check', 'cake2-address-block', true); updateProgress(); }
function toggleSameReceiver() { toggleCake2('same-receiver-check', 'cake2-receiver-block', true); updateProgress(); }
function toggleSamePhone()    { toggleCake2('same-phone-check', 'cake2-phone-block', true);    updateProgress(); }
function toggleSameDate()     { toggleCake2('same-date-check', 'cake2-date-block', true);      updateProgress(); }
function toggleSameTime()     { toggleCake2('same-time-check', 'cake2-time-block', true);      updateProgress(); }
function toggleSameCharge()   { toggleCake2('same-charge-check', 'cake2-charge-block', true);  recalcPrice(); }
function toggleAltPhone() {
  const check = document.getElementById('alt-phone-check');
  const block = document.getElementById('alt-phone-block');
  if (check && block) block.classList.toggle('field-hidden', !check.checked);
}

function onReceiverSameCust(idx) {
  idx = idx || 1;
  const cb = document.getElementById(idx === 1 ? 'receiver-same-cust' : 'receiver-same-cust-' + idx);
  const phone = document.getElementById(idx === 1 ? 'f-receiver-phone' : 'f-receiver-phone-' + idx);
  if (!cb || !phone) return;
  if (cb.checked) {
    const myNum = pendingPhone || localStorage.getItem('nitu-cust-phone') || '';
    phone.value = myNum;
    phone.readOnly = true;
  } else {
    phone.readOnly = false;
    phone.value = '';
  }
  updateProgress();
}

function reconnectDeliveryListeners() {
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onchange = fn; };
  bind('same-address-check', toggleSameAddress);
  bind('same-receiver-check', toggleSameReceiver);
  bind('same-phone-check', toggleSamePhone);
  bind('same-date-check', toggleSameDate);
  bind('same-time-check', toggleSameTime);
  bind('same-charge-check', toggleSameCharge);
  bind('alt-phone-check', toggleAltPhone);
  bind('receiver-same-cust', function () { onReceiverSameCust(1); });
  bind('receiver-same-cust-2', function () { onReceiverSameCust(2); });
}

// ─── Weight-unit popup (POUND / KG) ─────────────────────────────
let weightUnitTarget = null;

function isBareNumberWeight(raw) {
  const norm = String(raw || '').trim().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).toLowerCase();
  return /^\d+(?:\.\d+)?$/.test(norm);
}

function maybeAskWeightUnit(i) {
  const el = weightEl(i);
  if (!el) return;
  const raw = (el.value || '').trim();
  if (!raw || isPresetWeight(raw) || !isBareNumberWeight(raw)) return;
  weightUnitTarget = i;
  const norm = raw.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  document.getElementById('weight-unit-msg').textContent = lang === 'en'
    ? 'You typed ' + norm + ' — is that ' + norm + ' POUND or ' + norm + ' KG?'
    : 'আপনি ' + norm + ' লিখেছেন — এটি কি ' + norm + ' পাউন্ড, নাকি ' + norm + ' KG?';
  document.getElementById('weight-unit-popup').classList.add('show');
}

function chooseWeightUnit(unit) {
  if (weightUnitTarget == null) return;
  const i = weightUnitTarget;
  const el = weightEl(i);
  const norm = (el.value || '').trim().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const m = norm.match(/^(\d+(?:\.\d+)?)$/);
  if (m) {
    el.value = unit === 'kg' ? m[1] + ' KG' : m[1] + ' pound';
    updateWeightHint(i);
  }
  weightUnitTarget = null;
  document.getElementById('weight-unit-popup').classList.remove('show');
  recalcPrice(); updateProgress();
}

function closeWeightUnitPopup(event) {
  const pop = document.getElementById('weight-unit-popup');
  if (event && event.target !== pop) return;
  pop.classList.remove('show'); weightUnitTarget = null;
}

// ─── Mini cake → 100% advance popup ────────────────────────────
function openMiniAdvancePopup() { document.getElementById('mini-advance-popup').classList.add('show'); }
function closeMiniAdvancePopup() { document.getElementById('mini-advance-popup').classList.remove('show'); }
function timeAmpmEl(i)   { return document.getElementById(i === 1 ? 'f-time-ampm' : 'f-time-ampm-' + i); }
function photosFor(i)    { return i === 1 ? currentPhotos : (extraPhotos[i] || []); }
function cakeWeightText(i) {
  const el = weightEl(i);
  return el ? (el.value || '').trim() : '';
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

async function handlePhoto(e, idx) {
  idx = idx || 1;
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  const store = idx === 1 ? currentPhotos : (extraPhotos[idx] = extraPhotos[idx] || []);
  const slots = MAX_PHOTOS - store.length;
  if (slots <= 0) { showToast(`সর্বোচ্চ ${MAX_PHOTOS}টি ছবি দেওয়া যাবে`); return; }
  if (files.length > slots) showToast(`প্রথম ${slots}টি ছবি নেওয়া হলো`);
  for (const file of files.slice(0, slots)) {
    if (file.size > 5 * 1024 * 1024) { showToast(`${file.name || 'ছবি'}: ৫MB এর কম হতে হবে`); continue; }
    try { store.push(await compressImage(file)); } catch (_) { showToast('ছবি লোড করা যায়নি'); }
  }
  renderPhotos(idx);
}

function renderPhotos(i) {
  i = i || 1;
  const grid = photoGridEl(i);
  if (!grid) return;
  const store = photosFor(i);
  grid.innerHTML = store.map((src, idx) => `
    <div class="photo-thumb">
      <img src="${src}" alt="">
      <button type="button" class="photo-remove" onclick="removePhoto(${idx}, ${i})">✕</button>
    </div>`).join('');
}

function removePhoto(i, idx) {
  idx = idx || 1;
  const store = idx === 1 ? currentPhotos : (extraPhotos[idx] || []);
  store.splice(i, 1);
  renderPhotos(idx);
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
  // Keep the "How did you pay?" mirror in sync if the select was changed
  // manually (the select remains the source of truth for the charge).
  if (advanceMethod && methodId && advanceMethod !== methodId) {
    advanceMethod = methodId;
    document.querySelectorAll('.adv-method-opt').forEach(el => el.classList.remove('active'));
    const gridOpt = document.getElementById('adv-opt-' + methodId);
    if (gridOpt) gridOpt.classList.add('active');
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

// ─── "Select the exact flavour" notice ──────────────────────
// Customers often pick a pricier flavour than the one discussed in the
// Facebook chat (e.g. Chocolate Sponge agreed, Chocolate Mud selected),
// forcing a price re-negotiation afterwards. A single friendly popup on the
// first tap of the flavour dropdown reminds them to match the chat. Full
// flavour details stay available via the ❗ button and the link in the popup.
function showFlavourNotice(i) {
  if (flavourNoticeShown) return; // only once per session
  flavourNoticeShown = true;
  // Close the native dropdown picker so the notice is read first
  const sel = i ? flavourEl(i) : document.getElementById('f-flavour');
  if (sel) sel.blur();
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

function updateWritingCount(i) {
  i = i || 1;
  const el = writingEl(i);
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
  const counter = writingCountEl(i);
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
  const price = parseFloat(document.getElementById('f-cake-price').value) || 0;
  if (price <= 0) document.getElementById('f-advance').value = '';
  // Ask HOW the advance is being sent (bKash/Nagad/Bank) before calculating
  // the charge-inclusive amount. The chooser popup opens right away.
  if (!advanceMethod) {
    openAdvanceMethodPopup();
    return;
  }
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

// ─── "How did you pay?" gateway chooser ──────────────────────
// Auto-opens as a popup right after an advance option (50%/100%) is tapped,
// and is mirrored as a field above the amount box so it can be changed.
// bKash/Nagad add their cash-out % on top of the advance (shown in the
// amount box); Bank adds nothing. Saved with the order on submit.
function openAdvanceMethodPopup() {
  document.getElementById('adv-method-popup').classList.add('show');
}

function closeAdvanceMethodPopup(event) {
  const pop = document.getElementById('adv-method-popup');
  if (event && event.target !== pop) return; // only the overlay itself or the X
  pop.classList.remove('show');
}

function chooseAdvanceMethod(id) {
  const m = getPaymentMethod(id);
  if (!m) return;
  advanceMethod = id;
  document.getElementById('adv-method-popup').classList.remove('show');
  document.querySelectorAll('.adv-method-opt').forEach(el => el.classList.remove('active'));
  const gridOpt = document.getElementById('adv-opt-' + id);
  if (gridOpt) gridOpt.classList.add('active');
  // Keep the gateway select (number/name shown to the customer) in sync —
  // its rate is what recalcPrice adds on top of the advance, and submitting
  // needs the select filled anyway.
  const sel = document.getElementById('f-payment-method');
  if (sel.value !== id) { sel.value = id; onPaymentChange(); }
  if (advanceType) recalcPrice();
  updateProgress();
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
  const methodId = document.getElementById('f-payment-method').value;
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  const advInput = document.getElementById('f-advance');
  const typedSend = parseFloat(advInput.value) || 0;

  // The payment preview depends ONLY on the cake price — not on the weight
  // field — so the auto-count works as soon as the customer types a price,
  // even if the details section above is still empty.
  if (cakePrice <= 0) {
    document.getElementById('calc-box').classList.remove('show');
    document.getElementById('due-field').classList.remove('show');
    document.getElementById('pay-footnote').classList.remove('show');
    return;
  }

  const rate = getGatewayRate();
  const delivery = document.getElementById('f-fulfilment').value === 'pickup' ? 0 : getTotalDeliveryCharge();
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

function resolveWeight(i) {
  i = i || 1;
  const raw = cakeWeightText(i);
  if (!raw) return null;
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

function updateWeightHint(i) {
  i = i || 1;
  const el = weightHintEl(i);
  if (!el) return;
  const p = parseWeightText(weightEl(i).value || '');
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

function setWeightPreset(kind, btn, i) {
  i = i || 1;
  const p = WEIGHT_PRESETS[kind];
  if (!p) return;
  const el = weightEl(i);
  el.value = lang === 'en' ? p.fillEn : p.fill;
  document.querySelectorAll('.weight-preset' + (i === 1 ? '' : '-' + i)).forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateWeightHint(i);
  recalcPrice();
  updateProgress();
  showTextPopup(p.file, lang === 'en' ? p.titleEn : p.title);
  // Mini cake requires 100% advance — auto-select full payment + notify
  if (kind === 'mini') {
    setAdvanceType('full');
    openMiniAdvancePopup();
  }
}
// Total delivery charge = cake 1 charge + cake 2 charge (unless "same")
function getTotalDeliveryCharge() {
  let total = parseFloat(document.getElementById('f-delivery-charge').value) || 0;
  if (cakeCount >= 2) {
    const sc = document.getElementById('same-charge-check');
    const sameCharge = sc ? sc.checked : true;
    if (!sameCharge) {
      const el2 = document.getElementById('f-delivery-charge-2');
      if (el2) total += parseFloat(el2.value) || 0;
    }
  }
  return total;
}



function onFulfilmentChange() {
  const pickup = document.getElementById('f-fulfilment').value === 'pickup';
  document.getElementById('pickup-box').classList.toggle('show', pickup);
  document.getElementById('delivery-charge-field').style.display = pickup ? 'none' : 'block';
  const c2 = document.getElementById('delivery-charge2-field');
  if (c2) c2.style.display = pickup ? 'none' : 'block';
  if (!pickup) showDeliveryPopup();
  if (pickup) {
    const dc = document.getElementById('f-delivery-charge'); if (dc) dc.value = '';
    const dc2 = document.getElementById('f-delivery-charge-2'); if (dc2) dc2.value = '';
    document.getElementById('f-address').value = 'Rongdhonu apartment, Khoshalshah road, Amanbazar, Hathazari Road, Chattogram';
    const a2 = document.getElementById('f-address-2'); if (a2) a2.value = 'Rongdhonu apartment, Khoshalshah road, Amanbazar, Hathazari Road, Chattogram';
  }
  document.getElementById('f-address').required = !pickup;
  const a2b = document.getElementById('f-address-2'); if (a2b) a2b.required = !pickup;
  recalcPrice();
  updateProgress();
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
  const fields = ['f-name', 'f-cake-price', 'f-date', 'f-payment-method', 'f-advance', 'f-trx',
                  'f-address', 'f-receiver', 'f-receiver-phone'];
  for (let i = 1; i <= cakeCount; i++) {
    fields.push('f-weight-' + i, 'f-flavour-' + i, 'f-writing-' + i);
  }
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
    ['f-name', 'নাম দিন'], ['f-cake-price', 'কেকের মূল্য দিন'],
    ['f-date', 'তারিখ দিন'],
    ['f-payment-method', 'পেমেন্ট পদ্ধতি নির্বাচন করুন'],
    ['f-advance', 'অগ্রিম পরিমাণ দিন'], ['f-trx', 'ট্রানজেকশন আইডি দিন']
  ];
  for (const [id, msg] of req) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { showToast(msg); el.focus(); return false; }
  }
  const isPickup = document.getElementById('f-fulfilment').value === 'pickup';
  // Each cake: weight + flavour + writing
  for (let i = 1; i <= cakeCount; i++) {
    const pfx = i === 1 ? '' : (lang === 'en' ? 'Cake ' + i + ': ' : 'কেক ' + bnCake(i) + ': ');
    const wRaw = cakeWeightText(i);
    if (!wRaw) { showToast(pfx + 'ওজন নির্বাচন করুন'); weightEl(i).focus(); return false; }
    if (isBareNumberWeight(wRaw)) { maybeAskWeightUnit(i); showToast(pfx + 'ওজনের একক বেছে নিন — পাউন্ড নাকি KG?'); return false; }
    if (!isPresetWeight(wRaw) && !parseWeightText(wRaw)) { showToast(pfx + 'সঠিক ওজন লিখুন'); weightEl(i).focus(); return false; }
    if (!flavourEl(i).value) { showToast(pfx + 'ফ্লেভার নির্বাচন করুন'); flavourEl(i).focus(); return false; }
    const wErr = getCakeWritingError(writingEl(i).value);
    if (wErr) { showToast(pfx + wErr); writingEl(i).focus(); return false; }
  }
  // Cake 1 delivery / receiver
  if (!isPickup && !document.getElementById('f-address').value.trim()) { showToast('ডেলিভারি ঠিকানা দিন'); document.getElementById('f-address').focus(); return false; }
  if (!document.getElementById('f-receiver').value.trim()) { showToast('রিসিভারের নাম দিন'); document.getElementById('f-receiver').focus(); return false; }
  const rc1 = document.getElementById('receiver-same-cust');
  const sameCust1 = rc1 ? rc1.checked : false;
  if (!sameCust1 && !validateBangladeshPhone(document.getElementById('f-receiver-phone').value.trim())) { showToast('সঠিক রিসিভার ফোন দিন'); document.getElementById('f-receiver-phone').focus(); return false; }
  const tErr1 = getTimeError(1);
  if (tErr1) { showToast(tErr1); timeSlotEl(1).focus(); return false; }
  // Cake 2 delivery (only when multiple)
  if (cakeCount >= 2) {
    const pfx = lang === 'en' ? 'Cake 2: ' : 'কেক ২: ';
    const sameAddr = document.getElementById('same-address-check').checked;
    if (!isPickup && !sameAddr && !document.getElementById('f-address-2').value.trim()) { showToast(pfx + 'ডেলিভারি ঠিকানা দিন'); document.getElementById('f-address-2').focus(); return false; }
    const sameRcv = document.getElementById('same-receiver-check').checked;
    if (!sameRcv && !document.getElementById('f-receiver-2').value.trim()) { showToast(pfx + 'রিসিভারের নাম দিন'); document.getElementById('f-receiver-2').focus(); return false; }
    const samePh = document.getElementById('same-phone-check').checked;
    const rc2 = document.getElementById('receiver-same-cust-2');
    const sameCust2 = rc2 ? rc2.checked : false;
    if (!samePh && !sameCust2 && !validateBangladeshPhone(document.getElementById('f-receiver-phone-2').value.trim())) { showToast(pfx + 'সঠিক রিসিভার ফোন দিন'); document.getElementById('f-receiver-phone-2').focus(); return false; }
    const sameDt = document.getElementById('same-date-check').checked;
    if (!sameDt && !document.getElementById('f-date-2').value.trim()) { showToast(pfx + 'তারিখ দিন'); document.getElementById('f-date-2').focus(); return false; }
    const sameTm = document.getElementById('same-time-check').checked;
    if (!sameTm) { const tErr2 = getTimeError(2); if (tErr2) { showToast(pfx + tErr2); timeSlotEl(2).focus(); return false; } }
  }
  if (!advanceMethod) {
    showToast(lang === 'en' ? 'Select the payment method (bKash / Nagad / Bank)' : 'আপনি কিভাবে পেমেন্ট করেছেন সেটা নির্বাচন করুন');
    openAdvanceMethodPopup();
    return false;
  }
  if (isSurprise) {
    const adv = parseFloat(document.getElementById('f-advance').value) || 0;
    const total = getOrderTotal();
    if (adv < total) { showToast('সারপ্রাইজের জন্য পূর্ণ পেমেন্ট দিন'); return false; }
  }
  return true;
}

function getOrderTotal() {
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  if (cakePrice <= 0) return 0;
  return cakePrice;
}

// Submit
function submitOrder() {
  if (!validate()) return;

  const phone = localStorage.getItem('nitu-cust-phone') || '';
  const customerName = document.getElementById('f-name').value.trim();
  localStorage.setItem('nitu-cust-name', customerName);

  const method = getPaymentMethod(document.getElementById('f-payment-method').value);
  const cakePrice = parseFloat(document.getElementById('f-cake-price').value) || 0;
  const sendAmount = parseFloat(document.getElementById('f-advance').value) || 0;
  const isPickup = document.getElementById('f-fulfilment').value === 'pickup';

  // f-advance holds what the customer sends (base advance + gateway charge).
  const rate = method && method.charges > 0 ? method.charges : 0;
  let advance, charge;
  if (advanceType && lastAutoSend > 0 && sendAmount === lastAutoSend) {
    advance = lastAutoBase;
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

  // Per-cake details (cakes 1..N). Delivery is stored INSIDE each cake with the
  // same field names the admin app reads (address/deliveryAddress, receiver,
  // receiverPhone, date/deliveryDate, timeSlot/timeSlotLabel, deliveryCharge)
  // so a multi-cake order is editable from either app without losing a cake's
  // own delivery. Cakes 3+ have no per-cake delivery UI here, so they always
  // inherit cake 1. Cake 2 inherits cake 1 unless a "same" toggle is off; a
  // cake sharing cake 1's trip adds no extra delivery charge.
  const sameAddr = document.getElementById('same-address-check').checked;
  const sameRcv = document.getElementById('same-receiver-check').checked;
  const samePh = document.getElementById('same-phone-check').checked;
  const sameDt = document.getElementById('same-date-check').checked;
  const sameTm = document.getElementById('same-time-check').checked;
  const sameCh = document.getElementById('same-charge-check').checked;
  const rc1 = document.getElementById('receiver-same-cust');

  const cake1Delivery = {
    address: document.getElementById('f-address').value.trim(),
    receiver: document.getElementById('f-receiver').value.trim(),
    receiverPhone: document.getElementById('f-receiver-phone').value.trim(),
    date: document.getElementById('f-date').value,
    timeSlot: getSelectedTime(1),
    deliveryCharge: isPickup ? 0 : (parseFloat(document.getElementById('f-delivery-charge').value) || 0)
  };

  const cakes = [];
  for (let i = 1; i <= cakeCount; i++) {
    const fl = getFlavour(flavourEl(i) ? flavourEl(i).value : '');
    const store = photosFor(i);
    const writingText = (writingEl(i) ? writingEl(i).value : '').trim();
    const isCake2 = i === 2;
    const sameAddress = i !== 2 || sameAddr;
    const sameReceiver = i !== 2 || sameRcv;
    const samePhone = i !== 2 || samePh;
    // Admin stores receiver name + phone as ONE unit; "same" only when both match.
    const sameReceiverUnit = sameReceiver && samePhone;
    const sameDate = i !== 2 || sameDt;
    const sameTime = i !== 2 || sameTm;
    const sameCharge = i !== 2 || sameCh;
    const addr = sameAddress ? cake1Delivery.address : (document.getElementById('f-address-2').value || '').trim();
    const rcv = sameReceiver ? cake1Delivery.receiver : (document.getElementById('f-receiver-2').value || '').trim();
    const rcp = samePhone ? cake1Delivery.receiverPhone : (document.getElementById('f-receiver-phone-2').value || '').trim();
    const dt = sameDate ? cake1Delivery.date : document.getElementById('f-date-2').value;
    const tm = sameTime ? cake1Delivery.timeSlot : getSelectedTime(2);
    const chg = isPickup ? 0 : (sameCharge ? 0 : (parseFloat(document.getElementById('f-delivery-charge-2').value) || 0));
    cakes.push({
      cakeIndex: i,
      weight: (cakeWeightText(i) || '').toLowerCase(),
      weightLabel: cakeWeightText(i),
      flavour: fl ? fl.value : '',
      flavourName: fl ? fl.label : '',
      writing: writingText,
      cakeWriting: writingText,
      photo: store[0] || '',
      photos: store,
      photoNote: (photoNoteEl(i) ? photoNoteEl(i).value : '').trim(),
      address: addr,
      deliveryAddress: addr,
      receiver: rcv,
      receiverPhone: rcp,
      date: dt,
      deliveryDate: dt,
      timeSlot: tm,
      timeSlotLabel: tm,
      deliveryCharge: chg,
      deliveryAmount: chg,
      sameAddressAsCake1: sameAddress,
      sameReceiverAsCake1: sameReceiverUnit,
      sameTimeAsCake1: sameTime,
      sameChargeAsCake1: sameCharge,
      sameDateAsCake1: sameDate
    });
  }
  const altPhoneEl = document.getElementById('f-alt-phone');
  const altPhone = altPhoneEl ? altPhoneEl.value.trim() : '';
  const delivery = isPickup ? 0 : getTotalDeliveryCharge();
  const firstCake = cakes[0];

  const order = {
    orderId: currentOrderId || generateOrderId(),
    customerPhone: phone,
    customerName: customerName,
    category: 'custom',
    categoryName: 'কাস্টম কেক',
    cakeCount: cakeCount,
    cakes: cakes,
    // Cake-1 mirror (backward compatible with admin app + old orders)
    weight: firstCake.weight,
    weightLabel: firstCake.weightLabel,
    flavour: firstCake.flavour,
    flavourName: firstCake.flavourName,
    photo: firstCake.photo,
    photos: firstCake.photos,
    photoNote: firstCake.photoNote,
    writing: firstCake.writing,
    cakeWriting: firstCake.writing,
    // Delivery — cake 1
    address: document.getElementById('f-address').value.trim(),
    deliveryAddress: document.getElementById('f-address').value.trim(),
    date: document.getElementById('f-date').value,
    deliveryDate: document.getElementById('f-date').value,
    timeSlot: getSelectedTime(1),
    timeSlotLabel: getSelectedTime(1),
    receiver: firstCake.receiver,
    receiverPhone: firstCake.receiverPhone,
    altPhone: altPhone,
    receiverSameCust: rc1 ? rc1.checked : false,
    // One payment method for the whole order
    paymentMethod: method.id,
    paymentMethodName: method.name,
    advanceMethod: advanceMethod || '',
    advanceMethodName: method.name,
    basePrice: cakePrice,
    weightPrice: 0,    cakePrice: cakePrice,
    deliveryCharge: delivery,
    paymentCharges: charge,
    subtotal: subtotal,    total: total,
    advance: advance,
    advanceTotal: advanceTotal,
    advanceCharge: charge,
    advanceAutoTotal: (advanceType && lastAutoSend > 0 && sendAmount !== lastAutoSend) ? lastAutoSend : null,
    dueAmount: dueAmount,
    fulfilment: document.getElementById('f-fulfilment').value,
    trx: document.getElementById('f-trx').value.trim(),
    notes: document.getElementById('f-notes') ? document.getElementById('f-notes').value.trim() : '',
    lang: lang,
    source: 'customer',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  showLoading(true);
  db.ref('orders').push(order).then(() => {
    showLoading(false);
    try { fireNtfyAlert(order); } catch (e) { console.error(e); }
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
    var cakeDesc = '';
    if (order.cakes && order.cakes.length > 1) {
      cakeDesc = order.cakes.length + ' cakes: ' + order.cakes.map(function (c) {
        return (String(c.weightLabel || c.weight || '').trim() + ' ' + String(c.flavourName || FLAV_EN[c.flavour] || '').trim()).trim();
      }).join(', ');
    } else {
      cakeDesc = ((w ? w + ' ' : '') + (flavN || '') + ' cake').trim();
    }
    var msg = (name) + ' just placed ' + cakeDesc +
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
        priority: 4,
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

function normalizeTimeInput(i) {
  i = i || 1;
  const el = timeSlotEl(i);
  if (!el) return;
  const raw = el.value.trim();
  if (!raw) return;
  const cleaned = raw.replace(/\s*(?:a\.?m\.?|p\.?m\.?|এএম|পিএম)\.?$/i, '').trim();
  const p = parseTimeParts(cleaned);
  if (!p) return;
  el.value = `${p.h}.${String(p.min == null ? 0 : p.min).padStart(2, '0')}`;
}

function getSelectedTime(i) {
  i = i || 1;
  const el = timeSlotEl(i);
  const pie = parseTimeParts(el ? el.value : '');
  const apEl = timeAmpmEl(i);
  const ap = apEl ? apEl.value : '';
  if (!pie || !ap) return '';
  return `${pie.h}:${String(pie.min == null ? 0 : pie.min).padStart(2, '0')} ${ap}`;
}

function getTimeError(i) {
  i = i || 1;
  const rawEl = timeSlotEl(i);
  const raw = rawEl ? rawEl.value.trim() : '';
  const apEl = timeAmpmEl(i);
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
  const many = order.cakes && order.cakes.length > 1;
  const cakesRows = many
    ? order.cakes.map(c => `<div class="row"><span>কেক ${bnCake(c.cakeIndex || 0)}</span><span>${esc(c.weightLabel)} — ${esc(c.flavourName)}</span></div>`).join('')
    : `<div class="row"><span>কেক</span><span>${esc(order.weightLabel)} — ${esc(order.flavourName)}</span></div>`;
  const writingRows = many
    ? order.cakes.filter(c => c.writing).map(c => `<div class="row"><span>কেক ${bnCake(c.cakeIndex || 0)} লেখা</span><span>${esc(c.writing)}</span></div>`).join('')
    : (order.writing ? `<div class="row"><span>কেকের লেখা</span><span>${esc(order.writing)}</span></div>` : '');
  summary.innerHTML = `
    <div class="row"><span>অর্ডার আইডি</span><span>${esc(order.orderId)}</span></div>
    <div class="row"><span>নাম</span><span>${esc(order.customerName)}</span></div>
    <div class="row"><span>ফোন</span><span>${esc(order.customerPhone)}</span></div>
    ${cakesRows}
    ${writingRows}
    <div class="row"><span>তারিখ</span><span>${esc(fmtDate(order.deliveryDate))} · ${esc(order.timeSlotLabel)}</span></div>
    <div class="row"><span>ঠিকানা</span><span>${esc(order.deliveryAddress)}${many && order.cakes.some(c => c.cakeIndex > 1 && !c.sameAddressAsCake1) ? ' · কেক ২ আলাদা ঠিকানায়' : ''}</span></div>
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
  document.querySelectorAll('#form-screen input:not(#entry-phone), #form-screen textarea').forEach(el => { if (!el.readOnly) el.value = ''; });
  document.querySelectorAll('#form-screen select').forEach(el => el.selectedIndex = 0);
  currentPhotos = [];
  extraPhotos = {};
  advanceType = ''; lastAutoSend = 0; lastAutoBase = 0; isSurprise = false; cakeWritingNoticeShown = false;
  advanceMethod = '';
  flavourNoticeShown = false;
  // Reset to a single cake
  cakeCount = 1;
  ['same-address-check', 'same-receiver-check', 'same-phone-check', 'same-date-check', 'same-time-check', 'same-charge-check'].forEach(id => {
    const el = document.getElementById(id); if (el) el.checked = true;
  });
  const altCb = document.getElementById('alt-phone-check'); if (altCb) altCb.checked = false;
  const rsc1 = document.getElementById('receiver-same-cust'); if (rsc1) rsc1.checked = false;
  const rsc2 = document.getElementById('receiver-same-cust-2'); if (rsc2) rsc2.checked = false;
  const rph1 = document.getElementById('f-receiver-phone'); if (rph1) rph1.readOnly = false;
  const rph2 = document.getElementById('f-receiver-phone-2'); if (rph2) rph2.readOnly = false;
  document.getElementById('mode-single').classList.add('active');
  document.getElementById('mode-multiple').classList.remove('active');
  const picker = document.getElementById('cake-count-picker');
  if (picker) picker.classList.remove('show');
  document.querySelectorAll('.adv-method-opt').forEach(el => el.classList.remove('active'));
  updateWritingCount(1);
  document.getElementById('calc-box').classList.remove('show');
  document.getElementById('due-field').classList.remove('show');
  document.getElementById('surprise-note').classList.remove('show');
  document.getElementById('payment-info').classList.remove('show');
  document.querySelectorAll('.advance-opt').forEach(el => { el.classList.remove('active'); el.style.opacity = '1'; });
  renderCakeColumns();
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
  const f1 = document.getElementById('f-date');
  if (f1) f1.setAttribute('min', today);
  const f2 = document.getElementById('f-date-2');
  if (f2) f2.setAttribute('min', today);
}

// Init
(function init() {
  populateDropdowns();
  setLang(lang);
  renderCakeColumns();
  const savedPhone = localStorage.getItem('nitu-cust-phone');
  if (savedPhone) document.getElementById('entry-phone').value = savedPhone;
  setMinDate();
})();
