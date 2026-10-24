/* The original simple bakery shopping notepad, kept beside the advanced workspace. */
'use strict';

window.NituNotebookModes = (() => {
  const show = mode => {
    const selected = mode === 'advanced' ? 'advanced' : 'basic';
    const basic = document.getElementById('notepad-basic-view');
    const advanced = document.getElementById('notepad-advanced-view');
    const basicTab = document.getElementById('notepad-mode-basic');
    const advancedTab = document.getElementById('notepad-mode-advanced');
    if (basic) basic.hidden = selected !== 'basic';
    if (advanced) advanced.hidden = selected !== 'advanced';
    if (basicTab) {
      basicTab.classList.toggle('active', selected === 'basic');
      basicTab.setAttribute('aria-selected', String(selected === 'basic'));
      basicTab.tabIndex = selected === 'basic' ? 0 : -1;
    }
    if (advancedTab) {
      advancedTab.classList.toggle('active', selected === 'advanced');
      advancedTab.setAttribute('aria-selected', String(selected === 'advanced'));
      advancedTab.tabIndex = selected === 'advanced' ? 0 : -1;
    }
    return selected;
  };
  return { show };
})();

window.NituBasicNotepad = (() => {
  const entries = raw => Object.entries(raw || {})
    .filter(([, page]) => page && typeof page === 'object')
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));

  const photoEntries = page => Object.entries(page?.photos || {})
    .filter(([, src]) => typeof src === 'string' && src);

  const create = ({ pagesRef, notesRef, toast, sync, confirm, language, photoUrl, compressPhoto, openPhoto }) => {
    const el = id => document.getElementById(id);
    const say = (en, bn) => language() === 'bn' ? bn : en;
    const askConfirm = (title, message) => new Promise(resolve => {
      let settled = false;
      const done = result => {
        if (settled) return;
        settled = true;
        resolve(!!result);
      };
      try {
        if (typeof confirm !== 'function') done(false);
        else confirm(title, message, false, done);
      } catch (e) { done(false); }
    });

    let pages = {};
    let legacy = null;
    let ready = false;
    let active = null;
    let user = '';
    let epoch = 0;
    let loadSequence = 0;
    let timer = null;
    let draft = null;
    let saving = null;

    const pageList = () => entries(pages);
    const current = () => active == null ? null : pages[active];
    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const pageIndex = key => pageList().findIndex(([entryKey]) => String(entryKey) === String(key));

    const renderStatus = () => {
      const status = el('notepad-basic-status');
      if (!status) return;
      const position = pageIndex(active);
      status.textContent = !ready
        ? say('Connecting to notes…', 'নোটে সংযোগ হচ্ছে…')
        : saving || draft?.error
          ? say('Saving the simple notebook…', 'বেসিক নোটবুক সেভ হচ্ছে…')
          : say(`☁️ Live sync · page ${position < 0 ? 0 : position + 1}/${pageList().length}`, `☁️ লাইভ সিঙ্ক · পেজ ${position < 0 ? 0 : position + 1}/${pageList().length}`);
    };

    const render = (force = false) => {
      const list = pageList();
      if (!list.some(([key]) => String(key) === String(active))) active = list[0]?.[0] ?? null;
      const page = current();
      const select = el('notepad-basic-page-sel');
      if (select) {
        select.replaceChildren();
        list.forEach(([key, value], index) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = `📄 ${say('Page', 'পেজ')} ${index + 1}${photoEntries(value).length ? ' 🖼️' : ''}`;
          option.selected = String(key) === String(active);
          select.append(option);
        });
        select.disabled = !page;
      }

      const empty = el('notepad-basic-empty');
      if (empty) empty.hidden = !!page;
      const text = el('notepad-basic-text');
      if (text) {
        text.disabled = !page;
        const value = draft && String(draft.key) === String(active)
          ? draft.text
          : String(page?.text || '');
        if (force || document.activeElement !== text || !draft || String(draft.key) !== String(active)) {
          if (text.value !== value) text.value = value;
        }
      }

      const photoInput = el('notepad-basic-add-photo');
      if (photoInput) photoInput.disabled = !page;
      const clear = el('notepad-basic-clear');
      if (clear) clear.disabled = !page;
      const photos = el('notepad-basic-photos');
      if (photos) {
        photos.replaceChildren();
        photoEntries(page).forEach(([key, src]) => {
          const safe = photoUrl(src);
          if (!safe) return;
          const wrap = document.createElement('div');
          wrap.className = 'np-basic-photo-wrap';
          const image = document.createElement('img');
          image.src = safe;
          image.alt = say('Note photo', 'নোটের ছবি');
          image.className = 'np-thumb';
          image.onclick = () => openPhoto(src);
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'np-basic-photo-remove';
          remove.textContent = '×';
          remove.setAttribute('aria-label', say('Remove photo', 'ছবি সরান'));
          remove.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            void removePhoto(key);
          };
          wrap.append(image, remove);
          photos.append(wrap);
        });
      }
      renderStatus();
    };

    const reset = () => {
      clearTimer();
      epoch++;
      loadSequence++;
      pages = {};
      legacy = null;
      ready = false;
      active = null;
      draft = null;
      saving = null;
      render(true);
    };

    const activate = uid => {
      if (user === uid) return;
      reset();
      user = uid || '';
    };

    const receive = async raw => {
      const sequence = ++loadSequence;
      const session = epoch;
      const incoming = raw && typeof raw === 'object' ? raw : {};
      pages = incoming;
      if (!entries(pages).length && !ready) {
        try {
          const snapshot = await notesRef.once('value');
          if (session !== epoch || sequence !== loadSequence) return;
          if (snapshot.val() != null && String(snapshot.val()) !== '') {
            legacy = { text: String(snapshot.val()), photos: [], createdAt: Date.now() };
            pages = { 0: legacy };
          }
        } catch (e) {
          if (session !== epoch) return;
          toast(say('Notes could not load. Please reconnect.', 'নোট লোড হয়নি। আবার সংযোগ দিন।'));
          return;
        }
      }
      ready = true;
      if (active == null || !pages[active]) active = pageList()[0]?.[0] ?? null;
      render();
    };

    const materializeLegacy = async () => {
      if (!legacy) return;
      const original = legacy;
      const session = epoch;
      const result = await pagesRef.transaction(raw => {
        if (raw && typeof raw === 'object' && Object.keys(raw).length) return raw;
        return { 0: original };
      }, undefined, false);
      if (session !== epoch) throw new Error('session');
      pages = result?.snapshot?.val?.() || { 0: original };
      legacy = null;
    };

    const saveDraft = () => {
      if (saving) return saving;
      const pending = draft;
      if (!pending || active == null || !ready) return Promise.resolve(true);
      const session = epoch;
      const key = String(pending.key);
      saving = (async () => {
        try {
          await materializeLegacy();
          if (session !== epoch) return false;
          const result = await pagesRef.child(key).transaction(page => {
            if (!page || typeof page !== 'object') return;
            return { ...page, text: pending.text };
          }, undefined, false);
          if (session !== epoch) return false;
          if (!result?.committed) throw new Error('conflict');
          pages = { ...pages, [key]: result.snapshot.val() };
          if (draft === pending) draft = null;
          await notesRef.set(pending.text).catch(() => {});
          sync('ok');
          return true;
        } catch (error) {
          if (session !== epoch) return false;
          pending.error = error.message === 'conflict' ? 'conflict' : 'network';
          sync('error', say('Notes not saved', 'নোট সেভ হয়নি'));
          toast(say('Your simple note is kept. Please retry.', 'আপনার বেসিক নোট রাখা আছে। আবার চেষ্টা করুন।'));
          return false;
        } finally {
          if (session === epoch) {
            saving = null;
            render(true);
          }
        }
      })();
      renderStatus();
      return saving;
    };

    const flush = async () => {
      clearTimer();
      if (saving) await saving;
      return saveDraft();
    };

    const edit = value => {
      if (!ready || active == null || !current()) return;
      draft = { key: String(active), text: String(value ?? ''), error: null };
      clearTimer();
      timer = setTimeout(() => { void saveDraft(); }, 700);
      renderStatus();
    };

    const addPage = async () => {
      if (!ready || !await flush()) return false;
      const session = epoch;
      const newPage = { text: '', photos: [], createdAt: Date.now() };
      let key = null;
      try {
        const result = await pagesRef.transaction(raw => {
          if (session !== epoch) return;
          const existing = raw && typeof raw === 'object' ? raw : {};
          const numericKeys = Object.keys(existing).filter(value => /^\d+$/.test(value)).map(Number);
          key = String(numericKeys.length ? Math.max(...numericKeys) + 1 : 0);
          return { ...existing, [key]: newPage };
        }, undefined, false);
        if (session !== epoch || !result?.committed) return false;
        pages = result.snapshot.val() || {};
        active = key;
        render(true);
        toast(say('New page created', 'নতুন পেজ তৈরি হয়েছে'));
        return true;
      } catch (e) {
        if (session === epoch) toast(say('The page could not be saved. Please retry.', 'পেজ সেভ হয়নি। আবার চেষ্টা করুন।'));
        return false;
      }
    };

    const switchPage = async key => {
      if (String(key) === String(active)) return true;
      if (!await flush()) return false;
      if (!pages[key]) return false;
      active = String(key);
      draft = null;
      render(true);
      return true;
    };

    const addPhoto = input => {
      const file = input?.files?.[0];
      const key = active;
      const session = epoch;
      if (!file || key == null || !current()) return;
      if (photoEntries(current()).length >= 6) {
        toast(say('A page can contain at most 6 photos.', 'এক পেজে সর্বোচ্চ ৬টি ছবি রাখা যায়।'));
        input.value = '';
        return;
      }
      compressPhoto(file, async src => {
        if (session !== epoch) return;
        try {
          const result = await pagesRef.child(String(key)).transaction(page => {
            if (!page || typeof page !== 'object') return;
            const photos = photoEntries(page).map(([, value]) => value);
            if (photos.length >= 6) return;
            return { ...page, photos: photos.concat(src) };
          }, undefined, false);
          if (!result?.committed) throw new Error('photo');
          pages = { ...pages, [key]: result.snapshot.val() };
          render(true);
          toast(say('Photo added', 'ছবি যোগ হয়েছে'));
        } catch (e) {
          toast(say('Photo was not saved. Please retry.', 'ছবি সেভ হয়নি। আবার চেষ্টা করুন।'));
        } finally {
          input.value = '';
        }
      });
    };

    const removePhoto = async photoKey => {
      const key = active;
      const page = current();
      const src = page?.photos?.[photoKey];
      if (key == null || !src) return false;
      if (!await askConfirm(
        say('Remove this photo?', 'এই ছবিটি সরাবেন?'),
        say('Only this photo will be removed.', 'শুধু এই ছবিটি সরানো হবে।')
      )) return false;
      try {
        const result = await pagesRef.child(String(key)).transaction(value => {
          if (!value || typeof value !== 'object') return;
          const photos = photoEntries(value).filter(([entryKey]) => String(entryKey) !== String(photoKey)).map(([, entryValue]) => entryValue);
          return { ...value, photos };
        }, undefined, false);
        if (!result?.committed) throw new Error('photo');
        pages = { ...pages, [key]: result.snapshot.val() };
        render(true);
        return true;
      } catch (e) {
        toast(say('Photo was not removed. Please retry.', 'ছবি সরানো যায়নি। আবার চেষ্টা করুন।'));
        return false;
      }
    };

    const clearPage = async () => {
      const key = active;
      if (key == null || !current()) return false;
      if (!await askConfirm(
        say('Clear this page?', 'এই পেজটি মুছবেন?'),
        say('The simple note text and its photos will be cleared.', 'এই বেসিক নোটের লেখা ও ছবিগুলো মুছে যাবে।')
      )) return false;
      if (!await flush()) return false;
      try {
        const result = await pagesRef.transaction(raw => {
          const existing = raw && typeof raw === 'object' ? raw : {};
          const keys = Object.keys(existing).filter(entryKey => existing[entryKey] && typeof existing[entryKey] === 'object');
          const next = { ...existing };
          if (keys.length > 1) delete next[key];
          else if (next[key]) next[key] = { ...next[key], text: '', photos: [] };
          return next;
        }, undefined, false);
        if (!result?.committed) throw new Error('page');
        pages = result.snapshot.val() || {};
        active = pageList()[0]?.[0] ?? null;
        await notesRef.set(String(pages[active]?.text || '')).catch(() => {});
        render(true);
        toast(say('Page cleared', 'পেজ মুছে ফেলা হয়েছে'));
        return true;
      } catch (e) {
        toast(say('The page could not be cleared. Please retry.', 'পেজ মুছে ফেলা যায়নি। আবার চেষ্টা করুন।'));
        return false;
      }
    };

    const open = async () => {
      if (!await flush()) return false;
      render(true);
      return true;
    };

    const close = () => { void flush(); };

    const text = el('notepad-basic-text');
    if (text) text.addEventListener('input', event => edit(event.target.value));
    render(true);

    return {
      activate,
      reset,
      receive,
      render,
      open,
      close,
      addPage,
      switchPage,
      addPhoto,
      removePhoto,
      clearPage,
      flush
    };
  };

  return { create, entries };
})();
