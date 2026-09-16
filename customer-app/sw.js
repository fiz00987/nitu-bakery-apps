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
  var url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // Still always-fresh by design (HTTP caching disabled), but the app can
  // NEVER white-screen anymore: if the network drops mid-launch or mid-use,
  // navigations get a friendly auto-retrying page instead of an error.
  event.respondWith(
    fetch(new Request(event.request, { cache: 'no-store' })).catch(function () {
      if (event.request.mode === 'navigate' || event.request.destination === 'document') {
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
          '<script>setTimeout(function(){location.reload()},6000)<\/script>' +
          '</div></body></html>';
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      throw new Error('offline');
    })
  );
});
