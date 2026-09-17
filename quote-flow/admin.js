// quote-flow/admin.js — standalone quote builder & link manager.
// STANDALONE (review build): creates quotes/<TOKEN> records compatible with
// both this folder's quote.html and the integrated customer-multi redemption.
// Login uses the same Firebase email/password accounts as admin-app.

'use strict';

const FLAVOURS = {
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
const WEIGHT_CHIPS = ['1 pound', '1.5 pound', '2 pound', '2.5 pound', '3 pound', '4 pound', '5 pound'];
const MAX_CAKES = 5;
const QUOTE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SHOP_CALL_LINE = '01303-931284';

let currentUser = null;
let allQuotes = [];

const $     = id => document.getElementById(id);
const esc   = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bnNum = n => String(n).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const money = n => '৳' + bnNum(Math.round(Number(n) || 0));

// ─── auth gate (same accounts as admin-app) ──────────────────────
firebase.auth().onAuthStateChanged(u => {
  currentUser = u;
  $('login-screen').classList.toggle('hidden', !!u);
  $('admin-main').classList.toggle('hidden', !u);
  if (u) { $('whoami').textContent = u.email || ''; startQuotesListener(); if (!document.querySelector('#cakes-box .cake-row')) addCakeRow(); updateTotalPreview(); }
});

async function login() {
  $('login-err').textContent = '';
  try { await firebase.auth().signInWithEmailAndPassword($('login-email').value.trim(), $('login-pass').value); }
  catch (e) { $('login-err').textContent = '❌ ' + (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' ? 'ইমেইল বা পাসওয়ার্ড ভুল' : (e.message || 'লগইন ব্যর্থ')); }
}
function logout() { firebase.auth().signOut(); }

// ─── cake rows ───────────────────────────────────────────────────
function addCakeRow() {
  const box = $('cakes-box');
  if (box.children.length >= MAX_CAKES) return;
  const i = box.children.length + 1;
  const div = document.createElement('div');
  div.className = 'cake-row';
  div.innerHTML =
    '<div class="cr-head"><b>কেক ' + bnNum(i) + '</b>' +
    (box.children.length ? '<button class="mini-btn danger" onclick="this.closest(\'.cake-row\').remove();renumberCakes()">✕ বাদ</button>' : '') + '</div>' +
    '<div class="row2">' +
      '<div class="field"><label>ফ্লেভার <span class="req">*</span></label><select class="q-flav">' +
        '<option value="">— বাছাই —</option>' +
        Object.keys(FLAVOURS).map(k => '<option value="' + k + '">' + FLAVOURS[k] + '</option>').join('') +
      '</select></div>' +
      '<div class="field"><label>ওজন <span class="req">*</span></label><input class="q-weight" placeholder="যেমন: 1.5 pound"></div>' +
    '</div>' +
    '<div class="field"><label>কেকে লেখা (অপশনাল)</label><input class="q-writing" placeholder="যেমন: Happy Birthday Ayan"></div>' +
    '<div class="chips">' + WEIGHT_CHIPS.map(w => '<button type="button" class="chip" onclick="this.closest(\'.cake-row\').querySelector(\'.q-weight\').value=\'' + w + '\'">' + w + '</button>').join('') + '</div>';
  box.appendChild(div);
}
function renumberCakes() {
  document.querySelectorAll('#cakes-box .cake-row').forEach((r, idx) => {
    r.querySelector('.cr-head b').textContent = 'কেক ' + bnNum(idx + 1);
    r.querySelector('.cr-head .danger') && (r.querySelector('.cr-head .danger').style.display = document.querySelectorAll('#cakes-box .cake-row').length > 1 ? '' : 'none');
  });
  updateTotalPreview();
}

function updateTotalPreview() {
  const cp = parseFloat($('q-cake-price').value) || 0;
  const dc = parseFloat($('q-delivery').value) || 0;
  $('total-preview').textContent = money(cp + dc) + (dc > 0 ? ' (কেক ' + money(cp) + ' + ডেলিভারি ' + money(dc) + ')' : ' (সেল্ফ পিকআপ)');
}
// ─── token + link + messages ─────────────────────────────────────
function makeToken() {
  let t = '';
  for (let i = 0; i < 8; i++) t += QUOTE_CHARS[Math.floor(Math.random() * QUOTE_CHARS.length)];
  return t;
}
async function newUniqueToken() {
  for (let i = 0; i < 6; i++) {
    const t = makeToken();
    try { const s = await db.ref('quotes/' + t).once('value'); if (!s || !s.exists()) return t; }
    catch (_) { return t; }
  }
  return makeToken() + Date.now().toString(36).slice(-2).toUpperCase();
}
function linkBase() {
  const saved = localStorage.getItem('qf-base');
  if (saved) return saved.replace(/\/+$/, '') + '/quote.html';
  return location.href.replace(/admin\.html.*$/i, '') + 'quote.html';
}
function quoteLink(token) { return linkBase().replace(/quote\.html.*$/, 'quote.html') + '?quote=' + token; }

function cakeDescOf(q) {
  return (q.cakes || []).map(c => {
    const w = String(c.weightLabel || c.weight || '').trim();
    return ((w ? w + ' ' : '') + (c.flavourName || FLAVOURS[c.flavour] || c.flavour || '')).trim();
  }).join(' + ');
}
function buildWaMsg(q, token) {
  const isPickup = q.fulfilment === 'pickup';
  const exp = q.expiresAt ? new Date(q.expiresAt).toLocaleDateString('bn-BD') : '';
  return 'আসসালামু আলাইকুম ' + (q.customerName || '') + '! 🌸\n' +
    'আপনার জন্য কেকের কোটেশন তৈরি হয়েছে 🎂\n\n' +
    '🍰 কেক: ' + cakeDescOf(q) + '\n' +
    '💰 কেকের মূল্য: ' + money(q.cakePrice) + '\n' +
    (isPickup ? '🏬 সেল্ফ পিকআপ\n' : '🚚 ডেলিভারি চার্জ: ' + money(q.deliveryCharge) + '\n') +
    '✅ মোট: ' + money(q.cakePrice + (isPickup ? 0 : q.deliveryCharge)) + '\n\n' +
    'নিচের লিংকে ক্লিক করে শুধু আপনার নাম, ফোন ও ডেলিভারির তথ্য দিন এবং পেমেন্ট করুন 👇\n' +
    quoteLink(token) + '\n\n' +
    (exp ? '⏳ লিংকটি কার্যকর: ' + exp + ' পর্যন্ত\n' : '') +
    'কোনো প্রশ্ন থাকলে রিপ্লাই দিন বা কল করুন ' + SHOP_CALL_LINE + '।';
}
// ─── create quote ────────────────────────────────────────────────
async function createQuote() {
  const rows = [...document.querySelectorAll('#cakes-box .cake-row')];
  const cakes = [];
  for (let i = 0; i < rows.length; i++) {
    const flav = rows[i].querySelector('.q-flav').value;
    const w = rows[i].querySelector('.q-weight').value.trim();
    if (!flav) { rows[i].querySelector('.q-flav').focus(); return alert('কেক ' + bnNum(i + 1) + ' — ফ্লেভার বাছাই করুন'); }
    if (!w)    { rows[i].querySelector('.q-weight').focus(); return alert('কেক ' + bnNum(i + 1) + ' — ওজন লিখুন'); }
    cakes.push({
      weight: w, weightLabel: w, flavour: flav, flavourName: FLAVOURS[flav],
      writing: rows[i].querySelector('.q-writing').value.trim(),
      deliveryCharge: i === 0 ? (parseFloat($('q-delivery').value) || 0) : 0
    });
  }
  const cp = Math.round(parseFloat($('q-cake-price').value) || 0);
  if (cp <= 0) { $('q-cake-price').focus(); return alert('কেকের মোট মূল্য লিখুন'); }
  const dc = parseFloat($('q-delivery').value) || 0;
  const fulfil = $('q-fulfilment').value;
  if (fulfil === 'delivery' && dc <= 0) { $('q-delivery').focus(); return alert('ডেলিভারি চার্জ লিখুন (অথবা সেল্ফ পিকআপ বাছাই করুন)'); }
  const hrs = Number($('q-expiry').value) || 72;

  const token = await newUniqueToken();
  const now = Date.now();
  const quote = {
    cakes: cakes,
    cakePrice: cp,
    deliveryCharge: fulfil === 'pickup' ? 0 : dc,
    total: cp,
    fulfilment: fulfil,
    status: 'open',
    createdAt: now,
    createdBy: (currentUser && currentUser.email) || 'admin',
    expiresAt: now + hrs * 60 * 60 * 1000,
    customerName: $('q-cust-name').value.trim(),
    customerPhone: $('q-cust-phone').value.trim().replace(/[\s-]/g, ''),
    customer: $('q-cust-name').value.trim(),
    deliveryNotes: $('q-notes').value.trim()
  };
  try { await db.ref('quotes/' + token).set(quote); }
  catch (e) { console.error(e); return alert('❌ কোটেশন সেভ হয়নি — ইন্টারনেট/লগইন চেক করুন'); }

  $('res-token').textContent = token;
  $('res-link').textContent = quoteLink(token);
  $('res-msg').value = buildWaMsg(quote, token);
  $('wa-btn').onclick = () => {
    const ph = quote.customerPhone.replace(/^0/, '880');
    const url = ph.length === 13 ? 'https://wa.me/' + ph + '?text=' + encodeURIComponent($('res-msg').value) : 'https://wa.me/?text=' + encodeURIComponent($('res-msg').value);
    window.open(url, '_blank');
  };
  $('result-panel').classList.remove('hidden');
  $('result-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function useBase() { localStorage.setItem('qf-base', $('base-url').value.trim()); alert('✅ লিংকের ভিত্তি সেভ হয়েছে'); }

// ─── live quotes list ────────────────────────────────────────────
function startQuotesListener() {
  db.ref('quotes').limitToLast(200).on('value', snap => {
    const v = snap ? snap.val() : null;
    allQuotes = v ? Object.keys(v).map(k => Object.assign({ token: k }, v[k])) : [];
    allQuotes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderQuotes();
  }, err => console.error(err));
}
function statusOf(q) {
  if (q.status === 'used') return ['ব্যবহৃত', 's-used'];
  if (q.status === 'cancelled') return ['বাতিল', 's-cancel'];
  if (q.expiresAt && Date.now() > q.expiresAt) return ['মেয়াদ শেষ', 's-expired'];
  return ['চালু', 's-open'];
}
async function cancelQuote(token) {
  if (!confirm('এই কোটেশন বাতিল করবেন? লিংকটি আর কাজ করবে না।')) return;
  try { await db.ref('quotes/' + token).update({ status: 'cancelled', cancelledAt: Date.now() }); }
  catch (e) { alert('❌ বাতিল করা যায়নি'); }
}
let msgCache = [];
function renderQuotes() {
  if (!allQuotes.length) { $('quotes-list').innerHTML = '<p class="empty">এখনো কোনো কোটেশন তৈরি হয়নি।</p>'; return; }
  msgCache = [];
  $('quotes-list').innerHTML = allQuotes.map((q, idx) => {
    const [label, cls] = statusOf(q);
    const link = quoteLink(q.token);
    const exp = q.expiresAt ? new Date(q.expiresAt).toLocaleDateString('bn-BD') : '—';
    msgCache.push(buildWaMsg(q, q.token));
    return '<div class="qrow">' +
      '<div class="qr-top"><b class="tok">' + esc(q.token) + '</b><span class="chip-st ' + cls + '">' + label + '</span></div>' +
      '<div class="qr-line">🎂 ' + esc(cakeDescOf(q)) + ' · <b>' + money(q.cakePrice + (q.fulfilment === 'pickup' ? 0 : q.deliveryCharge)) + '</b></div>' +
      (q.customerName || q.customerPhone ? '<div class="qr-line">👤 ' + esc(q.customerName || '') + (q.customerPhone ? ' · ' + esc(q.customerPhone) : '') + '</div>' : '') +
      '<div class="qr-line mut2">মেয়াদ: ' + exp + (q.usedOrderId ? ' · অর্ডার: ' + esc(q.usedOrderId) : '') + '</div>' +
      '<div class="qr-acts">' +
        '<button class="mini-btn" onclick="copyText(\'' + link + '\', this)">🔗 লিংক কপি</button>' +
        '<button class="mini-btn" onclick="copyText(msgCache[' + idx + '], this)">📝 মেসেজ কপি</button>' +
        '<button class="mini-btn" onclick="openWa(\'' + q.token + '\')">💬 WhatsApp</button>' +
        (q.status === 'open' ? '<button class="mini-btn danger" onclick="cancelQuote(\'' + q.token + '\')">✕ বাতিল</button>' : '') +
      '</div></div>';
  }).join('');
}
function openWa(token) {
  const q = allQuotes.find(x => x.token === token);
  if (!q) return;
  const ph = String(q.customerPhone || '').replace(/^0/, '880');
  const url = ph.length === 13
    ? 'https://wa.me/' + ph + '?text=' + encodeURIComponent(buildWaMsg(q, token))
    : 'https://wa.me/?text=' + encodeURIComponent(buildWaMsg(q, token));
  window.open(url, '_blank');
}
function copyText(txt, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '✅'; setTimeout(() => btn.textContent = o, 1200); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => fb(txt, done));
  else fb(txt, done);
}
function fb(txt, done) {
  const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta); if (done) done();
}