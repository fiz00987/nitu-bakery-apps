/* Nitu's Bakery customer app — always-fresh service worker.
   It intentionally stores no app files. Every navigation and same-origin asset
   is requested with HTTP caching disabled, so a reopened app gets the current
   deployed version instead of an old cached order form. */
'use strict';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(new Request(event.request, { cache: 'no-store' })));
});
