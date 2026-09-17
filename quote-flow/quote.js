// quote-flow/quote.js — customer-side redemption of admin-issued quote links.
// STANDALONE (review build): does not modify customer-multi / admin-app.
// Reads quotes/<TOKEN> (schema shared with the integrated flow) and pushes an
// order to `orders` with the same schema customer-multi uses, so the existing
// admin dashboard renders it identically. Price/weight/flavour/delivery are
// taken from the quote node at submit time (client cannot tamper with them —
// the locked values are never read from the form).

'use strict';

const FLAVOUR_MAP = {
  'vanilla-sponge': 'ভ্যানিলা স্পঞ্জ', 'chocolate-sponge': 'চক্লেট স্পঞ্জ',
  'double-layer-chocolate': 'ডাবল লেয়ারড চকলেট', 'black-forest': 'ব্ল্যাক ফরেস্ট',
  'white-forest': 'হোয়াইট ফরেস্ট', 'lemon': 'লেমন কেক', 'orange': 'অরেঞ্জ কেক',
  'strawberry': 'স্ট্রবেরি কেক', 'blueberry': 'ব্লুবেরি', 'malai': 'মালাই কেক',
  'butterscotch': 'বাটারস্কচ কেক', 'special-vanilla': 'স্পেশাল ভ্যানিলা',
  'chocolate-mud': 'চকলেট মাডকেক', 'red-velvet': 'রেড ভেলভেট',
  'cream-cheese-fruit': 'ক্রিম চিজ ফ্রস্টিং উইথ ফ্রুট ফিলিং',
  'vanilla-whipped-cream': 'ভ্যানিলা হুইপড ক্রিম', 'choco-truffle': 'চকো ট্রাফল',
  'mango-mousse': 'ম্যাংগো মুস'
};
const PAYMENT_METHODS = [
  { id: 'bkash', name: 'বিকাশ',            rate: 0.0182, number: '01521400475', regName: 'Nasrin Akter' },
  { id: 'nagad', name: 'নগদ',              rate: 0.0149, number: '01521222376', regName: 'Firoz Ahmed' },
  { id: 'bank',  name: 'ব্যাংক (NPSB)',    rate: 0,      number: '',            regName: '' }
];

let quoteToken = '';
let quoteData  = null;
let payShot    = '';
let METHOD     = null;

const $    = id => document.getElementById(id);
const esc  = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bnNum = n => String(n).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const money = n => '৳' + bnNum(Math.round(Number(n) || 0));
const cakePriceOf = q => Number(q.cakePrice != null ? q.cakePrice : q.total) || 0;
const flavName = c => c.flavourName || FLAVOUR_MAP[c.flavour] || c.flavour || '';

function fail(msg) {
  $('loading').classList.add('hidden');
  $('err-msg').textContent = msg;
  $('error-screen').classList.remove('hidden');
}

(async function init() {
  try {
    let t = '';
    try {
      const sp = new URLSearchParams(location.search);
      t = (sp.get('quote') || sp.get('q') || '').trim().toUpperCase();
    } catch (_) {}
    if (!t) return fail('লিংকে কোনো কোটেশন কোড নেই।\nঅনুগ্রহ করে এডমিনের পাঠানো লিংকটি ব্যবহার করুন।');
    quoteToken = t;
    const snap = await db.ref('quotes/' + t).once('value');
    const q = snap ? snap.val() : null;
    if (!q) return fail('কোটেশন পাওয়া যায়নি — লিংকটি ভুল হতে পারে।\nএডমিনকে জানান।');
    if (q.status && q.status !== 'open') return fail('এই কোটেশনটি আর কার্যকর নেই (ইতিমধ্যে ব্যবহৃত বা বাতিল করা হয়েছে)।');
    if (q.expiresAt && Date.now() > q.expiresAt) return fail('এই কোটেশনের মেয়াদ শেষ হয়ে গেছে।\nএডমিনকে জানান — নতুন লিংক পাঠিয়ে দেবেন।');
    if (!Array.isArray(q.cakes) || !q.cakes.length) return fail('কোটেশনে কেকের তথ্য নেই — এডমিনকে জানান।');
    quoteData = q;
    renderQuote();
  } catch (e) {
    console.error(e);
    fail('কোটেশন লোড করা যায়নি — ইন্টারনেট সংযোগ চেক করে পেজটি আবার খুলুন।');
  }
})();

function renderQuote() {
  const q = quoteData;
  const isPickup = q.fulfilment === 'pickup';

  // ── locked cake lines ──
  $('quote-lines').innerHTML = q.cakes.map((c, i) => {
    const w = String(c.weightLabel || c.weight || '').trim();
    const wr = String(c.writing || c.cakeWriting || '').trim();
    const nm = q.cakes.length > 1 ? 'কেক ' + bnNum(i + 1) + ': ' : '';
    return '<div class="qline"><span class="ic">🎂</span><span>' + nm + esc((w ? w + ' ' : '') + flavName(c)) +
      (wr ? '<span class="mut">✏️ লেখা: ' + esc(wr) + '</span>' : '') + '</span></div>';
  }).join('');

  // ── price summary (never editable) ──
  const cp = cakePriceOf(q), del = isPickup ? 0 : (Number(q.deliveryCharge) || 0);
  $('pr-cake').textContent = money(cp);
  $('pr-del').textContent  = isPickup ? 'সেল্ফ পিকআপ' : money(del);
  $('pr-total').textContent = money(cp + del);

  // expiry banner
  if (q.expiresAt) {
    const d = new Date(q.expiresAt);
    $('expiry-banner').style.display = 'block';
    $('expiry-banner').innerHTML = '⏳ এই কোটেশনের মেয়াদ শেষ: <b>' +
      d.toLocaleDateString('bn-BD') + ', ' + d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) + '</b>';
  }
  if (q.deliveryNotes) {
    $('q-note').style.display = 'block';
    $('q-note').textContent = '💌 এডমিনের নোট: ' + q.deliveryNotes;
  }

  // ── prefill customer info (name & phone stay EDITABLE per requirement) ──
  if (q.customerName) $('f-name').value = q.customerName;
  if (q.customerPhone) $('f-phone').value = q.customerPhone;
  else if (q.customer && /^01\d{9}$/.test(String(q.customer).replace(/\D/g, ''))) $('f-phone').value = String(q.customer).replace(/\D/g, '');
  if (q.cakes[0] && (q.cakes[0].writing || q.cakes[0].cakeWriting)) $('f-writing').value = q.cakes[0].writing || q.cakes[0].cakeWriting;

  // date min = today (local, BD-safe)
  const t0 = new Date();
  const iso = t0.getFullYear() + '-' + String(t0.getMonth() + 1).padStart(2, '0') + '-' + String(t0.getDate()).padStart(2, '0');
  $('f-date').min = iso;

  // pickup → hide delivery block
  if (isPickup) $('delivery-section').classList.add('hidden');

  renderPayMethods();
  $('loading').classList.add('hidden');
  $('main').classList.remove('hidden');
  recalcPay();
}
function renderPayMethods() {
  $('pm-box').innerHTML = PAYMENT_METHODS.map((m, i) =>
    '<div class="pm" id="pm-' + m.id + '" onclick="pickMethod(\'' + m.id + '\')">' +
      '<div class="pm-top"><span>💳 ' + m.name + (m.rate ? ' <span class="mut" style="font-weight:600;font-size:11.5px">(চার্জ ' + (m.rate * 100).toFixed(2) + '%)</span>' : '') + '</span>' +
      (m.number ? '<button class="cpy" onclick="event.stopPropagation();copyText(\'' + m.number + '\', this)">📋 কপি</button>' : '') + '</div>' +
      (m.number ? '<div class="pm-num">নম্বর: <b>' + m.number + '</b>' + (m.regName ? ' · ' + esc(m.regName) : '') + '</div>' : '<div class="pm-num">এডমিন ব্যাংক ডিটেইলস WhatsApp-এ পাঠিয়ে দেবেন</div>') +
    '</div>').join('');
}

function pickMethod(id) {
  METHOD = PAYMENT_METHODS.find(m => m.id === id) || null;
  PAYMENT_METHODS.forEach(m => $('pm-' + m.id).classList.toggle('sel', m.id === id));
  recalcPay();
}

function subtotalNow() {
  const isPickup = quoteData.fulfilment === 'pickup';
  return cakePriceOf(quoteData) + (isPickup ? 0 : (Number(quoteData.deliveryCharge) || 0));
}

function recalcPay() {
  if (!quoteData) return;
  const isPickup = quoteData.fulfilment === 'pickup';
  const sub = subtotalNow();
  const advEl = $('f-advance');
  if (document.activeElement !== advEl && advEl.dataset.auto !== '0') {
    if (advEl.dataset.auto !== '1') { advEl.value = sub; advEl.dataset.auto = '1'; }
  }
  let adv = Math.round(Number(advEl.value) || 0);
  if (adv > sub) { adv = sub; advEl.value = sub; }
  const chg = METHOD && METHOD.rate ? Math.ceil(adv * METHOD.rate) : 0;
  $('pc-sub').textContent   = money(sub);
  $('pc-adv').textContent   = money(adv);
  $('pc-chg').textContent   = money(chg);
  $('pc-now').textContent   = money(adv + chg);
  $('pc-due').textContent   = money(Math.max(0, sub - adv));
  $('pc-due-row').style.display = (sub - adv) > 0 ? '' : 'none';
}

function copyText(txt, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '✅ কপি হয়েছে'; setTimeout(() => btn.textContent = o, 1200); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
  else fallbackCopy(txt, done);
}
function fallbackCopy(txt, done) {
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta); if (done) done();
}

// ─── payment screenshot (compressed data URL, same as customer-multi) ──
async function compressImage(file) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
  });
  let q = 0.72, out = dataUrl;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const cv = document.createElement('canvas');
  const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
  cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  out = cv.toDataURL('image/jpeg', q);
  while (out.length > 110 * 1024 && q > 0.35) { q -= 0.12; out = cv.toDataURL('image/jpeg', q); }
  return out;
}
async function handleShot(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return alert('ছবিটি ৫MB এর কম হতে হবে');
  try {
    payShot = await compressImage(file);
    $('shot-box').innerHTML = '📸 স্ক্রিনশট যুক্ত হয়েছে — ট্যাপ করে বদলান<img src="' + payShot + '">';
  } catch (_) { alert('ছবি লোড করা যায়নি'); }
}
// ─── submit: order values come from the QUOTE NODE, never from a
// price field the customer could tamper with ─────────────────────
function genOrderId() {
  const d = new Date();
  const ds = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return 'NB' + ds + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}
function vErr(id, msg) { const el = $(id); if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } alert(msg); return false; }

async function submitOrder() {
  const isPickup = quoteData.fulfilment === 'pickup';
  const name = $('f-name').value.trim();
  const phone = $('f-phone').value.trim().replace(/[\s-]/g, '');
  if (!name) return vErr('f-name', 'আপনার নাম দিন');
  if (!/^01[3-9]\d{8}$/.test(phone)) return vErr('f-phone', 'সঠিক ১১ ডিজিটের ফোন নম্বর দিন (01XXXXXXXXX)');
  const addr = isPickup ? '' : $('f-address').value.trim();
  if (!isPickup && !addr) return vErr('f-address', 'ডেলিভারি ঠিকানা দিন');
  const dt = $('f-date').value;
  if (!isPickup && !dt) return vErr('f-date', 'ডেলিভারির তারিখ দিন');
  const tm = $('f-time').value.trim();
  if (!isPickup && !tm) return vErr('f-time', 'ডেলিভারির সময় লিখুন (যেমন: বিকাল 4টা)');
  if (!METHOD) return alert('পেমেন্ট পদ্ধতি বাছাই করুন');
  const sub = subtotalNow();
  let adv = Math.round(Number($('f-advance').value) || 0);
  if (adv <= 0) { $('f-advance').focus(); return alert('অগ্রিম পরিমাণ লিখুন'); }
  if (adv > sub) { adv = sub; $('f-advance').value = sub; }
  const trx = $('f-trx').value.trim();
  if (!trx) { $('f-trx').focus(); return alert('TrxID / রেফারেন্স নম্বর দিন — পেমেন্টের প্রমাণ হিসেবে দরকার'); }
  if (!payShot) return alert('পেমেন্টের স্ক্রিনশট দিন — bKash / Nagad / ব্যাংক কনফার্মেশন পেজের ছবি');

  // freshness re-check against the server copy of the quote
  let fresh = null;
  try { const s = await db.ref('quotes/' + quoteToken).once('value'); fresh = s ? s.val() : null; } catch (_) {}
  if (!fresh || (fresh.status && fresh.status !== 'open') || (fresh.expiresAt && Date.now() > fresh.expiresAt)) {
    return alert('❌ কোটেশনটি আর কার্যকর নেই — এডমিনকে জানান।');
  }
  if (cakePriceOf(fresh) !== cakePriceOf(quoteData) || Number(fresh.deliveryCharge || 0) !== Number(quoteData.deliveryCharge || 0)) {
    return alert('❌ কোটেশনের মূল্য বদলে গেছে — নতুন লিংকের জন্য এডমিনকে জানান।');
  }

  const chg = METHOD.rate ? Math.ceil(adv * METHOD.rate) : 0;
  const total = sub + chg;
  const writing = $('f-writing').value.trim();
  const sameRc = isPickup || $('rc-same').checked;
  const rcv = isPickup ? '' : (sameRc ? name : $('f-receiver').value.trim());
  const rcp = isPickup ? '' : (sameRc ? phone : $('f-rc-phone').value.trim());
  if (!isPickup && !sameRc && !rcv) return vErr('f-receiver', 'রিসিভারের নাম দিন');
  if (!isPickup && !sameRc && !rcp) return vErr('f-rc-phone', 'রিসিভারের ফোন নম্বর দিন');
  if (!isPickup && !sameRc && rcp && !/^01[3-9]\d{8}$/.test(rcp)) return vErr('f-rc-phone', 'রিসিভারের সঠিক ফোন নম্বর দিন');

  const cakes = quoteData.cakes.map((c, i) => {
    const d1 = i === 0;
    return {
      weight: String(c.weightLabel || c.weight || '').trim(), weightLabel: String(c.weightLabel || c.weight || '').trim(),
      flavour: c.flavour || '', flavourName: flavName(c),
      writing: writing, cakeWriting: writing,
      photo: '', photos: [], photoNote: '',
      address: addr, deliveryAddress: addr,
      receiver: rcv, receiverPhone: rcp,
      date: dt, deliveryDate: dt, timeSlot: tm, timeSlotLabel: tm,
      deliveryCharge: d1 ? Number(quoteData.deliveryCharge) || 0 : 0,
      deliveryAmount: d1 ? Number(quoteData.deliveryCharge) || 0 : 0,
      sameAddressAsCake1: true, sameReceiverAsCake1: true, sameTimeAsCake1: true, sameChargeAsCake1: true, sameDateAsCake1: true
    };
  });
  const first = cakes[0];
  const order = {
    orderId: genOrderId(),
    customerPhone: phone, customerName: name, name: name, phone: phone,
    category: 'custom', categoryName: 'কাস্টম কেক',
    cakeCount: cakes.length, cakes: cakes,
    weight: first.weight, weightLabel: first.weightLabel,
    flavour: first.flavour, flavourName: first.flavourName,
    photo: '', photos: [], photoNote: '',
    writing: writing, cakeWriting: writing,
    address: addr, deliveryAddress: addr,
    date: dt, deliveryDate: dt, timeSlot: tm, timeSlotLabel: tm,
    receiver: rcv, receiverPhone: rcp,
    altPhone: $('f-alt-phone').value.trim(),
    receiverSameCust: sameRc, surprise: $('f-surprise').checked,
    paymentMethod: METHOD.id, paymentMethodName: METHOD.name,
    advanceMethod: METHOD.id, advanceMethodName: METHOD.name,
    basePrice: cakePriceOf(quoteData), weightPrice: 0, cakePrice: cakePriceOf(quoteData),
    deliveryCharge: isPickup ? 0 : Number(quoteData.deliveryCharge) || 0,
    paymentCharges: chg,
    subtotal: sub, total: total,
    advance: adv, advanceTotal: adv + chg, advanceCharge: chg, advanceAutoTotal: null,
    dueAmount: Math.max(0, sub - adv),
    fulfilment: quoteData.fulfilment || 'delivery',
    payShot: payShot, quoteToken: quoteToken,
    notes: $('f-notes').value.trim(),
    lang: 'bn', source: 'customer', status: 'pending',
    createdAt: Date.now(), updatedAt: Date.now()
  };

  $('submit-btn').disabled = true;
  try {
    const snap = await db.ref('orders').push(order);
    await db.ref('quotes/' + quoteToken).update({ status: 'used', usedAt: Date.now(), usedOrderId: (snap && snap.key) || order.orderId });
    $('main').classList.add('hidden');
    $('success-oid').textContent = order.orderId;
    $('success-detail').innerHTML =
      '💰 এখন পাঠাতে হবে: <b>' + money(adv + chg) + '</b> (' + esc(METHOD.name) + (chg ? ' — চার্জসহ' : '') + ')\n' +
      ((sub - adv) > 0 ? '🔴 ডেলিভারির সময় বাকি: ' + money(sub - adv) + '\n' : '✅ ফুল পেমেন্ট সম্পন্ন\n') +
      '🧾 TrxID: ' + esc(trx);
    $('success-screen').classList.remove('hidden');
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    alert('❌ জমা দেওয়া যায়নি — ইন্টারনেট চেক করে আবার চেষ্টা করুন।');
    $('submit-btn').disabled = false;
  }
}