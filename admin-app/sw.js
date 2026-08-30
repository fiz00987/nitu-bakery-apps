/* =============================================
   Nitu's Bakery — Service Worker
   Strategy:
   - App shell (index.html, manifest, icons): network-first,
     fall back to cache when offline — so updates apply
     instantly when online, but the app still opens offline.
   - Google Fonts: cache-first (they never change).
   - Firebase requests: never intercepted (realtime data
     must always go to the network; Firebase SDK has its
     own offline queue).
   ============================================= */
'use strict';

const CACHE_NAME = 'nitu-bakery-v7';

const APP_SHELL = [
  './',
  './index.html',
  './utils.js',
  './app.js',
  './notifications.js',
  './manifest.json',
  './logo.png',
  './logo-white.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// ─── Install: pre-cache the app shell ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old cache versions ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Never intercept Firebase (realtime DB, auth, etc.)
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebasedatabase.app') ||
      url.hostname.includes('googleapis.com') && url.hostname !== 'fonts.googleapis.com' ||
      url.hostname.includes('gstatic.com') && url.hostname !== 'fonts.gstatic.com') {
    return; // let the browser handle it directly
  }

  // Google Fonts: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return resp;
        })
      )
    );
    return;
  }

  // App shell (same-origin): network-first, cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return resp;
        })
        .catch(() =>
          caches.match(event.request).then(cached =>
            cached || caches.match('./index.html')
          )
        )
    );
  }
});
