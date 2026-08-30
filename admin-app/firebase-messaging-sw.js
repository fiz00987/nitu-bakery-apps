/* ============================================================
   Nitu's Bakery — Firebase Cloud Messaging Service Worker (v7, self-healing)
   Handles push messages when the app is in the background / closed,
   PLUS offline app-shell caching for instant startup.
   ------------------------------------------------------------
   iOS note: Web Push on iPhone/iPad works ONLY when this PWA is
   installed ("Add to Home Screen") and served over HTTPS.
   WHY v7: the previous worker could serve a REJECTED promise on
   navigation (pure WHITE SCREEN) when the network hiccupped while
   its offline cache was incomplete — common right after updates.
   This version can never white-screen: install never aborts on a
   single bad download, activate salvages the last good page from
   older caches, and navigation always resolves to something.
   ============================================================ */
'use strict';

// Import the Firebase messaging service worker (v9 compat).
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD9mGV0hogQ6AyPMznmEcZuAhFmIV3rh3M",
  projectId: "nitusbakingplanv2",
  messagingSenderId: "413436889702",
  appId: "1:413436889702:web:f0290fdc4b8d4e80d1bba7"
});

const messaging = firebase.messaging();

// Show/control the notification that FCM delivers in the background.
messaging.onBackgroundMessage(function (payload) {
  var data = (payload && payload.data) || {};
  var notif = (payload && payload.notification) || {};
  var title = notif.title || (data && data.title) || '🎂 নিতুর বেকারি';
  var body = notif.body || (data && data.body) || 'নতুন বিজ্ঞপ্তি';
  var options = {
    body: body,
    icon: './logo.png',
    badge: './icons/icon-192.png',
    tag: data && data.tag ? data.tag : ('nitu-' + Date.now()),
    renotify: true,
    data: {
      url: data && data.url ? data.url : './'
    }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if ('focus' in client) { client.navigate(url); return client.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* ─── Offline caching (bulletproof edition) ────────────────── */
var CACHE_NAME = 'nitu-bakery-v8';
var INDEX_KEY  = './index.html';
var APP_SHELL = [
  './index.html',
  './',
  './manifest.json',
  './logo.png',
  './logo-white.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// Friendly stand-in so the app NEVER loads to a white page offline.
// Auto-retries the real app every few seconds — once internet returns
// it recovers by itself.
function offlineFallbackResponse() {
  var html =
    '<!doctype html><html lang="bn"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>নিতুর বেকারি</title><style>' +
    'body{margin:0;font-family:-apple-system,sans-serif;background:#fff5f8;' +
    'display:flex;min-height:100vh;align-items:center;justify-content:center}' +
    '.c{text-align:center;padding:28px}.e{font-size:52px;margin-bottom:10px}' +
    'h2{margin:0 0 8px;color:#c2185b}p{color:#777;margin:0 0 18px}' +
    'button{border:0;background:#e91e63;color:#fff;padding:12px 26px;' +
    'border-radius:24px;font-size:15px}</style></head>' +
    '<body><div class="c"><div class="e">🎂</div>' +
    '<h2>ইন্টারনেট সংযোগ নেই</h2>' +
    '<p>সংযোগ ফিরলে অ্যাপ নিজে থেকেই চালু হবে…</p>' +
    '<button onclick="location.reload()">এখন আবার চেষ্টা করুন</button>' +
    '<script>setTimeout(function(){location.replace("./")},6000)<\/script>' +
    '</div></body></html>';
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(CACHE_NAME);
    // Each file downloads independently — ONE failure cannot abort
    // the whole install anymore (that was the white-screen seed).
    await Promise.allSettled(APP_SHELL.map(function (f) {
      return cache.add(f).catch(function () {});
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    var oldKeys = keys.filter(function (k) { return k !== CACHE_NAME; });
    var cache = await caches.open(CACHE_NAME);

    // SALVAGE: if this fresh install missed index.html (bad network at
    // update time), rescue the previous version's copy so the app can
    // still start fully instead of breaking.
    var haveIndex = await cache.match(INDEX_KEY);
    if (!haveIndex) {
      for (var i = 0; i < oldKeys.length; i++) {
        var oldCache = await caches.open(oldKeys[i]);
        var rescued = await oldCache.match(INDEX_KEY);
        if (rescued) { await cache.put(INDEX_KEY, rescued.clone()); break; }
      }
    }

    await Promise.all(oldKeys.map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

// Google Fonts: cache-first (they change effectively never).
async function fontCacheFirst(req) {
  var cached = await caches.match(req);
  if (cached) return cached;
  var resp = await fetch(req);
  if (resp.ok) {
    var clone = resp.clone();
    caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
  }
  return resp;
}

// App pages (navigations): network-first, then our cache, then ANY
// older cache, finally the friendly retry page. Never rejects —
// no more white screens regardless of network state.
async function documentNetFirst(req) {
  try {
    var resp = await fetch(new Request(req, { cache: 'no-store' }));
    var clone = resp.clone();
    caches.open(CACHE_NAME).then(function (c) { c.put(INDEX_KEY, clone); }).catch(function () {});
    return resp;
  } catch (netErr) {
    var cache = await caches.open(CACHE_NAME);
    var hit = (await cache.match(INDEX_KEY)) || (await cache.match('./'));
    if (!hit) {
      var keys = await caches.keys();
      for (var i = 0; i < keys.length; i++) {
        var oc = await caches.open(keys[i]);
        hit = (await oc.match(INDEX_KEY)) || (await oc.match('./'));
        if (hit) break;
      }
    }
    return hit || offlineFallbackResponse();
  }
}

// Static assets: network-first with cache fallback for offline cover.
async function assetNetFirst(req) {
  try {
    var resp = await fetch(new Request(req, { cache: 'no-store' }));
    var clone = resp.clone();
    caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); }).catch(function () {});
    return resp;
  } catch (e) {
    var hit = await caches.match(req);
    if (hit) return hit;
    throw e; // subresource failures degrade gracefully in the page
  }
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Never intercept Firebase / FCM traffic
  if (url.hostname.indexOf('firebaseio.com') !== -1 ||
      url.hostname.indexOf('firebasedatabase.app') !== -1 ||
      url.hostname.indexOf('gstatic.com') !== -1 && url.hostname !== 'fonts.gstatic.com' ||
      url.hostname.indexOf('googleapis.com') !== -1 && url.hostname !== 'fonts.googleapis.com') {
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontCacheFirst(req));
    return;
  }

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate' || req.destination === 'document') {
      event.respondWith(documentNetFirst(req));
    } else {
      event.respondWith(assetNetFirst(req));
    }
  }
});