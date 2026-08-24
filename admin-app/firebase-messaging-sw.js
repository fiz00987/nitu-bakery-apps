/* ============================================================
   Nitu's Bakery — Firebase Cloud Messaging Service Worker
   Handles push messages when the app is in the background / closed.
   iOS note: Web Push on iPhone/iPad works ONLY when this PWA is
   installed ("Add to Home Screen") and served over HTTPS.
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
    badge: './icon-192.png',
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

/* ============================================================
   Offline app-shell caching (kept in this worker so the single
   service worker covers BOTH push messages and offline startup).
   ============================================================ */
var CACHE_NAME = 'nitu-bakery-v2';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () { self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);
  if (req.method !== 'GET') return;

  // Never intercept Firebase
  if (url.hostname.indexOf('firebaseio.com') !== -1 ||
      url.hostname.indexOf('firebasedatabase.app') !== -1 ||
      url.hostname.indexOf('googleapis.com') !== -1 && url.hostname !== 'fonts.googleapis.com' ||
      url.hostname.indexOf('gstatic.com') !== -1 && url.hostname !== 'fonts.gstatic.com') {
    return;
  }

  // Google Fonts: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (resp) {
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
          return resp;
        });
      })
    );
    return;
  }

  // App shell (same origin): network-first, cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
  }
});