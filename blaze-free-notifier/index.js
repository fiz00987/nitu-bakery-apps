'use strict';

/* ============================================================
   NITU'S BAKERY — Blaze-free notification sender
   ------------------------------------------------------------
   Runs anywhere Node runs (designed for FREE GitHub Actions
   cron jobs). No Firebase Blaze plan required!

   Modes:
     node index.js          -> poll /orders for NEW orders and
                               push 🎂 নতুন অর্ডার notifications
     node index.js --daily  -> send the 🚚 আজকের ডেলিভারি (names)
                               summary once per Bangladesh day

   Required environment variable:
     FIREBASE_SERVICE_ACCOUNT_JSON = full contents of the service
     account key JSON downloaded from Firebase Console
     (Project settings ▸ Service accounts ▸ Generate new private key)

   STATE: remembers processed orders inside YOUR OWN database at
   /notifierState, so any run on any machine resumes correctly.
   ============================================================ */

const admin = require('firebase-admin');

const RAW_SA = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
if (!RAW_SA.trim()) {
  console.error('FATAL: FIREBASE_SERVICE_ACCOUNT_JSON secret is missing.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(RAW_SA);
} catch (e) {
  console.error('FATAL: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:', e.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nitusbakingplanv2-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db          = admin.database();
const ORDERS_REF  = db.ref('orders');
const TOKENS_REF  = db.ref('pushTokens');
const STATE_REF   = db.ref('notifierState');

const INACTIVE_STATUSES = ['delivered', 'cancelled', 'completed', 'complete'];
const KNOWN_LIMIT       = 800;               // max remembered order ids
const DOW_BN            = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];

const isActive = o => !INACTIVE_STATUSES.includes(String((o && o.status) || '').toLowerCase());

// YYYY-MM-DD for Bangladesh (UTC+6) regardless of runner timezone.
function bdDateString(now) {
  return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── Redundant channel #1: Telegram ─────────────────────────
// Works even with zero registered push devices, arrives instantly,
// and the message stays in the chat until you delete it yourself.
const TG_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_CHAT  = process.env.TG_CHAT_ID  || '';

async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return; // channel not configured yet — skip quietly
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true })
    });
    const j = await res.json();
    console.log(j.ok ? '📨 Telegram delivered.' : `⚠️ Telegram failed: ${j.description}`);
  } catch (e) {
    console.warn('⚠️ Telegram network error:', e && e.message);
  }
}

// ─── Redundant channel #2: ntfy.sh push (no Telegram needed) ──
// Free push service: the owner installs the ntfy app (Android/iOS) and
// subscribes to the private topic in the NTFY_TOPIC secret. Alerts land
// on the lock screen within seconds — no account, no phone number.
const NTFY_SERVER = process.env.NTFY_SERVER || 'https://ntfy.sh';
const NTFY_TOPIC  = process.env.NTFY_TOPIC  || '';

async function sendNtfy(title, message) {
  if (!NTFY_TOPIC) return; // channel not configured yet — skip quietly
  try {
    const res = await fetch(`${NTFY_SERVER.replace(/\/+$/, '')}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: NTFY_TOPIC, title, message, priority: 4, tags: ['cake'] })
    });
    console.log(res.ok ? '📨 ntfy delivered.' : `⚠️ ntfy failed: HTTP ${res.status}`);
  } catch (e) {
    console.warn('⚠️ ntfy network error:', e && e.message);
  }
}

// '2026-09-01' → '1st September'
function humanDate(iso) {
  const m = String(iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const d = parseInt(m[3], 10);
  const suf = (d % 10 === 1 && d !== 11) ? 'st'
            : (d % 10 === 2 && d !== 12) ? 'nd'
            : (d % 10 === 3 && d !== 13) ? 'rd' : 'th';
  return `${d}${suf} ${MONTHS[parseInt(m[2], 10) - 1]}`;
}

// Machine flavour id → English display name (matches the example
// "2 pound chocolate sponge cake"); falls back to stored names.
const FLAVOUR_EN = {
  'vanilla-sponge': 'vanilla sponge',
  'chocolate-sponge': 'chocolate sponge',
  'double-layer-chocolate': 'double layered chocolate',
  'black-forest': 'black forest',
  'white-forest': 'white forest',
  'lemon': 'lemon',
  'orange': 'orange',
  'strawberry': 'strawberry',
  'blueberry': 'blueberry',
  'malai': 'malai',
  'butterscotch': 'butterscotch',
  'special-vanilla': 'special vanilla',
  'chocolate-mud': 'chocolate mud',
  'red-velvet': 'red velvet',
  'cream-cheese-fruit': 'cream cheese fruit'
};
const flavourEnglish = o => FLAVOUR_EN[String(o.flavour || '').trim()] ||
  String(o.flavourName || o.flavour || '').trim();


async function loadDevices() {
  const snap = await TOKENS_REF.once('value');
  const devices = [];
  snap.forEach(child => {
    const v = child.val();
    if (v && v.token) devices.push({ key: child.key, token: v.token });
  });
  return devices;
}

// Send one multicast; prune dead tokens; log a readable result.
async function sendToAll(notification, data) {
  const devices = await loadDevices();
  if (!devices.length) {
    console.warn('⚠️ No devices in /pushTokens yet — open the admin app and tap 🔔.');
    return;
  }
  const resp = await admin.messaging().sendEachForMulticast({
    tokens: devices.map(d => d.token),
    notification,
    data
  });

  const dead = [];
  resp.responses.forEach((r, i) => {
    if (!r.success && r.error &&
       (r.error.code === 'messaging/registration-token-not-registered' ||
        r.error.code === 'messaging/invalid-registration-token')) {
      dead.push(devices[i].key);
    }
  });
  if (dead.length) await Promise.all(dead.map(k => TOKENS_REF.child(k).remove()));

  const firstErr = (resp.responses.find(r => r.error) || {}).error;
  console.log(`📤 Delivered ${resp.successCount}/${devices.length}` +
    (dead.length ? ` · removed ${dead.length} stale token(s)` : '') +
    (firstErr ? ` · first failure: ${firstErr.code} ${firstErr.message}` : ''));
}

async function getState() {
  const snap = await STATE_REF.once('value');
  const v = snap.val() || {};
  return { known: v.knownKeys || {}, lastDailyDate: v.lastDailyDate || '' };
}

/* ─── Mode 1: poll for NEW orders ──────────────────────────── */
async function pollNewOrders() {
  const [state, snap] = await Promise.all([getState(), ORDERS_REF.once('value')]);
  const data = snap.val() || {};
  const allKeys = Object.keys(data);

  // First run ever: silently memorise history so the shop isn't
  // spammed with years-old "new order" bursts.
  if (!Object.keys(state.known).length) {
    const known = {};
    allKeys.slice(-KNOWN_LIMIT).forEach(k => { known[k] = true; });
    await STATE_REF.update({ knownKeys: known, lastRunAt: Date.now() });
    console.log(`🧷 Bootstrap: memorised ${allKeys.length} existing orders; staying silent.`);
    return;
  }

  const fresh = allKeys.filter(k => !state.known[k]);
  if (!fresh.length) {
    console.log('✔️ No new orders.');
    return;
  }
  console.log(`🔔 ${fresh.length} new order(s) detected.`);

  for (const key of fresh) {
    const o = data[key] || {};
    const name    = o.customerName || o.name || 'Unknown';
    const wRaw    = String(o.weightLabel || o.weight || '').trim();
    const weight  = (wRaw && wRaw.toLowerCase() !== 'custom') ? wRaw : '';
    const flavour = String(o.flavourName || o.flavour || '').trim();
    const body = [weight, flavour, o.total ? '৳' + Math.round(o.total) : '']
      .filter(Boolean).join(' · ');

    // Channel #1 — Telegram pop-up (persists until you remove it)
    if (TG_TOKEN && TG_CHAT) {
      const cakeDesc = [weight, flavourEnglish(o)].filter(Boolean).join(' ') || 'cake';
      const when     = humanDate(o.deliveryDate || o.date);
      const tmsg     = `🎂 ${name} just placed a ${cakeDesc} cake` +
                       (when ? ` for ${when}` : '') +
                       (o.total ? `\n💰 Total: ৳${Math.round(o.total)}` : '') +
                       `\n🕐 Order ID: ${o.orderId || key.slice(-6)}`;
      await sendTelegram(tmsg);
    }

    // Channel #2 — ntfy.sh push (lock-screen alert in seconds, no Telegram)
    {
      const cakeDesc = [weight, flavourEnglish(o)].filter(Boolean).join(' ') || 'cake';
      const when     = humanDate(o.deliveryDate || o.date);
      const nmsg     = `${name} just placed a ${cakeDesc} cake` +
                       (when ? ` for ${when}` : '') +
                       (o.total ? `\n💰 Total: ৳${Math.round(o.total)}` : '') +
                       `\n🕐 Order ID: ${o.orderId || key.slice(-6)}`;
      await sendNtfy('🎂 নতুন অর্ডার', nmsg);
    }

    // Channel #3 — FCM web-push to registered devices
    await sendToAll(
      {
        title: '🎂 নতুন অর্ডার: ' + name,
        body: body || 'নতুন অর্ডার!',
        icon: './logo.png',
        badge: './icons/icon-192.png',
        tag: 'nitu-order-' + key,
        renotify: true,
        click_action: './'
      },
      { url: './', tag: 'nitu-order-' + key }
    );
  }

  // Compact the remembered set to the newest KNOWN_LIMIT orders.
  const known = {};
  allKeys
    .sort((a, b) => ((data[a] && data[a].createdAt) || 0) - ((data[b] && data[b].createdAt) || 0))
    .slice(-KNOWN_LIMIT)
    .forEach(k => { known[k] = true; });
  await STATE_REF.update({ knownKeys: known, lastRunAt: Date.now() });
}

/* ─── Mode 2: daily morning summary with names ─────────────── */
async function dailySummary() {
  const today = bdDateString(new Date());
  const state = await getState();

  if (state.lastDailyDate === today) {
    console.log('✔️ Daily summary already sent today (' + today + ').');
    return;
  }

  const snap = await ORDERS_REF.once('value');
  const data = snap.val() || {};
  const names = [];

  Object.keys(data).forEach(key => {
    const o = data[key] || {};
    if (!isActive(o)) return;
    const dateStr = String(o.deliveryDate || o.date || '');   // both field styles
    if (dateStr.slice(0, 10) === today) {
      names.push(o.customerName || o.name || 'Unknown');
    }
  });

  // Mark BEFORE sending so a mid-run crash can't double-spam.
  await STATE_REF.update({ lastDailyDate: today });

  if (!names.length) {
    console.log(`✔️ ${today}: no deliveries today — nothing pushed.`);
    return;
  }

  const MAX_NAMES = 12;
  let body = names.slice(0, MAX_NAMES).map(n => '• ' + n).join('\n');
  if (names.length > MAX_NAMES) body += '\n• … +' + (names.length - MAX_NAMES) + ' জন';

  // At 09:00 Asia/Dhaka the UTC date still matches Bangladesh.
  const dow = DOW_BN[new Date().getUTCDay()];
  console.log(`📤 Daily summary for ${today} (${names.length}): ${names.join(', ')}`);
  await sendToAll(
    { title: `🚚 ${dow} — আজকের ডেলিভারি (${names.length})`, body },
    { url: './', tag: 'nitu-daily-' + today }
  );
  await sendNtfy(`🚚 ${dow} — আজকের ডেলিভারি (${names.length})`, body);
  await sendTelegram(`🚚 Today (${today}): ${names.length} delivery(s) — ${names.join(', ')}`);
}

/* ─── Entry point ──────────────────────────────────────────── */
(async () => {
  const daily = process.argv.includes('--daily');
  try {
    if (daily) await dailySummary();
    else       await pollNewOrders();
  } catch (err) {
    console.error('❌ FAILED:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    // Close RTDB connections so GitHub Actions exits promptly.
    await admin.app().delete().catch(() => {});
  }
})();