/* Nitu Baburchir Portfolio — static storefront, connected to the live apps. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const storage = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const designs = [
    { id: 'daisy-love', tags: ['flowers', 'words'], bn: 'ডেইজিতে ভালোবাসা', en: 'Daisies & a little love', description: ['সাদা ডেইজি, হলুদ রিবন আর আপনার প্রিয় কথায় সাজানো একটি ক্যানভাস।', 'White daisies, a yellow ribbon, and a message close to your heart.'], keywords: 'anniversary অ্যানিভার্সারি সাদা white yellow হলুদ' },
    { id: 'design-06', tags: ['flowers'], bn: 'গোলাপের ছোট্ট বাগান', en: 'A little rose garden', description: ['সাদা ক্যানভাসজুড়ে লাল গোলাপের কোমল ছোঁয়া আর মনের কথা।', 'Delicate red roses and a thoughtful message on a white canvas.'], keywords: 'red roses লাল গোলাপ birthday জন্মদিন' },
    { id: 'design-03', tags: ['art'], bn: 'শিল্পের হলুদ ক্যানভাস', en: 'A sunshine work of art', description: ['উজ্জ্বল হলুদে সূক্ষ্ম নকশা, ফুল আর রঙের খেলায় একটু অন্যরকম উদযাপন।', 'An intricate decorative pattern, flowers, and colour on a bright yellow canvas.'], keywords: 'yellow হলুদ sunflower সূর্যমুখী pattern নকশা' },
    { id: 'blue-poetry', tags: ['words', 'art'], bn: 'এক টুকরো নীল আকাশ', en: 'A little piece of the sky', description: ['নীল আকাশ, সাদা মেঘ আর প্রিয় মানুষকে বলার কিছু কথা।', 'A sky-blue canvas, little white clouds, and words for someone special.'], keywords: 'blue নীল clouds মেঘ poetry কবিতা message বার্তা' },
    { id: 'design-09', tags: ['art'], bn: 'স্মৃতির আঁকা ছবি', en: 'A memory in the making', description: ['প্রিয় মুহূর্তের আঁকা ছবি আর ছোট্ট ভালোবাসার বার্তায় সাজানো কেক।', 'An illustrated memory and a little love note for a special celebration.'], keywords: 'illustration family couple ছবি দম্পতি papa বাবা' },
    { id: 'design-07', tags: ['flowers', 'words'], bn: 'গোলাপি ভালোবাসা', en: 'Pretty in pink roses', description: ['গোলাপি গোলাপ, সবুজ পাতার ছোঁয়া আর ভালোবাসার একটি বার্তা।', 'Pink roses, little green leaves, and a message with a lot of heart.'], keywords: 'pink গোলাপি roses গোলাপ floral ফুল' },
    { id: 'design-04', tags: ['art', 'words'], bn: 'প্রিয় গণিতের গল্প', en: 'For the love of mathematics', description: ['সূত্র, সংখ্যা আর গণিতের প্রতি ভালোবাসায় ভরা একটি থিম কেক।', 'Formulas, numbers, and a whole canvas of love for mathematics.'], keywords: 'math mathematics গণিত formulas সূত্র teacher শিক্ষক' },
    { id: 'design-05', tags: ['flowers', 'words'], bn: 'রঙিন ফুলের ডালা', en: 'A bouquet of little wishes', description: ['রঙিন ফুলের বর্ডার আর মাঝখানে আপনার পছন্দের বার্তা।', 'A border of colourful flowers framing a personal message.'], keywords: 'flowers floral রঙিন ফুল white সাদা' },
    { id: 'design-08', tags: ['flowers', 'words'], bn: 'কবিতায় মনের কথা', en: 'A poem, beautifully baked', description: ['নরম রং, ছোট্ট ফুলের লতা আর কেকের ক্যানভাসে লেখা মনের কথা।', 'Soft colours, tiny flowering vines, and meaningful words on a cake canvas.'], keywords: 'poem poetry কবিতা বাংলা bangla pastel প্যাস্টেল' },
    { id: 'design-10', tags: ['flowers', 'words'], bn: 'গোলাপে লেখা গল্প', en: 'A story among roses', description: ['লাল গোলাপের ডালে সাজানো সাদা কেক, সঙ্গে একটি বিশেষ বার্তা।', 'A white cake with red rose sprigs and a special personal message.'], keywords: 'red roses লাল গোলাপ anniversary message অ্যানিভার্সারি' },
    { id: 'design-11', tags: ['flowers'], bn: 'লাল গোলাপের দিন', en: 'A day for red roses', description: ['লাল গোলাপ আর সবুজ পাতায় ঘেরা ভালোবাসার ছোট্ট উদযাপন।', 'A little celebration framed by red roses and green leaves.'], keywords: 'red roses লাল গোলাপ white green সাদা সবুজ' },
    { id: 'design-12', tags: ['flowers', 'words'], bn: 'প্যাস্টেলে ছোট্ট উদযাপন', en: 'A pastel kind of celebration', description: ['নীল-গোলাপি ফুল আর নরম রঙে সাজানো একটি মিষ্টি ক্যানভাস।', 'Tiny blue and pink flowers on a softly coloured celebration canvas.'], keywords: 'pastel blue pink প্যাস্টেল নীল গোলাপি flowers ফুল' }
  ].map((design, index) => ({ ...design, code: String(index + 1).padStart(2, '0'), image: `assets/${design.id}.webp` }));

  // Flavour names and recipes match customer-app/utils.js and flavours.txt.
  // Prices are the basic-design guide in base price.txt, not computed quotes.
  const flavours = [
    ['vanilla-sponge', 'ভ্যানিলা স্পঞ্জ', 'Vanilla sponge', 'cream', 820, 'ভ্যানিলা স্পঞ্জ, হুইপড ক্রিম ফ্রস্টিং ও হোয়াইট চকলেট গানাশ।', 'Vanilla sponge, whipped cream frosting, and white chocolate ganache.', '#f0e7d4', '#9b753c'],
    ['chocolate-sponge', 'চকলেট স্পঞ্জ', 'Chocolate sponge', 'cream', 900, 'চকলেট স্পঞ্জ, চকলেট হুইপড ক্রিম ও চকলেট গানাশ।', 'Chocolate sponge with chocolate whipped cream and chocolate ganache.', '#e9dbd2', '#785142'],
    ['double-layer-chocolate', 'ডাবল লেয়ারড চকলেট', 'Double-layer chocolate', 'ganache', 1100, 'চকলেট স্পঞ্জ, গানাশ ফ্রস্টিং আর চকলেট চিপসের মজাদার স্তর।', 'Chocolate sponge with ganache frosting and delicious chocolate chips.', '#e4d5cb', '#70503e'],
    ['strawberry', 'স্ট্রবেরি কেক', 'Strawberry cake', 'cream', 900, 'নরম স্পঞ্জ কেকের মাঝে স্ট্রবেরি ফ্রুট ফিলিং।', 'Soft sponge cake with a strawberry fruit filling.', '#f3dfe0', '#a25761'],
    ['lemon', 'লেমন কেক', 'Lemon cake', 'cream', 950, 'স্পঞ্জ কেকের সঙ্গে হোমমেড লেমন কার্ডের সতেজ স্বাদ।', 'Sponge cake with the fresh flavour of homemade lemon curd.', '#eeeccf', '#7b8140'],
    ['red-velvet', 'রেড ভেলভেট', 'Red velvet', 'cheese', 2200, 'বাটার-বেসড ময়েস্ট কেক আর ক্রিমচিজ ফ্রস্টিং।', 'A butter-based moist cake with cream cheese frosting.', '#efd7d5', '#a1514b'],
    ['black-forest', 'ব্ল্যাক ফরেস্ট', 'Black forest', 'cream', 920, 'স্পঞ্জ, হুইপড ক্রিম, চেরি ফিলিং আর ডার্ক চকলেট।', 'Sponge cake, whipped cream, cherry filling, and dark chocolate.', '#e7d8d6', '#834646'],
    ['white-forest', 'হোয়াইট ফরেস্ট', 'White forest', 'cream', 950, 'ভ্যানিলা স্পঞ্জ, হুইপড ক্রিম, চেরি ফিলিং ও হোয়াইট চকলেট।', 'Vanilla sponge with whipped cream, cherry filling, and white chocolate.', '#eee6d4', '#8b714b'],
    ['orange', 'অরেঞ্জ কেক', 'Orange cake', 'cream', 950, 'স্পঞ্জ কেক আর হোমমেড অরেঞ্জ কার্ডের মিষ্টি-টক স্বাদ।', 'Sponge cake with the sweet citrus flavour of homemade orange curd.', '#f2e2c9', '#b27d3e'],
    ['blueberry', 'ব্লুবেরি কেক', 'Blueberry cake', 'cream', 900, 'ভ্যানিলা স্পঞ্জের মাঝে ব্লুবেরি ফ্রুট ফিলিং।', 'Vanilla sponge filled with blueberry fruit filling.', '#e3dfee', '#736184'],
    ['malai', 'মালাই কেক', 'Malai cake', 'cream', 1000, 'ভ্যানিলা স্পঞ্জের সঙ্গে হোমমেড মালাইয়ের কোমল স্বাদ।', 'Vanilla sponge with the gentle richness of homemade malai.', '#f0e7d5', '#9b8048'],
    ['butterscotch', 'বাটারস্কচ কেক', 'Butterscotch cake', 'cream', 950, 'স্পঞ্জ কেক, ক্যারামেল সস আর ক্যারামেলাইজড বাদাম।', 'Sponge cake with caramel sauce and caramelized nuts.', '#ebdfc5', '#986c38'],
    ['special-vanilla', 'স্পেশাল ভ্যানিলা', 'Special vanilla', 'ganache', 1150, 'ভ্যানিলা স্পঞ্জ, হোয়াইট চকলেট গানাশ আর স্ট্রবেরি ফিলিং।', 'Vanilla sponge with white chocolate ganache and strawberry filling.', '#efe1d8', '#a07864'],
    ['chocolate-mud', 'চকলেট মাডকেক', 'Chocolate mud cake', 'ganache', 1200, 'বাটার-বেসড ময়েস্ট কেকের ওপরে চকলেট গানাশ ফ্রস্টিং।', 'Butter-based moist cake with chocolate ganache frosting.', '#e3d5cf', '#725345'],
    ['cream-cheese-fruit', 'ফ্রুট ফিলিং ও ক্রিমচিজ', 'Fruit & cream cheese', 'cheese', [1180, 1190], 'স্পঞ্জ কেক, ক্রিমচিজ ফ্রস্টিং ও ব্লুবেরি, স্ট্রবেরি বা লেমন ফিলিং।', 'Sponge cake with cream cheese frosting and blueberry, strawberry, or lemon filling.', '#e6e8d7', '#7b8653']
  ].map(([id, bn, en, category, price, descriptionBn, descriptionEn, tint, colour]) => ({ id, bn, en, category, price, descriptionBn, descriptionEn, tint, colour }));

  const categoryLabels = { cream: ['হুইপড ক্রিম', 'Whipped cream'], ganache: ['গানাশ', 'Ganache'], cheese: ['ক্রিমচিজ', 'Cream cheese'] };
  let lang = storage.read('nitu-website-language', 'bn') === 'en' ? 'en' : 'bn';
  let galleryFilter = 'all';
  let flavourFilter = 'all';
  let galleryExpanded = false;
  let flavoursExpanded = false;
  let activeDesign = null;
  let activeFlavour = null;
  let toastTimer;
  const storedSaved = storage.read('nitu-website-designs', []);
  const saved = new Set(Array.isArray(storedSaved) ? storedSaved.filter(id => designs.some(d => d.id === id)) : []);
  const text = (bn, en) => lang === 'en' ? en : bn;
  const name = item => item[lang];
  const number = value => Number(value).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { useGrouping: false });
  const price = value => Array.isArray(value) ? `৳${number(value[0])}–${number(value[1])}` : `৳${number(value)}`;

  function showToast(message) {
    const toast = $('toast');
    const active = document.querySelector('dialog[open]');
    (active || document.body).appendChild(toast);
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function openDialog(dialog) {
    document.querySelectorAll('dialog[open]').forEach(other => { if (other !== dialog) other.close(); });
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
  }

  function matchingDesigns() {
    const query = $('gallery-search').value.trim().toLocaleLowerCase().normalize('NFC');
    return designs.filter(d => (galleryFilter === 'all' || d.tags.includes(galleryFilter)) && (!query || `${d.bn} ${d.en} ${d.keywords} ${d.code} ${d.description.join(' ')}`.toLocaleLowerCase().normalize('NFC').includes(query)));
  }

  function renderGallery() {
    const matches = matchingDesigns();
    const visible = galleryExpanded ? matches : matches.slice(0, 6);
    $('gallery-grid').innerHTML = visible.length ? visible.map(d => `<article class="gallery-card"><div class="gallery-photo"><button class="gallery-image-button" type="button" data-design-open="${d.id}" aria-label="${escape(text('ডিজাইন খুলুন: ', 'View design: ') + name(d))}"><img src="${d.image}" alt="${escape(name(d))}" width="736" height="736" loading="lazy" decoding="async"><span class="gallery-zoom">DESIGN ${d.code}</span></button><button class="icon-button gallery-favourite" type="button" data-save-id="${d.id}">${icon('heart')}</button></div><div class="gallery-caption"><div><h3>${escape(name(d))}</h3><small>${escape(text('নিতুবাবুর্চীর পোর্টফোলিও', 'Nitu Baburchir Portfolio'))}</small></div>${icon('up-right')}</div></article>`).join('') : `<div class="empty-state">${icon('search')}<h3>${text('এই খোঁজে কোনো ডিজাইন পাওয়া যায়নি।', 'No designs found this time.')}</h3><p>${text('অন্য কোনো শব্দ দিয়ে খুঁজুন, অথবা সব ডিজাইন দেখুন।', 'Try another word, or explore all the designs.')}</p><button type="button" class="button button-outline" data-gallery-reset>${text('সব ডিজাইন দেখি', 'Show all designs')}</button></div>`;
    $('gallery-more').hidden = matches.length <= 6;
    $('gallery-more').querySelector('span').textContent = galleryExpanded ? text('কম ডিজাইন দেখুন', 'Show fewer designs') : text('আরও ডিজাইন দেখুন', 'A few more designs');
    updateSaveButtons();
  }

  function updateSaveButtons() {
    document.querySelectorAll('[data-save-id]').forEach(button => {
      const d = designs.find(item => item.id === button.dataset.saveId);
      const isSaved = saved.has(d.id);
      button.classList.toggle('saved', isSaved);
      button.setAttribute('aria-pressed', String(isSaved));
      button.setAttribute('aria-label', text(isSaved ? 'পছন্দ থেকে সরান: ' : 'পছন্দে রাখুন: ', isSaved ? 'Remove favourite: ' : 'Save favourite: ') + name(d));
    });
    $('saved-count').textContent = number(saved.size);
    $('saved-count').hidden = saved.size === 0;
    $('saved-open').setAttribute('aria-label', text('পছন্দের ডিজাইন: ', 'Saved designs: ') + number(saved.size));
    if (activeDesign) $('design-save').innerHTML = icon('heart') + `<span>${saved.has(activeDesign.id) ? text('পছন্দ থেকে সরান', 'Remove from favourites') : text('পছন্দের খাতায় রাখুন', 'Save to my favourites')}</span>`;
    if (activeDesign) $('design-save').setAttribute('aria-pressed', String(saved.has(activeDesign.id)));
  }

  function toggleSaved(id) {
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    const persisted = storage.write('nitu-website-designs', [...saved]);
    updateSaveButtons();
    if ($('saved-dialog').open) renderSaved();
    showToast(saved.has(id) ? persisted ? text('পছন্দের খাতায় রাখা হয়েছে।', 'Saved to your little collection.') : text('এই সেশনে আপনার পছন্দে রাখা হয়েছে।', 'Saved for this session.') : text('পছন্দের খাতা থেকে সরানো হয়েছে।', 'Removed from your favourites.'));
  }

  function designLink(d) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('design', d.id);
    url.hash = 'portfolio';
    return url.href;
  }

  function renderDesign() {
    const d = activeDesign;
    if (!d) return;
    $('design-dialog-image').src = d.image;
    $('design-dialog-image').alt = name(d);
    $('design-dialog-title').textContent = name(d);
    $('design-dialog-code').textContent = `DESIGN ${d.code} · NITU BABURCHIR PORTFOLIO`;
    $('design-dialog-description').textContent = d.description[lang === 'bn' ? 0 : 1];
    $('design-download').href = d.image;
    $('design-download').download = `nitu-portfolio-design-${d.code}.webp`;
    updateSaveButtons();
  }

  function openDesign(id) {
    activeDesign = designs.find(d => d.id === id);
    if (!activeDesign) return;
    renderDesign();
    openDialog($('design-dialog'));
  }

  function moveDesign(direction) {
    let list = matchingDesigns();
    if (!list.some(d => d.id === activeDesign.id)) list = designs;
    const index = list.findIndex(d => d.id === activeDesign.id);
    activeDesign = list[(index + direction + list.length) % list.length];
    renderDesign();
  }

  function renderSaved() {
    const list = designs.filter(d => saved.has(d.id));
    $('saved-grid').innerHTML = list.length ? list.map(d => `<article class="saved-tile"><button type="button" data-design-open="${d.id}"><img src="${d.image}" alt="${escape(name(d))}" loading="lazy" width="240" height="240"><strong>${escape(name(d))}</strong></button><button class="icon-button" type="button" data-save-id="${d.id}">${icon('close')}</button></article>`).join('') : `<div class="empty-state">${icon('heart')}<h3>${text('পছন্দের খাতাটা এখনো খালি।', 'Your collection is waiting for you.')}</h3><p>${text('গ্যালারির হার্টে চাপ দিয়ে আপনার পছন্দের ডিজাইনগুলো রাখুন।', 'Tap a heart in the gallery to start collecting the designs you love.')}</p><button type="button" class="button button-outline" data-dialog-close>${text('গ্যালারিতে ফিরে যাই', 'Back to the gallery')}</button></div>`;
    $('saved-copy').disabled = list.length === 0;
    updateSaveButtons();
  }

  function renderFlavours() {
    const matches = flavours.filter(f => flavourFilter === 'all' || f.category === flavourFilter);
    const visible = flavoursExpanded ? matches : matches.slice(0, 6);
    $('flavour-grid').innerHTML = visible.map(f => `<article class="flavour-card"><div class="flavour-card-top"><div class="flavour-art" style="--flavour-tint:${f.tint};--flavour-color:${f.colour}">${icon(f.category === 'cream' && ['lemon', 'orange', 'strawberry', 'blueberry'].includes(f.id) ? 'flower' : 'cake')}</div><span class="flavour-category">${escape(categoryLabels[f.category][lang === 'bn' ? 0 : 1])}</span></div><h3>${escape(name(f))}</h3><p>${escape(f[lang === 'bn' ? 'descriptionBn' : 'descriptionEn'])}</p><div class="flavour-card-bottom"><div><small>${text('বেসিক ডিজাইন গাইড', 'Basic-design guide')}</small><strong class="flavour-price${Array.isArray(f.price) ? ' price-range' : ''}">${price(f.price)}</strong></div><button class="text-link" type="button" data-flavour-open="${f.id}" aria-label="${escape(text('ফ্লেভারের বিস্তারিত: ', 'Flavour details: ') + name(f))}"><span>${text('বিস্তারিত', 'Details')}</span>${icon('up-right')}</button></div></article>`).join('');
    $('flavour-more').hidden = matches.length <= 6;
    $('flavour-more').querySelector('span').textContent = flavoursExpanded ? text('কম ফ্লেভার দেখুন', 'Show fewer flavours') : text('সব ফ্লেভার দেখুন', 'Explore all flavours');
  }

  function renderFlavour() {
    const f = activeFlavour;
    if (!f) return;
    $('flavour-dialog-title').textContent = name(f);
    $('flavour-dialog-category').textContent = categoryLabels[f.category][lang === 'bn' ? 0 : 1];
    $('flavour-dialog-description').textContent = f[lang === 'bn' ? 'descriptionBn' : 'descriptionEn'];
    $('flavour-dialog-art').style.setProperty('--flavour-tint', f.tint);
    $('flavour-dialog-art').style.setProperty('--flavour-color', f.colour);
    $('flavour-dialog-art').innerHTML = icon('cake');
    $('flavour-dialog-price').innerHTML = `<span>${text('বেসিক ডিজাইন গাইড', 'Basic-design guide')}</span><strong>${price(f.price)}</strong>`;
    $('flavour-dialog-minimum').textContent = f.id === 'red-velvet' ? text('ন্যূনতম অর্ডার: ২ পাউন্ড।', 'Minimum order: 2 pounds.') : f.category === 'ganache' ? text('ন্যূনতম অর্ডার: ৫০০–৬০০ গ্রাম।', 'Minimum order: 500–600 g.') : f.id === 'cream-cheese-fruit' ? text('স্ট্রবেরি/ব্লুবেরি: ৳১১৮০; লেমন: ৳১১৯০ (বেসিক ডিজাইন গাইড)।', 'Strawberry/blueberry: ৳1180; lemon: ৳1190 (basic-design guide).') : text('সাইজ ও উপলব্ধতা ইনবক্সে নিশ্চিত করুন।', 'Confirm size and availability in our inbox.');
  }

  function setLanguage(value) {
    lang = value;
    document.documentElement.lang = lang;
    storage.write('nitu-website-language', lang);
    document.querySelectorAll('[data-bn][data-en]').forEach(el => { el.textContent = el.dataset[lang]; });
    document.querySelectorAll('[data-bn-label]').forEach(el => { el.setAttribute('aria-label', el.getAttribute(`data-${lang}-label`)); });
    document.querySelectorAll('[data-bn-alt]').forEach(el => { el.alt = el.getAttribute(`data-${lang}-alt`); });
    document.querySelectorAll('[data-bn-placeholder]').forEach(el => { el.placeholder = el.getAttribute(`data-${lang}-placeholder`); });
    $('language-toggle').textContent = lang === 'bn' ? 'EN' : 'বাংলা';
    $('language-toggle').setAttribute('aria-label', lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন');
    document.title = text('নিতুবাবুর্চীর পোর্টফোলিও · The cake is a canvas', 'Nitu Baburchir Portfolio · Custom cakes in Chattogram');
    document.querySelector('.brand').setAttribute('aria-label', text('নিতুবাবুর্চীর পোর্টফোলিও · মূল পাতা', 'Nitu Baburchir Portfolio · Home'));
    renderGallery(); renderFlavours(); renderSaved(); renderDesign(); renderFlavour();
  }

  async function copyText(value) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; } } catch {}
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px;';
    (document.querySelector('dialog[open]') || document.body).appendChild(input);
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    input.remove();
    return copied;
  }

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-dialog-close]');
    if (close) { close.closest('dialog').close(); return; }
    const save = event.target.closest('[data-save-id]');
    if (save) { toggleSaved(save.dataset.saveId); return; }
    const design = event.target.closest('[data-design-open]');
    if (design) { openDesign(design.dataset.designOpen); return; }
    const flavour = event.target.closest('[data-flavour-open]');
    if (flavour) { activeFlavour = flavours.find(f => f.id === flavour.dataset.flavourOpen); renderFlavour(); openDialog($('flavour-dialog')); return; }
    if (event.target.closest('[data-order-open]')) openDialog($('order-dialog'));
    if (event.target.closest('[data-gallery-reset]')) {
      $('gallery-search').value = ''; galleryFilter = 'all'; galleryExpanded = false;
      document.querySelectorAll('[data-gallery-filter]').forEach(button => { const active = button.dataset.galleryFilter === 'all'; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
      renderGallery();
    }
  });

  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.toggle('modal-open', !!document.querySelector('dialog[open]'));
      if (!document.querySelector('dialog[open]')) document.body.appendChild($('toast'));
    });
  });
  $('order-dialog').setAttribute('aria-labelledby', 'order-dialog-title');
  $('language-toggle').addEventListener('click', () => setLanguage(lang === 'bn' ? 'en' : 'bn'));
  $('saved-open').addEventListener('click', () => { renderSaved(); openDialog($('saved-dialog')); });
  $('design-save').addEventListener('click', () => toggleSaved(activeDesign.id));
  $('design-previous').addEventListener('click', () => moveDesign(-1));
  $('design-next').addEventListener('click', () => moveDesign(1));
  document.addEventListener('keydown', event => { if ($('design-dialog').open && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); moveDesign(event.key === 'ArrowLeft' ? -1 : 1); } });
  $('gallery-search').addEventListener('input', () => { galleryExpanded = false; renderGallery(); });
  document.querySelectorAll('[data-gallery-filter]').forEach(button => button.addEventListener('click', () => {
    galleryFilter = button.dataset.galleryFilter; galleryExpanded = false;
    document.querySelectorAll('[data-gallery-filter]').forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active)); });
    renderGallery();
  }));
  document.querySelectorAll('[data-flavour-filter]').forEach(button => button.addEventListener('click', () => {
    flavourFilter = button.dataset.flavourFilter; flavoursExpanded = false;
    document.querySelectorAll('[data-flavour-filter]').forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active)); });
    renderFlavours();
  }));
  $('gallery-more').addEventListener('click', () => { galleryExpanded = !galleryExpanded; renderGallery(); });
  $('flavour-more').addEventListener('click', () => { flavoursExpanded = !flavoursExpanded; renderFlavours(); });
  $('saved-copy').addEventListener('click', async () => {
    const list = designs.filter(d => saved.has(d.id));
    const message = text('নিতুবাবুর্চীর পোর্টফোলিও — আমার পছন্দের ডিজাইন:', 'Nitu Baburchir Portfolio — my favourite designs:') + '\n\n' + list.map(d => `${name(d)} (Design ${d.code})\n${designLink(d)}`).join('\n\n');
    const copied = await copyText(message);
    showToast(copied ? text('পছন্দের লিংক কপি হয়েছে। ইনবক্সে পেস্ট করুন।', 'Links copied. Paste them into our inbox.') : text('এই ব্রাউজারে কপি করা যায়নি। ছবিগুলো খুলে ডাউনলোড করুন।', 'Copy is unavailable here. Open and download the design photos instead.'));
  });
  $('nav-toggle').addEventListener('click', () => {
    const isOpen = $('main-nav').classList.toggle('open');
    $('nav-toggle').setAttribute('aria-expanded', String(isOpen));
  });
  $('main-nav').querySelectorAll('a').forEach(link => link.addEventListener('click', () => { $('main-nav').classList.remove('open'); $('nav-toggle').setAttribute('aria-expanded', 'false'); }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('main-nav').classList.remove('open'); $('nav-toggle').setAttribute('aria-expanded', 'false'); } });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        $('main-nav').querySelectorAll('a').forEach(link => { if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    ['portfolio', 'flavours', 'how-to-order', 'contact'].forEach(id => observer.observe($(id)));
  }
  $('year').textContent = new Date().getFullYear();
  setLanguage(lang);
  const sharedDesign = new URL(window.location.href).searchParams.get('design');
  if (sharedDesign && designs.some(d => d.id === sharedDesign)) openDesign(sharedDesign);
})();
