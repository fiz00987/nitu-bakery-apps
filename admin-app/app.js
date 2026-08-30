
/* =============================================================
   NITU BAKERY ORDER MANAGER — v4.0
   Professional, modular, ES6+ codebase
   Firebase Realtime Database · Mobile-first · Accessible
   ============================================================= */
'use strict';

window.App = (() => {

  // ─── Firebase ───────────────────────────────────────────────
  const firebaseConfig = {
    apiKey:            'AIzaSyD9mGV0hogQ6AyPMznmEcZuAhFmIV3rh3M',
    authDomain:        'nitusbakingplanv2.firebaseapp.com',
    databaseURL:       'https://nitusbakingplanv2-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId:         'nitusbakingplanv2',
    storageBucket:     'nitusbakingplanv2.firebasestorage.app',
    messagingSenderId: '413436889702',
    appId:             '1:413436889702:web:f0290fdc4b8d4e80d1bba7'
  };

  firebase.initializeApp(firebaseConfig);
  const db        = firebase.database();
  const auth      = firebase.auth();
  const ordersRef = db.ref('orders');

  // ─── State ───────────────────────────────────────────────────
  let orders        = [];
  let currentUser   = null;
  let editingId     = null;
  let activeTab     = 'plan';
  let isConnected   = false;
  let confirmCb     = null;
  let currentPhoto  = '';
  let currentPhotos = [];           // multi-photo (mirrors customer app)
  let sortMode      = 'date';       // 'date' | 'name' | 'due'
  let searchTimer   = null;
  let lang          = localStorage.getItem('nitu-lang') || 'bn';  // 'bn' | 'en'

  // ─── i18n dictionary ─────────────────────────────────────────
  const I18N = {
    bn: {
      brand: 'অর্ডার ম্যানেজার', connecting: 'ক্লাউডে সংযুক্ত হচ্ছে...',
      backup: '⬆ ব্যাকআপ', restore: '⬇ রিস্টোর',
      searchPlaceholder: 'অর্ডার নম্বর দিয়ে খুঁজুন...',
      allStatus: 'সব স্ট্যাটাস', st_confirmed: 'কনফার্মড', st_baking: 'বেক হচ্ছে',
      st_delivered: 'ডেলিভার্ড', st_cancelled: 'বাতিল',
      sumToday: 'আজ ডেলিভারি', sumBake: 'আজ রাতে বেক', sumWeek: 'এই সপ্তাহে',
      sumPending: 'পেন্ডিং', sumDone: 'সম্পন্ন',
      monthPlanned: 'এই মাসে অর্ডার', monthCompleted: 'এই মাসে সম্পন্ন',
      monthEarn: 'আয় (মোট বিক্রি)',
      monthEarnNote: '💡 ডেলিভারি চার্জ ও bKash চার্জ বাদে কেকের মোট বিক্রি। ডেলিভারি চার্জ পুরোটা ডেলিভারি এজেন্ট পান।',
      chartMonthlyOrders: '📊 মাসিক অর্ডার — শেষ ৫ মাস',
      tabPlan: 'প্ল্যান', tabAll: 'অর্ডার', tabDone: 'সম্পন্ন', tabRev: 'আয়',
      sort_date: 'তারিখ', sort_name: 'নাম', sort_due: 'বকেয়া',
      secPayment: '💳 পেমেন্ট', fTotal: 'মোট মূল্য (৳)', fPaid: 'পরিশোধিত (৳)',
      live: 'লাইভ', offline: 'সংযোগ নেই', saving: 'সেভ হচ্ছে...', conn: 'সংযোগ...',
      cakePayment: 'কেকের পেমেন্ট', bkashDeducted: 'bKash চার্জ বাদ',
      payFullOpt: '✅ ফুল পেমেন্ট — bKash চার্জ + ডেলিভারি চার্জ সহ',
      fReceiver: 'রিসিভারের নাম', fReceiverPhone: 'রিসিভারের ফোন',
      call: '📞 কল', markPaid: '✅ সম্পূর্ণ পরিশোধ', copyPhone: '📱 ফোন কপি',
      due: 'বকেয়া', paidFull: 'পরিশোধিত ✅', delCharge: 'ডেলিভারি চার্জ',
      todayTitle: '🚚 আজকের ডেলিভারি ({n})',
      dailyNew: 'আজকের নতুন',
    },
    en: {
      brand: 'Order Manager', connecting: 'Connecting to cloud...',
      backup: '⬆ Backup', restore: '⬇ Restore',
      searchPlaceholder: 'Search by order number...',
      allStatus: 'All Status', st_confirmed: 'Confirmed', st_baking: 'Baking',
      st_delivered: 'Delivered', st_cancelled: 'Cancelled',
      sumToday: 'Today\'s Delivery', sumBake: 'Bake Tonight', sumWeek: 'This Week',
      sumPending: 'Pending', sumDone: 'Done',
      monthPlanned: 'Orders This Month', monthCompleted: 'Completed This Month',
      monthEarn: 'Earn (Total Sale)',
      monthEarnNote: '💡 Total cake sale excluding delivery & bKash charges. The delivery fee goes fully to the delivery agent.',
      chartMonthlyOrders: '📊 Orders per Month — Last 5',
      tabPlan: 'Plan', tabAll: 'Orders', tabDone: 'Done', tabRev: 'Revenue',
      sort_date: 'Date', sort_name: 'Name', sort_due: 'Due',
      secPayment: '💳 Payment', fTotal: 'Total Price (৳)', fPaid: 'Paid (৳)',
      live: 'Live', offline: 'Offline', saving: 'Saving...', conn: 'Connecting...',
      cakePayment: 'Cake Payment', bkashDeducted: 'bKash charge deducted',
      payFullOpt: '✅ Full Payment — incl. bKash charge + delivery',
      fReceiver: 'Receiver Name', fReceiverPhone: 'Receiver Phone',
      call: '📞 Call', markPaid: '✅ Mark Fully Paid', copyPhone: '📱 Copy Phone',
      due: 'Due', paidFull: 'Paid ✅', delCharge: 'Delivery Charge',
      todayTitle: "Today's deliveries ({n})",
      dailyNew: "Today's New",
    }
  };

  const tr = key => (I18N[lang] && I18N[lang][key]) || (I18N.bn[key]) || key;

  // ─── Date helpers ────────────────────────────────────────────
  const toDate  = s => new Date(s + 'T00:00:00');
  const today0  = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

  const fmtDate = s => {
    const d = toDate(s);
    const DAYS   = ['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'];
    const MONTHS = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টে','অক্টো','নভে','ডিসে'];
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const fmtMoney = n => {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString('bn-BD');
  };

  // Effective amount that actually counts toward the cake.
  // If the customer sent money with the bKash cash-out charge included,
  // that charge is NOT payment for the cake, so we subtract it.
  const bkashCharge   = o => Math.max(0, Number(o.bkashCharge) || 0);
  const effectivePaid = o => Math.max(0, (Number(o.paid) || 0) - bkashCharge(o));
  const dueAmt        = o => Math.max(0, (o.total || 0) - effectivePaid(o));

  const normalizeCustomerOrder = o => {
    if (o.customerName && !o.name) o.name = o.customerName;
    if (o.customerPhone && !o.phone) o.phone = o.customerPhone;
    if (o.deliveryDate && !o.date) o.date = o.deliveryDate;
    if (o.deliveryAddress && !o.address) o.address = o.deliveryAddress;
    if (o.timeSlotLabel && !o.time) o.time = o.timeSlotLabel;
    if (o.weightLabel && (!o.weight || String(o.weight).toLowerCase() === 'custom')) o.weight = o.weightLabel;
    if (o.flavourName && !o.flavour) o.flavour = o.flavourName;
    // Repair/upgrade flavour data: fill a blank flavour from its Bengali
    // label (e.g. orders damaged by old edit-modal bug), derive a missing
    // Bengali name from a known id, and convert known ids to their display
    // name so the card shows what the customer actually chose.
    if (!o.flavourName && o.flavour && FLAVOUR_MAP[o.flavour]) o.flavourName = FLAVOUR_MAP[o.flavour];
    if (o.flavour && FLAVOUR_MAP[o.flavour]) o.flavour = FLAVOUR_MAP[o.flavour];
    if (o.cakeWriting && !o.writing) o.writing = o.cakeWriting;
    if (o.cakePrice != null && !o.total) o.total = Number(o.cakePrice);
    if (o.deliveryCharge != null && o.deliveryAmount == null) o.deliveryAmount = Number(o.deliveryCharge);
    if (o.fulfilment === 'pickup' && o.deliveryPaid == null) o.deliveryPaid = 'na';
    if (o.fulfilment === 'delivery' && o.deliveryPaid == null) o.deliveryPaid = o.deliveryAmount > 0 ? 'unpaid' : 'na';
    if (o.advanceTotal != null && o.paid == null) o.paid = Number(o.advanceTotal);
    if (o.paymentCharges != null && o.bkashCharge == null) o.bkashCharge = Number(o.paymentCharges);
    if (o.fulfilment === 'pickup' && !o.address) o.address = 'Self pickup: Rongdhonu apartment, Khoshalshah road, Amanbazar, Hathazari Road, Chattogram';
    return o;
  };

  // Flavour map mirrors customer-app utils.js: converts machine ids like
  // 'white-forest' to display names, so admin edits can never blank out a
  // stored flavour and cards always show the Bengali name customers chose.
  const FLAVOUR_MAP = {
    'vanilla-sponge': 'ভ্যানিলা স্পঞ্জ',
    'chocolate-sponge': 'চক্লেট স্পঞ্জ',
    'double-layer-chocolate': 'ডাবল লেয়ারড চকলেট',
    'black-forest': 'ব্ল্যাক ফরেস্ট',
    'white-forest': 'হোয়াইট ফরেস্ট',
    'lemon': 'লেমন কেক',
    'orange': 'অরেঞ্জ কেক',
    'strawberry': 'স্ট্রবেরি কেক',
    'blueberry': 'ব্লুবেরি',
    'malai': 'মালাই কেক',
    'butterscotch': 'বাটারস্কচ কেক',
    'special-vanilla': 'স্পেশাল ভ্যানিলা',
    'chocolate-mud': 'চকলেট মাডকেক',
    'red-velvet': 'রেড ভেলভেট',
    'cream-cheese-fruit': 'ক্রিম চিজ ফ্রস্টিং উইথ ফ্রুট ফিলিং',
    'vanilla-whipped-cream': 'ভ্যানিলা হুইপড ক্রিম',
    'choco-truffle': 'চকো ট্রাফল',
    'mango-mousse': 'ম্যাংগো মুস'
  };
  // Single source of truth for displaying a flavour on cards/messages:
  // known id → mapped Bengali name; else stored Bengali name; else raw text.
  const flavourLabel = o => FLAVOUR_MAP[o.flavour] || o.flavourName || o.flavour || '';

  // Weight display: prefer the raw weight text written by the customer.
  // Legacy customer orders stored weight='custom' with the real text in
  // weightLabel, so fall back to that label when weight is missing or
  // still the placeholder value 'custom'.
  const weightText = o => {
    const w  = (o.weight || '').trim();
    const wl = (o.weightLabel || '').trim();
    return (w && w.toLowerCase() !== 'custom') ? w : (wl || w);
  };

  // ─── HTML escaping ───────────────────────────────────────────
  const esc = s => {
    if (s == null) return '';
    return String(s)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  };

  // ─── i18n engine ─────────────────────────────────────────────
  const applyI18n = () => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang);
    // textContent for [data-i18n]
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = tr(el.getAttribute('data-i18n'));
    });
    // placeholder for [data-i18n-ph]
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.setAttribute('placeholder', tr(el.getAttribute('data-i18n-ph')));
    });
    // toggle buttons
    document.getElementById('lang-bn').classList.toggle('active', lang === 'bn');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    // sort button label
    document.getElementById('sort-label').textContent = tr('sort_' + sortMode);
  };

  const setLang = l => {
    lang = l;
    localStorage.setItem('nitu-lang', l);
    applyI18n();
    render();
  };

  // ─── Sync status ─────────────────────────────────────────────
  const setSyncStatus = (state, msg) => {
    const pill  = document.getElementById('status-pill');
    const dot   = document.getElementById('sync-dot');
    const label = document.getElementById('sync-label');
    const sub   = document.getElementById('last-sync-text');

    dot.className = 'sync-dot' + (state === 'ok' ? '' : ` ${state}`);
    label.textContent = state === 'ok' ? tr('live') : state === 'error' ? tr('offline') : tr('saving');
    pill.className    = 'status-pill' + (state === 'error' ? ' error' : '');
    if (msg) sub.textContent = msg;
    if (state === 'ok') {
      const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
      sub.textContent = (lang === 'bn' ? '☁️ সব ডেটা ক্লাউডে সেভ · ' : '☁️ All data saved to cloud · ')
        + new Date().toLocaleTimeString(locale);
    }
  };

  // ─── Today's-delivery banner (always visible in-app) ─────────
  // Sticky: stays open until nothing active is left for today.
  let todayBannerTimer = null;
  const showTodayBanner = (title, namesText) => {
    try {
      const el  = document.getElementById('today-banner');
      const ttl = document.getElementById('tb-title');
      const lst = document.getElementById('tb-list');
      if (!el) return;
      if (ttl) ttl.textContent = title;
      if (lst) {
        lst.innerHTML = '';
        String(namesText).split('\n').forEach(line => {
          const d = document.createElement('div');
          d.className   = 'tb-item';
          d.textContent = line;
          lst.appendChild(d);
        });
      }
      el.classList.add('show');
      clearTimeout(todayBannerTimer);
      // Auto-hide after 10s ONLY when every order for today is done,
      // otherwise it keeps pulsing as a reminder that work remains.
      const stillOpen = orders.some(isActiveOrder);
      if (!stillOpen) todayBannerTimer = setTimeout(() => el.classList.remove('show'), 10000);
      document.getElementById('tb-close').onclick = () => el.classList.remove('show');
    } catch (e) {}

    // System notification on top (bell icon already granted permission)
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: namesText, tag: 'nitu-today-' + new Date().toISOString().slice(0, 10), renotify: true });
      }
    } catch (e) {}
  };

  // ─── Toast ───────────────────────────────────────────────────
  let toastTimer = null;
  const showToast = msg => {
    const el = document.getElementById('toast');
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  };

  // ─── Instant Telegram bridge + heartbeat (channel #1 backup) ─────
  // NOTE: lives in the same closure as the Firebase listeners below
  // (moved from script block #3 — cross-block calls were crashing render).
  var TG_CFG = null, tgCfgFetched = false;
  function fetchTgConfig() {
    if (!tgCfgFetched) {
      tgCfgFetched = true;
      fetch('./telegram-config.json?cb=' + Date.now())
        .then(r => r.ok ? r.json() : null)
        .then(cfg => { TG_CFG = (cfg && cfg.botToken && cfg.chatId) ? cfg : null; })
        .catch(() => { TG_CFG = null; });
    }
    return Promise.resolve(TG_CFG);
  }
  fetchTgConfig();
  setInterval(fetchTgConfig, 6 * 60 * 60 * 1000);

  function _tgHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var _tgEscapeSafe = _tgHtml;
  function sendTelegramNow(text) {
    return fetchTgConfig().then(cfg => {
      if (!cfg) return false;
      try {
        var ctl = new AbortController();
        setTimeout(() => ctl.abort(), 8000);
        return fetch('https://api.telegram.org/bot' + cfg.botToken + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: cfg.chatId, text: text }),
          signal: ctl.signal
        }).then(r => r.ok).catch(() => false);
      } catch (e) { return false; }
    });
  }
  const HB_FLAV_EN = {
    'vanilla-sponge': 'Vanilla Sponge', 'chocolate-sponge': 'Chocolate Sponge',
    'double-layer-chocolate': 'Double Layered Chocolate', 'black-forest': 'Black Forest',
    'white-forest': 'White Forest', 'lemon': 'Lemon Cake', 'orange': 'Orange Cake',
    'strawberry': 'Strawberry Cake', 'blueberry': 'Blueberry', 'malai': 'Malai Cake',
    'butterscotch': 'Butterscotch Cake', 'special-vanilla': 'Special Vanilla',
    'chocolate-mud': 'Chocolate Mud Cake', 'red-velvet': 'Red Velvet',
    'cream-cheese-fruit': 'Cream Cheese Fruit'
  };
  const HB_MO_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function hbHumanWhen(dstr) {
    var d = String(dstr || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      var p = d.split('-');
      return (+p[2]) + ' ' + HB_MO_EN[(+p[1]) - 1] + ' ' + p[0];
    }
    return d;
  }

  // ─── Firebase listeners ──────────────────────────────────────
  // Auth state listener - MUST be set up before database listeners
  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      // User is signed in - show main app
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('last-sync-text').textContent = user.email;
      // Start listening to orders
      ordersRef.on('value', snap => {
        isConnected = true;
        setSyncStatus('ok');
        orders = [];
        const data = snap.val();
        if (data) {
          Object.keys(data).forEach(k => {
            const o = normalizeCustomerOrder(data[k]);
            o.firebaseKey = k;
            orders.push(o);
          });
        }
        detectNewOrdersRealtime(orders);
        sortOrders();
        render();
        updateDailyBadge();
        // On the very first snapshot of a session, pop the daily
        // "orders placed today" list (only when there is something to show)
        if (!dailyPopupShownThisSession) {
          dailyPopupShownThisSession = true;
          if (todaysPlacedOrders().length > 0) showDailyPopup();
        }
      }, err => {
        console.error('Firebase error:', err);
        setSyncStatus('error', '❌ সংযোগ বিচ্ছিন্ন — ইন্টারনেট চেক করুন');
        render();
      });
    } else {
      // User is signed out - show login screen
      document.getElementById('login-screen').classList.remove('hidden');
      orders = [];
      lastTodaysNotifyKey = '';  // allow the banner again next login/day
      render();
    }
  });

  // ─── Heartbeat engine (Telegram channel; lives in THIS closure so the
  //     live listener above can always reach it — never move to block #3) ──
  var hbKnownIds = {};
  try { hbKnownIds = JSON.parse(localStorage.getItem('nitu_hb_known') || '{}'); } catch (e) { hbKnownIds = {}; }
  var HB_BOOT_DONE = false;

  function trimHbMemory() {
    try {
      var ids = Object.keys(hbKnownIds);
      if (ids.length <= 300) return;
      hbKnownIds = {};
      ids.slice(-300).forEach(k => { hbKnownIds[k] = true; });
    } catch (e) {}
  }

  function orderAlertText(o) {
    var name  = o.customerName || o.name || 'Unknown';
    var wRaw  = String(o.weightLabel || o.weight || '').trim();
    var w     = (wRaw && wRaw.toLowerCase() !== 'custom') ? wRaw : '';
    var flavN = o.flavourName || HB_FLAV_EN[o.flavour] || '';
    var when  = hbHumanWhen(o.deliveryDate || o.date);
    var due   = Math.max(0, Math.round((o.total || 0) - ((o.advanceTotal != null ? o.advanceTotal : o.advance) || 0)));
    return '🎂 ' + _tgHtml(name) + ' just placed a ' +
      _tgEscapeSafe(((w ? w + ' ' : '') + (flavN || '')).trim() || 'cake') + ' cake' +
      (when ? ' for ' + _tgEscapeSafe(when) : '') +
      (o.total ? '\n💰 Total: ৳' + Math.round(o.total) : '') +
      (due > 0 ? '\n⚠️ Due: ৳' + due : '') +
      '\n🕐 Order ID: ' + _tgEscapeSafe(o.orderId || '');
  }

  function detectNewOrdersRealtime(ordersArr) {
    try {
      if (!HB_BOOT_DONE) {
        HB_BOOT_DONE = true;
        (ordersArr || []).forEach(o => { if (o && o.firebaseKey) hbKnownIds[o.firebaseKey] = true; });
        trimHbMemory();
        try { localStorage.setItem('nitu_hb_known', JSON.stringify(hbKnownIds)); } catch (e) {}
        repairStuckDeliveries(null);
        return;
      }
      var unseen = (ordersArr || []).filter(o => o && o.firebaseKey && !hbKnownIds[o.firebaseKey]);
      unseen.forEach(o => { hbKnownIds[o.firebaseKey] = true; });
      if (unseen.length) {
        trimHbMemory();
        try { localStorage.setItem('nitu_hb_known', JSON.stringify(hbKnownIds)); } catch (e) {}
        unseen.forEach(o => { console.log('[heartbeat] new order:', o.orderId || o.firebaseKey); });
        unseen.forEach(o => { sendTelegramNow(orderAlertText(o)); });
      }
    } catch (hbErr) { console.error('[heartbeat] fault contained:', hbErr); }
  }

  // Every 10 min: ensure Telegram knows about every pending customer order.
  // If any other layer ever stalls, this sweep guarantees delivery.
  function repairStuckDeliveries(listOverride) {
    var job = listOverride ? Promise.resolve(listOverride)
      : Promise.resolve().then(() => {
          if (!currentUser) return null;
          return ordersRef.once('value').then(snap => {
            var out = [];
            var data = snap.val() || {};
            Object.keys(data).forEach(k => {
              var o = normalizeCustomerOrder(data[k]);
              o.firebaseKey = k;
              out.push(o);
            });
            return out;
          });
        });
    return job.then(list => {
      if (!list || !list.length) return;
      var missing = [];
      list.forEach(o => {
        if (o && o.firebaseKey &&
            o.source === 'customer' &&
            String(o.status || '') !== 'delivered' &&
            String(o.status || '') !== 'cancelled' &&
            !hbKnownIds[o.firebaseKey]) {
          missing.push(o);
        }
      });
      if (!missing.length) return;
      console.log('[heartbeat] repairing ' + missing.length + ' stuck order(s)');
      missing.forEach(o => { sendTelegramNow(orderAlertText(o)); });
      missing.forEach(o => { hbKnownIds[o.firebaseKey] = true; });
      trimHbMemory();
      try { localStorage.setItem('nitu_hb_known', JSON.stringify(hbKnownIds)); } catch (e) {}
    }).catch(() => {});
  }
  setInterval(() => { try { repairStuckDeliveries(null); } catch (e) {} }, 10 * 60 * 1000);

  setTimeout(() => {
    if (!isConnected) setSyncStatus('error', '❌ সংযোগ ব্যর্থ হয়েছে');
  }, 6000);

  db.ref('.info/connected').on('value', snap => {
    if (isConnected && !snap.val()) setSyncStatus('error', '✈️ অফলাইন — পুনরায় সংযুক্ত হলে সিঙ্ক হবে');
    else if (snap.val() && isConnected) setSyncStatus('ok');
  });

  // File import listener
  document.getElementById('import-file').addEventListener('change', e => importData(e));

  // Search debounce
  // Search only by order number (debounced)
  document.getElementById('search-input').addEventListener('input', () => {
    const val = document.getElementById('search-input').value;
    document.getElementById('search-clear').classList.toggle('visible', val.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 200);
  });

  // ─── Sorting ─────────────────────────────────────────────────
  const sortOrders = () => {
    orders.sort((a, b) => {
      if (sortMode === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortMode === 'due')  return dueAmt(b) - dueAmt(a);
      return toDate(a.date || '2099-01-01') - toDate(b.date || '2099-01-01');
    });
  };

  const toggleSort = () => {
    const modes = ['date','name','due'];
    const labels = { date: '⇅ তারিখ', name: '⇅ নাম', due: '⇅ বকেয়া' };
    sortMode = modes[(modes.indexOf(sortMode) + 1) % modes.length];
    document.getElementById('sort-btn').textContent = labels[sortMode];
    sortOrders();
    render();
    showToast(`সাজানো হচ্ছে: ${labels[sortMode].replace('⇅ ','')}`);
  };

  // ─── Filtering ───────────────────────────────────────────────
  const getFiltered = pool => {
    const q = (document.getElementById('search-input').value || '').toLowerCase().trim();
    if (!q) return pool;
    return pool.filter(o => String(o.orderId || '').toLowerCase().includes(q));
  };

  const clearSearch = () => {
    document.getElementById('search-input').value = '';
    document.getElementById('search-clear').classList.remove('visible');
    render();
  };

  // ─── Chip / status helpers ───────────────────────────────────
  const colClass = o => ({
    delivered: 'col-delivered',
    baking:    'col-baking',
    cancelled: 'col-cancelled'
  })[o.status] || 'col-confirmed';

  const statusChip = o => {
    const map = {
      delivered: ['chip-green', 'ডেলিভার হয়েছে 🎉'],
      baking:    ['chip-amber', 'বেক হচ্ছে 🔄'],
      cancelled: ['chip-gray',  'বাতিল ❌']
    };
    const [cls, lbl] = map[o.status] || ['chip-pink', 'কনফার্মড ✅'];
    return `<span class="chip ${cls}">${lbl}</span>`;
  };

  const countdownChip = dateStr => {
    if (!dateStr) return '';
    const diff = Math.round((toDate(dateStr) - today0()) / 86_400_000);
    if (diff < 0)  return `<div class="countdown overdue">⚠️ ${Math.abs(diff)} দিন দেরি</div>`;
    if (diff === 0) return `<div class="countdown urgent">🚀 আজকে!</div>`;
    if (diff === 1) return `<div class="countdown urgent">🌙 আগামীকাল</div>`;
    if (diff <= 3)  return `<div class="countdown soon">${diff} দিন বাকি</div>`;
    return `<div class="countdown later">${diff} দিন বাকি</div>`;
  };

  // ─── SRS message builder ─────────────────────────────────────
  const buildSrsMsg = o => {
    // Receiver name and phone are stored separately now; combine them so the
    // phone regex below still finds the receiver's number.
    const rp = [o.receiver, o.receiverPhone].filter(Boolean).join(' ');
    const pm = rp.match(/(\+?880)?0?1[0-9]{9}/);
    let msg = `আপনার নামঃ ${o.name}\n`;
    msg += `ডেলিভারি পয়েন্টঃ ${o.address || ''}\n`;
    msg += `ডেলিভারির তারিখ এবং সময়ঃ ${o.date ? fmtDate(o.date) : ''} — ${o.time || ''}\n`;
    msg += `রিসিভার এর ফোন নাম্বারঃ ${pm ? pm[0] : rp}\n\nCake ${weightText(o)}\n`;
    // Cake due (total minus what actually counts toward the cake, i.e. excluding
    // any bKash cash-out charge) so the SRS message states the full-payment due.
    const cakeDue = Math.max(0, (Number(o.total) || 0) - Math.max(0, (Number(o.paid) || 0) - bkashCharge(o)));
    if (cakeDue > 0) msg += `Cake due: ${fmtMoney(cakeDue)}/-\n`;
    if (o.deliveryPaid === 'unpaid' && o.deliveryAmount > 0) msg += `due: Delivery charge (${o.deliveryAmount}/-)`;
    else if (o.deliveryPaid === 'unpaid') msg += `due: Delivery charge`;
    else msg += `Delivery charge: Paid`;
    return msg;
  };

  // ─── Copy-to-notepad (full order text) ─────────────────────────
  const buildNotepadText = o => {
    const L = [];
    // Header
    L.push('🔰🔰🔰🔰🔰🔰');
    L.push('');
    // Delivery day line
    L.push(`🔴${o.date || ''}${o.time ? ' ' + o.time : ''}-`);
    L.push('');
    // Customer name
    L.push(`${o.name || ''}`);
    L.push('');
    // Weight + flavour
    L.push(`${weightText(o)}${weightText(o) && o.flavour ? ' ' : ''}${flavourLabel(o)}`);
    L.push('');
    // Size
    if (o.size) { L.push(`size- ${o.size}`); L.push(''); }
    // Writing
    if (o.writing) { L.push('Writing on board fondant-'); L.push(''); L.push(`${o.writing}`); L.push(''); L.push(''); }

    // Customer-facing summary
    L.push(`◾আপনার নামঃ ${o.name || ''}`);
    L.push('');
    L.push(`◾ডেলিভারি পয়েন্টঃ ${o.address || ''}`);
    L.push('');
    L.push(`◾ডেলিভারির তারিখ এবং সময়ঃ ${o.date || ''}${o.time ? ' ' + o.time : ''}`);
    L.push('');
    L.push(`◾রিসিভার এর ফোন নাম্বারঃ ${o.receiverPhone || ''}`);
    L.push('');
    L.push(`◾বিকাশ করে থাকলে লাস্ট ৩ডিজিটঃ ${o.trx || ''}`);
    L.push('');
    L.push('');

    // Payment summary
    const methodName = (o.paymentMethodName || o.paymentChargesLabel || o.paymentMethod || '').toLowerCase();
    L.push(`Total- ${Math.round(Number(o.total) || 0)}+ Delivery charge`);
    L.push('');
    L.push(`Paid- ${Math.round(Number(o.paid) || 0)}/- with ${methodName} charge`);
    L.push('');
    L.push(`due : Delivery charge ( ${Math.round(Number(o.deliveryAmount) || 0)}/- )`);

    return L.join('\n');
  };

  // ─── Detail row helper ───────────────────────────────────────
  const drow = (icon, label, val) => {
    if (val == null || val === '' || val === 'Na' || val === 'undefined') return '';
    val = String(val).trim();
    if (!val) return '';
    return `<div class="detail-row">
      <div class="detail-icon">${icon}</div>
      <div class="detail-body">
        <div class="detail-label">${label}</div>
        <div class="detail-val">${esc(val)}</div>
      </div>
    </div>`;
  };

  // ─── Payment progress bar ────────────────────────────────────
  const payProgressBar = o => {
    const total = o.total || 0;
    const paid  = effectivePaid(o);
    if (total <= 0) return '';
    const pct = Math.min(100, Math.round((paid / total) * 100));
    const fillClass = pct >= 100 ? '' : pct > 0 ? 'partial' : 'zero';
    return `
      <div class="pay-progress-wrap">
        <div class="pay-progress-label">
          <span>পেমেন্ট অগ্রগতি</span>
          <span>${pct}% পরিশোধিত</span>
        </div>
        <div class="pay-progress-bar">
          <div class="pay-progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
      </div>`;
  };

  // ─── Render a single card ────────────────────────────────────
  const renderCard = o => {
    const d          = dueAmt(o);
    const t          = today0();
    const dd         = o.date ? toDate(o.date) : null;
    const isPast     = dd && dd < t && o.status !== 'delivered' && o.status !== 'cancelled';
    const isOvdPay   = d > 0 && isPast;
    const fk         = o.firebaseKey;

    const dueChip      = d > 0
      ? `<span class="chip chip-red">বকেয়া ৳${fmtMoney(d)}</span>`
      : `<span class="chip chip-green">পরিশোধিত ✅</span>`;
    const surpriseChip = o.surprise === 'yes' ? `<span class="chip chip-purple">🎁 সারপ্রাইজ</span>` : '';
    const tallyBadge   = o.source === 'tally'  ? `<span class="chip chip-tally">Tally</span>` : '';
    const customerBadge = o.source === 'customer' ? `<span class="chip chip-customer">অনলাইন অর্ডার</span>` : '';
    const deliveryChip = o.deliveryPaid === 'paid'
      ? `<span class="chip chip-green">🚚 ডেল. পরিশোধিত</span>`
      : o.deliveryPaid === 'unpaid'
      ? `<span class="chip chip-amber">🚚 ডেল. বাকি</span>` : '';
    const cdChip = (o.status !== 'delivered' && o.status !== 'cancelled') ? countdownChip(o.date) : '';

    // WhatsApp link — customer's own phone is the primary contact
    const waSrc = o.customerPhone || o.phone || o.receiverPhone || '';
    const rm = String(waSrc).match(/(\+?880|0)(1[0-9]{9})/);
    const waPhone = rm ? `880${rm[2]}` : '';
    const waLink  = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(buildSrsMsg(o))}`
      : '';

    const statusClass = { delivered: ' status-delivered', cancelled: ' status-cancelled' }[o.status] || '';

    return `
<div class="card${isOvdPay ? ' overdue-payment' : ''}${statusClass}" id="card-${fk}">
  <div class="card-head" onclick="App.toggleCard('${fk}')" role="button" tabindex="0" aria-expanded="false">
    <div class="card-stripe ${colClass(o)}"></div>
    <div class="card-head-body">
      ${o.orderId ? `<div class="card-order-id">🆔 ${esc(o.orderId)}</div>` : ''}
      <div class="card-name"><span class="card-name-text">${esc(o.name)}</span>${tallyBadge}${customerBadge}<button class="name-copy-btn" type="button" onclick="event.stopPropagation();App.copyCardName(this)" title="নাম কপি করুন">📋 কপি</button></div>
      <div class="card-meta">${esc(weightText(o))}${weightText(o) && o.flavour ? ' · ' : ''}${esc(flavourLabel(o))}${o.time ? ' · ' + esc(o.time) : ''}</div>
      ${cdChip}
      <div class="card-chips">${statusChip(o)}${dueChip}${surpriseChip}${deliveryChip}</div>
    </div>
    <div class="card-chevron" aria-hidden="true">⌄</div>
  </div>

  ${payProgressBar(o)}

  <div class="card-details">
    ${o.photo ? `<div class="card-photo-wrap"><img class="card-photo" src="${o.photo}" onclick="App.openLightbox('${fk}')" alt="রেফারেন্স কেক" loading="lazy"></div>` : ''}
    ${(o.photos && o.photos.length > 1) ? o.photos.slice(1).map((p, i) => `<div class="card-photo-wrap"><img class="card-photo" src="${p}" alt="রেফারেন্স কেক ${i + 2}" loading="lazy" onclick="event.stopPropagation();window.open(this.src,'_blank')"></div>`).join('') : ''}

    ${isOvdPay ? `<div class="overdue-alert">⚠️ বকেয়া পেমেন্ট: ৳${fmtMoney(d)} — ডেলিভারির তারিখ পেরিয়ে গেছে!</div>` : ''}

    <div class="detail-section">
      <div class="detail-title">🎂 কেক বিবরণ</div>
      ${drow('⚖️', 'ওজন ও ফ্লেভার', `${weightText(o)} — ${flavourLabel(o)}`)}
      ${drow('📐', 'সাইজ', o.size)}
      ${o.photoNote ? `<div class="pay-note" style="border-left:3px solid var(--amber);background:var(--amber-light, #fff7e6)">📝 <strong>${lang==='bn'?'ছবির নোট:':'Photo note:'}</strong> ${esc(o.photoNote)}</div>` : ''}
      ${drow('✍️', 'লেখা', o.writing)}
    </div>

    <div class="detail-section">
      <div class="detail-title">🚚 ডেলিভারি</div>
      ${drow('📅', 'তারিখ ও সময়', `${o.date ? fmtDate(o.date) : ''} — ${o.time || ''}`)}
      ${drow('👤', 'রিসিভার', o.receiver)}
      ${o.receiverPhone ? drow('📞', 'রিসিভার ফোন', o.receiverPhone) : ''}
      ${drow('📍', 'ঠিকানা', o.address)}
      ${o.surprise === 'yes' ? drow('🎁', 'সারপ্রাইজ', 'হ্যাঁ — গোপন রাখুন!') : ''}
      ${o.deliveryPaid && o.deliveryPaid !== 'na'
        ? drow('🚚', 'ডেলিভারি চার্জ', (o.deliveryPaid === 'paid' ? 'পরিশোধিত' : 'বাকি') + (o.deliveryAmount ? ` — ৳${fmtMoney(o.deliveryAmount)}` : ''))
        : ''}
    </div>

    <div class="detail-section">
      <div class="detail-title">💳 পেমেন্ট</div>
      <div class="pay-box">
        <div class="pay-cell"><div class="pay-lbl">${lang==='bn'?'মোট':'Total'}</div><div class="pay-val">৳${fmtMoney(o.total)}</div></div>
        <div class="pay-cell"><div class="pay-lbl">${tr('cakePayment')}</div><div class="pay-val green">৳${fmtMoney(effectivePaid(o))}</div></div>
        <div class="pay-cell"><div class="pay-lbl">${tr('due')}</div><div class="pay-val ${d > 0 ? 'red' : 'green'}">৳${fmtMoney(d)}</div></div>
      </div>
      ${bkashCharge(o) > 0 ? `<div class="pay-note">💰 ${tr('bkashDeducted')}: ৳${fmtMoney(o.paid)} − ৳${fmtMoney(bkashCharge(o))}${o.paymentChargesLabel ? ` (${esc(o.paymentChargesLabel)})` : ''} = ৳${fmtMoney(effectivePaid(o))}</div>` : ''}
      ${o.paynote ? `<div class="pay-note">💳 ${esc(o.paynote)}</div>` : ''}
      ${o.source === 'customer' && o.advance ? `<div class="pay-note">📱 কাস্টমার অগ্রিম: ৳${fmtMoney(o.advance)}${o.advanceCharge > 0 ? ` (+চার্জ ৳${fmtMoney(o.advanceCharge)})` : ''} = ৳${fmtMoney(o.advanceTotal)} | ট্রানজেকশন: ${esc(o.trx || '')}</div>` : ''}
    </div>

    <div class="status-select-wrap">
      <div class="detail-title" style="padding:0;margin-bottom:6px">🔄 স্ট্যাটাস পরিবর্তন</div>
      <select class="status-select" onchange="App.confirmStatusChange('${fk}', this)" onclick="event.stopPropagation()">
        <option value="pending"   ${o.status === 'pending'   ? 'selected' : ''}>পেন্ডিং ⏳</option>
        <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>কনফার্মড ✅</option>
        <option value="baking"    ${o.status === 'baking'    ? 'selected' : ''}>আজ রাতে বেক 🔄</option>
        <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>ডেলিভার হয়েছে 🎉</option>
        <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>বাতিল ❌</option>
      </select>
    </div>

    <div class="baking-notes-wrap">
      <div class="notes-label">✍️ নিতুর বেকিং নোটস</div>
      <textarea
        class="notes-input"
        placeholder="বেকিং প্ল্যান, টিপস, রিমাইন্ডার..."
        onclick="event.stopPropagation()"
        onblur="App.updateNotes('${fk}', this.value)"
      >${esc(o.bakingnotes || '')}</textarea>
    </div>

    <div class="card-actions">
      <button class="card-btn btn-note"   onclick="event.stopPropagation(); App.copyNotepad('${fk}')">📋 নোটপ্যাড কপি</button>
      <button class="card-btn btn-srs"   onclick="event.stopPropagation(); App.copySrsMessage('${fk}')">📋 SRS কপি</button>
      ${waLink ? `<button class="card-btn btn-wa" onclick="event.stopPropagation(); window.open('${waLink}','_blank')">💬 WhatsApp</button>` : ''}
      ${waPhone ? `<button class="card-btn btn-call" onclick="event.stopPropagation(); window.open('tel:${waPhone}')">${tr('call')}</button>` : ''}
      <button class="card-btn btn-edit"  onclick="event.stopPropagation(); App.openModal('${fk}')">✏️ এডিট</button>
      <button class="card-btn btn-del"   onclick="event.stopPropagation(); App.confirmDelete('${fk}')">🗑️ মুছুন</button>
    </div>
  </div>
</div>`;
  };

  // ─── Skeleton loader ─────────────────────────────────────────
  const renderSkeletons = (n = 3) => {
    return Array.from({ length: n }, () => `
      <div class="skeleton-card">
        <div class="skeleton-line wide"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line xshort" style="margin-top:10px"></div>
      </div>`).join('');
  };

  // ─── Render views ────────────────────────────────────────────
  const renderPlan = () => {
    const t   = today0();
    const tm  = new Date(t); tm.setDate(tm.getDate() + 1);
    const pool = getFiltered(orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled'));

    const groups = {};
    pool.forEach(o => {
      if (!o.date) return;
      const d = toDate(o.date);
      let key, dot;
      if (d.getTime() === t.getTime())  { key = '🚚 আজকে ডেলিভারি';    dot = 'dot-today'; }
      else if (d.getTime() === tm.getTime()) { key = '🌙 আজ রাতে বেক — আগামীকাল ডেলিভারি'; dot = 'dot-tomorrow'; }
      else if (d > t)  { key = fmtDate(o.date); dot = 'dot-later'; }
      else { key = '⚠️ দেরি — ' + fmtDate(o.date); dot = 'dot-today'; }
      if (!groups[key]) groups[key] = { orders: [], dot };
      groups[key].orders.push(o);
    });

    let html = '';
    Object.keys(groups).forEach(k => {
      const g = groups[k];
      html += `<div class="day-group">
        <div class="day-label">
          <div class="day-dot ${g.dot}"></div>
          <span class="day-label-text">${k}</span>
          <span class="day-count">${g.orders.length}</span>
        </div>
        ${g.orders.map(renderCard).join('')}
      </div>`;
    });

    if (!html) html = `<div class="empty">
      <div class="empty-icon">🎂</div>
      <h3>কোনো আসন্ন অর্ডার নেই</h3>
      <p>+ বাটন চাপুন নতুন অর্ডার যোগ করতে।</p>
    </div>`;

    document.getElementById('view-plan').innerHTML = html;
    document.getElementById('tc-plan').textContent = pool.length + (document.getElementById('search-input').value.trim() ? '/' : '');
  };

  const renderAll = () => {
    const pool = getFiltered(orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled'));
    const el = document.getElementById('view-all');
    el.innerHTML = pool.length
      ? pool.map(renderCard).join('')
      : `<div class="empty"><div class="empty-icon">📦</div><h3>কোনো মিল পাওয়া যায়নি</h3><p>ভিন্ন সার্চ বা ফিল্টার চেষ্টা করুন।</p></div>`;
    document.getElementById('tc-all').textContent = pool.length;
  };

  const renderDone = () => {
    const pool = getFiltered(orders.filter(o => o.status === 'delivered' || o.status === 'cancelled'))
      .sort((a, b) => toDate(b.date || '2000-01-01') - toDate(a.date || '2000-01-01'));
    const el = document.getElementById('view-done');
    el.innerHTML = pool.length
      ? pool.map(renderCard).join('')
      : `<div class="empty"><div class="empty-icon">✅</div><h3>কোনো সম্পন্ন অর্ডার নেই</h3><p>ডেলিভার করা অর্ডার এখানে দেখাবে।</p></div>`;
    document.getElementById('tc-done').textContent = pool.length;
  };

  // ─── Earn concept ────────────────────────────────────────────
  // Supplies are bought in bulk, so per-cake cost/profit cannot be
  // measured reliably. "Earn" is therefore simply the total cake
  // sale value EXCLUDING the delivery charge (goes fully to the
  // delivery agent) and the bKash charge (payment fee).
  const earnOf = o => Math.max(
    0,
    (Number(o.total) || 0) -
    (Number(o.deliveryAmount) || 0) -
    bkashCharge(o)
  );

  // ─── Monthly mini chart: orders taken per month ──────────────
  const buildMonthlyChart = () => {
    const now     = new Date();
    const months  = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টে','অক্টো','নভে','ডিসে'];
    const data    = {};

    // Last 5 months
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      data[key] = { label: months[d.getMonth()], n: 0 };
    }

    orders.forEach(o => {
      if (o.status === 'cancelled' || !o.date) return;
      const d   = toDate(o.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (data[key]) data[key].n++;
    });

    const vals = Object.values(data);
    const max  = Math.max(...vals.map(v => v.n), 1);

    const bars = vals.map(v => {
      const pct = Math.max(4, Math.round((v.n / max) * 100));
      return `<div class="chart-bar-col">
        <div class="chart-bar-val">${v.n > 0 ? v.n : ''}</div>
        <div class="chart-bar" style="height:${pct}%"></div>
        <div class="chart-bar-lbl">${v.label}</div>
      </div>`;
    }).join('');

    return `<div class="mini-chart-wrap">
      <div class="mini-chart-title">${tr('chartMonthlyOrders')}</div>
      <div class="chart-bars">${bars}</div>
    </div>`;
  };

  const renderRevenue = () => {
    const t        = today0();
    const y        = t.getFullYear();
    const m        = t.getMonth();
    const MONTHS   = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    const curMonth = `${MONTHS[m]} ${y}`;

    // Monthly basis: orders taken in the CURRENT month only.
    let planned = 0, completed = 0, earn = 0;

    orders.forEach(o => {
      if (!o.date || o.status === 'cancelled') return;
      const d = toDate(o.date);
      if (d.getFullYear() !== y || d.getMonth() !== m) return;
      planned++;
      if (o.status === 'delivered') completed++;
      earn += earnOf(o);
    });

    let html = buildMonthlyChart();

    html += `
      <div class="rev-header">${curMonth}</div>
      <div class="rev-grid rev-grid-3">
        <div class="rev-card"><div class="rev-icon">🧾</div><div class="rev-num">${fmtMoney(planned)}</div><div class="rev-lbl">${tr('monthPlanned')}</div></div>
        <div class="rev-card"><div class="rev-icon">✅</div><div class="rev-num green">${fmtMoney(completed)}</div><div class="rev-lbl">${tr('monthCompleted')}</div></div>
        <div class="rev-card"><div class="rev-icon">💰</div><div class="rev-num blue">৳${fmtMoney(earn)}</div><div class="rev-lbl">${tr('monthEarn')}</div></div>
      </div>
      <div class="earn-note">${tr('monthEarnNote')}</div>`;

    document.getElementById('view-revenue').innerHTML = html;
  };

  // ─── Title badge + pending counter ────────────────────────────
  // "Pending" = every order that still needs action (not delivered,
  // not cancelled), exactly like the প্ল্যান tab — INCLUDING overdue
  // orders sitting on past dates.
  const INACTIVE_STATUSES = ['delivered', 'cancelled', 'completed', 'complete'];
  const isActiveOrder = o => !INACTIVE_STATUSES.includes(String(o.status || '').toLowerCase());
  const pendingCount  = () => orders.filter(isActiveOrder).length;

  const updateSummary = () => {
    const p = pendingCount();
    document.title = p > 0 ? `🔴 ${p} পেন্ডিং — নিতুর বেকারি` : '🎂 নিতুর বেকারি';
  };

  // Names of active orders due TODAY (max 5) — used by the morning
  // "you have N deliveries today" alert so it says WHO, not just how many.
  const todayOrderNames = () => {
    const t = today0();
    return orders
      .filter(isActiveOrder)
      .filter(o => o.date && !Number.isNaN(toDate(o.date).getTime()))
      .filter(o => toDate(o.date).getTime() === t.getTime())
      .map(o => o.name)
      .slice(0, 5);
  };

  // Fires once per day with today's delivery list. If a NEW order for
  // today arrives later, the changed name set re-triggers it once more.
  let lastTodaysNotifyKey = '';
  const notifyTodaysOrders = () => {
    const names = todayOrderNames();
    if (!names.length) return;
    const key = new Date().toISOString().slice(0, 10) + '|' + names.join(',');
    if (key === lastTodaysNotifyKey) return;
    lastTodaysNotifyKey = key;
    showTodayBanner(
      tr('todayTitle').replace('{n}', String(names.length)),
      names.map(n => '• ' + n).join('\n')
    );
  };
  setInterval(notifyTodaysOrders, 60000);

  // ─── Mini calendar (daily order capacity) ─────────────────────
  let calCursor = today0(); calCursor.setDate(1);

  const calLabel = () => {
    const MON = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    return `${MON[calCursor.getMonth()]} ${calCursor.getFullYear()}`;
  };

  const calShift = dir => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + dir, 1);
    render();
  };

  const openCalendar = () => {
    // Reset to current month each time it opens so it always starts on today's month
    calCursor = today0(); calCursor.setDate(1);
    render();
    document.getElementById('cal-popup-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  const closeCalendar = () => {
    document.getElementById('cal-popup-overlay').classList.remove('open');
    document.body.style.overflow = '';
  };
  const closeCalendarBg = e => {
    if (e.target === document.getElementById('cal-popup-overlay')) closeCalendar();
  };

  const renderCalendar = () => {
    // Only work that still needs action consumes calendar capacity.
    // Delivered, cancelled, and legacy completed orders immediately return to the default cell colour.
    const isActiveCalendarOrder = o => !['delivered', 'cancelled', 'completed', 'complete']
      .includes(String(o.status || '').toLowerCase());
    const counts = {};
    orders.forEach(o => {
      if (!isActiveCalendarOrder(o) || !o.date) return;
      const d = toDate(o.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    const y = calCursor.getFullYear(), m = calCursor.getMonth();
    const startDow = new Date(y, m, 1).getDay();          // 0 = Sunday
    const dim      = new Date(y, m + 1, 0).getDate();
    const today    = today0();

    const DOW = ['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'];
    let html = DOW.map(d => `<div class="minical-dow">${d}</div>`).join('');
    for (let i = 0; i < startDow; i++) html += '<div class="minical-cell empty"></div>';

    for (let day = 1; day <= dim; day++) {
      const n = counts[`${y}-${m}-${day}`] || 0;
      const cls = n === 0 ? 'c-0' : n <= 2 ? 'c-ok' : n === 3 ? 'c-warn' : 'c-bad';
      const isToday = (today.getFullYear() === y && today.getMonth() === m && today.getDate() === day);
      // Color communicates the order-capacity range shown in the legend.
      // Do not print the count beneath the date: it can look like a date from the next month.
      const orderLabel = n === 1 ? '১টি অর্ডার' : `${n}টি অর্ডার`;
      html += `<div class="minical-cell ${cls}${isToday ? ' today' : ''}" title="${day} তারিখে ${orderLabel}" aria-label="${day} তারিখে ${orderLabel}">` +
              `<span class="mc-day">${day}</span>` +
              `</div>`;
    }

    document.getElementById('cal-title').textContent = calLabel();
    document.getElementById('cal-grid').innerHTML = html;
  };

  const render = () => {
    updateSummary();
    renderCalendar();
    renderPlan();
    if (activeTab === 'all')     renderAll();
    if (activeTab === 'done')    renderDone();
    if (activeTab === 'revenue') renderRevenue();
  };

  // ─── Tab switcher ─────────────────────────────────────────────
  const switchTab = t => {
    activeTab = t;
    ['plan','all','done','revenue'].forEach(n => {
      document.getElementById(`view-${n}`).classList.toggle('hidden', n !== t);
      const btn = document.getElementById(`tab-${n === 'revenue' ? 'rev' : n}`);
      const isActive = n === t;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    // Lazy render on switch
    if (t === 'all')     renderAll();
    if (t === 'done')    renderDone();
    if (t === 'revenue') renderRevenue();
  };

  // ─── Toggle card expand ──────────────────────────────────────
  const toggleCard = key => {
    const el = document.getElementById(`card-${key}`);
    if (!el) return;
    const head = el.querySelector('.card-head');
    el.classList.toggle('expanded');
    head.setAttribute('aria-expanded', el.classList.contains('expanded') ? 'true' : 'false');
  };

  // ─── Copy customer name (exact Facebook name) ───────────────
  const copyCardName = btn => {
    const name = (btn.closest('.card-name')?.querySelector('.card-name-text')?.textContent || '').trim();
    if (!name) return;
    const done = () => showToast('✅ নাম কপি হয়েছে!');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(name).then(done).catch(() => fallbackCopyText(name, done));
    } else {
      fallbackCopyText(name, done);
    }
  };
  const fallbackCopyText = (text, done) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  };

  // ─── Lightbox ────────────────────────────────────────────────
  const openLightbox = key => {
    const o = orders.find(x => x.firebaseKey === key);
    if (!o?.photo) return;
    document.getElementById('lightbox-img').src = o.photo;
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  const closeLightbox = () => {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
  };

  // ─── Status update ───────────────────────────────────────────
  const confirmStatusChange = (key, sel) => {
    const newVal = sel.value;
    const o      = orders.find(x => x.firebaseKey === key);
    const oldVal = o ? o.status : 'confirmed';
    if (newVal === oldVal) return;

    if (newVal === 'delivered' || newVal === 'cancelled') {
      let msg;
      if (newVal === 'delivered') {
        msg = lang === 'bn'
          ? 'অর্ডারটি সম্পন্ন ট্যাবে চলে যাবে।'
          : 'The order will move to the Done tab.';
        if (o && dueAmt(o) > 0) {
          msg += lang === 'bn'
            ? `\n💰 বকেয়া ৳${fmtMoney(dueAmt(o))} স্বয়ংক্রিয়ভাবে সম্পূর্ণ পরিশোধিত হিসেবে চিহ্নিত হবে।`
            : `\n💰 The remaining due of ৳${fmtMoney(dueAmt(o))} will be marked fully paid automatically.`;
        }
      } else {
        msg = 'অর্ডারটি সম্পন্ন ট্যাবে আর্কাইভ হবে।';
      }
      showConfirm(
        newVal === 'delivered' ? 'ডেলিভার হিসেবে মার্ক করুন? 🎉' : 'বাতিল করবেন? ❌',
        msg,
        newVal === 'delivered',
        ok => { if (ok) updateStatus(key, newVal); else sel.value = oldVal; }
      );
    } else {
      updateStatus(key, newVal);
    }
  };

  const updateStatus = (key, val) => {
    setSyncStatus('syncing', 'সেভ হচ্ছে...');
    // Marking delivered also settles any remaining cake balance in the
    // same write: paid is set so that effectivePaid == total (keeping
    // the existing bKash charge), mirroring the "Mark Fully Paid" action.
    if (val === 'delivered') {
      const o = orders.find(x => x.firebaseKey === key);
      const newPaid = o ? (o.total || 0) + bkashCharge(o) : null;
      if (newPaid != null) {
        ordersRef.child(key).update({ status: val, paid: newPaid, updatedAt: Date.now() })
          .then(() => {
            setSyncStatus('ok');
            showToast(lang === 'bn' ? '🎉 ডেলিভার্ড — বকেয়া স্বতঃ পরিশোধিত!' : '🎉 Delivered — due auto-settled!');
          })
          .catch(err => {
            console.error('Delivered-save failed:', err);
            setSyncStatus('error', '❌ সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন');
            showToast(lang === 'bn' ? '❌ স্ট্যাটাস সেভ হয়নি — আবার চেষ্টা করুন' : '❌ Status not saved — try again');
          });
        return;
      }
    }
    ordersRef.child(key).update({ status: val, updatedAt: Date.now() })
      .then(() => {
        setSyncStatus('ok');
        showToast('স্ট্যাটাস আপডেট হয়েছে ✅');
      })
      .catch(err => {
        console.error('Status save failed:', err);
        setSyncStatus('error', '❌ সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন');
        showToast(lang === 'bn' ? '❌ স্ট্যাটাস সেভ হয়নি — আবার চেষ্টা করুন' : '❌ Status not saved — try again');
      });
  };

  const updateNotes = (key, val) => {
    setSyncStatus('syncing', 'নোটস সেভ হচ্ছে...');
    ordersRef.child(key).update({ bakingnotes: val, updatedAt: Date.now() })
      .then(() => setSyncStatus('ok'))
      .catch(err => {
        console.error('Notes save failed:', err);
        setSyncStatus('error', '❌ নোট সেভ হয়নি — আবার চেষ্টা করুন');
        showToast(lang === 'bn' ? '❌ নোট সেভ হয়নি!' : '❌ Note not saved!');
      });
  };

  const markFullyPaid = key => {
    const o = orders.find(x => x.firebaseKey === key);
    if (!o) return;
    const title = lang === 'bn' ? 'সম্পূর্ণ পরিশোধ?' : 'Mark as fully paid?';
    const msg   = lang === 'bn'
      ? `বকেয়া ৳${fmtMoney(dueAmt(o))} পরিশোধিত হিসেবে চিহ্নিত হবে।`
      : `The due of ৳${fmtMoney(dueAmt(o))} will be marked as paid.`;
    showConfirm(title, msg, true, ok => {
      if (!ok) return;
      // Set paid so that effectivePaid == total (keep existing bKash charge)
      const newPaid = (o.total || 0) + bkashCharge(o);
      setSyncStatus('syncing', tr('saving'));
      ordersRef.child(key).update({ paid: newPaid, updatedAt: Date.now() })
        .then(() => {
          setSyncStatus('ok');
          showToast(lang === 'bn' ? '✅ সম্পূর্ণ পরিশোধিত!' : '✅ Marked fully paid!');
        })
        .catch(err => {
          console.error('Mark-paid failed:', err);
          setSyncStatus('error', '❌ সংরক্ষণ ব্যর্থ — আবার চেষ্টা করুন');
          showToast(lang === 'bn' ? '❌ সেভ হয়নি — আবার চেষ্টা করুন' : '❌ Not saved — try again');
        });
    });
  };

  // ─── Copy SRS ────────────────────────────────────────────────
  const copySrsMessage = key => {
    const o = orders.find(x => x.firebaseKey === key);
    if (!o) return;
    const msg = buildSrsMsg(o);
    const done = () => showToast('✅ SRS মেসেজ কপি হয়েছে!');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(msg).then(done).catch(() => fallbackCopy(msg, done));
    } else {
      fallbackCopy(msg, done);
    }
  };

  const copyNotepad = key => {
    const o = orders.find(x => x.firebaseKey === key);
    if (!o) return;
    const msg = buildNotepadText(o);
    const done = () => showToast('✅ নোটপ্যাড কপি হয়েছে!');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(msg).then(done).catch(() => fallbackCopy(msg, done));
    } else {
      fallbackCopy(msg, done);
    }
  };

  const fallbackCopy = (text, done) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); done(); }
    catch { alert(`টেক্সট:\n\n${text}`); }
    document.body.removeChild(ta);
  };

  // ─── Duplicate order ─────────────────────────────────────────
  const duplicateOrder = key => {
    const o = orders.find(x => x.firebaseKey === key);
    if (!o) return;
    editingId     = null;
    currentPhoto  = '';
    currentPhotos = [];
    populateForm({
      ...o,
      date:      '',
      paid:      0,
      status:    'confirmed',
      bakingnotes: o.bakingnotes || ''
    });
    document.getElementById('modal-title').textContent = 'অর্ডার কপি করুন';
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  // ─── Confirm dialog ──────────────────────────────────────────
  const showConfirm = (title, msg, isGreen, cb) => {
    document.getElementById('confirm-title').textContent    = title;
    document.getElementById('confirm-msg').textContent      = msg;
    const btn = document.getElementById('confirm-yes-btn');
    btn.className = 'btn-cnf-yes' + (isGreen ? ' green' : '');
    confirmCb = cb;
    document.getElementById('confirm-overlay').classList.add('open');
  };
  const closeConfirm = result => {
    document.getElementById('confirm-overlay').classList.remove('open');
    if (confirmCb) confirmCb(result);
    confirmCb = null;
  };
  const confirmDelete = key => {
    showConfirm('এই অর্ডার মুছবেন?', 'এটি স্থায়ীভাবে মুছে যাবে।', false, ok => {
      if (ok) { ordersRef.child(key).remove(); showToast('অর্ডার মুছে ফেলা হয়েছে।'); }
    });
  };

  // ─── Modal ───────────────────────────────────────────────────
  const populateForm = o => {
    const g = id => document.getElementById(id);
    g('f-name').value           = o.name      || '';
    g('f-phone').value          = o.phone     || '';
    g('f-weight').value         = weightText(o);
    // Match stored flavour no matter how it was saved over the years:
    // machine id (customer form) → Bengali name → legacy English label.
    // Falls back to 'Custom' so an edit can NEVER silently blank a flavour.
    {
      const flSel    = g('f-flavour');
      const stored   = String(o.flavour || '').trim();
      const storedBn = String(o.flavourName || '').trim();
      let pick       = '';
      Array.from(flSel.options).forEach(opt => {
        if (!pick && opt.value && (opt.value === stored)) pick = opt.value;
        if (!pick && storedBn && opt.textContent === storedBn) pick = opt.value;
      });
      if (!pick) {
        for (const entry of Object.entries(FLAVOUR_MAP)) {
          if (entry[1] === stored || entry[1] === storedBn) { pick = entry[0]; break; }
        }
      }
      if (!pick) {
        const LEGACY = { 'Chocolate Sponge': 'chocolate-sponge', 'Vanilla Sponge': 'vanilla-sponge',
          'Vanilla with Whipped Cream': 'vanilla-whipped-cream', 'Red Velvet': 'red-velvet',
          'Black Forest': 'black-forest', 'White Forest': 'white-forest', 'Lemon Cake': 'lemon',
          'Orange Cake': 'orange', 'Strawberry Cake': 'strawberry', 'Blueberry Cake': 'blueberry',
          'Malai Cake': 'malai', 'Butterscotch': 'butterscotch', 'Special Vanilla': 'special-vanilla',
          'Chocolate Mudcake': 'chocolate-mud', 'Double Chocolate': 'double-layer-chocolate',
          'Choco Truffle': 'choco-truffle', 'Mango Mousse': 'mango-mousse' };
        pick = LEGACY[stored] || LEGACY[storedBn] || 'custom';
      }
      flSel.value = pick;
    }
    g('f-size').value           = o.size      || '';
    g('f-writing').value        = o.writing   || '';
    g('f-date').value           = o.date      || '';
    // Structured time (same as the customer app): hour + AM/PM selector.
    // Legacy free-text times that don't parse are kept as-is in the input.
    {
      const tIn  = g('f-time');
      const ampm = g('f-time-ampm');
      const noCb = g('f-no-time');
      const rawT = String(o.timeSlot || o.time || '').trim();
      if (rawT === 'TIME NOT CONFIRMED') {
        noCb.checked = true;
        tIn.value = ''; if (ampm) ampm.value = '';
        toggleTime();
      } else {
        noCb.checked = false;
        tIn.disabled = false; tIn.style.opacity = '1';
        if (ampm) { ampm.disabled = false; ampm.style.opacity = '1'; }
        const m = rawT.match(/^(\d{1,2})\s*[:.\-]\s*(\d{1,2})\s*(AM|PM|এএম|পিএম)?$/i);
        if (m) {
          tIn.value = `${parseInt(m[1], 10)}.${String(parseInt(m[2], 10)).padStart(2, '0')}`;
          if (ampm) ampm.value = m[3] && /p/i.test(m[3]) ? 'PM' : (m[3] ? 'AM' : '');
        } else {
          tIn.value = rawT;
          if (ampm) ampm.value = '';
        }
      }
    }
    g('f-fulfilment').value     = o.fulfilment || 'delivery';
    g('f-receiver').value       = o.receiver  || '';
    g('f-receiver-phone').value = o.receiverPhone || '';
    g('f-address').value        = o.address   || '';
    g('f-surprise').value       = o.surprise  || 'no';
    g('f-delivery-paid').value  = o.deliveryPaid    || 'unpaid';
    g('f-delivery-amount').value = o.deliveryAmount || '';
    g('f-total').value          = o.total     || '';
    g('f-paid').value           = o.paid      || '';
    g('f-charge-deduct').value  = (o.paymentCharges != null ? o.paymentCharges : o.bkashCharge) || '';
    g('f-trx').value            = o.trx       || '';
    g('f-notes').value          = o.notes     || '';
    g('f-photo-note').value     = o.photoNote || '';
    // New manual orders start as PENDING — the admin confirms after review
    g('f-status').value         = o.status    || 'pending';
    g('f-bakingnotes').value    = o.bakingnotes || '';

    // Multi-photo: prefer the photos array, fall back to the single legacy photo
    currentPhotos = Array.isArray(o.photos) && o.photos.length
      ? o.photos.filter(Boolean)
      : (o.photo ? [o.photo] : []);
    renderModalPhotos();
  };

  const openModal = key => {
    editingId    = key;
    currentPhoto = '';
    currentPhotos = [];
    const o = key ? orders.find(x => x.firebaseKey === key) : null;
    document.getElementById('modal-title').textContent =
      o ? 'অর্ডার সম্পাদনা করুন' : 'নতুন অর্ডার';
    populateForm(o || {});
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus first field
    setTimeout(() => document.getElementById('f-name').focus(), 350);
  };

  const closeModal = () => {
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('f-photo-file').value = '';
  };

  const closeModalBg = e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  };

  // ─── Photo handling (multi, mirrors customer app) ────────────
  const MAX_PHOTOS = 4;
  const renderModalPhotos = () => {
    const grid = document.getElementById('modal-photo-grid');
    if (!grid) return;
    grid.innerHTML = currentPhotos.map((src, i) => `
      <div class="photo-thumb">
        <img src="${src}" alt="রেফারেন্স কেক ${i + 1}" loading="lazy" onclick="App.openPhotoLightbox(${i})">
        <button type="button" class="photo-remove-btn" onclick="App.removePhoto(${i})" aria-label="ছবি সরান">✕</button>
      </div>`).join('');
  };

  document.getElementById('f-photo-file').addEventListener('change', e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const slots = MAX_PHOTOS - currentPhotos.length;
    if (slots <= 0) { showToast(`সর্বোচ্চ ${MAX_PHOTOS}টি ছবি দেওয়া যাবে`); return; }
    if (files.length > slots) showToast(`প্রথম ${slots}টি ছবি নেওয়া হলো`);
    let pending = files.slice(0, slots).length;
    files.slice(0, slots).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const MAX = 900;
          let { width: w, height: h } = img;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          currentPhotos.push(canvas.toDataURL('image/jpeg', 0.78));
          if (--pending <= 0) renderModalPhotos();
        };
        img.onerror = () => { if (--pending <= 0) renderModalPhotos(); };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  });

  const removePhoto = i => {
    currentPhotos.splice(i, 1);
    renderModalPhotos();
  };

  // Zoom a modal photo in the existing full-screen lightbox
  const openPhotoLightbox = i => {
    const src = currentPhotos[i];
    if (!src) return;
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  // ─── Payment-charges popup (advance → gateway charges) ────────
  // After the admin types how much the customer sent in advance, a popup
  // asks which channel(s) the money came through and the actual market
  // charge for each. paid = advance + total charges, so every downstream
  // view (progress bar, due chip, revenue) keeps working unchanged.
  let pcOpenForAdvance = 0;

  const openPayCharge = () => {
    const advance = parseFloat(document.getElementById('f-paid').value) || 0;
    if (advance <= 0) {
      showToast(lang === 'bn' ? '⚠️ আগে অ্যাডভান্সের পরিমাণ লিখুন।' : '⚠️ Enter the advance amount first.');
      return;
    }
    pcOpenForAdvance = advance;
    ['bkash', 'nagad', 'bank'].forEach(ch => {
      document.getElementById('pc-' + ch).checked = false;
      const amt = document.getElementById('pc-' + ch + '-amt');
      amt.value = '';
      amt.disabled = true;
    });
    document.getElementById('pay-charge-overlay').classList.add('open');
  };

  const closePayCharge = () => {
    document.getElementById('pay-charge-overlay').classList.remove('open');
    pcOpenForAdvance = 0;
  };

  const closePayChargeBg = e => {
    if (e.target === document.getElementById('pay-charge-overlay')) closePayCharge();
  };

  const pcToggle = ch => {
    const amt = document.getElementById('pc-' + ch + '-amt');
    amt.disabled = !document.getElementById('pc-' + ch).checked;
    if (amt.disabled) amt.value = '';
    if (!amt.disabled) amt.focus();
  };

  const applyPayCharge = () => {
    let totalCharge = 0;
    ['bkash', 'nagad', 'bank'].forEach(ch => {
      if (document.getElementById('pc-' + ch).checked) {
        totalCharge += parseFloat(document.getElementById('pc-' + ch + '-amt').value) || 0;
      }
    });
    document.getElementById('f-charge-deduct').value = totalCharge || '';
    closePayCharge();
    showToast(lang === 'bn'
      ? `✅ মোট চার্জ ৳${fmtMoney(totalCharge)} — কেকে জমা ৳${fmtMoney(Math.max(0, pcOpenForAdvance - totalCharge))}`
      : `✅ Total charge ৳${fmtMoney(totalCharge)} — ৳${fmtMoney(Math.max(0, pcOpenForAdvance - totalCharge))} toward cake`);
  };

  // Opens the charges popup automatically shortly after an advance is entered
  let advanceDebounce = null;
  const advanceInput = () => {
    clearTimeout(advanceDebounce);
    advanceDebounce = setTimeout(() => {
      const advance = parseFloat(document.getElementById('f-paid').value) || 0;
      const popupOpen = document.getElementById('pay-charge-overlay').classList.contains('open');
      if (advance > 0 && !popupOpen) openPayCharge();
    }, 800);
  };

  // Live recalculation while the popup is open — keeps the note accurate
  // as the admin types each charge (without touching the saved fields).
  ['pc-bkash-amt', 'pc-nagad-amt', 'pc-bank-amt'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      let totalCharge = 0;
      ['bkash', 'nagad', 'bank'].forEach(ch => {
        if (document.getElementById('pc-' + ch).checked) {
          totalCharge += parseFloat(document.getElementById('pc-' + ch + '-amt').value) || 0;
        }
      });
      document.getElementById('pc-note').textContent = lang === 'bn'
        ? `অ্যাডভান্স ৳${fmtMoney(pcOpenForAdvance)} — মোট চার্জ ৳${fmtMoney(totalCharge)} → কেকে জমা ৳${fmtMoney(Math.max(0, pcOpenForAdvance - totalCharge))}`
        : `Advance ৳${fmtMoney(pcOpenForAdvance)} — total charge ৳${fmtMoney(totalCharge)} → ৳${fmtMoney(Math.max(0, pcOpenForAdvance - totalCharge))} toward cake`;
    });
  });

  // ─── Save order ──────────────────────────────────────────────
  const saveOrder = () => {
    const g    = id => document.getElementById(id);
    const name = g('f-name').value.trim();
    const date = g('f-date').value;

    if (!name) { showToast('⚠️ কাস্টমারের নাম দিন।'); g('f-name').focus(); return; }
    if (!date) { showToast('⚠️ ডেলিভারির তারিখ দিন।'); g('f-date').focus(); return; }

    const existing   = editingId ? orders.find(x => x.firebaseKey === editingId) : null;
    // Multi-photo: keep whatever is currently in the modal grid; fall back to
    // the stored array / single legacy photo if the admin didn't touch photos.
    const photosToSave = currentPhotos.length
      ? currentPhotos
      : (Array.isArray(existing?.photos) && existing.photos.length ? existing.photos.filter(Boolean)
        : (existing?.photo ? [existing.photo] : []));
    const photoHidden = photosToSave.length === 0;
    const photoToSave = photosToSave[0] || '';

    // ─── Time (structured like the customer app: hour + AM/PM) ───
    // "নির্ধারিত নয়" keeps the legacy 'TIME NOT CONFIRMED' value. Legacy
    // free-text times (e.g. "বিকাল ৪টা") are kept as-is instead of forcing
    // re-entry when an old order is edited.
    let timeVal = '';
    if (g('f-no-time').checked) {
      timeVal = 'TIME NOT CONFIRMED';
    } else {
      const rawTime   = g('f-time').value.trim();
      const legacyText = rawTime && !parseTimeParts(rawTime.replace(/\s*(?:a\.?m\.?|p\.?m\.?|এএম|পিএম)\.?$/i, '').trim());
      if (legacyText) {
        // Legacy free-text time (e.g. "বিকাল ৪টা") — keep as-is
        timeVal = rawTime;
      } else if (getTimeError()) {
        showToast('⚠️ ' + getTimeError());
        g('f-time').focus();
        return;
      } else {
        timeVal = getSelectedTime();
      }
      if (!timeVal) {
        showToast('⚠️ ডেলিভারির সময় দিন — যেমন 3.00 + PM।');
        g('f-time').focus();
        return;
      }
    }

    const cakePrice      = parseFloat(g('f-total').value) || 0;
    const deliveryAmt    = parseFloat(g('f-delivery-amount').value) || 0;
    const fulfilmentVal  = g('f-fulfilment').value;
    // Charges deducted from the received money (from the payment-charges popup)
    const chargeToDeduct = parseFloat(g('f-charge-deduct').value) || 0;
    // Channels chosen in the popup → a readable label like "বিকাশ + নগদ"
    const PC_NAMES = { bkash: 'বিকাশ', nagad: 'নগদ', bank: 'ব্যাংক' };
    const chargeLabel    = ['bkash', 'nagad', 'bank']
      .filter(ch => document.getElementById('pc-' + ch).checked)
      .map(ch => PC_NAMES[ch]).join(' + ');

    const o = {
      // ── Customer-app compatible identity & aliases (so manual orders
      //    look exactly like online orders in every view) ──
      orderId:        (existing && existing.orderId) || generateAdminOrderId(),
      name,
      customerName:   name,
      phone:          g('f-phone').value.trim(),
      customerPhone:  g('f-phone').value.trim(),
      category:       'custom',
      categoryName:   'কাস্টম কেক',
      weight:         g('f-weight').value.trim(),
      weightLabel:    g('f-weight').value.trim(),
      flavour:        g('f-flavour').value,
      flavourName:    g('f-flavour').options[g('f-flavour').selectedIndex]?.textContent || '',
      size:           g('f-size').value.trim(),
      writing:        g('f-writing').value.trim(),
      cakeWriting:    g('f-writing').value.trim(),
      photo:          photoToSave,
      photos:         photosToSave,
      photoNote:      g('f-photo-note').value.trim(),
      date,
      deliveryDate:   date,
      time:           timeVal,
      timeSlot:       timeVal === 'TIME NOT CONFIRMED' ? '' : timeVal,
      timeSlotLabel:  timeVal === 'TIME NOT CONFIRMED' ? '' : timeVal,
      receiver:       g('f-receiver').value.trim(),
      receiverPhone:  g('f-receiver-phone').value.trim(),
      address:        g('f-address').value.trim(),
      deliveryAddress: g('f-address').value.trim(),
      surprise:       g('f-surprise').value,
      fulfilment:     fulfilmentVal,
      deliveryPaid:   fulfilmentVal === 'pickup' ? 'na' : g('f-delivery-paid').value,
      deliveryAmount: fulfilmentVal === 'pickup' ? 0 : deliveryAmt,
      deliveryCharge: fulfilmentVal === 'pickup' ? 0 : deliveryAmt,
      total:          cakePrice,
      basePrice:      cakePrice,
      cakePrice:      cakePrice,
      weightPrice:    0,
      subtotal:       cakePrice,
      paid:           parseFloat(g('f-paid').value)  || 0,
      bkashCharge:    chargeToDeduct,
      paymentCharges: chargeToDeduct,
      paymentChargesLabel: chargeLabel,
      trx:            g('f-trx').value.trim(),
      notes:          g('f-notes').value.trim(),
      status:         g('f-status').value,
      bakingnotes:    g('f-bakingnotes').value.trim(),
      source:         existing ? (existing.source || 'manual') : 'manual',
      createdAt:      (existing && existing.createdAt) || Date.now(),
      updatedAt:      Date.now()
    };

    // Keep the customer-app payment fields in sync. Customer-submitted orders
    // store the money in advance/advanceTotal/dueAmount, and the customer's
    // "Previous Orders" screen reads those fields. Without this sync, editing
    // the payment here updated `paid`/`total` but the customer kept seeing the
    // stale submitted due forever. advance = money that actually counts toward
    // the cake (received amount minus the gateway charges entered in the popup).
    const paidNum   = Number(o.paid) || 0;
    const chargeNum = Number(o.paymentCharges) || 0;
    o.advance        = Math.max(0, paidNum - chargeNum);
    o.advanceTotal   = paidNum;
    o.paymentCharges = chargeNum;
    o.dueAmount      = Math.max(0, (Number(o.total) || 0) - o.advance);

    setSyncStatus('syncing', 'ক্লাউডে সেভ হচ্ছে...');
    const failSave = err => {
      console.error('Order save failed:', err);
      setSyncStatus('error', '❌ সংরক্ষণ ব্যর্থ — ইন্টারনেট চেক করুন');
      showToast(lang === 'bn' ? '❌ সংরক্ষণ ব্যর্থ! ইন্টারনেট দেখে আবার সেভ করুন।' : '❌ Save failed! Check internet and save again.');
    };
    if (editingId) {
      ordersRef.child(editingId).update(o)
        .then(() => {
          setSyncStatus('ok');
          showToast('✅ অর্ডার আপডেট হয়েছে!');
          currentPhoto = '';
          currentPhotos = [];
          closeModal();
        })
        .catch(failSave);
    } else {
      o.createdAt = Date.now();
      ordersRef.push(o)
        .then(() => {
          setSyncStatus('ok');
          showToast('✅ নতুন অর্ডার সেভ হয়েছে!');
          currentPhoto = '';
          currentPhotos = [];
          closeModal();
        })
        .catch(failSave);
    }
  };

  // ─── Backup / Restore ─────────────────────────────────────────
  const exportData = () => {
    const backup = { exported: new Date().toISOString(), version: 4, orders };
    const blob   = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    const ds     = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `NituOrders_Backup_${ds}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ ব্যাকআপ ডাউনলোড হয়েছে!');
  };

  const importData = event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const backup = JSON.parse(e.target.result);
        if (!backup.orders || !Array.isArray(backup.orders)) {
          showToast('❌ অবৈধ ব্যাকআপ ফাইল।');
          return;
        }
        showConfirm(
          `${backup.orders.length}টি অর্ডার রিস্টোর করবেন?`,
          'এটি বিদ্যমান অর্ডারে যোগ হবে। তারিখ: ' +
            (backup.exported ? new Date(backup.exported).toLocaleDateString('bn-BD') : 'অজানা'),
          true,
          ok => {
            if (!ok) return;
            backup.orders.forEach(o => {
              const n = { ...o };
              delete n.firebaseKey;
              ordersRef.push(n);
            });
            showToast(`✅ ${backup.orders.length}টি অর্ডার রিস্টোর হয়েছে!`);
          }
        );
      } catch {
        showToast('❌ ব্যাকআপ ফাইল পড়া যাচ্ছে না।');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // ─── Keyboard shortcuts ──────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'n' || e.key === 'N') openModal(null);
    if (e.key === 'Escape') {
      closeModal();
      closeLightbox();
      closeConfirm(false);
    }
    if (e.key === '1') switchTab('plan');
    if (e.key === '2') switchTab('all');
    if (e.key === '3') switchTab('done');
    if (e.key === '4') switchTab('revenue');
  });

  // ─── Init skeleton + language ────────────────────────────────
  document.getElementById('view-plan').innerHTML =
    `<div class="skeleton-wrap">${renderSkeletons(4)}</div>`;
  applyI18n();

  // ─── Reminder Notification System ────────────────────────────
  const checkUpcomingOrders = () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    const now = today0();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);

    // Check for orders 1-2 days away
    orders.forEach(o => {
      if (o.status === 'delivered' || o.status === 'cancelled' || !o.date) return;
      
      const deliveryDate = toDate(o.date);
      const diff = Math.round((deliveryDate - now) / 86_400_000);
      
      // Remind 1-2 days before delivery
      if (diff === 1 || diff === 2) {
        const notifKey = `reminder-${o.firebaseKey}-${o.date}`;
        const lastReminder = localStorage.getItem(notifKey);
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        // Send notification only once per day per order
        if (!lastReminder || parseInt(lastReminder) < oneDayAgo) {
          const title = diff === 1 
            ? `⚠️ আগামীকাল ডেলিভারি: ${o.name}`
            : `📅 ${diff} দিনে ডেলিভারি: ${o.name}`;
          const body = `${weightText(o)} ${o.flavour || ''} কেক\n${o.time || 'সময় নির্ধারিত নয়'}`;
          
          try {
            const n = new Notification(title, { 
              body, 
              tag: notifKey,
              requireInteraction: false,
              icon: 'icons/icon-192.png'
            });
            n.onclick = () => { window.focus(); n.close(); };
            localStorage.setItem(notifKey, Date.now().toString());
          } catch(e) {
            console.error('Notification error:', e);
          }
        }
      }
    });
  };

  // Check reminders every 30 minutes
  setInterval(checkUpcomingOrders, 30 * 60 * 1000);
  // Also check on page load (after orders are loaded)
  setTimeout(checkUpcomingOrders, 5000);

  // ─── Authentication ──────────────────────────────────────────
  let authMode = 'login'; // 'login' | 'register'

  const handleLogin = async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');

    if (!email || !password) {
      showLoginError('ইমেইল এবং পাসওয়ার্ড দিন');
      return;
    }

    btn.disabled = true;
    btn.textContent = authMode === 'login' ? 'লগইন হচ্ছে...' : 'রেজিস্টার হচ্ছে...';
    errorEl.classList.remove('show');

    try {
      if (authMode === 'login') {
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        await auth.createUserWithEmailAndPassword(email, password);
      }
      // onAuthStateChanged will handle the UI update
    } catch (error) {
      console.error('Auth error:', error);
      let msg = 'লগইন ব্যর্থ হয়েছে';
      if (error.code === 'auth/user-not-found') msg = 'ইউজার পাওয়া যায়নি';
      if (error.code === 'auth/wrong-password') msg = 'ভুল পাসওয়ার্ড';
      if (error.code === 'auth/email-already-in-use') msg = 'এই ইমেইল ইতিমধ্যে ব্যবহৃত';
      if (error.code === 'auth/weak-password') msg = 'পাসওয়ার্ড দুর্বল (কমপক্ষে ৬টি অক্ষর)';
      if (error.code === 'auth/invalid-email') msg = 'ইমেইল ঠিকানা সঠিক নয়';
      showLoginError(msg);
      btn.disabled = false;
      btn.textContent = authMode === 'login' ? 'লগইন' : 'রেজিস্টার করুন';
    }
  };

  const showLoginError = msg => {
    const el = document.getElementById('login-error');
    el.textContent = '⚠️ ' + msg;
    el.classList.add('show');
  };

  const toggleAuthMode = () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    const subtitle = document.getElementById('login-subtitle');
    const btn = document.getElementById('login-btn');
    const toggleText = document.getElementById('login-toggle-text');
    const toggleLink = document.getElementById('login-toggle-link');

    if (authMode === 'register') {
      subtitle.textContent = 'নতুন অ্যাকাউন্ট তৈরি করুন';
      btn.textContent = 'রেজিস্টার করুন';
      toggleText.textContent = 'ইতিমধ্যে অ্যাকাউন্ট আছে?';
      toggleLink.textContent = 'লগইন করুন';
    } else {
      subtitle.textContent = 'লগইন করুন';
      btn.textContent = 'লগইন';
      toggleText.textContent = 'অ্যাকাউন্ট নেই?';
      toggleLink.textContent = 'রেজিস্টার করুন';
    }
    document.getElementById('login-error').classList.remove('show');
  };

  const handleLogout = () => {
    showConfirm('লগআউট করবেন?', 'আপনি লগআউট হয়ে যাবেন।', false, ok => {
      if (ok) auth.signOut();
    });
  };

  // ─── Splash screen (welcome ~2.5s, then fades to the login screen) ──
  (function initSplash() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    // Sprinkles + orbit dots (matches the watermark splash style)
    const fx = document.getElementById('splash-fx');
    if (fx) {
      const cols = ['#e09642', '#2f8f77', '#d6783c', '#c9a227'];
      for (let i = 0; i < 26; i++) {
        const s = document.createElement('span');
        s.className = 'splash-spr';
        s.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 4]};` +
          `animation-duration:${(6 + Math.random() * 8).toFixed(1)}s;animation-delay:${(-Math.random() * 12).toFixed(1)}s;` +
          `opacity:${(.4 + Math.random() * .5).toFixed(2)}`;
        fx.appendChild(s);
      }
      const orbit = document.createElement('div');
      orbit.className = 'splash-orbit';
      for (let i = 0; i < 8; i++) {
        const d = document.createElement('i');
        d.style.cssText = `background:${cols[i % 4]};transform:rotate(${i * 45}deg) translateX(150px)`;
        orbit.appendChild(d);
      }
      fx.appendChild(orbit);
    }
    // Fade out after ~4.5s so the welcome animation plays fully and lingers
    if (!splash.classList.contains('gone')) {
      setTimeout(() => splash.classList.add('gone'), 4500);
    }
  })();

  // Enter key support for login
  document.addEventListener('DOMContentLoaded', () => {
    const handleEnter = e => {
      if (e.key === 'Enter') handleLogin();
    };
    document.getElementById('login-email')?.addEventListener('keypress', handleEnter);
    document.getElementById('login-password')?.addEventListener('keypress', handleEnter);
  });

  // ─── Public API ──────────────────────────────────────────────
  // ─── Writing toggle ─────────────────────────────────────────────
  const toggleWriting = function() {
    const checkbox = document.getElementById('f-no-writing');
    const input = document.getElementById('f-writing');
    if (checkbox.checked) {
      input.value = 'NO WRITING';
      input.disabled = true;
      input.style.opacity = '0.5';
    } else {
      if (input.value === 'NO WRITING') input.value = '';
      input.disabled = false;
      input.style.opacity = '1';
    }
  };

  // ─── Time toggle ────────────────────────────────────────────────
  const toggleTime = function() {
    const checkbox = document.getElementById('f-no-time');
    const input    = document.getElementById('f-time');
    const ampm     = document.getElementById('f-time-ampm');
    if (checkbox.checked) {
      input.value = '';
      input.disabled = true;
      input.style.opacity = '0.5';
      if (ampm) { ampm.value = ''; ampm.disabled = true; ampm.style.opacity = '0.5'; }
    } else {
      input.disabled = false;
      input.style.opacity = '1';
      if (ampm) { ampm.disabled = false; ampm.style.opacity = '1'; }
    }
  };

  // ─── Delivery time helpers (identical rules to the customer app) ─
  // Hour (1-12) + optional minutes + AM/PM selector. Minutes missing?
  // Auto-set to 00 ("3" or "3." → "3.00").
  function parseTimeParts(raw) {
    const t = String(raw || '').trim().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
    const m = t.match(/^(\d{1,2})(?:\s*[:.\-]\s*(\d{1,2}))?$/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = m[2] != null ? parseInt(m[2], 10) : null;
    if (h < 1 || h > 12) return null;
    if (min != null && min > 59) return null;
    return { h, min };
  }

  const normalizeTimeInput = function() {
    const el = document.getElementById('f-time');
    if (!el) return;
    const raw = el.value.trim();
    if (!raw) return;
    // If AM/PM was typed manually, drop it — there is a selector now
    const cleaned = raw.replace(/\s*(?:a\.?m\.?|p\.?m\.?|এএম|পিএম)\.?$/i, '').trim();
    const p = parseTimeParts(cleaned);
    if (!p) return; // leave as-is; validation will catch it
    el.value = `${p.h}.${String(p.min == null ? 0 : p.min).padStart(2, '0')}`;
  };

  const getSelectedTime = function() {
    const p = parseTimeParts(document.getElementById('f-time')?.value);
    const apEl = document.getElementById('f-time-ampm');
    const ap = apEl ? apEl.value : '';
    if (!p || !ap) return '';
    return `${p.h}:${String(p.min == null ? 0 : p.min).padStart(2, '0')} ${ap}`;
  };

  const getTimeError = function() {
    const raw = document.getElementById('f-time')?.value.trim() || '';
    const apEl = document.getElementById('f-time-ampm');
    const ap = apEl ? apEl.value : '';
    if (!raw && !ap) {
      return lang === 'en' ? 'Please enter the delivery time' : 'ডেলিভারির সময় দিন';
    }
    const cleaned = raw.replace(/\s*(?:a\.?m\.?|p\.?m\.?|এএম|পিএম)\.?$/i, '').trim();
    if (!parseTimeParts(cleaned)) {
      return lang === 'en'
        ? 'Enter a valid time like 3.00 (hour 1-12, minutes 0-59)'
        : 'সঠিক সময় লিখুন — যেমন 3.00 (ঘণ্টা ১-১২, মিনিট ০-৫৯)';
    }
    if (!ap) {
      return lang === 'en' ? 'Please select AM or PM' : 'AM অথবা PM নির্বাচন করুন';
    }
    return '';
  };

  // ─── Fulfilment (delivery / self-pickup, mirrors customer app) ───
  const PICKUP_ADDRESS = 'রঙধনু অ্যাপার্টমেন্ট, খোশালশাহ রোড, আমানবাজার, হাটহাজারী রোড, চট্টগ্রাম';
  const onFulfilmentChange = function() {
    const fulfil = document.getElementById('f-fulfilment').value;
    const addr   = document.getElementById('f-address');
    const damt   = document.getElementById('f-delivery-amount');
    const dpaid  = document.getElementById('f-delivery-paid');
    if (fulfil === 'pickup') {
      if (!addr.value.trim()) addr.value = PICKUP_ADDRESS;
      damt.value = '';
      dpaid.value = 'na';
    } else {
      if (addr.value.trim() === PICKUP_ADDRESS) addr.value = '';
      if (dpaid.value === 'na') dpaid.value = 'unpaid';
    }
  };

  // Order ID — same NB + date + random format as the customer app
  const generateAdminOrderId = function() {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `NB${dateStr}${random}`;
  };

  // ─── Daily "orders placed today" popup ───────────────────────────
  // Every time the app is opened it lists all orders created TODAY
  // (Bangladesh time, UTC+6). The list accumulates through the day and
  // resets automatically at 12 AM because createdAt moves to yesterday.
  let dailyPopupShownThisSession = false;
  const bdTodayStr = () => new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const bdCreatedToday = o => {
    const ts = Number(o.createdAt);
    if (!ts) return false;
    return new Date(ts + 6 * 60 * 60 * 1000).toISOString().slice(0, 10) === bdTodayStr();
  };
  const MONTHS_EN_D = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_EN_D   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS_BN_D = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  const DAYS_BN_D   = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  const dailyFmtDate = dstr => {
    const d = toDate(dstr);
    if (!d || Number.isNaN(d.getTime())) return dstr || '';
    return lang === 'bn'
      ? `${d.getDate()} ${MONTHS_BN_D[d.getMonth()]} ${DAYS_BN_D[d.getDay()]} ${d.getFullYear()}`
      : `${d.getDate()} ${MONTHS_EN_D[d.getMonth()]} ${DAYS_EN_D[d.getDay()]} ${d.getFullYear()}`;
  };
  const todaysPlacedOrders = () => orders
    .filter(o => bdCreatedToday(o) && o.status !== 'cancelled')
    .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

  const updateDailyBadge = () => {
    const btn = document.getElementById('daily-log-btn');
    const cnt = document.getElementById('daily-count');
    if (!btn || !cnt) return;
    const n = todaysPlacedOrders().length;
    cnt.textContent = n;
    btn.style.display = n > 0 ? '' : 'none';
  };

  const showDailyPopup = () => {
    const wrap  = document.getElementById('daily-popup-overlay');
    const title = document.getElementById('daily-popup-title');
    const body  = document.getElementById('daily-popup-list');
    if (!wrap || !body) return;
    const list = todaysPlacedOrders();
    title.textContent = lang === 'bn'
      ? `🎉 আজকের নতুন অর্ডার (${list.length}টি)`
      : `🎉 New orders placed today (${list.length})`;
    body.innerHTML = list.length ? list.map((o, i) => {
      const nm = o.customerName || o.name || '—';
      const wt = weightText(o) || '';
      const fl = flavourLabel(o) || '';
      const dstr = o.deliveryDate || o.date || '';
      return `<div class="daily-item">
        <span class="d-num">${i + 1}</span>
        <div>
          <div class="d-name">${esc(nm)}</div>
          <div class="d-meta">${lang === 'bn' ? 'অর্ডার করেছে' : 'Ordered'} ${esc(wt)} ${esc(fl)} ${lang === 'bn' ? 'কেক' : 'cake'}</div>
          <div class="d-meta">${lang === 'bn' ? 'মূল্য' : 'price'}: <span class="d-price">৳${fmtMoney(o.total)}</span> · ${lang === 'bn' ? 'ডেলিভারির তারিখ' : 'delivery date'}: ${esc(dailyFmtDate(dstr))}</div>
        </div>
      </div>`;
    }).join('') : `<div style="text-align:center;color:var(--text3);padding:22px 0">${lang === 'bn' ? 'আজ কোনো নতুন অর্ডার আসেনি।' : 'No new orders placed today yet.'}</div>`;
    wrap.classList.add('open');
  };
  const closeDailyPopup = () => {
    const w = document.getElementById('daily-popup-overlay');
    if (w) w.classList.remove('open');
  };
  const closeDailyPopupBg = e => { if (e.target && e.target.id === 'daily-popup-overlay') closeDailyPopup(); };

  return {
    switchTab,
    toggleCard,
    copyCardName,
    copySrsMessage,
    copyNotepad,
    openModal,
    closeModal,
    closeModalBg,
    saveOrder,
    exportData,
    openLightbox,
    closeLightbox,
    confirmStatusChange,
    updateNotes,
    copySrsMessage,
    duplicateOrder,
    showConfirm,
    closeConfirm,
    confirmDelete,
    toggleSort,
    clearSearch,
    calPrev: () => calShift(-1),
    calNext: () => calShift(1),
    openCalendar,
    closeCalendar,
    closeCalendarBg,
    removePhoto,
    openPhotoLightbox,
    setLang,
    openPayCharge,
    closePayCharge,
    closePayChargeBg,
    pcToggle,
    applyPayCharge,
    advanceInput,
    markFullyPaid,
    handleLogin,
    toggleAuthMode,
    handleLogout,
    toggleWriting,
    toggleTime,
    normalizeTimeInput,
    onFulfilmentChange,
    showDailyPopup,
    closeDailyPopup,
    closeDailyPopupBg
  };

})();
