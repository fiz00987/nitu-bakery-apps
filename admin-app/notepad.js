/* Categorized bakery notes. Existing numeric page keys and page contents stay intact. */
'use strict';
window.NituNotepad = (() => {
  const CATEGORIES = ['cake', 'baking', 'other'];
  const VIEWS = [...CATEGORIES, 'calculator'];
  const isToolView = value => value === 'calculator';
  const categoryOf = page => CATEGORIES.includes(page && page.category) ? page.category : 'cake';
  const entries = raw => Object.entries(raw || {}).filter(([, page]) => page && typeof page === 'object')
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  const digits = value => String(value).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const formatNumber = value => String(Number(value.toPrecision(12)));
  const EXPENSE_CHANGE_EVENT = 'notepad-expenses-changed';
  const amountPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const normalizeAmount = value => {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Number(formatNumber(value)) : null;
    if (typeof value !== 'string') return null;
    const source = digits(value.trim());
    if (!source || !amountPattern.test(source)) return null;
    const amount = Number(source);
    return Number.isFinite(amount) && amount >= 0 ? Number(formatNumber(amount)) : null;
  };
  const normalizeDate = value => {
    const source = digits(String(value ?? '').trim());
    if (!datePattern.test(source)) return null;
    const [year, month, day] = source.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] ? source : null;
  };
  const today = () => {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  };
  const MAX_ITEMS_PER_PAGE = 30;
  const itemQuantityOf = item => {
    if (!item || typeof item !== 'object') return '';
    // `detail` is the original shopping-list field. New rows use the more
    // precise quantity name, while old rows must continue to display as-is.
    const quantity = Object.hasOwn(item, 'quantity') ? String(item.quantity ?? '').trim() : '';
    return quantity || String(item.detail ?? '');
  };
  const appendPageText = (text, addition) => {
    const source = String(text ?? '');
    const extra = String(addition ?? '').trim();
    if (!extra) return source;
    return source.trim() ? `${source}\n\n${extra}` : extra;
  };

  // Parse arithmetic, never JavaScript. Supports precedence, parentheses and Bangla digits.
  const calculate = expression => {
    const source = digits(expression).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
    if (!source || source.length > 180 || /[^0-9.+*/()\-]/.test(source)) throw new Error('expression');
    let pos = 0;
    const primary = () => {
      if (source[pos] === '+' || source[pos] === '-') {
        const sign = source[pos++] === '-' ? -1 : 1;
        return sign * primary();
      }
      if (source[pos] === '(') {
        pos++;
        const value = sum();
        if (source[pos++] !== ')') throw new Error('expression');
        return value;
      }
      const match = source.slice(pos).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) throw new Error('expression');
      pos += match[0].length;
      return Number(match[0]);
    };
    const product = () => {
      let value = primary();
      while (source[pos] === '*' || source[pos] === '/') {
        const op = source[pos++], right = primary();
        if (op === '/' && right === 0) throw new Error('zero');
        value = op === '*' ? value * right : value / right;
      }
      return value;
    };
    const sum = () => {
      let value = product();
      while (source[pos] === '+' || source[pos] === '-') {
        const op = source[pos++], right = product();
        value = op === '+' ? value + right : value - right;
      }
      return value;
    };
    const result = sum();
    if (pos !== source.length || !Number.isFinite(result)) throw new Error('expression');
    return Number(formatNumber(result));
  };
  const create = ({ pagesRef, notesRef, toast, sync, confirm, language, photoUrl, compressPhoto, openPhoto }) => {
    const el = id => document.getElementById(id);
    const say = (en, bn) => language() === 'bn' ? bn : en;
    const firstElement = ids => ids.map(id => el(id)).find(Boolean) || null;
    const addEntryRow = () => document.querySelector('.np-add-item');
    const ensureAddInput = (id, options = {}) => {
      const existing = el(id);
      if (existing) return existing;
      const row = addEntryRow();
      if (!row) return null;
      const input = document.createElement('input');
      input.id = id;
      input.type = options.type || 'text';
      input.className = options.className || '';
      if (options.maxLength) input.maxLength = options.maxLength;
      if (options.min != null) input.min = String(options.min);
      if (options.step != null) input.step = String(options.step);
      if (options.inputMode) input.inputMode = options.inputMode;
      if (options.placeholderEn) {
        input.dataset.npPlaceholderEn = options.placeholderEn;
        input.dataset.npPlaceholderBn = options.placeholderBn || options.placeholderEn;
        input.placeholder = say(options.placeholderEn, options.placeholderBn || options.placeholderEn);
      }
      if (options.ariaEn) {
        input.dataset.npAriaEn = options.ariaEn;
        input.dataset.npAriaBn = options.ariaBn || options.ariaEn;
        input.setAttribute('aria-label', say(options.ariaEn, options.ariaBn || options.ariaEn));
      }
      const button = row.querySelector('button');
      row.insertBefore(input, button || null);
      return input;
    };
    const addEntryControls = () => {
      const name = el('notepad-item-name');
      const quantity = firstElement(['notepad-item-quantity', 'notepad-item-detail']);
      if (quantity) {
        quantity.classList.add('np-add-quantity');
        quantity.dataset.npPlaceholderEn ||= 'Quantity';
        quantity.dataset.npPlaceholderBn ||= 'পরিমাণ';
        quantity.dataset.npAriaEn ||= 'Shopping quantity';
        quantity.dataset.npAriaBn ||= 'কেনাকাটার পরিমাণ';
      }
      const price = firstElement(['notepad-item-price', 'notepad-item-amount']) || ensureAddInput('notepad-item-price', {
        type: 'number', className: 'np-add-price', min: 0, step: 0.01, inputMode: 'decimal',
        placeholderEn: 'Price (optional)', placeholderBn: 'দাম (ঐচ্ছিক)',
        ariaEn: 'Shopping item price', ariaBn: 'কেনাকাটার আইটেমের দাম'
      });
      if (price) price.classList.add('np-add-price');
      const additional = firstElement(['notepad-item-additional', 'notepad-item-additional-info', 'notepad-item-info']);
      if (additional) additional.classList.add('np-add-additional');
      return { name, quantity, price, additional };
    };
    let pages = {}, legacy = null, ready = false, active = null, category = 'cake', activeView = 'cake';
    let drafts = {}, user = '', epoch = 0, loadSequence = 0, timer = null;
    let addingItem = null, removeAllJob = null;
    const saving = new Map();
    const expenseDrafts = new Map();
    const expenseSaving = new Map();
    const lastPage = {};
    const current = () => active == null ? null : pages[active];
    const expenseDraftKey = (pageKey, itemKey) => `${pageKey}\u0000${itemKey}`;
    const scopedExpenseDraftKey = () => 'nitu-note-expense-drafts-v1:' + user;
    const persistExpenseDrafts = () => {
      if (!user) return;
      try {
        if (!expenseDrafts.size) {
          localStorage.removeItem(scopedExpenseDraftKey());
          return;
        }
        const stored = {};
        expenseDrafts.forEach((draft, key) => {
          stored[key] = {
            pageKey: String(draft.pageKey), itemKey: String(draft.itemKey),
            values: {
              amount: String(draft.values?.amount ?? ''),
              date: String(draft.values?.date ?? '')
            },
            patch: Object.fromEntries(['amount', 'date']
              .filter(field => Object.hasOwn(draft.patch || {}, field))
              .map(field => [field, String(draft.patch[field] ?? '')])),
            base: draft.base && typeof draft.base === 'object' ? {
              amount: String(draft.base.amount ?? ''), date: String(draft.base.date ?? '')
            } : null,
            version: Number.isFinite(Number(draft.version)) ? Number(draft.version) : 0,
            error: draft.error || null
          };
        });
        localStorage.setItem(scopedExpenseDraftKey(), JSON.stringify(stored));
      } catch (e) { toast(say('Expense draft storage is full — keep this window open until saved.', 'খরচের ড্রাফট স্টোরেজ পূর্ণ — সেভ না হওয়া পর্যন্ত এই উইন্ডো খোলা রাখুন।')); }
    };
    const restoreExpenseDrafts = () => {
      expenseDrafts.clear();
      if (!user) return;
      try {
        const stored = JSON.parse(localStorage.getItem(scopedExpenseDraftKey()) || '{}') || {};
        Object.values(stored).forEach(raw => {
          if (!raw || typeof raw !== 'object' || raw.pageKey == null || raw.itemKey == null) return;
          const pageKey = String(raw.pageKey), itemKey = String(raw.itemKey), patch = {};
          const rawPatch = raw.patch && typeof raw.patch === 'object' ? raw.patch : {};
          ['amount', 'date'].forEach(field => {
            if (Object.hasOwn(rawPatch, field)) patch[field] = String(rawPatch[field] ?? '');
          });
          const rawValues = raw.values && typeof raw.values === 'object' ? raw.values : {};
          const rawBase = raw.base && typeof raw.base === 'object' ? raw.base : null;
          expenseDrafts.set(expenseDraftKey(pageKey, itemKey), {
            pageKey, itemKey,
            values: { amount: String(rawValues.amount ?? patch.amount ?? ''), date: String(rawValues.date ?? patch.date ?? '') },
            patch,
            base: rawBase ? { amount: String(rawBase.amount ?? ''), date: String(rawBase.date ?? '') } : null,
            version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 0,
            timer: null,
            error: typeof raw.error === 'string' ? raw.error : null
          });
        });
      } catch (e) { expenseDrafts.clear(); }
    };
    const expenseSource = item => item && typeof item.expense === 'object' && item.expense !== null ? item.expense : null;
    const expenseValues = item => {
      const source = expenseSource(item);
      const rawAmount = source && Object.hasOwn(source, 'amount') ? source.amount
        : source && Object.hasOwn(source, 'price') ? source.price
          : item?.price;
      const rawDate = source && Object.hasOwn(source, 'date') ? source.date
        : source && Object.hasOwn(source, 'purchaseDate') ? source.purchaseDate
          : source && Object.hasOwn(source, 'expenseDate') ? source.expenseDate
            : item?.purchaseDate ?? item?.expenseDate ?? item?.priceDate ?? item?.date;
      return { amount: normalizeAmount(rawAmount), date: normalizeDate(rawDate) };
    };
    const itemIsPriced = (item, draft = null) => {
      const rawAmount = draft && Object.hasOwn(draft.patch || {}, 'amount')
        ? draft.values?.amount
        : expenseValues(item).amount;
      return normalizeAmount(rawAmount) != null;
    };
    const reconcileExpenseDrafts = raw => {
      expenseDrafts.forEach(draft => {
        const item = raw?.[draft.pageKey]?.items?.[draft.itemKey];
        if (!item || typeof item !== 'object') return;
        const values = expenseValues(item);
        ['amount', 'date'].forEach(field => {
          if (Object.hasOwn(draft.patch, field)) return;
          const value = values[field] == null ? '' : String(values[field]);
          draft.values[field] = value;
          if (draft.base) draft.base[field] = value;
        });
      });
    };
    const getExpenses = () => entries(pages).filter(([, page]) => categoryOf(page) === 'cake').flatMap(([pageKey, page]) =>
      entries(page.items).flatMap(([itemKey, item]) => {
        const expense = expenseValues(item);
        if (expense.amount == null || !expense.date) return [];
        return [{ pageKey: String(pageKey), itemKey: String(itemKey), name: String(item.name || ''), amount: expense.amount, date: expense.date }];
      })
    );
    const signalExpensesChanged = (reason, pageKey = null, itemKey = null) => {
      try {
        window.dispatchEvent(new CustomEvent(EXPENSE_CHANGE_EVENT, {
          detail: { reason, pageKey: pageKey == null ? null : String(pageKey), itemKey: itemKey == null ? null : String(itemKey), expenses: getExpenses() }
        }));
      } catch (e) {}
    };
    const askConfirm = (title, message, isGreen = false) => new Promise(resolve => {
      let settled = false;
      const done = result => {
        if (settled) return;
        settled = true;
        resolve(!!result);
      };
      try {
        if (typeof confirm !== 'function') done(false);
        else confirm(title, message, isGreen, done);
      } catch (e) { done(false); }
    });
    const matchesExpenseDraft = (draft, pageKey, itemKey = null) => draft
      && String(draft.pageKey) === String(pageKey)
      && (itemKey == null || String(draft.itemKey) === String(itemKey));
    const settleExpenseDrafts = async (pageKey, itemKey = null) => {
      const keys = [...expenseDrafts.entries()]
        .filter(([, draft]) => matchesExpenseDraft(draft, pageKey, itemKey))
        .map(([key]) => key);
      keys.forEach(key => {
        const draft = expenseDrafts.get(key);
        if (draft?.timer) clearTimeout(draft.timer);
        if (draft) draft.timer = null;
      });
      const jobs = keys.map(key => expenseSaving.get(key)).filter(Boolean);
      if (jobs.length) await Promise.allSettled(jobs);
    };
    const forgetExpenseDrafts = (pageKey, itemKey = null) => {
      let changed = false;
      [...expenseDrafts.entries()]
        .filter(([, draft]) => matchesExpenseDraft(draft, pageKey, itemKey))
        .forEach(([key, draft]) => {
          if (draft?.timer) clearTimeout(draft.timer);
          expenseDrafts.delete(key);
          changed = true;
        });
      if (changed) persistExpenseDrafts();
    };
    const scopedDraftKey = () => 'nitu-note-drafts-v1:' + user;
    const persist = () => {
      if (!user) return;
      try { localStorage.setItem(scopedDraftKey(), JSON.stringify(drafts)); }
      catch (e) { toast(say('Draft storage is full — keep this window open until saved.', 'ড্রাফট স্টোরেজ পূর্ণ — সেভ না হওয়া পর্যন্ত এই উইন্ডো খোলা রাখুন।')); }
    };
    const choosePage = () => {
      const visible = entries(pages).filter(([, page]) => categoryOf(page) === category);
      if (!visible.some(([key]) => key === active)) {
        active = visible.some(([key]) => key === lastPage[category]) ? lastPage[category] : (visible[0] || [null])[0];
      }
      return visible;
    };
    const reset = () => {
      persist();
      persistExpenseDrafts();
      epoch++; loadSequence++;
      clearTimeout(timer);
      expenseDrafts.forEach(draft => { if (draft.timer) clearTimeout(draft.timer); });
      pages = {}; legacy = null; ready = false; active = null; category = 'cake'; activeView = 'cake';
      drafts = {}; user = ''; addingItem = null; removeAllJob = null; saving.clear(); expenseDrafts.clear(); expenseSaving.clear();
      Object.keys(lastPage).forEach(key => delete lastPage[key]);
      el('notepad-overlay').classList.remove('open');
      document.body.style.overflow = '';
      render();
      signalExpensesChanged('reset');
    };
    const activate = uid => {
      if (user === uid) return;
      reset(); user = uid;
      try { drafts = JSON.parse(localStorage.getItem(scopedDraftKey()) || '{}') || {}; } catch (e) { drafts = {}; }
      restoreExpenseDrafts();
    };
    const receive = async raw => {
      const sequence = ++loadSequence, session = epoch;
      pages = raw && typeof raw === 'object' ? raw : {};
      if (!entries(pages).length && !ready) {
        try {
          const snapshot = await notesRef.once('value');
          if (session !== epoch || sequence !== loadSequence) return;
          if (snapshot.val() != null && String(snapshot.val()) !== '') {
            legacy = { text: String(snapshot.val()), photos: [], createdAt: Date.now() };
            pages = { 0: legacy }; // Display only. No migration write merely from opening the app.
          }
        } catch (e) {
          if (session !== epoch) return;
          toast(say('Notes could not load. Please reconnect.', 'নোট লোড হয়নি। আবার সংযোগ দিন।'));
          return;
        }
      }
      reconcileExpenseDrafts(pages);
      ready = true;
      render();
      signalExpensesChanged('receive');
    };
    const materializeLegacy = async () => {
      if (!legacy) return;
      const original = legacy, session = epoch;
      const result = await pagesRef.transaction(raw => {
        if (raw != null && Object.keys(raw).length) return;
        return { 0: original };
      }, undefined, false);
      if (session !== epoch) throw new Error('session');
      legacy = null;
      pages = result.snapshot.val() || {};
    };
    const commitPage = async (key, transform) => {
      const session = epoch;
      await materializeLegacy();
      if (session !== epoch) throw new Error('session');
      const result = await pagesRef.child(key).transaction(page => {
        if (session !== epoch) return;
        if (!page || typeof page !== 'object') return;
        const next = transform(page);
        return next && { ...next, updatedAt: Date.now() };
      }, undefined, false);
      if (session !== epoch) throw new Error('session');
      if (!result.committed) throw new Error('conflict');
      pages = { ...pages, [key]: result.snapshot.val() };
      return pages[key];
    };
    const saveDraft = key => {
      if (saving.has(key)) return saving.get(key).then(() => drafts[key] && !drafts[key].error ? saveDraft(key) : !drafts[key]);
      const draft = drafts[key];
      if (!draft || draft.error === 'conflict') return Promise.resolve(!draft);
      const session = epoch, version = draft.version;
      const patch = { ...draft.patch }, base = { ...draft.base };
      const job = commitPage(key, page => {
        if (Object.keys(patch).some(field => String(page[field] || '') !== base[field])) return;
        return { ...page, ...patch };
      }).then(saved => {
        if (session !== epoch) return false;
        const pending = drafts[key];
        if (pending && pending.version === version) delete drafts[key];
        else if (pending) Object.keys(patch).forEach(field => { pending.base[field] = String(saved[field] || ''); });
        persist();
        if (Object.hasOwn(patch, 'text')) {
          // Legacy readers keep the latest edited text; opening/moving pages never clears it.
          notesRef.set(saved.text || '').catch(() => {});
        }
        sync('ok');
        return true;
      }).catch(error => {
        if (session !== epoch) return false;
        if (drafts[key]) drafts[key].error = error.message === 'conflict' ? 'conflict' : 'network';
        persist(); sync('error', say('Notes not saved', 'নোট সেভ হয়নি'));
        toast(say('Your draft is kept. Retry or save a separate copy.', 'আপনার ড্রাফট রাখা আছে। আবার চেষ্টা করুন বা আলাদা কপি সেভ করুন।'));
        return false;
      }).finally(() => { if (session === epoch) { saving.delete(key); render(); } });
      saving.set(key, job);
      sync('syncing', say('Saving notes…', 'নোট সেভ হচ্ছে…'));
      renderStatus();
      return job;
    };
    const edit = (field, value) => {
      if (!ready || !current()) return;
      const draft = drafts[active] ||= { base: {}, patch: {}, version: 0 };
      if (!Object.hasOwn(draft.base, field)) draft.base[field] = String(current()[field] || '');
      draft.patch[field] = value; draft.version++;
      if (draft.error === 'network') delete draft.error;
      if (field === 'text' && category === 'cake') renderQuickBoard(current(), draft);
      persist(); renderStatus();
      clearTimeout(timer);
      const key = active;
      timer = setTimeout(() => saveDraft(key), 700);
    };
    const flush = async () => {
      clearTimeout(timer);
      const key = active;
      if (key == null || !await saveDraft(key)) return key == null;
      return flushExpenseDrafts(key);
    };
    const addPage = async (source = null) => {
      if (!ready || (!source && !await flush())) return false;
      const session = epoch, selectedCategory = category;
      const newPage = source || { text: '', photos: [], category: selectedCategory, createdAt: Date.now() };
      let key;
      try {
        await materializeLegacy();
        if (session !== epoch) return false;
        const result = await pagesRef.transaction(raw => {
          if (session !== epoch) return;
          // Allocate on the latest SERVER snapshot, retaining every existing key and field.
          const keys = Object.keys(raw || {}).filter(k => /^\d+$/.test(k)).map(Number);
          key = String(keys.length ? Math.max(...keys) + 1 : 0);
          return { ...(raw || {}), [key]: newPage };
        }, undefined, false);
        if (session !== epoch) return false;
        if (!result.committed) throw new Error('save');
        pages = result.snapshot.val() || {};
        category = categoryOf(newPage); active = key; lastPage[category] = key;
        render(true);
        signalExpensesChanged('page', key);
        toast(say('New page saved', 'নতুন পেজ সেভ হয়েছে'));
        return true;
      } catch (e) { if (session === epoch) toast(say('Page could not be saved. Try again.', 'পেজ সেভ হয়নি। আবার চেষ্টা করুন।')); return false; }
    };
    const switchCategory = async value => {
      if (!VIEWS.includes(value) || !await flush()) return;
      if (isToolView(value)) { activeView = value; render(true); return; }
      if (active != null) lastPage[category] = active;
      activeView = category = value; active = lastPage[category] || null;
      render(true);
    };
    const switchPage = async key => {
      if (!pages[key] || categoryOf(pages[key]) !== category || !await flush()) { render(); return; }
      active = key; lastPage[category] = key; render(true);
    };
    const movePage = async value => {
      if (!current() || !CATEGORIES.includes(value)) return;
      if (!await flush()) { render(); return; }
      const key = active;
      try {
        await commitPage(key, page => ({ ...page, category: value }));
        category = value; active = key; lastPage[value] = key; render(true);
        signalExpensesChanged('page', key);
        toast(say('Page moved — text and photos preserved', 'পেজ সরানো হয়েছে — লেখা ও ছবি অক্ষত আছে'));
      } catch (e) { render(); toast(say('Move failed. Your original page is unchanged.', 'সরানো যায়নি। মূল পেজ অক্ষত আছে।')); }
    };
    const recover = async () => {
      const key = active, draft = drafts[key];
      if (!draft) return;
      const original = pages[key] || {};
      const copy = { ...original, ...draft.patch, category, createdAt: Date.now(), title: (draft.patch.title || original.title || say('Recovered note', 'উদ্ধার করা নোট')) + say(' (copy)', ' (কপি)') };
      if (await addPage(copy)) { delete drafts[key]; persist(); render(true); }
    };
    const retry = async () => {
      const noteDraft = drafts[active];
      if (noteDraft && noteDraft.error !== 'conflict') {
        delete noteDraft.error;
        await saveDraft(active);
      }
      if (active != null) await flushExpenseDrafts(active);
    };
    const renderStatus = () => {
      const draft = drafts[active];
      const expenseDraft = active == null ? null : [...expenseDrafts.values()].find(item => item.pageKey === String(active) && (item.error || Object.keys(item.patch).length));
      const expenseError = expenseDraft?.error;
      el('notepad-status').textContent = !ready ? say('Connecting to notes…', 'নোটে সংযোগ হচ্ছে…')
        : draft?.error || expenseError ? say('Draft kept on this device · not saved to cloud', 'এই ডিভাইসে ড্রাফট রাখা আছে · ক্লাউডে সেভ হয়নি')
          : draft ? say('Saving your draft…', 'ড্রাফট সেভ হচ্ছে…')
            : expenseDraft ? say('Saving expense…', 'খরচ সেভ হচ্ছে…')
              : say('☁️ Shared notes · saved to cloud', '☁️ সবার জন্য নোট · ক্লাউডে সেভ আছে');
      el('notepad-draft-alert').hidden = !(draft?.error || expenseError);
      el('notepad-retry').hidden = draft?.error === 'conflict' && !expenseError;
      el('notepad-draft-message').textContent = expenseError
        ? say('Your expense entry is kept on this device. Reconnect to retry.', 'আপনার খরচের লেখা এই ডিভাইসে রাখা আছে। সংযোগ দিয়ে আবার চেষ্টা করুন।')
        : draft?.error === 'conflict'
        ? say('This page changed on another device. Your draft has not overwritten it. Save your draft as a new page.', 'অন্য ডিভাইসে এই পেজ বদলেছে। আপনার ড্রাফট সেটি মুছে দেয়নি। ড্রাফটটি নতুন পেজে সেভ করুন।')
        : say('Your draft is kept. Reconnect to retry, or save it as a new page.', 'আপনার ড্রাফট রাখা আছে। সংযোগ দিয়ে আবার চেষ্টা করুন বা নতুন পেজে সেভ করুন।');
    };
    const render = (force = false) => {
      reconcileExpenseDrafts(pages);
      const visible = choosePage(), page = current(), draft = drafts[active], tool = isToolView(activeView);
      bindRemoveAllButton();
      const removeAllButton = el('notepad-remove-all-items');
      if (removeAllButton && (!page || category !== 'cake')) removeAllButton.disabled = true;
      document.querySelectorAll('[data-np-en]').forEach(node => { node.textContent = say(node.dataset.npEn, node.dataset.npBn); });
      document.querySelectorAll('[data-np-placeholder-en]').forEach(node => { node.placeholder = say(node.dataset.npPlaceholderEn, node.dataset.npPlaceholderBn); });
      document.querySelectorAll('[data-np-aria-en]').forEach(node => { node.setAttribute('aria-label', say(node.dataset.npAriaEn, node.dataset.npAriaBn)); });
      VIEWS.forEach(key => {
        const tab = el('notepad-tab-' + key), count = entries(pages).filter(([, p]) => categoryOf(p) === key).length;
        const selected = activeView === key;
        tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        const badge = tab.querySelector('.np-tab-count'); if (badge) badge.textContent = CATEGORIES.includes(key) ? count : '';
      });
      const select = el('notepad-page-sel');
      select.replaceChildren();
      visible.forEach(([key, p], i) => {
        const option = document.createElement('option'); option.value = key;
        option.textContent = p.title || `${say('Page', 'পেজ')} ${i + 1}`;
        if (p.photos && Object.keys(p.photos).length) option.textContent += ' 🖼️';
        option.selected = key === active; select.append(option);
      });
      el('notepad-panel').hidden = tool;
      el('notepad-tool-host').hidden = !tool;
      el('notepad-empty').hidden = tool || !!page;
      el('notepad-editor').hidden = tool || !page;
      el('notepad-new-page').disabled = !ready || tool;
      select.disabled = !page || tool;
      el('notepad-panel').setAttribute('aria-labelledby', 'notepad-tab-' + activeView);
      const helper = el('notepad-helper-aside');
      if (helper) {
        (tool ? el('notepad-tool-host') : el('notepad-helper-slot')).appendChild(helper);
        helper.querySelectorAll('details').forEach(detail => {
          detail.hidden = !tool;
          detail.open = tool;
        });
      }
      el('np-cake-board').hidden = tool || category !== 'cake' || !page;
      const editDetails = el('notepad-edit-details');
      if (editDetails) editDetails.open = !tool;
      renderQuickBoard(page, draft);
      el('notepad-category-description').textContent = category === 'cake'
        ? say('Add baking items with a quantity and total price. Use Additional Info for snacks, vegetables and other shop notes.', 'বেকিং আইটেমের নাম, পরিমাণ ও মোট দাম যোগ করুন। স্ন্যাকস, সবজি ও অন্য দোকানের নোট Additional Info-তে লিখুন।')
        : category === 'baking' ? say('Recipes, oven settings and baking methods — each on its own page.', 'রেসিপি, ওভেনের সেটিং ও বেকিং পদ্ধতি — আলাদা আলাদা পেজে।')
        : say('Ideas, supplier details and everything else.', 'আইডিয়া, সরবরাহকারীর তথ্য ও অন্যান্য নোট।');
      if (page) {
        for (const [id, field] of [['notepad-text', 'text'], ['notepad-title', 'title']]) {
          const input = el(id), value = draft && Object.hasOwn(draft.patch, field) ? draft.patch[field] : String(page[field] || '');
          const hasLocalEdit = draft && Object.hasOwn(draft.patch, field);
          if ((force || document.activeElement !== input || !hasLocalEdit) && input.value !== value) input.value = value;
        }
        el('notepad-move').value = categoryOf(page);
        const photos = el('notepad-photos'); photos.replaceChildren();
        Object.entries(page.photos || {}).forEach(([key, src]) => {
          const safe = photoUrl(src); if (!safe) return;
          const wrap = document.createElement('div'); wrap.className = 'np-thumb-wrap';
          const image = document.createElement('img'); image.src = safe; image.alt = say('Note photo', 'নোটের ছবি'); image.className = 'np-thumb'; image.onclick = () => openPhoto(src);
          const button = document.createElement('button'); button.type = 'button'; button.className = 'np-thumb-remove'; button.textContent = '×'; button.setAttribute('aria-label', say('Remove photo', 'ছবি সরান')); button.onclick = () => removePhoto(key);
          wrap.append(image, button); photos.append(wrap);
        });
        renderChecklist();
      }
      el('notepad-shopping').hidden = tool || category !== 'cake';
      el('notepad-recipe-template').hidden = tool || category !== 'baking';
      renderStatus();
    };
    const open = async () => {
      if (!await flush()) return;
      activeView = category = 'cake'; active = lastPage.cake || null;
      render(true); el('notepad-overlay').classList.add('open'); document.body.style.overflow = 'hidden';
    };
    const close = () => { flush(); el('notepad-overlay').classList.remove('open'); document.body.style.overflow = ''; };
    const addPhoto = input => {
      const file = input?.files?.[0], key = active, session = epoch;
      if (!file || !current()) return;
      compressPhoto(file, async src => {
        if (session !== epoch) return;
        try {
          await commitPage(key, page => {
            const photos = Object.values(page.photos || {});
            if (photos.length >= 6) return;
            return { ...page, photos: photos.concat(src) };
          });
          render(); toast(say('Photo added to its original page', 'মূল পেজে ছবি যোগ হয়েছে'));
        } catch (e) { toast(say('Photo not saved (maximum 6 per page). Please retry.', 'ছবি সেভ হয়নি (এক পেজে সর্বোচ্চ ৬টি)। আবার চেষ্টা করুন।')); }
        input.value = '';
      });
    };
    const removePhoto = index => {
      const key = active, src = current()?.photos?.[index];
      if (!src) return;
      confirm(say('Remove this photo?', 'এই ছবি সরাবেন?'), say('Only this photo will be removed.', 'শুধু এই ছবি সরানো হবে।'), false, async ok => {
        if (!ok) return;
        try {
          await commitPage(key, page => {
            if (page.photos?.[index] !== src) return;
            const photos = { ...(page.photos || {}) }; delete photos[index];
            return { ...page, photos };
          }); render();
        } catch (e) { toast(say('Photo changed. Please reopen this page.', 'ছবি বদলেছে। পেজটি আবার খুলুন।')); }
      });
    };
    const normalizeExpensePatch = patch => {
      const normalized = {};
      const amountField = Object.hasOwn(patch, 'amount') ? 'amount' : Object.hasOwn(patch, 'price') ? 'price' : null;
      for (const field of ['amount', 'date']) {
        const sourceField = field === 'amount' ? amountField : field;
        if (!sourceField || (field === 'date' && !Object.hasOwn(patch, 'date'))) continue;
        const raw = String(patch[sourceField] ?? '').trim();
        if (!raw) { normalized[field] = null; continue; }
        const value = field === 'amount' ? normalizeAmount(raw) : normalizeDate(raw);
        if (value == null) throw new Error(field);
        normalized[field] = value;
      }
      return normalized;
    };
    const applyExpensePatch = (item, patch) => {
      const next = { ...item };
      const source = expenseSource(item);
      const compact = Object.hasOwn(item, 'quantity') || Object.hasOwn(item, 'price');
      const expense = { ...(source || {}) };
      Object.entries(patch).forEach(([field, value]) => { expense[field] = value; });
      if (source && Object.hasOwn(source, 'price') && Object.hasOwn(patch, 'amount')) expense.price = patch.amount;
      // Compact rows keep their price at the item level so older consumers can
      // read them without understanding the expense envelope. Keep the
      // envelope too when it already exists (or when a new compact row needs
      // an expense date), retaining receipts and any other unknown fields.
      if (compact && Object.hasOwn(patch, 'amount')) {
        if (patch.amount == null) delete next.price;
        else next.price = patch.amount;
      }
      if (source || !compact || Object.keys(expense).length) next.expense = expense;
      return next;
    };
    const expenseDraftFor = (pageKey, itemKey, item) => {
      const key = expenseDraftKey(pageKey, itemKey);
      let draft = expenseDrafts.get(key);
      if (!draft) {
        const values = expenseValues(item);
        draft = {
          pageKey: String(pageKey), itemKey: String(itemKey),
          values: { amount: values.amount == null ? '' : String(values.amount), date: values.date || '' },
          patch: {}, base: { amount: values.amount == null ? '' : String(values.amount), date: values.date || '' },
          version: 0, timer: null, error: null
        };
        expenseDrafts.set(key, draft);
      }
      return [key, draft];
    };
    const refreshPricedBadge = itemKey => {
      const list = el('notepad-checklist');
      const row = list && [...list.querySelectorAll('.np-check-row')]
        .find(node => node.dataset.itemKey === String(itemKey));
      const badge = row?.querySelector('.np-priced-badge');
      const item = current()?.items?.[itemKey];
      if (!badge || !item) return;
      const draft = expenseDrafts.get(expenseDraftKey(active, itemKey));
      const priced = itemIsPriced(item, draft);
      badge.hidden = !priced;
      badge.textContent = say('✓ Priced', '✓ দাম দেওয়া হয়েছে');
      badge.setAttribute('aria-label', say('Price entered', 'দাম দেওয়া হয়েছে'));
    };
    const saveExpenseDraft = async key => {
      const running = expenseSaving.get(key);
      if (running) return running.then(() => expenseDrafts.has(key) ? saveExpenseDraft(key) : true);
      const draft = expenseDrafts.get(key);
      if (!draft || !Object.keys(draft.patch).length) return true;
      if (draft.timer) { clearTimeout(draft.timer); draft.timer = null; }
      const session = epoch, version = draft.version, rawPatch = { ...draft.patch }, base = draft.base ? { ...draft.base } : null, pageKey = draft.pageKey, itemKey = draft.itemKey;
      let patch;
      try { patch = normalizeExpensePatch(rawPatch); }
      catch (error) {
        draft.error = error.message;
        render();
        return false;
      }
      let appliedPatch = null;
      const job = (async () => {
        try {
          const saved = await commitPage(pageKey, page => {
            const item = page.items?.[itemKey];
            if (!item || typeof item !== 'object') return;
            if (base && Object.keys(rawPatch).some(field => {
              const currentValue = expenseValues(item)[field];
              return String(currentValue == null ? '' : currentValue) !== String(base[field] ?? '');
            })) return;
            const safePatch = { ...patch };
            const existingExpense = expenseValues(item);
            // A price first entered in the notebook belongs to today. An
            // existing purchase date is authoritative and must survive price
            // edits, including edits made from the compact price input.
            if (Object.hasOwn(safePatch, 'amount') && safePatch.amount != null && !Object.hasOwn(rawPatch, 'date') && !existingExpense.date) safePatch.date = today();
            else if (item.checked && !Object.hasOwn(safePatch, 'date') && !existingExpense.date) safePatch.date = today();
            appliedPatch = safePatch;
            return { ...page, items: { ...page.items, [itemKey]: applyExpensePatch(item, safePatch) } };
          });
          if (session !== epoch) return false;
          const pending = expenseDrafts.get(key);
          if (pending && pending.version === version) expenseDrafts.delete(key);
          else if (pending) {
            Object.entries(rawPatch).forEach(([field, value]) => { if (pending.patch[field] === value) delete pending.patch[field]; });
            if (pending.base && saved?.items?.[itemKey]) {
              const savedExpense = expenseValues(saved.items[itemKey]);
              Object.keys(appliedPatch || rawPatch).forEach(field => { pending.base[field] = String(savedExpense[field] == null ? '' : savedExpense[field]); });
            }
            pending.error = null;
            if (!Object.keys(pending.patch).length) expenseDrafts.delete(key);
          }
          persistExpenseDrafts();
          render();
          signalExpensesChanged('expense', pageKey, itemKey);
          sync('ok');
          return true;
        } catch (error) {
          if (session !== epoch) return false;
          const pending = expenseDrafts.get(key);
          if (pending) pending.error = error.message === 'conflict' ? 'conflict' : 'network';
          persistExpenseDrafts();
          sync('error', say('Expense not saved', 'খরচ সেভ হয়নি'));
          toast(say('Expense not saved. Your entry is kept; please retry.', 'খরচ সেভ হয়নি। আপনার লেখা রাখা আছে; আবার চেষ্টা করুন।'));
          render();
          return false;
        }
      })().finally(() => { if (expenseSaving.get(key) === job) expenseSaving.delete(key); });
      expenseSaving.set(key, job);
      sync('syncing', say('Saving expense…', 'খরচ সেভ হচ্ছে…'));
      return job;
    };
    const flushExpenseDrafts = async pageKey => {
      const keys = [...expenseDrafts.entries()].filter(([, draft]) => draft.pageKey === String(pageKey)).map(([key]) => key);
      let result = true;
      for (const key of keys) {
        const draft = expenseDrafts.get(key);
        if (draft?.timer) { clearTimeout(draft.timer); draft.timer = null; }
        let attempts = 0;
        while (expenseDrafts.has(key) && attempts++ < 5) {
          if (!await saveExpenseDraft(key)) { result = false; break; }
        }
        if (expenseDrafts.has(key)) result = false;
      }
      return result;
    };
    const queueExpenseSave = (itemKey, field, value, input = null, reportValidity = false) => {
      const pageKey = active, item = current()?.items?.[itemKey];
      if (pageKey == null || !item) return false;
      const raw = String(value ?? '').trim();
      const valid = !raw || (field === 'amount' ? normalizeAmount(raw) != null : normalizeDate(raw) != null);
      if (input) {
        input.setCustomValidity(valid ? '' : field === 'amount'
          ? say('Enter a non-negative amount.', 'শূন্য বা তার বেশি টাকার পরিমাণ দিন।')
          : say('Enter a valid expense date.', 'সঠিক খরচের তারিখ দিন।'));
        input.setAttribute('aria-invalid', String(!valid));
        if (!valid && reportValidity && input.reportValidity) input.reportValidity();
      }
      const [key, draft] = expenseDraftFor(pageKey, itemKey, item);
      if (draft.error === 'conflict' && draft.base) {
        const currentValue = expenseValues(item)[field];
        draft.base[field] = currentValue == null ? '' : String(currentValue);
      }
      const changed = !Object.hasOwn(draft.patch, field) || draft.patch[field] !== raw;
      draft.values[field] = raw;
      draft.patch[field] = raw;
      draft.error = null;
      if (changed) {
        draft.version++;
        if (draft.timer) clearTimeout(draft.timer);
        draft.timer = setTimeout(() => saveExpenseDraft(key), 700);
      }
      persistExpenseDrafts();
      renderStatus();
      refreshPricedBadge(itemKey);
      return valid;
    };
    const setItemExpense = async (itemKey, patch = {}) => {
      if (active == null || !current()?.items?.[itemKey] || !patch || typeof patch !== 'object') return false;
      try { normalizeExpensePatch(patch); } catch (e) { return false; }
      const expensePatch = { ...patch };
      if (!Object.hasOwn(expensePatch, 'amount') && Object.hasOwn(expensePatch, 'price')) expensePatch.amount = expensePatch.price;
      for (const field of ['amount', 'date']) {
        if (Object.hasOwn(expensePatch, field) && !queueExpenseSave(itemKey, field, expensePatch[field])) return false;
      }
      return flushExpenseDrafts(active);
    };
    const renderChecklist = () => {
      const pageKey = active, items = entries(current()?.items), list = el('notepad-checklist');
      const focused = document.activeElement && list.contains(document.activeElement) ? {
        itemKey: document.activeElement.dataset.itemKey,
        field: document.activeElement.dataset.expenseField || 'checked',
        start: document.activeElement.selectionStart,
        end: document.activeElement.selectionEnd
      } : null;
      list.replaceChildren();
      const done = items.filter(([, item]) => item.checked).length;
      el('notepad-check-progress').textContent = `${done}/${items.length} ${say('bought', 'কেনা হয়েছে')} · ${items.length}/30`;
      const addButton = document.querySelector('.np-add-item button');
      if (addButton) {
        addButton.disabled = items.length >= MAX_ITEMS_PER_PAGE;
        addButton.title = addButton.disabled
          ? say('Maximum 30 items reached', 'সর্বোচ্চ ৩০টি আইটেম যোগ হয়েছে')
          : say('Add baking item', 'বেকিং আইটেম যোগ করুন');
      }
      const removeAllButton = el('notepad-remove-all-items');
      if (removeAllButton) removeAllButton.disabled = category !== 'cake' || !items.length || !!removeAllJob;
      items.forEach(([key, item]) => {
        const row = document.createElement('div'); row.className = 'np-check-row' + (item.checked ? ' checked' : '');
        row.dataset.itemKey = String(key);
        const main = document.createElement('label'); main.className = 'np-check-main';
        const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !!item.checked;
        check.dataset.itemKey = String(key);
        const name = String(item.name || '');
        check.setAttribute('aria-label', say(`Mark ${name} as bought`, `${name} কেনা হয়েছে চিহ্নিত করুন`));
        check.onchange = () => toggleItem(key, check.checked);
        const text = document.createElement('span'); text.className = 'np-check-copy'; text.textContent = name;
        const quantity = itemQuantityOf(item);
        if (quantity) { const detail = document.createElement('span'); detail.textContent = ' · ' + quantity; text.append(detail); }
        main.append(check, text);

        const draft = expenseDrafts.get(expenseDraftKey(pageKey, key));
        const storedExpense = expenseValues(item);
        const fields = document.createElement('div'); fields.className = 'np-expense-fields';
        const amountLabel = document.createElement('label'); amountLabel.className = 'np-expense-field';
        const amountText = document.createElement('span'); amountText.className = 'np-expense-label'; amountText.textContent = say('Price', 'দাম');
        const amountWrap = document.createElement('span'); amountWrap.className = 'np-expense-control';
        const currency = document.createElement('span'); currency.className = 'np-expense-currency'; currency.textContent = '৳';
        const amount = document.createElement('input'); amount.type = 'number'; amount.min = '0'; amount.step = '0.01'; amount.inputMode = 'decimal'; amount.className = 'np-expense-amount';
        amount.value = draft && Object.hasOwn(draft.patch, 'amount') ? draft.values.amount : (storedExpense.amount == null ? '' : String(storedExpense.amount));
        amount.setAttribute('aria-label', say(`Price for ${name}`, `${name}-এর দাম`)); amount.dataset.itemKey = String(key); amount.dataset.expenseField = 'amount';
        amount.oninput = () => queueExpenseSave(key, 'amount', amount.value, amount);
        amount.onchange = () => queueExpenseSave(key, 'amount', amount.value, amount, true);
        amountWrap.append(currency, amount); amountLabel.append(amountText, amountWrap);

        const dateLabel = document.createElement('label'); dateLabel.className = 'np-expense-field np-expense-date-field'; dateLabel.hidden = true;
        const dateText = document.createElement('span'); dateText.className = 'np-expense-label'; dateText.textContent = say('Expense date', 'খরচের তারিখ');
        const date = document.createElement('input'); date.type = 'date'; date.className = 'np-expense-date';
        date.value = draft && Object.hasOwn(draft.patch, 'date') ? draft.values.date : (storedExpense.date || '');
        date.setAttribute('aria-label', say(`Expense date for ${name}`, `${name}-এর খরচের তারিখ`)); date.dataset.itemKey = String(key); date.dataset.expenseField = 'date';
        date.oninput = () => queueExpenseSave(key, 'date', date.value, date);
        date.onchange = () => queueExpenseSave(key, 'date', date.value, date, true);
        dateLabel.append(dateText, date);
        fields.append(amountLabel, dateLabel);

        const actions = document.createElement('div'); actions.className = 'np-item-actions';
        const badge = document.createElement('span'); badge.className = 'np-priced-badge';
        badge.hidden = !itemIsPriced(item, draft);
        badge.textContent = say('✓ Priced', '✓ দাম দেওয়া হয়েছে');
        badge.setAttribute('aria-label', say('Price entered', 'দাম দেওয়া হয়েছে'));
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'np-item-remove';
        remove.textContent = '×'; remove.dataset.itemKey = String(key);
        remove.setAttribute('aria-label', say(`Remove ${name}`, `${name} সরান`));
        remove.onclick = event => { event?.preventDefault?.(); event?.stopPropagation?.(); void removeItem(key); };
        const itemMain = document.createElement('div'); itemMain.className = 'np-item-main';
        itemMain.append(main, badge);
        actions.append(remove);
        row.append(itemMain, fields, actions); list.append(row);
      });
      if (focused?.itemKey != null) {
        const target = [...list.querySelectorAll('input[data-item-key]')].find(input =>
          input.dataset.itemKey === focused.itemKey && (input.dataset.expenseField || 'checked') === focused.field);
        if (target) {
          target.focus();
          if (focused.start != null && target.setSelectionRange) {
            try { target.setSelectionRange(focused.start, focused.end); } catch (e) {}
          }
        }
      }
    };
    const renderQuickBoard = (page, draft) => {
      const board = el('np-cake-board'); if (!board) return;
      board.replaceChildren();
      if (!page) return;
      const text = draft && Object.hasOwn(draft.patch, 'text') ? draft.patch.text : String(page.text || '');
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const items = entries(page.items).map(([, item]) => `${item.checked ? '✓ ' : '○ '}${item.name}${itemQuantityOf(item) ? ' · ' + itemQuantityOf(item) : ''}`);
      [...lines, ...items].forEach((line, index) => {
        const node = document.createElement('div'); node.className = 'np-board-line' + (line.startsWith('✓') ? ' done' : '');
        node.textContent = line; node.title = line; node.dataset.index = String(index); board.append(node);
      });
      if (!board.children.length) { const empty = document.createElement('div'); empty.className = 'np-board-empty'; empty.textContent = say('No shopping items yet — use Edit full note below.', 'এখনো কেনাকাটার আইটেম নেই — নিচে পূর্ণ নোট এডিট করুন।'); board.append(empty); }
    };
    const clearAddEntry = controls => {
      Object.values(controls || {}).forEach(input => {
        if (!input) return;
        input.value = '';
        input.setCustomValidity?.('');
        input.removeAttribute('aria-invalid');
      });
    };
    const addItem = async (values = null, quantityArg, priceArg, additionalArg) => {
      if (addingItem) return addingItem;
      const controls = addEntryControls();
      const supplied = values && typeof values === 'object' ? values : {};
      const positionalName = typeof values === 'string' ? values : null;
      const name = String(supplied.name ?? positionalName ?? controls.name?.value ?? '').trim();
      const quantityValue = supplied.quantity ?? supplied.detail ?? quantityArg
        ?? controls.quantity?.value ?? '';
      const quantity = String(quantityValue ?? '').trim();
      const priceValue = supplied.price ?? supplied.amount ?? priceArg ?? controls.price?.value ?? '';
      const priceRaw = String(priceValue ?? '').trim();
      const additionalValue = supplied.additional ?? supplied.additionalInfo ?? supplied.info ?? additionalArg ?? controls.additional?.value ?? '';
      const additional = String(additionalValue ?? '').trim();
      if (!name || !current()) return false;
      let price = null;
      if (priceRaw) {
        price = normalizeAmount(priceRaw);
        if (price == null) {
          if (controls.price) {
            controls.price.setCustomValidity(say('Enter a non-negative price.', 'শূন্য বা তার বেশি দাম দিন।'));
            controls.price.setAttribute('aria-invalid', 'true');
            if (controls.price.reportValidity) controls.price.reportValidity();
          }
          return false;
        }
      }
      const key = active, id = pagesRef.push().key;
      let limitReached = false;
      const job = (async () => {
        try {
          // Additional information belongs to the page note, so settle an
          // in-flight text draft before appending to that same text value.
          if (additional && !await flush()) return false;
          const saved = await commitPage(key, page => {
            const existingItems = entries(page.items);
            // This check deliberately runs in the Firebase page transaction;
            // two admins cannot race the page past the 30-object limit.
            if (existingItems.length >= MAX_ITEMS_PER_PAGE) {
              limitReached = true;
              return;
            }
            const item = { name, quantity, checked: false, createdAt: Date.now() };
            if (price != null) {
              item.price = price;
              item.expense = { amount: price, date: today() };
            }
            const next = { ...page, items: { ...(page.items || {}), [id]: item } };
            if (additional) next.text = appendPageText(page.text, additional);
            return next;
          });
          if (additional) notesRef.set(saved.text || '').catch(() => {});
          clearAddEntry(controls);
          render();
          signalExpensesChanged('item', key, id);
          return true;
        } catch (e) {
          if (limitReached) toast(say('A page can contain at most 30 shopping items.', 'একটি পেজে সর্বোচ্চ ৩০টি কেনাকাটার আইটেম রাখা যায়।'));
          else toast(say('Item not saved. Please retry.', 'আইটেম সেভ হয়নি। আবার চেষ্টা করুন।'));
          return false;
        }
      })().finally(() => { if (addingItem === job) addingItem = null; });
      addingItem = job;
      return job;
    };
    const updateItem = async (itemKey, values = {}, quantityArg) => {
      if (typeof values === 'string') values = { name: values, quantity: quantityArg };
      if (!values || typeof values !== 'object' || active == null || !current()?.items?.[itemKey]) return false;
      const patch = values;
      const hasName = Object.hasOwn(patch, 'name');
      const hasQuantity = Object.hasOwn(patch, 'quantity') || Object.hasOwn(patch, 'detail');
      const hasPrice = Object.hasOwn(patch, 'price') || Object.hasOwn(patch, 'amount');
      const additional = String(patch.additional ?? patch.additionalInfo ?? patch.info ?? '').trim();
      const nextName = hasName ? String(patch.name ?? '').trim() : null;
      const nextQuantity = hasQuantity ? String(patch.quantity ?? patch.detail ?? '').trim() : null;
      if (hasName && !nextName) return false;
      let price = null;
      if (hasPrice) {
        const rawPrice = String(patch.price ?? patch.amount ?? '').trim();
        if (rawPrice) {
          price = normalizeAmount(rawPrice);
          if (price == null) return false;
        }
      }
      const pageKey = active;
      let changed = false;
      let saved = null;
      try {
        if (additional && !await flush()) return false;
        saved = await commitPage(pageKey, page => {
          const item = page.items?.[itemKey];
          if (!item || typeof item !== 'object') return;
          const nextItem = { ...item };
          if (hasName) { nextItem.name = nextName; changed = true; }
          if (hasQuantity) { nextItem.quantity = nextQuantity; changed = true; }
          if (hasPrice) {
            const existingExpense = expenseValues(item);
            const expensePatch = { amount: price };
            if (price != null && !existingExpense.date) expensePatch.date = today();
            const pricedItem = applyExpensePatch(nextItem, expensePatch);
            Object.assign(nextItem, pricedItem);
            if (!Object.hasOwn(pricedItem, 'price')) delete nextItem.price;
            changed = true;
          }
          const next = { ...page, items: { ...page.items, [itemKey]: nextItem } };
          if (additional) { next.text = appendPageText(page.text, additional); changed = true; }
          return next;
        });
        if (changed) {
          if (additional) notesRef.set(saved?.text || '').catch(() => {});
          render();
          if (hasPrice) signalExpensesChanged('expense', pageKey, itemKey);
        }
        return changed;
      } catch (e) {
        toast(say('Item not saved. Please retry.', 'আইটেম সেভ হয়নি। আবার চেষ্টা করুন।'));
        return false;
      }
    };
    const removeItem = async itemKey => {
      const pageKey = active, item = current()?.items?.[itemKey], session = epoch;
      if (pageKey == null || !item || typeof item !== 'object') return false;
      const name = String(item.name || say('this item', 'এই আইটেমটি'));
      if (!await askConfirm(
        say('Remove this baking item?', 'এই বেকিং আইটেমটি সরাবেন?'),
        say(`Only “${name}” will be removed.`, `শুধু “${name}” সরানো হবে।`),
        false
      )) return false;
      try {
        await settleExpenseDrafts(pageKey, itemKey);
        await commitPage(pageKey, page => {
          const existing = page.items?.[itemKey];
          if (!existing || typeof existing !== 'object') return;
          const items = { ...(page.items || {}) };
          delete items[itemKey];
          return { ...page, items };
        });
        forgetExpenseDrafts(pageKey, itemKey);
        render();
        signalExpensesChanged('item-removed', pageKey, itemKey);
        sync('ok');
        return true;
      } catch (e) {
        if (session !== epoch) return false;
        render();
        sync('error', say('Item not removed', 'আইটেম সরানো যায়নি'));
        toast(say('Item not removed. Please retry.', 'আইটেম সরানো হয়নি। আবার চেষ্টা করুন।'));
        return false;
      }
    };
    const removeAllItems = async () => {
      if (removeAllJob) return removeAllJob;
      const pageKey = active, items = entries(current()?.items), session = epoch;
      if (pageKey == null || !items.length) return false;
      const job = (async () => {
        if (!await askConfirm(
          say('Remove all baking items?', 'সব বেকিং আইটেম সরাবেন?'),
          say('Every baking-item row on this page will be removed.', 'এই পেজের সব বেকিং আইটেমের সারি সরানো হবে।'),
          false
        )) return false;
        try {
          await settleExpenseDrafts(pageKey);
          await commitPage(pageKey, page => {
            if (!entries(page.items).length) return;
            return { ...page, items: {} };
          });
          forgetExpenseDrafts(pageKey);
          render();
          signalExpensesChanged('items-removed', pageKey);
          sync('ok');
          return true;
        } catch (e) {
          if (session !== epoch) return false;
          render();
          sync('error', say('Items not removed', 'আইটেমগুলো সরানো যায়নি'));
          toast(say('Items not removed. Please retry.', 'আইটেমগুলো সরানো হয়নি। আবার চেষ্টা করুন।'));
          return false;
        }
      })().finally(() => {
        if (removeAllJob === job) removeAllJob = null;
        if (session === epoch) render();
      });
      removeAllJob = job;
      render();
      return job;
    };
    const bindRemoveAllButton = () => {
      const button = el('notepad-remove-all-items');
      if (!button || button.dataset.npRemoveAllBound === '1') return;
      button.dataset.npRemoveAllBound = '1';
      button.onclick = event => {
        event?.preventDefault?.();
        if (!button.disabled) void removeAllItems();
      };
    };
    const toggleItem = async (id, checked) => {
      const key = active;
      try {
        await commitPage(key, page => {
          const item = page.items?.[id];
          if (!item) return;
          const nextItem = { ...item, checked };
          if (checked && !expenseValues(item).date) {
            const expense = { ...(expenseSource(item) || {}), date: today() };
            nextItem.expense = expense;
          }
          return { ...page, items: { ...page.items, [id]: nextItem } };
        });
        render(); signalExpensesChanged('checked', key, id);
      } catch (e) { render(); toast(say('Checklist not saved. Please retry.', 'তালিকা সেভ হয়নি। আবার চেষ্টা করুন।')); }
    };
    const append = text => {
      if (!current()) { toast(say('Create a page first', 'আগে একটি পেজ তৈরি করুন')); return; }
      const textarea = el('notepad-text');
      textarea.value = textarea.value + (textarea.value.trim() ? '\n\n' : '') + text;
      edit('text', textarea.value);
    };
    const calculateUi = () => {
      try { el('np-calc-result').textContent = formatNumber(calculate(el('np-calc-input').value)); }
      catch (e) { el('np-calc-result').textContent = e.message === 'zero' ? say('Cannot divide by zero', 'শূন্য দিয়ে ভাগ করা যায় না') : say('Enter a valid calculation', 'সঠিক হিসাব লিখুন'); }
    };
    const calculatorKey = key => {
      const input = el('np-calc-input');
      input.value = key === 'clear' ? '' : key === 'back' ? input.value.slice(0, -1) : input.value + key;
      calculateUi();
    };
    const insertCalculation = () => {
      try { append(`${el('np-calc-input').value} = ${formatNumber(calculate(el('np-calc-input').value))}`); }
      catch (e) { calculateUi(); }
    };
    const template = () => append(say('Recipe:\nYield / cake size:\nIngredients:\nOven temperature:\nBaking time:\nMethod:\nCooling / decorating:', 'রেসিপি:\nপরিমাণ / কেকের আকার:\nউপকরণ:\nওভেনের তাপমাত্রা:\nবেকিং সময়:\nপদ্ধতি:\nঠান্ডা করা / সাজানো:'));
    const exportAll = () => {
      const content = JSON.stringify({ exportedAt: new Date().toISOString(), pages, drafts, legacyText: legacy?.text || null }, null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `bakery-notes-${new Date().toISOString().slice(0, 10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    el('notepad-text').addEventListener('input', event => edit('text', event.target.value));
    el('notepad-title').addEventListener('input', event => edit('title', event.target.value));
    el('np-calc-input').addEventListener('input', calculateUi);
    el('np-calc-input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); calculateUi(); } });
    const addControls = addEntryControls();
    [addControls.name, addControls.quantity, addControls.price, addControls.additional].forEach(input => {
      if (!input || input.dataset.npAddBound === '1') return;
      input.dataset.npAddBound = '1';
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addItem();
      });
    });
    VIEWS.forEach((key, index) => el('notepad-tab-' + key).addEventListener('keydown', async event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % VIEWS.length;
      else if (event.key === 'ArrowLeft') next = (index + VIEWS.length - 1) % VIEWS.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = VIEWS.length - 1;
      else return;
      event.preventDefault();
      await switchCategory(VIEWS[next]);
      el('notepad-tab-' + VIEWS[next]).focus();
    }));
    render();
    return {
      activate, reset, receive, render, open, close, addPage, switchCategory, switchPage, movePage,
      addPhoto, removePhoto, addItem, removeItem, removeAllItems, updateItem, updateItemNameQuantity: updateItem,
      updateItemDetails: updateItem, updateItemFields: updateItem, editItem: updateItem,
      toggleItem, setItemExpense, setItemPrice: (itemKey, price) => setItemExpense(itemKey, { amount: price }),
      getExpenses, getExpenseItems: getExpenses, expenseChangeEvent: EXPENSE_CHANGE_EVENT,
      calculatorKey, calculateUi, insertCalculation, template, exportAll, recover, retry, flush
    };
  };
  return { create, calculate, categoryOf, entries, expenseChangeEvent: EXPENSE_CHANGE_EVENT };
})();
