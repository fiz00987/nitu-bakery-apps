/* Categorized bakery notes. Existing numeric page keys and page contents stay intact. */
'use strict';
window.NituNotepad = (() => {
  const CATEGORIES = ['cake', 'baking', 'other'];
  const categoryOf = page => CATEGORIES.includes(page && page.category) ? page.category : 'cake';
  const entries = raw => Object.entries(raw || {}).filter(([, page]) => page && typeof page === 'object')
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  const digits = value => String(value).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const formatNumber = value => String(Number(value.toPrecision(12)));

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
  const scale = (quantity, original, target) => {
    const values = [quantity, original, target].map(v => String(v).trim());
    if (values.some(v => !v || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(digits(v)))) throw new Error('scale');
    const [q, from, to] = values.map(v => Number(digits(v)));
    const result = q * to / from;
    if (q < 0 || from <= 0 || to <= 0 || !Number.isFinite(result)) throw new Error('scale');
    return Number(formatNumber(result));
  };

  const create = ({ pagesRef, notesRef, toast, sync, confirm, language, photoUrl, compressPhoto, openPhoto }) => {
    const el = id => document.getElementById(id);
    const say = (en, bn) => language() === 'bn' ? bn : en;
    let pages = {}, legacy = null, ready = false, active = null, category = 'cake';
    let drafts = {}, user = '', epoch = 0, loadSequence = 0, timer = null;
    const saving = new Map();
    const lastPage = {};
    const current = () => active == null ? null : pages[active];
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
      epoch++; loadSequence++;
      clearTimeout(timer);
      pages = {}; legacy = null; ready = false; active = null; category = 'cake';
      drafts = {}; user = ''; saving.clear();
      Object.keys(lastPage).forEach(key => delete lastPage[key]);
      el('notepad-overlay').classList.remove('open');
      document.body.style.overflow = '';
      render();
    };
    const activate = uid => {
      if (user === uid) return;
      reset(); user = uid;
      try { drafts = JSON.parse(localStorage.getItem(scopedDraftKey()) || '{}') || {}; } catch (e) { drafts = {}; }
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
      ready = true;
      render();
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
      persist(); renderStatus();
      clearTimeout(timer);
      const key = active;
      timer = setTimeout(() => saveDraft(key), 700);
    };
    const flush = async () => {
      clearTimeout(timer);
      return active == null || await saveDraft(active);
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
        toast(say('New page saved', 'নতুন পেজ সেভ হয়েছে'));
        return true;
      } catch (e) { if (session === epoch) toast(say('Page could not be saved. Try again.', 'পেজ সেভ হয়নি। আবার চেষ্টা করুন।')); return false; }
    };
    const switchCategory = async value => {
      if (!CATEGORIES.includes(value) || !await flush()) return;
      if (active != null) lastPage[category] = active;
      category = value; active = lastPage[category] || null;
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
      if (!drafts[active] || drafts[active].error === 'conflict') return;
      delete drafts[active].error;
      await saveDraft(active);
    };
    const renderStatus = () => {
      const draft = drafts[active];
      el('notepad-status').textContent = !ready ? say('Connecting to notes…', 'নোটে সংযোগ হচ্ছে…')
        : draft ? draft.error ? say('Draft kept on this device · not saved to cloud', 'এই ডিভাইসে ড্রাফট রাখা আছে · ক্লাউডে সেভ হয়নি') : say('Saving your draft…', 'ড্রাফট সেভ হচ্ছে…')
        : say('☁️ Shared notes · saved to cloud', '☁️ সবার জন্য নোট · ক্লাউডে সেভ আছে');
      el('notepad-draft-alert').hidden = !draft?.error;
      el('notepad-retry').hidden = draft?.error === 'conflict';
      el('notepad-draft-message').textContent = draft?.error === 'conflict'
        ? say('This page changed on another device. Your draft has not overwritten it. Save your draft as a new page.', 'অন্য ডিভাইসে এই পেজ বদলেছে। আপনার ড্রাফট সেটি মুছে দেয়নি। ড্রাফটটি নতুন পেজে সেভ করুন।')
        : say('Your draft is kept. Reconnect to retry, or save it as a new page.', 'আপনার ড্রাফট রাখা আছে। সংযোগ দিয়ে আবার চেষ্টা করুন বা নতুন পেজে সেভ করুন।');
    };
    const render = (force = false) => {
      const visible = choosePage(), page = current(), draft = drafts[active];
      document.querySelectorAll('[data-np-en]').forEach(node => { node.textContent = say(node.dataset.npEn, node.dataset.npBn); });
      document.querySelectorAll('[data-np-placeholder-en]').forEach(node => { node.placeholder = say(node.dataset.npPlaceholderEn, node.dataset.npPlaceholderBn); });
      CATEGORIES.forEach(key => {
        const tab = el('notepad-tab-' + key), count = entries(pages).filter(([, p]) => categoryOf(p) === key).length;
        tab.classList.toggle('active', category === key); tab.setAttribute('aria-selected', String(category === key));
        tab.tabIndex = category === key ? 0 : -1;
        tab.querySelector('.np-tab-count').textContent = count;
      });
      const select = el('notepad-page-sel');
      select.replaceChildren();
      visible.forEach(([key, p], i) => {
        const option = document.createElement('option'); option.value = key;
        option.textContent = p.title || `${say('Page', 'পেজ')} ${i + 1}`;
        if (p.photos && Object.keys(p.photos).length) option.textContent += ' 🖼️';
        option.selected = key === active; select.append(option);
      });
      el('notepad-empty').hidden = !!page;
      el('notepad-editor').hidden = !page;
      el('notepad-new-page').disabled = !ready;
      select.disabled = !page;
      el('notepad-panel').setAttribute('aria-labelledby', 'notepad-tab-' + category);
      el('notepad-category-description').textContent = category === 'cake'
        ? say('Shopping comes first. Keep ingredients, packaging and things to buy here.', 'সবার আগে কেনাকাটা। উপকরণ, প্যাকেজিং ও কেনার তালিকা এখানে রাখুন।')
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
      el('notepad-shopping').hidden = category !== 'cake';
      el('notepad-recipe-template').hidden = category !== 'baking';
      renderStatus();
    };
    const open = async () => {
      if (!await flush()) return;
      category = 'cake'; active = lastPage.cake || null;
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
    const renderChecklist = () => {
      const items = entries(current()?.items), list = el('notepad-checklist'); list.replaceChildren();
      const done = items.filter(([, item]) => item.checked).length;
      el('notepad-check-progress').textContent = `${done}/${items.length} ${say('bought', 'কেনা হয়েছে')}`;
      items.forEach(([key, item]) => {
        const row = document.createElement('label'); row.className = 'np-check-row' + (item.checked ? ' checked' : '');
        const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !!item.checked;
        check.onchange = () => toggleItem(key, check.checked);
        const text = document.createElement('span'); text.textContent = item.name + (item.detail ? ' · ' + item.detail : '');
        row.append(check, text); list.append(row);
      });
    };
    const addItem = async () => {
      const name = el('notepad-item-name').value.trim(), detail = el('notepad-item-detail').value.trim(), key = active;
      if (!name || !current()) return;
      const id = pagesRef.push().key;
      try {
        await commitPage(key, page => ({ ...page, items: { ...(page.items || {}), [id]: { name, detail, checked: false, createdAt: Date.now() } } }));
        el('notepad-item-name').value = ''; el('notepad-item-detail').value = ''; render();
      } catch (e) { toast(say('Item not saved. Please retry.', 'আইটেম সেভ হয়নি। আবার চেষ্টা করুন।')); }
    };
    const toggleItem = async (id, checked) => {
      const key = active;
      try {
        await commitPage(key, page => {
          if (!page.items?.[id]) return;
          return { ...page, items: { ...page.items, [id]: { ...page.items[id], checked } } };
        }); render();
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
    const scaleUi = () => {
      try {
        const amount = scale(el('np-scale-quantity').value, el('np-scale-from').value, el('np-scale-to').value);
        const text = `${el('np-scale-name').value.trim() || say('Ingredient', 'উপকরণ')}: ${formatNumber(amount)} ${el('np-scale-unit').value}`;
        el('np-scale-result').textContent = text;
        return text + ` (${el('np-scale-quantity').value} × ${el('np-scale-to').value} ÷ ${el('np-scale-from').value})`;
      } catch (e) { el('np-scale-result').textContent = say('Enter quantity and positive original/target sizes.', 'পরিমাণ ও শূন্যের বেশি মূল/নতুন রেসিপির আকার দিন।'); return null; }
    };
    const insertScale = () => { const text = scaleUi(); if (text) append(text); };
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
    CATEGORIES.forEach((key, index) => el('notepad-tab-' + key).addEventListener('keydown', async event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % CATEGORIES.length;
      else if (event.key === 'ArrowLeft') next = (index + CATEGORIES.length - 1) % CATEGORIES.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = CATEGORIES.length - 1;
      else return;
      event.preventDefault();
      await switchCategory(CATEGORIES[next]);
      el('notepad-tab-' + category).focus();
    }));
    render();
    return { activate, reset, receive, render, open, close, addPage, switchCategory, switchPage, movePage, addPhoto, removePhoto, addItem, toggleItem, calculatorKey, calculateUi, insertCalculation, scaleUi, insertScale, template, exportAll, recover, retry, flush };
  };
  return { create, calculate, scale, categoryOf, entries };
})();
