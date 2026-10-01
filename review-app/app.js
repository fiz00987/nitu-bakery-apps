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
const SAFE_SCREENSHOT_MIME_TYPES = Object.freeze(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SCREENSHOT_PIXELS = 25 * 1000 * 1000;
const MAX_SCREENSHOT_DIMENSION = 10000;
const MAX_SCREENSHOT_DATA_URL_LENGTH = 4000000;
let submitInFlight = false;

function normalize(value) {
  let v = String(value || '').trim()
    .replace(/[০-৯]/g, digit => '০১২৩৪৫৬৭৮৯'.indexOf(digit))
    .replace(/[\s\-().]/g, '');
  if (/^\+8801[3-9]\d{8}$/.test(v)) return '0' + v.slice(4);
  if (/^8801[3-9]\d{8}$/.test(v)) return '0' + v.slice(3);
  if (/^01[3-9]\d{8}$/.test(v)) return v;
  return null;
}

function key(value) {
  return normalize(value) || String(value || '').replace(/\D/g, '');
}

function phoneVariants(value) {
  const normalized = normalize(value);
  if (!normalized) return key(value) ? [key(value)] : [];
  return [normalized, '+880' + normalized.slice(1), '880' + normalized.slice(1)];
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

// A claim is only for the exact Firebase order record it names.  Do not use
// orderId alone: legacy/order-import data can contain duplicate display IDs,
// while orderKey is the actual record identity.
function claimTargetsOrder(claim, order, expectedPhone) {
  if (!claim || !order) return false;
  const claimOrderKey = String(claim.orderKey || '');
  const actualOrderKey = String(order.orderKey || '');
  // Claims are tied to the exact Firebase order record. A display order ID is
  // not sufficient because imported/legacy data can reuse display IDs.
  if (!claimOrderKey || !actualOrderKey || claimOrderKey !== actualOrderKey) return false;
  const claimPhone = claim.phoneKey || claim.normalizedCustomerPhone || claim.customerPhone;
  if (expectedPhone && normalize(claimPhone) !== normalize(expectedPhone)) return false;
  return normalize(orderPhone(order)) === normalize(expectedPhone);
}

function claimMatchesOrder(claim, order, expectedPhone) {
  if (!claimTargetsOrder(claim, order, expectedPhone)) return false;
  const claimId = String(claim.orderId || '').trim();
  const actualId = orderId(order).trim();
  return !claimId || !actualId || claimId === actualId;
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

// Orders use several phone formats. Reusing this promise keeps repeated
// searches from issuing the same customer-scoped queries again.
function loadOrdersOnce(normalizedPhone) {
  // The hardened rules expose customer-scoped queries rather than the whole
  // orders collection. Check the common Bangladesh representations and merge
  // duplicate Firebase keys without weakening the client-side phone match.
  const phoneVariants = [
    normalizedPhone,
    '+880' + normalizedPhone.slice(1),
    '880' + normalizedPhone.slice(1)
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const cacheKey = phoneVariants.join('|');
  if (!allOrdersPromise || allOrdersPromise.cacheKey !== cacheKey) {
    const request = Promise.all(phoneVariants.map(value =>
      db.ref('orders').orderByChild('customerPhone').equalTo(value).once('value')
    )).then(snapshots => {
      const allOrders = [];
      const seen = new Set();
      snapshots.forEach(snapshot => snapshot.forEach(child => {
        if (seen.has(child.key)) return;
        seen.add(child.key);
        const value = child.val() || {};
        if (delivered(value)) allOrders.push({ ...value, orderKey: child.key });
      }));
      return allOrders;
    }).catch(error => {
      allOrdersPromise = null;
      throw error;
    });
    request.cacheKey = cacheKey;
    allOrdersPromise = request;
  }
  return allOrdersPromise;
}

function loadClaims(phoneValue) {
  return Promise.all(phoneVariants(phoneValue).map(value =>
    db.ref('reviewClaims').orderByChild('phoneKey').equalTo(value).once('value')
  )).then(snapshots => {
    const result = [];
    const seen = new Set();
    snapshots.forEach(snapshot => snapshot.forEach(child => {
      if (seen.has(child.key)) return;
      seen.add(child.key);
      result.push({ ...(child.val() || {}), key: child.key });
    }));
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
      loadOrdersOnce(normalized),
      loadClaims(key(normalized))
    ]);
    if (request !== lookupSequence) return;

    phone = normalized;
    claims = loadedClaims;
    orders = allOrders.filter(order => {
      const matchingPhone = normalize(orderPhone(order)) === normalized;
      // Every existing claim for this phone blocks another claim for the
      // same exact order, including rejected claims.  A malformed claim for
      // another order must not hide a valid order merely because its display
      // orderId happens to match.
      const alreadyClaimed = claims.some(claim => claimTargetsOrder(claim, order, normalized));
      return matchingPhone && !alreadyClaimed;
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
    if (!file || !SAFE_SCREENSHOT_MIME_TYPES.includes(String(file.type || '').toLowerCase()) ||
        !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_SCREENSHOT_BYTES) {
      reject(new Error('unsupported-screenshot'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('screenshot-read-failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('screenshot-decode-failed'));
      image.onload = () => {
        const sourceWidth = Number(image.naturalWidth || image.width);
        const sourceHeight = Number(image.naturalHeight || image.height);
        if (!sourceWidth || !sourceHeight || !Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) ||
            sourceWidth > MAX_SCREENSHOT_DIMENSION || sourceHeight > MAX_SCREENSHOT_DIMENSION ||
            sourceWidth * sourceHeight > MAX_SCREENSHOT_PIXELS) {
          reject(new Error('screenshot-dimensions-too-large'));
          return;
        }
        try {
          const scale = Math.min(1, 1200 / sourceWidth);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(sourceHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) throw new Error('canvas-unavailable');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          if (dataUrl.length > MAX_SCREENSHOT_DATA_URL_LENGTH ||
              !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/i.test(dataUrl)) throw new Error('screenshot-output-invalid');
          resolve(dataUrl);
        } catch (error) { reject(error); }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function claimKeyForOrder(orderKey) {
  const value = String(orderKey || '');
  let safe = '';
  for (const character of value) {
    safe += /[A-Za-z0-9_-]/.test(character)
      ? character
      : '_' + character.charCodeAt(0).toString(16) + '_';
  }
  return 'order-' + safe.slice(0, 700);
}

async function submit() {
  const message = $('formMsg');
  setMessage(message, '');
  if (submitInFlight) {
    setMessage(message, 'রিভিউ জমা হচ্ছে… / Your review is already being submitted…');
    return;
  }
  if (!selected) {
    setMessage(message, 'আগে একটি অর্ডার নির্বাচন করুন। / Select an order first.');
    return;
  }

  const file = $('shot').files && $('shot').files[0];
  if (!file) {
    setMessage(message, 'Facebook review-এর স্ক্রিনশট আপলোড করুন। / Upload the review screenshot.');
    return;
  }
  if (!SAFE_SCREENSHOT_MIME_TYPES.includes(String(file.type || '').toLowerCase())) {
    setMessage(message, 'JPEG, PNG, WEBP বা GIF ছবি দিন। / Please upload a JPEG, PNG, WEBP, or GIF image.');
    return;
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_SCREENSHOT_BYTES) {
    setMessage(message, 'স্ক্রিনশট ১.৫ MB-এর মধ্যে রাখুন। / Keep the screenshot under 1.5 MB.');
    return;
  }

  const submitButton = $('submit');
  submitInFlight = true;
  submitButton.disabled = true;
  try {
    // Re-read the selected order immediately before creating a claim.  The
    // initial list is only a convenience view and may be stale or tampered
    // with in the browser.
    // Re-query the selected phone and require the same Firebase key. This
    // avoids relying on arbitrary direct child reads under the hardened rules.
    const orderSnapshot = await db.ref('orders').orderByChild('customerPhone').equalTo(String(orderPhone(selected))).once('value');
    let freshOrder = null;
    orderSnapshot.forEach(child => {
      if (!freshOrder && child.key === String(selected.orderKey || '')) freshOrder = { ...(child.val() || {}), orderKey: child.key };
    });
    if (!freshOrder) throw new Error('order-not-found');
    if (orderId(selected).trim() !== orderId(freshOrder).trim()) throw new Error('order-mismatch');
    if (!delivered(freshOrder) || !claimMatchesOrder({ orderKey: freshOrder.orderKey, orderId: orderId(freshOrder), phoneKey: key(phone) }, freshOrder, phone)) {
      throw new Error('order-mismatch');
    }

    // Re-check the phone-indexed claims so a second tab/device cannot submit
    // the same order based on stale state.
    const latestClaims = await loadClaims(phone);
    if (latestClaims.some(claim => claimTargetsOrder(claim, freshOrder, phone))) {
      throw new Error('claim-already-exists');
    }

    const screenshot = await readScreenshot(file);
    if (screenshot.length > MAX_SCREENSHOT_DATA_URL_LENGTH || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/i.test(String(screenshot || ''))) {
      throw new Error('invalid-screenshot');
    }
    const note = $('review').value.trim();
    const claim = {
      orderKey: freshOrder.orderKey,
      orderId: orderId(freshOrder),
      normalizedCustomerPhone: phone,
      phoneKey: key(phone),
      customerPhone: orderPhone(freshOrder),
      customerName: orderCustomerName(freshOrder),
      // The note is optional in the UI. Keep a short fallback for the current
      // Firebase validation rule, which requires reviewText to be a string.
      reviewText: note || DEFAULT_REVIEW_TEXT,
      screenshot,
      status: 'pending',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    // Use a deterministic per-order key as a best-effort client-side
    // idempotency guard. Existing random-key claims are checked above for
    // backwards compatibility with older submissions. A direct write is used
    // instead of a transaction because customer reads are query-scoped by the
    // database rules.
    const claimReference = db.ref('reviewClaims').child(claimKeyForOrder(freshOrder.orderKey));
    try {
      await claimReference.set(claim);
    } catch (writeError) {
      // The database rule rejects a second write to the deterministic key.
      // Re-read the phone-scoped claims so a lost response or a second tab is
      // shown as already submitted instead of inviting a retry loop.
      const afterWriteClaims = await loadClaims(phone).catch(() => []);
      if (afterWriteClaims.some(value => claimTargetsOrder(value, freshOrder, phone))) {
        throw new Error('claim-already-exists');
      }
      throw writeError;
    }
    claims.push({ ...claim, key: claimReference.key });
    renderClaims();
    orders = orders.filter(order => order.orderKey !== freshOrder.orderKey);
    renderOrders();
    $('done').classList.remove('hidden');
    setMessage(message, '');
    submitInFlight = false;
  } catch (error) {
    console.error('Could not submit review claim', error);
    const duplicate = error && (error.message === 'claim-already-exists' || error.message === 'order-mismatch');
    setMessage(message, duplicate
      ? 'এই অর্ডারের জন্য রিভিউ ইতিমধ্যে জমা হয়েছে। / A review claim already exists for this order.'
      : 'রিভিউ জমা দেওয়া যায়নি। আবার চেষ্টা করুন। / Could not submit the review. Please try again.');
    submitInFlight = false;
    submitButton.disabled = false;
  }
}

$('find').addEventListener('click', find);
$('submit').addEventListener('click', submit);
