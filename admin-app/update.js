/* Refresh only the app shell. Auth, saved orders, and note drafts are not caches. */
(function () {
  'use strict';
  var BUILD = '2026-10-11-delivery-agent-tab';
  var status = document.getElementById('update-status');
  var retry = document.getElementById('update-retry');
  var base = new URL('./', location.href);
  var entry = new URL('index.html', base);
  var destination = new URL(entry);
  destination.searchParams.set('build', BUILD);
  var running = false;

  async function download(url) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 30000);
    try {
      var response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('download');
      return response;
    } finally { clearTimeout(timer); }
  }

  async function update() {
    if (running) return;
    running = true;
    retry.hidden = true;
    status.textContent = 'নতুন অ্যাপ ফাইল ডাউনলোড করছি… / Downloading the latest app files…';
    try {
      var response = await download(destination.href);
      var parsed = new DOMParser().parseFromString(await response.clone().text(), 'text/html');
      var marker = parsed.querySelector('meta[name="admin-build"]');
      if (!marker || marker.content !== BUILD) throw new Error('old-version');
      var urls = Array.from(parsed.querySelectorAll('script[src],link[rel="stylesheet"][href]'))
        .map(function (node) { return new URL(node.getAttribute('src') || node.getAttribute('href'), entry); })
        .filter(function (url) { return url.origin === location.origin; });
      var files = await Promise.all(urls.map(async function (url) {
        return { url: url.href, response: await download(url.href) };
      }));
      // Update existing worker registrations in place, preserving push subscriptions.
      if ('serviceWorker' in navigator) {
        try {
          var registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.filter(function (reg) { return reg.scope === base.href; })
            .map(function (reg) { return reg.update().catch(function () {}); }));
        } catch (error) {}
      }
      // Warm both the current and legacy bakery caches with the verified entry.
      // An old worker can then recover the new page even if navigation goes offline.
      if ('caches' in window) {
        try {
          var keys = await caches.keys();
          var names = keys.filter(function (key) { return key.indexOf('nitu-bakery-') === 0; });
           if (!names.includes('nitu-bakery-v28')) names.push('nitu-bakery-v28');
          await Promise.all(names.map(async function (name) {
            var cache = await caches.open(name);
            await Promise.all([
              cache.put(entry.href, response.clone()), cache.put(base.href, response.clone()),
              cache.put(destination.href, response.clone()),
              ...files.map(function (file) { return cache.put(file.url, file.response.clone()); })
            ]);
          }));
        } catch (error) { /* Private browsing may disallow caches; use fresh network files. */ }
      }
      status.textContent = 'আপডেট প্রস্তুত। অ্যাপ খুলছি… / Update ready. Opening the admin app…';
      location.replace(destination.href);
    } catch (error) {
      status.textContent = error.message === 'old-version'
        ? 'নতুন ভার্সন এখনও লোড হয়নি। ইন্টারনেট সংযোগ দিয়ে আবার চেষ্টা করুন। / The latest version did not load. Reconnect and retry.'
        : 'আপডেট ডাউনলোড হয়নি। ইন্টারনেট সংযোগ দিয়ে আবার চেষ্টা করুন। / Could not download the update. Reconnect and retry.';
      retry.hidden = false;
    } finally { running = false; }
  }
  retry.addEventListener('click', update);
  update();
})();
