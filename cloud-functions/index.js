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
   ============================================================ */
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
    return admin.database().ref('/pushTokens').once('value').then((snapTokens) => {
      const tokens = [];
      snapTokens.forEach((child) => {
        const t = child.val() && child.val().token;
        if (t) tokens.push(t);
      });
      if (tokens.length === 0) return null;

      return admin.messaging().sendEachForMulticast({
        tokens,
        notification: payload.notification,
        data: payload.data
      }).then((resp) => {
        // Clean up tokens that are no longer valid (device uninstalled)
        const failures = resp.responses.map((r, i) => r.success ? null : tokens[i])
          .filter(Boolean);
        if (failures.length) {
          const removes = [];
          snapTokens.forEach((child) => {
            const t = child.val() && child.val().token;
            if (t && failures.indexOf(t) !== -1) removes.push(child.ref.remove());
          });
          return Promise.all(removes);
        }
        return null;
      });
    })
    .catch((err) => {
      console.error('FCM send failed:', err);
      return null;
    });
  });