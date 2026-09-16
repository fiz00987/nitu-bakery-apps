/* ============================================================
   Nitu's Bakery — Push Notification Sender (Cloud Functions)
   -------------------------------------------------------------
   This function triggers whenever a NEW order is written to
   /orders. It sends a Firebase Cloud Messaging push to every
   admin device that subscribed (tokens stored at /pushTokens by
   the admin app), so the bell rings even when the app is closed
   on BOTH Android and iPhone (installed PWA).

   SETUP (one-time, in the Firebase console / CLI):
     1) In Firebase console enable Cloud Messaging and copy your
        Web Push VAPID key into admin-app/index.html
        (FCM_VAPID_KEY constant).
     2) Blaze plan is REQUIRED for Cloud Functions + FCM.
     3) Run these from this repo root:
          npm install -g firebase-tools
          firebase login
          firebase projects:list
          # then, from the /cloud-functions folder:
          npm install firebase-functions firebase-admin
          firebase deploy --only functions

     4) After deploying, the Firebase console should list TWO functions:
          onOrderCreate     – instant "নতুন অর্ডার" push on every new order
          dailyOrderSummary – 09:00 Asia/Dhaka push with today's delivery
                              count AND customer names.
        Both require the Blaze plan and at least one device registered
        under /pushTokens (open the admin app and tap 🔔).
   ============================================================ */
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ─── Helpers shared by all notifications ───────────────────────
function loadTokens() {
  return admin.database().ref('/pushTokens').once('value').then((snapTokens) => {
    const tokens = [];
    snapTokens.forEach((child) => {
      const t = child.val() && child.val().token;
      if (t) tokens.push(t);
    });
    return tokens;
  });
}

function sendToTokens(tokens, notification, data) {
  if (!tokens.length) return Promise.resolve(null);
  return admin.messaging().sendEachForMulticast({ tokens, notification, data })
    .then((resp) => {
      // Clean up tokens that are no longer valid (device uninstalled)
      const failures = resp.responses.map((r, i) => r.success ? null : tokens[i])
        .filter(Boolean);
      if (!failures.length) return null;
      return admin.database().ref('/pushTokens').once('value').then((snapTokens) => {
        const removes = [];
        snapTokens.forEach((child) => {
          const t = child.val() && child.val().token;
          if (t && failures.indexOf(t) !== -1) removes.push(child.ref.remove());
        });
        return Promise.all(removes);
      });
    })
    .catch((err) => {
      console.error('FCM send failed:', err);
      return null;
    });
}

const TODAY_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

// ISO date (YYYY-MM-DD) for "now" in Bangladesh (UTC+6), regardless of
// which timezone the server runs in.
function bangladeshDateStr(now) {
  const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return bd.toISOString().slice(0, 10);
}

// Trigger when a NEW order is added to /orders/{orderId}
exports.onOrderCreate = functions.database
  .ref('/orders/{orderId}')
  .onCreate((snap, context) => {
    const order = snap.val() || {};
    const orderId = context.params.orderId;

    const name = order.name || 'Unknown';
    const source = order.source === 'tally' ? ' (Tally)' : '';
    const weight = (order.weight || order.weightLabel || '').toString().trim();
    const flavour = order.flavour ? String(order.flavour) : '';
    const body = [weight, flavour, order.total ? '৳' + Math.round(order.total) : '']
      .filter(Boolean)
      .join(' · ');

    const payload = {
      notification: {
        title: '🎂 নতুন অর্ডার' + source + ': ' + name,
        body: body || 'নতুন অর্ডার!',
        icon: './logo.png',
        badge: './icon-192.png',
        tag: 'nitu-order-' + orderId,
        renotify: true,
        click_action: './'
      },
      data: {
        url: './',
        tag: 'nitu-order-' + orderId
      }
    };

    // Gather every subscribed admin device token
    return loadTokens().then((tokens) =>
      sendToTokens(tokens, payload.notification, payload.data));
  });

// Daily morning summary: "আজ Xটি ডেলিভারি" + customer names.
// Runs at 9:00 Asia/Dhaka (03:00 UTC). Uses schedule v2 with an explicit
// time zone so the "today" window always matches Bangladesh dates.
exports.dailyOrderSummary = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Asia/Dhaka')
  .onRun(async () => {
    const today = bangladeshDateStr(new Date());
    // At 09:00 Asia/Dhaka the UTC date still equals the Bangladesh date,
    // so getUTCDay() gives the right weekday no matter where Google runs us.
    const dow = TODAY_BN[new Date().getUTCDay()];
    try {
      const snap = await admin.database().ref('/orders').once('value');
      const names = [];
      snap.forEach((child) => {
        const o = child.val() || {};
        const status = String(o.status || '').toLowerCase();
        if (status === 'delivered' || status === 'cancelled' ||
            status === 'completed' || status === 'complete') return;
        // Both the customer-app field name and the legacy/admin one.
        const dateStr = String(o.deliveryDate || o.date || '');
        if (dateStr.slice(0, 10) === today) {
          const nm = o.customerName || o.name || 'Unknown';
          names.push(nm);
        }
      });
      if (!names.length) return null;

      let body = names.slice(0, 10).map((n) => '• ' + n).join('\n');
      if (names.length > 10) body += '\n• … +' + (names.length - 10) + ' জন';
      return sendToTokens(await loadTokens(), {
        title: `🚚 ${dow} — আজকের ডেলিভারি (${names.length})`,
        body: body
      }, { url: './', tag: 'nitu-daily-' + today });
    } catch (err) {
      console.error('dailyOrderSummary failed:', err);
      return null;
    }
  });