'use strict';

const $ = id => document.getElementById(id);
let phone = '';
let orders = [];
let claims = [];
let selected = null;
let allOrdersPromise = null;
let lookupSequence = 0;

const DEFAULT_REVIEW_TEXT = 'Facebook review screenshot submitted.';
const MAX_SCREENSHOT_BYTES = 1500000;

function normalize(value) {
  let v = String(value || '').trim().replace(/[\s-]/g, '');
  if (/^\+8801[3-9]\d{8}$/.test(v)) return '0' + v.slice(4);
  if (/^8801[3-9]\d{8}$/.test(v)) return '0' + v.slice(3);
  if (/^01[3-9]\d{8}$/.test(v)) return v;
  return null;
}

function key(value) {
  return String(value || '').replace(/\D/g, '');
}

function orderId(order) {
  return String(order.orderId || order.orderKey || order.id || 'অর্ডার');
}

function orderCustomerName(order) {
  return String(order.customerName || order.name || order.receiverName || '').trim();
}

function orderPhone(order) {
  return order.customerPhone || order.phone || order.receiverPhone || '';
}

function delivered(order) {
  const status = String(order.status || order.orderStatus || '').toLowerCase();
  return /deliver|complete|received|done/.test(status) || order.delivered === true;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function statusLabel(status) {
  if (status === 'pending') return 'যাচাই হচ্ছে';
  if (status === 'approved') return 'অনুমোদিত';
  if (status === 'rejected') return 'বাতিল';
  return 'ব্যবহৃত';
}

function setMessage(element, message) {
  element.textContent = message || '';
}

// Orders use several phone formats, so read the collection once and perform
// canonical Bangladesh-phone matching in the client. Reusing this promise
// also keeps repeated searches from downloading the full collection again.
function loadOrdersOnce() {
  if (!allOrdersPromise) {
    allOrdersPromise = db.ref('orders').once('value').then(snapshot => {
      const allOrders = [];
      snapshot.forEach(child => {
        const value = child.val() || {};
        if (delivered(value)) allOrders.push({ ...value, orderKey: child.key });
      });
      return allOrders;
    }).catch(error => {
      allOrdersPromise = null;
      throw error;
    });
  }
  return allOrdersPromise;
}

function loadClaims(phoneKey) {
  return db.ref('reviewClaims').orderByChild('phoneKey').equalTo(phoneKey).once('value').then(snapshot => {
    const result = [];
    snapshot.forEach(child => result.push({ ...child.val(), key: child.key }));
    return result;
  });
}

function renderClaims() {
  $('claims').innerHTML = claims.map(claim => {
    const id = claim.orderId || claim.orderKey || 'অর্ডার';
    return `<div class="claim"><b>${escapeHtml(id)}</b><span class="status">${escapeHtml(statusLabel(claim.status || 'pending'))}</span></div>`;
  }).join('');
  $('history').classList.toggle('hidden', !claims.length);
}

function selectOrder(index, element) {
  const previousOrder = selected;
  document.querySelectorAll('#orders .order').forEach(order => {
    order.classList.remove('selected');
    order.setAttribute('aria-pressed', 'false');
  });
  element.classList.add('selected');
  element.setAttribute('aria-pressed', 'true');
  selected = orders[index];
  if (previousOrder !== selected) {
    $('review').value = '';
    $('shot').value = '';
  }
  $('form').classList.remove('hidden');
  $('done').classList.add('hidden');
  setMessage($('formMsg'), '');
  $('submit').disabled = false;
}

function renderOrders() {
  const container = $('orders');
  if (!orders.length) {
    container.innerHTML = '<div class="hint">এই ফোনে নতুন রিভিউ দেওয়ার মতো ডেলিভারি অর্ডার নেই। / No new delivered orders were found for this phone.</div>';
    return;
  }
  container.innerHTML = orders.map((order, index) => {
    const name = orderCustomerName(order) || 'নাম পাওয়া যায়নি / Name unavailable';
    return `<button type="button" class="order" data-index="${index}" aria-pressed="false"><span class="order-number">${escapeHtml(orderId(order))}</span><span class="order-name">${escapeHtml(name)}</span></button>`;
  }).join('');
  container.querySelectorAll('.order').forEach(element => {
    element.addEventListener('click', () => selectOrder(Number(element.dataset.index), element));
  });
}

async function find() {
  const normalized = normalize($('phone').value);
  if (!normalized) {
    setMessage($('msg'), 'সঠিক বাংলাদেশি ফোন নম্বর দিন। / Enter a valid Bangladesh phone number.');
    return;
  }

  const request = ++lookupSequence;
  const findButton = $('find');
  findButton.disabled = true;
  setMessage($('msg'), 'অর্ডার খোঁজা হচ্ছে… / Loading orders…');
  $('workspace').classList.add('hidden');
  $('form').classList.add('hidden');
  selected = null;

  try {
    const authenticated = await authReady;
    if (!authenticated) throw new Error('anonymous-auth-failed');
    const [allOrders, loadedClaims] = await Promise.all([
      loadOrdersOnce(),
      loadClaims(key(normalized))
    ]);
    if (request !== lookupSequence) return;

    phone = normalized;
    claims = loadedClaims;
    const usedOrders = new Set();
    claims.forEach(claim => {
      if (claim.orderKey) usedOrders.add(String(claim.orderKey));
      if (claim.orderId) usedOrders.add(String(claim.orderId));
    });
    orders = allOrders.filter(order => {
      const matchingPhone = normalize(orderPhone(order)) === normalized;
      return matchingPhone && !usedOrders.has(String(order.orderKey)) && !usedOrders.has(orderId(order));
    });

    renderClaims();
    renderOrders();
    $('workspace').classList.remove('hidden');
    setMessage($('msg'), '');
  } catch (error) {
    console.error('Could not load review orders', error);
    setMessage($('msg'), 'অর্ডার লোড করা যায়নি। একটু পরে আবার চেষ্টা করুন। / Could not load orders. Please try again.');
  } finally {
    if (request === lookupSequence) findButton.disabled = false;
  }
}

function readScreenshot(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('screenshot-read-failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('screenshot-decode-failed'));
      image.onload = () => {
        const scale = Math.min(1, 1200 / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function submit() {
  const message = $('formMsg');
  setMessage(message, '');
  if (!selected) {
    setMessage(message, 'আগে একটি অর্ডার নির্বাচন করুন। / Select an order first.');
    return;
  }

  const file = $('shot').files && $('shot').files[0];
  if (!file) {
    setMessage(message, 'Facebook review-এর স্ক্রিনশট আপলোড করুন। / Upload the review screenshot.');
    return;
  }
  if (!file.type.startsWith('image/')) {
    setMessage(message, 'শুধু ছবি আপলোড করুন। / Please upload an image.');
    return;
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    setMessage(message, 'স্ক্রিনশট ১.৫ MB-এর মধ্যে রাখুন। / Keep the screenshot under 1.5 MB.');
    return;
  }

  const submitButton = $('submit');
  submitButton.disabled = true;
  try {
    const screenshot = await readScreenshot(file);
    const note = $('review').value.trim();
    const claim = {
      orderKey: selected.orderKey,
      orderId: orderId(selected),
      normalizedCustomerPhone: phone,
      phoneKey: key(phone),
      customerName: orderCustomerName(selected),
      // The note is optional in the UI. Keep a short fallback for the current
      // Firebase validation rule, which requires reviewText to be a string.
      reviewText: note || DEFAULT_REVIEW_TEXT,
      screenshot,
      status: 'pending',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    const claimReference = db.ref('reviewClaims').push();
    await claimReference.set(claim);
    claims.push({ ...claim, key: claimReference.key });
    renderClaims();
    orders = orders.filter(order => order.orderKey !== selected.orderKey);
    renderOrders();
    $('done').classList.remove('hidden');
    setMessage(message, '');
  } catch (error) {
    console.error('Could not submit review claim', error);
    setMessage(message, 'রিভিউ জমা দেওয়া যায়নি। আবার চেষ্টা করুন। / Could not submit the review. Please try again.');
    submitButton.disabled = false;
  }
}

$('find').addEventListener('click', find);
$('submit').addEventListener('click', submit);
