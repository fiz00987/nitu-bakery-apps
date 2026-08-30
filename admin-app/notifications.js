
(function() {
  "use strict";
  if (!window.firebase) return;

  var db = firebase.database();
  var notifRef = db.ref("orders");
  var tokRef   = db.ref("pushTokens");
  var notifEnabled = false;
  var fcmToken = null;

  // ISO-safe localStorage wrapper (private mode safe)
  function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }

  // ─── Feature support ──────────────────────────────────────────
  function supportsNotification(){ return ("Notification" in window); }
  var isIos = isIosDevice && isIosDevice();

  // Tag every registered device with WHERE it subscribed from, so the
  // /pushTokens table instantly shows whether your APK wrapper,
  // Chrome PWA or desktop browser holds each token.
  function platformKind() {
    var ua = navigator.userAgent || "";
    var standalone = navigator.standalone ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    if (isIos) return standalone ? "ios-standalone" : "ios-browser";
    if (/android/i.test(ua)) {
      if (/;\s*wv\)/i.test(ua)) return "android-webview";   // wrapped APK
      return standalone ? "android-standalone" : "android-browser";
    }
    return "desktop";
  }

  // Self-contained toast (does not depend on the main App scope)
  function showNotifToast(msg) {
    try {
      var el = document.getElementById("toast");
      if (!el) return;
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(showNotifToast._t);
      showNotifToast._t = setTimeout(function(){ el.classList.remove("show"); }, 3500);
    } catch(e){}
  }

  // ─── Registration + FCM token (Web Push) ─────────────────────
  // On iOS the push subscription is only ready a moment AFTER the
  // service worker registers, so one immediate getToken() call often
  // fails with "notification permission has not been requested yet"
  // or "storage unavailable". We therefore RETRY quietly.
  var PUSH_RETRIES_LEFT = 10;
  function deviceKey() {
    var uid = lsGet("nitu-uid");
    if (!uid) { uid = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); lsSet("nitu-uid", uid); }
    var uaId = "";
    try { uaId = btoa((navigator.userAgent || "dev").slice(-24)).replace(/[^A-Za-z0-9]/g, ""); } catch(e) { uaId = "ua"; }
    return ("d-" + uid.slice(0, 8) + "-" + uaId.slice(0, 10)).toLowerCase();
  }
  function savePushToken(token) {
    fcmToken = token;
    lsSet("nitu-fcm-token", token);
    if (isIos && lsGet("nitu-ios-push-prompted") !== "1") {
      lsSet("nitu-ios-push-prompted", "1");
      showNotifToast("🍎 নোটিফিকেশন চালু হয়েছে — এখন অ্যাপটি বন্ধ থাকলেও খবর পাবেন!");
    }
    // Persist this device token so the cloud function can target it.
    var key = deviceKey();
    tokRef.child(key).set({
      token: token,
      ts: Date.now(),
      ua: (navigator.userAgent || "").slice(0, 80),
      platform: platformKind()
    }).then(function () {
      // Remove any OTHER entries pointing at a DIFFERENT token — stale
      // tokens make FCM deliveries fail silently over time.
      return tokRef.once("value").then(function (snapTokens) {
        var removes = [];
        snapTokens.forEach(function (child) {
          var v = child.val();
          if (v && v.token && v.token !== token && child.key !== key) removes.push(child.ref.remove());
        });
        return Promise.all(removes);
      });
    }).catch(function () {});
    notifEnabled = true;
    updateBellUI();
  }
  function updateBellDenied(msg) {
    var bell = document.getElementById("notif-bell");
    if (bell) bell.classList.add("denied");
    if (msg) console.warn("[push]", msg);
  }
  function attemptPushSubscription(isRetry) {
    // VAPID key missing: Web Push can never work. Fall back to the old
    // standard Notification API behaviour (Android foreground only).
    if (FCM_VAPID_MISSING) { updateBellUI(); return; }
    if (!(window.Notification && Notification.permission === "granted")) { updateBellUI(); return; }
    if (fcmToken || PUSH_RETRIES_LEFT <= 0) { updateBellUI(); return; }
    if (isRetry) PUSH_RETRIES_LEFT--;
    var delay = isRetry ? Math.min(200 * Math.pow(1.6, 10 - PUSH_RETRIES_LEFT), 4000) : 0;
    setTimeout(function () {
      registerServiceWorkers().then(function (reg) {
        if (!reg) {
          if (PUSH_RETRIES_LEFT > 0) attemptPushSubscription(true);
          else updateBellDenied("service worker registration failed");
          return;
        }
        var messaging = firebase.messaging();
        messaging.getToken({ vapidKey: FCM_VAPID_KEY }).then(function (token) {
          if (token) savePushToken(token);
          else if (PUSH_RETRIES_LEFT > 0) attemptPushSubscription(true);
          else updateBellDenied("empty FCM token");
        }).catch(function (err) {
          if (PUSH_RETRIES_LEFT > 0) attemptPushSubscription(true);
          else {
            updateBellDenied(err && err.message ? err.message : "getToken failed");
            if (isIos && !lsGet("nitu-push-error-shown")) {
              lsSet("nitu-push-error-shown", "1");
              alert("⚠️ iPhone-এ নোটিফিকেশন সেটআপ সম্ভব হয়নি।\n\nঅ্যাপটি বন্ধ করে Home Screen আইকন থেকে নতুন করে খুলুন এবং 🔔 বাটনে আবার চাপুন।\n\nসমস্যা থাকলে: Settings → Safari → Advanced → Experimental Features → 'Web Push' চালু আছে কিনা দেখুন।");
            }
          }
        });
      });
    }, delay);
  }
  function subscribePush() {
    attemptPushSubscription(false);
  }

  // ─── Foreground message handler (app is open) ────────────────
  function wireOnMessage() {
    if (!window.firebase.messaging) return;
    try {
      firebase.messaging().onMessage(function(payload) {
        var d = (payload && payload.data) || {};
        var n = (payload && payload.notification) || {};
        var title = n.title || d.title || "🎂 নিতুর বেকারি";
        var body  = n.body  || d.body  || "নতুন বিজ্ঞপ্তি";
        if (supportsNotification() && Notification.permission === "granted") {
          try { new Notification(title, { body: body, icon: "./logo.png", tag: "nitu-" + Date.now() }); } catch(e){}
        } else {
          showNotifToast(title + " — " + body);
        }
      });
    } catch(e){}
  }

  // ─── Bell UI + button (cross-platform) ───────────────────────
  function updateBellUI() {
    var bell = document.getElementById("notif-bell");
    if (!bell) return;
    bell.classList.add("active");
    bell.classList.remove("denied");
    // On iOS Safari (non-installed / no SW push) dim the bell and explain.
    if (isIos && !navigator.standalone && !("onappleinstallprompt" in window)) {
      bell.style.opacity = "0.6";
    } else {
      bell.style.opacity = "1";
    }
  }

  // ─── Bell button handler ─────────────────────────────────────
  window.App.toggleNotifications = function() {
    var iosInstallTip = "\n\niPhone-এ নোটিফিকেশন পেতে:\n1. Safari-তে এই অ্যাপ খুলুন\n2. শেয়ার (Share) বাটনে চাপুন\n3. \"হোম স্ক্রিনে যোগ করুন\" (Add to Home Screen)\n4. হোম স্ক্রিন আইকন থেকে অ্যাপ খুলুন";

    if (platformKind() === "android-webview") {
      alert("ℹ️ এই APK (WebView) অ্যাপ বন্ধ থাকলে push notification সাধারণত পাঠাতে পারে না — এটি Android-এর টেকনিক্যাল সীমাবদ্ধতা, আপনার সেটআপের সমস্যা নয়।\n\nনির্ভরযোগ্য উপায়:\n১. Chrome ব্রাউজারে অ্যাডমিন পেজটি খুলুন\n২. ⋮ মেনু → \"Add to Home screen\"\n৩. ওই নতুন আইকন থেকে অ্যাপ খুলে 🔔 একবার চাপুন\n\nতবুও এই APK খোলা থাকা অবস্থায় নতুন অর্ডারে লাল ব্যানার + শব্দ + 🔔 রিং পাবেন।");
    }

    if (isIos && !navigator.standalone) {
      alert("🔔 iPhone-এ নোটিফিকেশন পেতে অ্যাপ হিসেবে ইনস্টল করুন" + iosInstallTip);
      return;
    }

    if (!supportsNotification()) {
      // iOS installed PWA uses registration.showNotification via the push worker,
      // so fall back to request permission + subscribe.
      subscribePush();
      return;
    }

    if (Notification.permission === "denied") {
      alert("⚠️ নোটিফিকেশন ব্লক করা আছে।\nব্রাউজার সেটিংস থেকে নোটিফিকেশন অনুমতি দিন।");
      return;
    }

    if (Notification.permission === "granted") {
      if (FCM_VAPID_MISSING && !isIos) {
        alert("⚠️ Push notification key (VAPID) এখনো সেট করা হয়নি!\n\nFirebase Console → Project Settings → Cloud Messaging → Web Push certificates থেকে Key pair কপি করে admin-app/index.html-এর FCM_VAPID_KEY-এ বসান।\n\nতার আগে অ্যাপ বন্ধ থাকা অবস্থায় নোটিফিকেশন আসবে না।");
        return;
      }
      subscribePush();
      alert("✅ নোটিফিকেশন চালু আছে! নতুন অর্ডার ও প্রতিদিন ২ বার রিমাইন্ড পাবেন।");
      return;
    }

    Notification.requestPermission().then(function(perm) {
      notifEnabled = (perm === "granted");
      updateBellUI();
      if (perm === "granted") {
        subscribePush();
        try { new Notification("🎂 নিতুর বেকারি", { body: "নোটিফিকেশন সফলভাবে চালু হয়েছে!", tag: "nitu-test" }); } catch(e){}
      }
    });
  };

  // ─── Order notifications ─────────────────────────────────────
  function wt(o) {
    var w = (o && (o.weight || "")).toString().trim();
    if (!w || w.toLowerCase() === "custom") w = (o && (o.weightLabel || "")).toString().trim();
    return w || "";
  }

  function sendNotification(orderData) {
    var supported = supportsNotification();
    var granted = supported && Notification.permission === "granted";
    var name = orderData.customerName || orderData.name || "নতুন কাস্টমার";
    var source = orderData.source === "tally" ? " (Tally)" : "";
    var flav = orderData.flavourName || orderData.flavour || "";
    var body = [wt(orderData), flav, orderData.total ? "৳" + Math.round(orderData.total) : ""].filter(Boolean).join(" · ");
    // Android: native notification (free). iPhone: in-app banner handles it (no billing needed).
    if (granted && !isIos) {
      try {
        var n = new Notification("🎂 নতুন অর্ডার" + source + ": " + name, { body: body || "নতুন অর্ডার!", tag: "nitu-" + Date.now(), requireInteraction: true });
        n.onclick = function(){ window.focus(); n.close(); };
      } catch(e){}
    } else if (granted) {
      try { new Notification("🎂 নতুন অর্ডার", { body: name + " — " + (body||""), tag: "nitu-" + Date.now() }); } catch(e){}
    }
    // FREE cross-platform alert (always): sound + red banner + bell flash — works on Android AND iPhone
    playAlertSound();
    showOrderBanner(name, body);
    showNotifToast("🎂 নতুন অর্ডার: " + name + " — " + (body||""));
    var bell = document.getElementById("notif-bell");
    if (bell) { bell.classList.remove("ringing"); bell.offsetWidth; bell.classList.add("ringing"); setTimeout(function(){ bell.classList.remove("ringing"); }, 700); }
  }

  // Free alert helpers (sound + red banner) — no billing needed; works on both Android & iPhone
  var audioCtx;
  var alertBeep;

  // Red banner close button + prepare fallback Audio element (runs once at load)
  (function initAlertBanner() {
    var c = document.getElementById("ab-close");
    if (c) c.onclick = function() { var e = document.getElementById("alert-banner"); if (e) e.classList.remove("show"); };
    try {
      alertBeep = new Audio();
      alertBeep.volume = 0.4;
      alertBeep.src = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAAAAAAAAABkQeIAAAD/WAQBAAAAAA==";
    } catch(e) {}
  })();

  function playAlertSound() {
    try { (alertBeep && alertBeep.play && alertBeep.play().catch(function(){})); } catch(e) {}
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === "suspended") { try { audioCtx.resume(); } catch(e){} }
      var ctx = audioCtx;
      if (!ctx || ctx.state !== "running") return;
      var now = ctx.currentTime;
      [0, 0.22, 0.44].forEach(function(delay){
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(900 - (delay*140), now + delay);
        o.connect(g); g.connect(ctx.destination);
        g.setValueAtTime(0, now + delay);
        g.linearRampToValueAtTime(0.18, now + delay + 0.015);
        g.linearRampToValueAtTime(0, now + delay + 0.16);
        o.start(now + delay + 0.015);
        o.stop(now + delay + 0.16);
      });
    } catch(e){}
  }
  function showOrderBanner(name, body) {
    try {
      var el = document.getElementById("alert-banner");
      if (!el) return;
      var txt = document.getElementById("ab-text");
      if (txt) txt.textContent = "🎂 নতুন অর্ডার: " + (name || "") + (body ? " — " + body : "");
      el.classList.add("show");
      clearTimeout(showOrderBanner._hide);
      showOrderBanner._hide = setTimeout(function(){ el.classList.remove("show"); }, 6000);
    } catch(e){}
  }

  // ─── Listen for NEW orders only ──────────────────────────────
  notifRef.once("value").then(function(snap) {
    var known = {};
    var data = snap.val();
    if (data) Object.keys(data).forEach(function(k){ known[k]=true; });
    notifRef.on("child_added", function(cs) {
      if (known[cs.key]) { delete known[cs.key]; return; }
      var o = cs.val();
      if (o) sendNotification(o);
    });
  });

  // ─── Scheduled daily reminders (2x/day, foreground only) ─────
  var REMINDER_HOURS = [9, 18];
  var REMINDER_MSGS = [
    { t: "🎂 নিতুর বেকারি — দৈনিক রিমাইন্ডার", b: "আজকের অর্ডার চেক করুন এবং পেমেন্ট হিসাব মিলিয়ে নিন!" },
    { t: "🧁 নিতুর বেকারি — সন্ধ্যার রিমাইন্ডার", b: "আজকের ডেলিভারি শেষ হয়েছে কি? পেন্ডিং অর্ডার দেখুন!" }
  ];
  function checkReminders() {
    var supported = supportsNotification();
    var granted = supported && Notification.permission === "granted";
    if (!granted) return;
    var now = new Date();
    var h = now.getHours(), m = now.getMinutes();
    var today = now.toISOString().slice(0,10);
    for (var i=0;i<REMINDER_HOURS.length;i++){
      var key = "nitu-reminder-"+today+"-"+REMINDER_HOURS[i];
      if (lsGet(key)) continue;
      if (h === REMINDER_HOURS[i] && m < 15) {
        try {
          new Notification(REMINDER_MSGS[i].t, { body: REMINDER_MSGS[i].b, tag: key });
          lsSet(key, Date.now().toString());
        } catch(e){}
      }
    }
  }
  setTimeout(function(){
    registerServiceWorkers().then(function(){
      wireOnMessage();
      subscribePush();
    });
    updateBellUI();
    checkReminders();
  }, 400);
  setInterval(checkReminders, 60000);
})();
