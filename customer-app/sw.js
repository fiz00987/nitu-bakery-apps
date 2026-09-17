/* Nitu's Bakery customer app — optimized service worker.
   Caches static assets for instant repeat loads while keeping the app shell fresh.
   Version 2: cache-first for static assets, network-first for HTML. */
'use strict';

var CACHE_NAME = 'nitu-cust-v2';
var STATIC_ASSETS = [
  './firebase-config.js',
  './utils.js',
  './logo.png',
  './manifest.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.allSettled(STATIC_ASSETS.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Cache-first for static assets (they rarely change, cache-busted when they do)
function cacheFirst(req) {
  return caches.match(req).then(function (cached) {
    if (cached) return cached;
    return fetch(req).then(function (resp) {
      if (resp.ok) {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
      }
      return resp;
    });
  });
}

// Network-first for HTML (always-fresh app shell)
function networkFirst(req) {
  return fetch(new Request(req, { cache: 'no-store' })).catch(function () {
    if (req.mode === 'navigate' || req.destination === 'document') {
      var html =
        '<!doctype html><html lang="bn"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>নিতুর বেকারি</title><style>' +
        'body{margin:0;font-family:-apple-system,sans-serif;background:#fff5f8;' +
        'display:flex;min-height:100vh;align-items:center;justify-content:center}' +
        '.c{text-align:center;padding:28px}.e{font-size:52px;margin-bottom:10px}' +
        '<h2>ইন্টারনেট সংযোগ নেই</h2>' +
        '<p>সংযোগ ফিরলে অ্যাপ নিজে থেকেই চালু হবে…</p>' +
        '<button onclick="location.reload()">এখন আবার চেষ্টা করুন</button>' +
        '<script>setTimeout(function(){location.reload()},6000)<\/script>' +
        '</div></body></html>';
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    throw new Error('offline');
  });
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url;
  try { url = new URL(event.request.url); } catch (e) { return; }

  // Never intercept Firebase traffic
  if (url.hostname.indexOf('firebaseio.com') !== -1 ||
      url.hostname.indexOf('googleapis.com') !== -1 ||
      url.hostname.indexOf('gstatic.com') !== -1) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first for speed
  var isStaticAsset = STATIC_ASSETS.some(function (asset) {
    return url.pathname.endsWith(asset.replace('./', ''));
  });

  if (isStaticAsset) {
    event.respondWith(cacheFirst(event.request));
  } else if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(networkFirst(event.request));
  }
  // Other resources (fonts etc.) bypass the worker
});
