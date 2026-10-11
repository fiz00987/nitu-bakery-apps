(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const products = [
    { id:'s417', name:'Wall Canvas · S417', category:'decor', label:'Wall art', image:'assets/canvas-s417.jpg', price:750, old:1250, description:'PVC wall canvas with vinyl sticker, glittery lamination and a durable 3 mm board. A bright, easy way to refresh an empty wall.', badge:'best seller', tags:'canvas wall art home decor modern' },
    { id:'s415', name:'Wall Canvas · S415', category:'decor', label:'Wall art', image:'assets/canvas-s415.jpg', price:750, old:1250, description:'A statement canvas with a clean finish and easy wall mounting. Designed for the corner that needs a little more life.', tags:'canvas wall art home decor' },
    { id:'s414', name:'Wall Canvas · S414', category:'decor', label:'Wall art', image:'assets/canvas-s414.jpg', price:750, old:1250, description:'Bring colour, texture and a little personality to your room with a water-resistant PVC wall canvas.', tags:'canvas wall art home decor colour' },
    { id:'s409', name:'Wall Canvas · S409', category:'decor', label:'Wall art', image:'assets/canvas-s409.jpg', price:750, old:1250, description:'A gallery-style wall piece with a premium laminated finish and no drilling required.', badge:'-৳500', tags:'canvas wall art home decor' },
    { id:'islamic20', name:'Islamic Canvas · 20', category:'islamic', label:'Islamic decor', image:'assets/islamic-20.jpg', price:750, old:900, description:'A calm, meaningful piece for your home. Vinyl sticker, matte lamination and a sturdy 3 mm PVC board.', badge:'popular', tags:'islamic canvas dua decor meaning' },
    { id:'islamic18', name:'Islamic Canvas · 18', category:'islamic', label:'Islamic decor', image:'assets/islamic-18.jpg', price:750, description:'Thoughtful wall art made to bring a little peace and beauty to your everyday space.', tags:'islamic canvas dua decor' },
    { id:'sanatani202', name:'Sanatoni Canvas · SD-202', category:'islamic', label:'Meaningful decor', image:'assets/sanatani-202.jpg', price:750, description:'A devotional canvas with a calm matte finish, chosen for spaces that hold meaning.', tags:'sanatoni sanatani canvas decor spiritual' },
    { id:'hex722', name:'Hexagon Set · S722', category:'frames', label:'Hexagon decor', image:'assets/hexagon-s722.jpg', price:550, description:'A compact geometric set for shelves, entryways and small walls that deserve a design moment.', tags:'hexagon frame wall decor small' },
    { id:'hex713', name:'Hexagon Set · S713', category:'frames', label:'Hexagon decor', image:'assets/hexagon-s713.jpg', price:550, description:'Make an empty wall feel considered with a light, modular hexagon arrangement.', tags:'hexagon frame wall decor' },
    { id:'frame1214', name:'Frame Set · S1214', category:'frames', label:'Frames & sets', image:'assets/frame-s1214.jpg', price:800, description:'Four-piece wall canvas set with a polished finish. Easy to mount, easy to make your own.', badge:'new', tags:'frame wall set canvas room' },
    { id:'frame1139', name:'Frame Set · S1139', category:'frames', label:'Frames & sets', image:'assets/frame-s1139.jpg', price:800, description:'A balanced set for a hallway, living room or the wall behind your favourite chair.', tags:'frame wall set canvas' },
    { id:'learning', name:'Kids Learning Box', category:'kids', label:'Kids & learning', image:'assets/learning-box.jpg', price:780, description:'A colourful 22-piece learning box made with strong board books and laminated pages for little hands.', badge:'gift pick', tags:'kids baby learning book gift' },
    { id:'album', name:'Baby Memory Album', category:'kids', label:'Kids & learning', image:'assets/baby-album.jpg', price:720, description:'Keep the first smile, first step and all the little milestones in one beautiful, lasting album.', badge:'gift pick', tags:'baby album memory gift book' },
    { id:'diary', name:'শৈশবের ডায়েরি', category:'kids', label:'Kids & learning', image:'assets/baby-diary.jpg', price:450, description:'A keepsake diary with a gift box and flash cards—made for new parents and all the moments they never want to forget.', tags:'baby diary memory gift book' }
  ];
  const read = key => { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; } catch { return []; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const state = { filter:'all', query:'', wishlist:new Set(read('shobdo-wishlist')), cart:read('shobdo-cart'), active:null, sort:'featured' };
  const money = n => `৳${Number(n).toLocaleString('bn-BD')}`;
  const escape = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const categoryName = { all:'সবকিছু', decor:'Wall art', islamic:'Islamic decor', kids:'Kids & learning', frames:'Frames & sets' };
  let toastTimer;

  function toast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
  function visibleProducts() {
    const query=state.query.trim().toLocaleLowerCase();
    let list=products.filter(product => (state.filter==='all'||product.category===state.filter) && (!query || `${product.name} ${product.label} ${product.tags} ${product.description}`.toLocaleLowerCase().includes(query)));
    if(state.sort==='price-low') list=[...list].sort((a,b)=>a.price-b.price);
    if(state.sort==='price-high') list=[...list].sort((a,b)=>b.price-a.price);
    return list;
  }
  function renderProducts() {
    const list=visibleProducts(); $('result-count').textContent=`${list.length.toLocaleString('bn-BD')}টি পণ্য`;
    $('empty-products').hidden=list.length>0;
    $('product-grid').innerHTML=list.map(product => `<article class="product-card" data-product="${product.id}"><div class="product-image"><img src="${product.image}" alt="${escape(product.name)}" loading="lazy"><span class="product-badge" ${product.badge?'':'hidden'}>${escape(product.badge||'')}</span><button class="wishlist-btn ${state.wishlist.has(product.id)?'saved':''}" data-wishlist="${product.id}" aria-label="পছন্দে রাখুন">${state.wishlist.has(product.id)?'♥':'♡'}</button><button class="quick-btn" data-quick="${product.id}">Quick view · বিস্তারিত</button></div><div class="product-info"><span class="product-category">${escape(product.label)}</span><h3>${escape(product.name)}</h3><p class="product-meta">${escape(product.description.slice(0,86))}…</p><div class="price-row"><strong class="price">${money(product.price)}</strong>${product.old?`<del class="old-price">${money(product.old)}</del>`:''}</div></div></article>`).join('');
  }
  function renderCounts() { const cartCount=state.cart.reduce((sum,item)=>sum+item.qty,0); $('cart-count').textContent=cartCount; $('mobile-cart-count').textContent=cartCount; $('wishlist-count').textContent=state.wishlist.size; }
  function renderCart() {
    const has=state.cart.length>0; $('cart-empty').hidden=has; $('cart-footer').hidden=!has;
    $('cart-items').innerHTML=state.cart.map(item=>{const product=products.find(p=>p.id===item.id);return product?`<div class="cart-item"><img src="${product.image}" alt="${escape(product.name)}"><div><small>${escape(product.label)}</small><strong>${escape(product.name)}</strong><p>${money(product.price)} · ×${item.qty}</p></div><button data-remove-cart="${product.id}" aria-label="সরান">×</button></div>`:''}).join('');
    const total=state.cart.reduce((sum,item)=>{const product=products.find(p=>p.id===item.id);return sum+(product?product.price*item.qty:0)},0); $('cart-total').textContent=money(total); renderCounts();
  }
  function renderWishlist() { const list=products.filter(product=>state.wishlist.has(product.id)); $('wishlist-empty').hidden=list.length>0; $('wishlist-grid').innerHTML=list.map(product=>`<div class="wishlist-tile"><img src="${product.image}" alt="${escape(product.name)}"><strong>${escape(product.name)}</strong><button data-wishlist="${product.id}" aria-label="পছন্দ থেকে সরান">×</button></div>`).join(''); renderCounts(); }
  function showDrawer(open) { $('cart-drawer').classList.toggle('open',open); $('overlay').classList.toggle('open',open); document.body.classList.toggle('drawer-open',open); if(open)renderCart(); }
  function showDialog(id) { const dialog=$(id); if(dialog && !dialog.open)dialog.showModal(); }
  function openQuick(id) { const product=products.find(p=>p.id===id); if(!product)return; state.active=product; $('quick-image').src=product.image; $('quick-image').alt=product.name; $('quick-category').textContent=product.label; $('quick-title').textContent=product.name; $('quick-description').textContent=product.description; $('quick-price').textContent=money(product.price); $('quick-old-price').textContent=product.old?money(product.old):''; showDialog('quick-dialog'); }
  function toggleWishlist(id) { if(state.wishlist.has(id))state.wishlist.delete(id); else state.wishlist.add(id); write('shobdo-wishlist',[...state.wishlist]); renderProducts(); renderWishlist(); toast(state.wishlist.has(id)?'পছন্দের তালিকায় রাখা হয়েছে ♥':'পছন্দের তালিকা থেকে সরানো হয়েছে'); }
  function addToCart(id) { const item=state.cart.find(entry=>entry.id===id); if(item)item.qty++; else state.cart.push({id,qty:1}); write('shobdo-cart',state.cart); renderCart(); toast('আপনার bag-এ রাখা হয়েছে ✦'); }
  document.addEventListener('click', event => {
    const filter=event.target.closest('[data-filter]'); if(filter){state.filter=filter.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el===filter));document.querySelectorAll('[data-category]').forEach(el=>el.classList.toggle('active',el.dataset.category===state.filter));renderProducts();return;}
    const category=event.target.closest('[data-category], [data-category-card], [data-category-link]'); if(category){const value=category.dataset.category||category.dataset.categoryCard||category.dataset.categoryLink;state.filter=value;document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter===value));document.querySelectorAll('[data-category]').forEach(el=>el.classList.toggle('active',el.dataset.category===value));renderProducts();return;}
    const wish=event.target.closest('[data-wishlist]'); if(wish){toggleWishlist(wish.dataset.wishlist);return;}
    const quick=event.target.closest('[data-quick]'); if(quick){openQuick(quick.dataset.quick);return;}
    const remove=event.target.closest('[data-remove-cart]'); if(remove){state.cart=state.cart.filter(item=>item.id!==remove.dataset.removeCart);write('shobdo-cart',state.cart);renderCart();return;}
    if(event.target.closest('#cart-open, #mobile-cart')){showDrawer(true);return;}
    if(event.target.closest('[data-close-drawer], #overlay')){showDrawer(false);return;}
    if(event.target.closest('#wishlist-open')){renderWishlist();showDialog('wishlist-dialog');return;}
    if(event.target.closest('[data-close-dialog]')){event.target.closest('dialog')?.close();return;}
    if(event.target.closest('#quick-add')&&state.active){addToCart(state.active.id);$('quick-dialog').close();showDrawer(true);return;}
    if(event.target.closest('#checkout-btn')){toast('Demo checkout — WooCommerce connect করার পর live হবে');return;}
    if(event.target.closest('#menu-toggle')){ $('category-nav').classList.toggle('open');return; }
  });
  $('site-search').addEventListener('input',event=>{state.query=event.target.value;renderProducts()});
  $('sort-toggle').addEventListener('click',()=>{state.sort=state.sort==='featured'?'price-low':state.sort==='price-low'?'price-high':'featured';$('sort-toggle').innerHTML=`Sort: ${state.sort==='featured'?'featured':state.sort==='price-low'?'price low':'price high'} <span>⌄</span>`;renderProducts()});
  $('quick-dialog').addEventListener('click',event=>{if(event.target===$('quick-dialog'))$('quick-dialog').close()});$('wishlist-dialog').addEventListener('click',event=>{if(event.target===$('wishlist-dialog'))$('wishlist-dialog').close()});
  document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('site-search').focus()}if(event.key==='Escape')showDrawer(false)});
  renderProducts();renderCart();renderWishlist();
})();
