/* Structured monthly costing ledger for the admin dashboard. */
'use strict';

window.NituMonthlyCosting = (() => {
  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const MONTHS = {
    bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  const CATEGORIES = [
    { key: 'current', icon: '⚡', bn: 'কারেন্ট / বিদ্যুৎ', en: 'Current / Electricity' },
    { key: 'bakery', icon: '🧁', bn: 'বেকারি সাপ্লাই', en: 'Bakery supplies' },
    { key: 'grocery', icon: '🛒', bn: 'গ্রোসারি', en: 'Grocery' },
    { key: 'topper', icon: '🎈', bn: 'টপার ও বল', en: 'Topper and ball' },
    { key: 'print', icon: '🖨️', bn: 'প্রিন্ট', en: 'Print' },
    { key: 'other', icon: '📦', bn: 'অন্যান্য', en: 'Other' }
  ];
  const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map(item => [item.key, item]));

  const text = (language, bn, en) => language === 'en' ? en : bn;
  const toAsciiDigits = value => String(value == null ? '' : value).replace(/[০-৯]/g, digit => String(BN_DIGITS.indexOf(digit)));
  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const callArg = value => escapeHtml(JSON.stringify(String(value)));

  const parseAmount = raw => {
    const source = toAsciiDigits(raw).replace(/[৳,\s]/g, '');
    if (!source) return { value: null, error: 'Enter an amount.' };
    if (!/^\d+(?:\.\d+)?(?:\+\d+(?:\.\d+)?)*$/.test(source)) {
      return { value: null, error: 'Use numbers separated by +, for example 1190+1293.' };
    }
    const parts = source.split('+').map(Number);
    const value = Math.round(parts.reduce((sum, part) => sum + part, 0) * 100) / 100;
    return value > 0 && Number.isFinite(value)
      ? { value, parts }
      : { value: null, error: 'Amount must be greater than zero.' };
  };

  const monthKeyFromDate = value => {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const validMonthKey = value => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(value || ''));
  const monthLabel = (key, language) => {
    if (!validMonthKey(key)) return key;
    const [year, month] = key.split('-').map(Number);
    return `${MONTHS[language === 'en' ? 'en' : 'bn'][month - 1]} ${year}`;
  };

  const normalizeEntry = (key, entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const category = CATEGORY_BY_KEY[entry.category] ? entry.category : 'other';
    return {
      key: String(key),
      category,
      amount,
      source: String(entry.source || amount),
      status: entry.status === 'pending' ? 'pending' : 'paid',
      note: String(entry.note || '').trim(),
      createdAt: Number(entry.createdAt) || 0,
      updatedAt: Number(entry.updatedAt) || 0
    };
  };

  const summarize = (month, baseIncome) => {
    const entries = Object.entries(month?.entries || {})
      .map(([key, entry]) => normalizeEntry(key, entry))
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    const incomeAdjustment = Number(month?.incomeAdjustment) || 0;
    const totalIncome = Math.max(0, Math.max(0, Number(baseIncome) || 0) + incomeAdjustment);
    const paidExpenses = entries.filter(entry => entry.status === 'paid').reduce((sum, entry) => sum + entry.amount, 0);
    const pendingExpenses = entries.filter(entry => entry.status === 'pending').reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = paidExpenses + pendingExpenses;
    const categoryTotals = {};
    entries.forEach(entry => { categoryTotals[entry.category] = (categoryTotals[entry.category] || 0) + entry.amount; });
    return {
      entries,
      baseIncome: Number(baseIncome) || 0,
      incomeAdjustment,
      totalIncome,
      paidExpenses,
      pendingExpenses,
      totalExpenses,
      cashNet: totalIncome - paidExpenses,
      projectedNet: totalIncome - totalExpenses,
      categoryTotals
    };
  };

  const create = ({ costingRef, getIncome, language, formatMoney, toast, confirm }) => {
    let data = {};
    let currentMonth = monthKeyFromDate(new Date());
    let ready = false;
    let uid = '';
    let listener = null;

    const lang = () => language() === 'en' ? 'en' : 'bn';
    const say = (bn, en) => text(lang(), bn, en);
    const money = value => typeof formatMoney === 'function'
      ? formatMoney(value)
      : Math.round(Number(value) || 0).toLocaleString(lang() === 'en' ? 'en-US' : 'bn-BD');
    const el = id => document.getElementById(id);
    const monthRef = key => costingRef.child(key);
    const summary = key => summarize(data[key] || {}, getIncome(key));

    const renderStatus = message => {
      const status = el('costing-status');
      if (!status) return;
      status.textContent = message || (!ready
        ? say('ক্লাউডে খরচের হিসাব লোড হচ্ছে…', 'Loading costing data from the cloud…')
        : say('☁️ মাসিক খরচ ক্লাউডে সিঙ্ক হয়েছে', '☁️ Monthly costs synced to the cloud'));
    };

    const receive = snapshot => {
      const value = snapshot && typeof snapshot.val === 'function' ? snapshot.val() : snapshot;
      data = value && typeof value === 'object' ? value : {};
      ready = true;
      render();
    };

    const reset = () => {
      if (listener) {
        try { costingRef.off('value', listener); } catch (e) {}
      }
      listener = null;
      data = {};
      ready = false;
      uid = '';
      render();
    };

    const activate = userId => {
      reset();
      uid = String(userId || '');
      if (!uid) return;
      listener = snapshot => receive(snapshot);
      costingRef.on('value', listener, () => renderStatus(say('খরচের হিসাব লোড হয়নি।', 'Could not load costing data.')));
    };

    const setMonth = value => {
      const next = String(value || '').trim();
      if (!validMonthKey(next)) return false;
      currentMonth = next;
      render();
      return true;
    };

    const saveIncome = async value => {
      if (!uid || !validMonthKey(currentMonth)) return false;
      const normalized = toAsciiDigits(value).replace(/[৳,\s]/g, '');
      const amount = normalized === '' ? 0 : Number(normalized);
      if (!Number.isFinite(amount)) {
        toast(say('আয়ের সমন্বয় সঠিক সংখ্যা দিন।', 'Enter a valid income adjustment.'));
        render();
        return false;
      }
      try {
        await monthRef(currentMonth).update({ incomeAdjustment: amount, updatedAt: Date.now() });
        data[currentMonth] = { ...(data[currentMonth] || {}), incomeAdjustment: amount, updatedAt: Date.now() };
        renderStatus();
        render();
        return true;
      } catch (error) {
        toast(say('আয়ের সমন্বয় সেভ হয়নি।', 'Income adjustment was not saved.'));
        return false;
      }
    };

    const addEntry = async () => {
      if (!uid || !ready) return false;
      const category = el('costing-category')?.value || 'other';
      const source = el('costing-amount')?.value || '';
      const parsed = parseAmount(source);
      if (!parsed.value) {
        toast(say('পরিমাণ লিখুন — যেমন ১১৯০+১২৯৩।', parsed.error));
        el('costing-amount')?.focus();
        return false;
      }
      const status = el('costing-payment-status')?.value === 'pending' ? 'pending' : 'paid';
      const note = String(el('costing-note')?.value || '').trim();
      const entry = {
        category: CATEGORY_BY_KEY[category] ? category : 'other',
        amount: parsed.value,
        source: String(source).trim(),
        status,
        note,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      try {
        const pushed = await monthRef(currentMonth).child('entries').push(entry);
        const key = pushed && pushed.key ? String(pushed.key) : '';
        if (key) {
          data[currentMonth] = {
            ...(data[currentMonth] || {}),
            entries: { ...((data[currentMonth] || {}).entries || {}), [key]: entry }
          };
        }
        toast(say('মাসিক খরচ যোগ হয়েছে।', 'Monthly expense added.'));
        const amountInput = el('costing-amount');
        const noteInput = el('costing-note');
        if (amountInput) amountInput.value = '';
        if (noteInput) noteInput.value = '';
        render();
        return true;
      } catch (error) {
        toast(say('খরচ সেভ হয়নি। আবার চেষ্টা করুন।', 'Expense was not saved. Please retry.'));
        return false;
      }
    };

    const deleteEntry = key => {
      const run = async ok => {
        if (!ok) return;
        try {
          await monthRef(currentMonth).child('entries').child(key).remove();
          if (data[currentMonth]?.entries) {
            const entries = { ...data[currentMonth].entries };
            delete entries[key];
            data[currentMonth] = { ...data[currentMonth], entries };
          }
          toast(say('খরচ মুছে ফেলা হয়েছে।', 'Expense deleted.'));
          render();
        } catch (error) {
          toast(say('খরচ মুছে ফেলা যায়নি।', 'Expense could not be deleted.'));
        }
      };
      if (typeof confirm === 'function') {
        confirm(say('এই খরচ মুছবেন?', 'Delete this expense?'), say('এই হিসাবটি আর থাকবে না।', 'This costing entry will be removed.'), false, run);
      } else {
        run(true);
      }
    };

    const toggleStatus = async key => {
      const entry = data[currentMonth]?.entries?.[key];
      if (!entry) return false;
      const status = entry.status === 'pending' ? 'paid' : 'pending';
      try {
        await monthRef(currentMonth).child('entries').child(key).update({ status, updatedAt: Date.now() });
        data[currentMonth] = {
          ...(data[currentMonth] || {}),
          entries: {
            ...((data[currentMonth] || {}).entries || {}),
            [key]: { ...entry, status, updatedAt: Date.now() }
          }
        };
        toast(say(status === 'paid' ? 'খরচ পরিশোধিত হিসেবে রাখা হয়েছে।' : 'খরচ বাকি হিসেবে রাখা হয়েছে।', status === 'paid' ? 'Expense marked paid.' : 'Expense marked pending.'));
        render();
        return true;
      } catch (error) {
        toast(say('স্ট্যাটাস বদলানো যায়নি।', 'Could not update expense status.'));
        return false;
      }
    };

    const render = () => {
      const view = el('view-costing');
      if (!view) return;
      const s = summary(currentMonth);
      const month = data[currentMonth] || {};
      const adjustment = month.incomeAdjustment == null ? '' : String(month.incomeAdjustment);
      const categoryOptions = CATEGORIES.map(item => `<option value="${item.key}">${item.icon} ${say(item.bn, item.en)}</option>`).join('');
      const entryRows = s.entries.length ? s.entries.map(entry => {
        const category = CATEGORY_BY_KEY[entry.category];
        const pending = entry.status === 'pending';
        return `<div class="costing-entry ${pending ? 'is-pending' : ''}">
          <div class="costing-entry-main"><span class="costing-entry-icon">${category.icon}</span><div><strong>${escapeHtml(say(category.bn, category.en))}</strong><small>${escapeHtml(entry.source)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</small></div></div>
          <div class="costing-entry-amount"><b>৳${money(entry.amount)}</b><button type="button" class="costing-status-btn ${pending ? 'pending' : 'paid'}" onclick="App.costingToggleStatus(${callArg(entry.key)})">${pending ? say('বাকি', 'Pending') : say('পরিশোধিত', 'Paid')}</button></div>
          <button type="button" class="costing-delete" aria-label="${say('খরচ মুছুন', 'Delete expense')}" onclick="App.costingDeleteEntry(${callArg(entry.key)})">✕</button>
        </div>`;
      }).join('') : `<div class="costing-empty">${say('এই মাসে এখনো কোনো খরচ যোগ করা হয়নি।', 'No expenses have been added for this month yet.')}</div>`;
      const categoryRows = CATEGORIES.map(item => {
        const amount = s.categoryTotals[item.key] || 0;
        return `<div class="costing-category-row"><span>${item.icon} ${escapeHtml(say(item.bn, item.en))}</span><b>৳${money(amount)}</b></div>`;
      }).join('');
      const netClass = s.projectedNet >= 0 ? 'positive' : 'negative';
      view.innerHTML = `<div class="costing-shell">
        <div class="costing-heading"><div><span class="costing-eyebrow">${say('মাসিক হিসাব', 'MONTHLY COSTING')}</span><h2>🧾 ${say('খরচ ও নেট আয়', 'Costs & Net Income')}</h2><p>${say('অর্ডারের আয় থেকে আপনার মাসিক খরচ বাদ দিয়ে হিসাব দেখুন।', 'Subtract monthly costs from order income and see the real result.')}</p></div><div class="costing-ready">${ready ? '☁️' : '…'}</div></div>
        <div class="costing-controls"><label><span>${say('মাস', 'Month')}</span><input id="costing-month" type="month" value="${escapeHtml(currentMonth)}" onchange="App.costingSetMonth(this.value)"></label><label><span>${say('অন্য আয় / সমন্বয়', 'Other income / adjustment')}</span><input id="costing-income-adjustment" type="number" step="0.01" inputmode="decimal" value="${escapeHtml(adjustment)}" placeholder="0" onchange="App.costingSaveIncome(this.value)"></label></div>
        <div class="costing-metrics"><div class="costing-metric income"><span>💰 ${say('মোট আয়', 'Total income')}</span><strong>৳${money(s.totalIncome)}</strong><small>${say('অর্ডার বিক্রি + সমন্বয়', 'Order sales + adjustment')}</small></div><div class="costing-metric expense"><span>🧾 ${say('পরিশোধিত খরচ', 'Paid expenses')}</span><strong>৳${money(s.paidExpenses)}</strong><small>${say('এখন পর্যন্ত দেওয়া', 'Already paid')}</small></div><div class="costing-metric pending"><span>⏳ ${say('বাকি খরচ', 'Pending expenses')}</span><strong>৳${money(s.pendingExpenses)}</strong><small>${say('পরে দিতে হবে', 'Still to pay')}</small></div><div class="costing-metric ${netClass}"><span>📈 ${say('প্রজেক্টেড নেট আয়', 'Projected net income')}</span><strong>৳${money(s.projectedNet)}</strong><small>${say('আয় − সব খরচ', 'Income − all expenses')}</small></div></div>
        <div class="costing-panels"><section class="costing-panel"><div class="costing-panel-title"><h3>${say('নতুন খরচ যোগ করুন', 'Add monthly expense')}</h3><span>${escapeHtml(monthLabel(currentMonth, lang()))}</span></div><div class="costing-form"><label><span>${say('ধরন', 'Category')}</span><select id="costing-category">${categoryOptions}</select></label><label><span>${say('পরিমাণ', 'Amount')}</span><input id="costing-amount" type="text" inputmode="decimal" placeholder="1190 + 1293"></label><label><span>${say('অবস্থা', 'Status')}</span><select id="costing-payment-status"><option value="paid">${say('পরিশোধিত', 'Paid')}</option><option value="pending">${say('বাকি', 'Pending')}</option></select></label><label><span>${say('নোট', 'Note')}</span><input id="costing-note" type="text" maxlength="120" placeholder="${say('দোকান বা কেনাকাটার নোট', 'Shop or purchase note')}"></label><button type="button" class="costing-add-btn" onclick="App.costingAddEntry()">＋ ${say('খরচ যোগ করুন', 'Add expense')}</button></div><p class="costing-form-hint">${say('একাধিক অংক যোগ করতে + ব্যবহার করুন, যেমন ১১৯০+১২৯৩।', 'Use + for multiple amounts, for example 1190+1293.')}</p></section><section class="costing-panel"><div class="costing-panel-title"><h3>${say('ক্যাটাগরি অনুযায়ী', 'By category')}</h3><span>৳${money(s.totalExpenses)}</span></div><div class="costing-category-list">${categoryRows}</div></section></div>
        <section class="costing-panel costing-entries-panel"><div class="costing-panel-title"><h3>${say('এই মাসের খরচ', 'This month\'s expenses')}</h3><span>${s.entries.length} ${say('টি এন্ট্রি', 'entries')}</span></div><div class="costing-entries">${entryRows}</div></section>
        <div class="costing-net-note"><strong>${say('ক্যাশ নেট আয়', 'Cash net income')}: ৳${money(s.cashNet)}</strong><span>${say('এখানে শুধু পরিশোধিত খরচ বাদ দেওয়া হয়েছে।', 'Only paid expenses are deducted here.')} ${say('প্রজেক্টেড নেট আয়ে বাকি খরচও ধরা হয়েছে।', 'Projected net income includes pending expenses too.')}</span></div>
        <div class="costing-footer"><span id="costing-status" role="status"></span><button type="button" class="costing-secondary-btn" onclick="App.dashboardTab('overview')">← ${say('ড্যাশবোর্ডে ফিরুন', 'Back to dashboard')}</button></div>
      </div>`;
      renderStatus();
    };

    return { activate, reset, receive, render, setMonth, saveIncome, addEntry, deleteEntry, toggleStatus, summary, getMonth: () => currentMonth };
  };

  return { CATEGORIES, parseAmount, monthKeyFromDate, summarize, create };
})();
