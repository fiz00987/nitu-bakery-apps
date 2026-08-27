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
    const source  = o.source === 'tally' ? ' (Tally)' : '';
    const wRaw    = String(o.weightLabel || o.weight || '').trim();
    const weight  = (wRaw && wRaw.toLowerCase() !== 'custom') ? wRaw : '';
    const flavour = String(o.flavourName || o.flavour || '').trim();
    const body = [weight, flavour, o.total ? '৳' + Math.round(o.total) : '']
      .filter(Boolean).join(' · ');

    await sendToAll(
      {
        title: '🎂 নতুন অর্ডার' + source + ': ' + name,
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