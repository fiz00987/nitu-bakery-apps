// ─── CAKE CONFIGURATIONS ────────────────────
const CAKE_CATEGORIES = [];

const WEIGHTS = [
  { value: '1-pound', label: '১ পাউন্ড', labelEn: '1 Pound', price: 0 },
  { value: '2-pound', label: '২ পাউন্ড', labelEn: '2 Pound', price: 0 },
  { value: '3-pound', label: '৩ পাউন্ড', labelEn: '3 Pound', price: 0 },
  { value: '5-pound', label: '৫ পাউন্ড', labelEn: '5 Pound', price: 0 }
];

const FLAVOURS = [
  { value: 'vanilla-sponge', label: 'ভ্যানিলা স্পঞ্জ', labelEn: 'Vanilla Sponge' },
  { value: 'chocolate-sponge', label: 'চক্লেট স্পঞ্জ', labelEn: 'Chocolate Sponge' },
  { value: 'double-layer-chocolate', label: 'ডাবল লেয়ারড চকলেট', labelEn: 'Double Layered Chocolate' },
  { value: 'black-forest', label: 'ব্ল্যাক ফরেস্ট', labelEn: 'Black Forest' },
  { value: 'white-forest', label: 'হোয়াইট ফরেস্ট', labelEn: 'White Forest' },
  { value: 'lemon', label: 'লেমন কেক', labelEn: 'Lemon Cake' },
  { value: 'orange', label: 'অরেঞ্জ কেক', labelEn: 'Orange Cake' },
  { value: 'strawberry', label: 'স্ট্রবেরি কেক', labelEn: 'Strawberry Cake' },
  { value: 'blueberry', label: 'ব্লুবেরি', labelEn: 'Blueberry' },
  { value: 'malai', label: 'মালাই কেক', labelEn: 'Malai Cake' },
  { value: 'butterscotch', label: 'বাটারস্কচ কেক', labelEn: 'Butterscotch Cake' },
  { value: 'special-vanilla', label: 'স্পেশাল ভ্যানিলা', labelEn: 'Special Vanilla' },
  { value: 'chocolate-mud', label: 'চকলেট মাডকেক', labelEn: 'Chocolate Mud Cake' },
  { value: 'red-velvet', label: 'রেড ভেলভেট', labelEn: 'Red Velvet' },
  { value: 'cream-cheese-fruit', label: 'ক্রিম চিজ ফ্রস্টিং উইথ ফ্রুট ফিলিং', labelEn: 'Cream Cheese Frosting with Fruit Filling' }
];

const TIME_SLOTS = [];

// ─── PAYMENT METHODS ────
const PAYMENT_METHODS = [
  { 
    id: 'bkash', 
    name: 'বিকাশ', 
    nameEn: 'bKash', 
    charges: 0.0182,
    number: '01521400475',
    regName: 'Nasrin Akter'
  },
  { 
    id: 'nagad', 
    name: 'নগদ', 
    nameEn: 'Nagad', 
    charges: 0.0149,
    number: '01521222376',          // ← UPDATED
    regName: 'Firoz Ahmed'          // ← UPDATED
  },
  {
    id: 'bank',
    name: 'ব্যাংক (NPSB)',
    nameEn: 'Bank (NPSB)',
    charges: 0,
    number: '0210165544851',
    regName: 'Sabrina Akter Bhuiyan'
  },
  {
    id: 'cod', 
    name: 'ক্যাশ অন ডেলিভারি', 
    nameEn: 'Cash on Delivery', 
    charges: 0, 
    number: null,
    regName: null
  }
];

const BKASH_RATE = 0.0182;
const NAGAD_RATE = 0.0149;

// ─── HELPER FUNCTIONS ───────────────────────
function getPaymentMethod(id) {
  return PAYMENT_METHODS.find(p => p.id === id) || null;
}

function getCategory(id) {
  return CAKE_CATEGORIES.find(c => c.id === id) || null;
}

function getWeight(value) {
  return WEIGHTS.find(w => w.value === value) || null;
}

function getFlavour(value) {
  return FLAVOURS.find(f => f.value === value) || null;
}

function getTimeSlot(value) {
  return TIME_SLOTS.find(t => t.value === value) || null;
}

function formatCurrency(amount) {
  return `৳${parseInt(amount).toLocaleString('bn-BD')}`;
}

function calculatePayment(basePrice, weightPrice, deliveryCharge, paymentMethodId) {
  const subtotal = basePrice + weightPrice + deliveryCharge;
  let charges = 0;
  let total = subtotal;

  if (paymentMethodId === 'bkash') {
    charges = Math.ceil(subtotal * BKASH_RATE);
    total = subtotal + charges;
  } else if (paymentMethodId === 'nagad') {
    charges = Math.ceil(subtotal * NAGAD_RATE);
    total = subtotal + charges;
  }

  return { subtotal, charges, total };
}

function validateBangladeshPhone(phone) {
  const clean = phone.replace(/[\s\-]/g, '');
  const regex = /^01[3-9]\d{8}$/;
  return regex.test(clean);
}

function formatPhoneForDisplay(phone) {
  const clean = phone.replace(/[\s\-]/g, '');
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return phone;
}

function generateOrderId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `NB${dateStr}${random}`;
}

function getBangladeshDate(date) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('bn-BD', options);
}

function getBangladeshTime(date) {
  return date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
}

// ─── SECURITY QUESTIONS (randomized) ────────
function getSecurityQuestion() {
  const questions = [
    () => { const a = Math.floor(Math.random() * 9) + 1, b = Math.floor(Math.random() * 9) + 1; return { q: `${a} + ${b} = ?`, a: a + b }; },
    () => { const a = Math.floor(Math.random() * 8) + 2, b = Math.floor(Math.random() * (a - 1)) + 1; return { q: `${a} - ${b} = ?`, a: a - b }; },
  ];
  return questions[Math.floor(Math.random() * questions.length)]();
}

// ─── DRAFT STORAGE ──────────────────────────
function saveDraft(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn('Could not save draft:', e); }
}

function loadDraft(key) {
  try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : null; } catch (e) { return null; }
}

function clearDraft(key) {
  try { localStorage.removeItem(key); } catch (e) { console.warn('Could not clear draft:', e); }
}

// ─── WHATSAPP MESSAGE ───────────────────────
function generateWhatsAppMessage(order) {
  let message = `🧁 *নিতুর বেকারি - নতুন অর্ডার*\n\n`;
  message += `📋 *অর্ডার আইডি:* ${order.orderId}\n`;
  message += `👤 *গ্রাহকের নাম:* ${order.customerName}\n`;
  message += `📱 *ফোন:* ${order.customerPhone}\n\n`;
  message += `🎂 *কেক বিবরণ:*\n`;
  message += `   • ধরন: ${order.categoryName}\n`;
  message += `   • স্বাদ: ${order.flavourName}\n`;
  message += `   • ওজন: ${order.weightLabel}\n`;
  if (order.size) message += `   • সাইজ: ${order.size}\n`;
  message += `\n✏️ *ডিজাইন:* ${order.writing || 'নেই'}\n`;
  if (order.designDescription) message += `📝 *বিবরণ:* ${order.designDescription}\n`;
  message += `\n🚚 *ডেলিভারি:*\n`;
  message += `   📅 তারিখ: ${order.deliveryDate}\n`;
  message += `   ⏰ সময়: ${order.timeSlotLabel}\n`;
  message += `   📍 ঠিকানা: ${order.deliveryAddress}\n`;
  if (order.surprise) message += `   🎁 সারপ্রাইজ: হ্যাঁ\n`;
  message += `\n💰 *মূল্য বিবরণ:*\n`;
  message += `   বেস মূল্য: ${formatCurrency(order.basePrice)}\n`;
  message += `   ওজন: ${formatCurrency(order.weightPrice)}\n`;
  message += `   ডেলিভারি: ${formatCurrency(order.deliveryCharge)}\n`;
  if (order.paymentCharges > 0) message += `   পেমেন্ট চার্জ: ${formatCurrency(order.paymentCharges)}\n`;
  message += `   *মোট: ${formatCurrency(order.total)}\n`;
  message += `💳 *প্রদান:* ${formatCurrency(order.advanceTotal)}\n`;
  if (order.dueAmount > 0) message += `⚠️ *বাকি:* ${formatCurrency(order.dueAmount)}\n`;
  message += `💳 *পদ্ধতি:* ${order.paymentMethodName}\n`;
  return encodeURIComponent(message);
}

function openWhatsApp(message) {
  const phone = '8801XXX-XXXXXX';
  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}

// ─── TRANSLATIONS ────────────────────────────
let currentLang = 'bn';

function toggleLanguage() {
  currentLang = currentLang === 'bn' ? 'en' : 'bn';
  document.documentElement.lang = currentLang;
  return currentLang;
}

function t(key) {
  if (currentLang === 'en' && translationsEn[key]) return translationsEn[key];
  return translations[key] || key;
}

const translations = {
  step1: 'ধাপ ১: কেক নির্বাচন করুন', step2: 'ধাপ ২: ডিজাইন বিবরণ',
  step3: 'ধাপ ৩: ডেলিভারি তথ্য', step4: 'ধাপ ৪: পেমেন্ট',
  step5: 'ধাপ ৫: নিশ্চিতকরণ', next: 'পরবর্তী', back: 'পিছনে',
  submit: 'জমা দিন', required: 'এই তথ্যটি প্রয়োজন',
  invalidPhone: 'সঠিক ফোন নম্বর দিন (০১XXX-XXXXXX)',
  selectCategory: 'কেকের ধরন নির্বাচন করুন', selectWeight: 'ওজন নির্বাচন করুন',
  selectFlavour: 'স্বাদ নির্বাচন করুন', writingHint: 'কাকে লিখবে কি?',
  noWriting: 'লিখবে না', designHint: 'কেমন দেখতে চান? বিবরণ দিন',
  uploadPhoto: 'রেফারেন্স ছবি পাঠান', deliveryDate: 'ডেলিভারি তারিখ',
  timeSlot: 'সময়', customerName: 'আপনার নাম', phone: 'ফোন নম্বর',
  address: 'সম্পূর্ণ ঠিকানা', surprise: 'সারপ্রাইজ ডেলিভারি?',
  paymentMethod: 'পেমেন্ট পদ্ধতি', orderReceived: 'আপনার অর্ডার নেওয়া হয়েছে!',
  confirmWhatsApp: 'আমরা WhatsApp এ নিশ্চিত করব!',
  sendWhatsApp: 'WhatsApp এ পাঠান', priceBreakdown: 'মূল্য বিবরণ',
  basePrice: 'বেস মূল্য', weightCharge: 'ওজন',
  deliveryCharge: 'ডেলিভারি', paymentCharges: 'পেমেন্ট চার্জ',
  total: 'মোট', sendPaymentRequest: 'পেমেন্ট রিকোয়েস্ট পাঠান',
  payNow: 'এখনই পে করুন', payCashOnDelivery: 'ক্যাশ অন ডেলিভারি',
  timeNotConfirmed: 'সময় নিশ্চিত নয়'
};

const translationsEn = {
  step1: 'Step 1: Select Cake', step2: 'Step 2: Design Details',
  step3: 'Step 3: Delivery Info', step4: 'Step 4: Payment',
  step5: 'Step 5: Confirmation', next: 'Next', back: 'Back',
  submit: 'Submit', required: 'This field is required',
  invalidPhone: 'Enter valid phone (01XXX-XXXXXX)',
  selectCategory: 'Select cake type', selectWeight: 'Select weight',
  selectFlavour: 'Select flavour', writingHint: 'What should be written on cake?',
  noWriting: 'No writing', designHint: 'Describe how you want it to look',
  uploadPhoto: 'Send reference photo', deliveryDate: 'Delivery Date',
  timeSlot: 'Time Slot', customerName: 'Your Name', phone: 'Phone Number',
  address: 'Full Address', surprise: 'Surprise Delivery?',
  paymentMethod: 'Payment Method', orderReceived: 'Your order has been received!',
  confirmWhatsApp: 'We will confirm on WhatsApp!',
  sendWhatsApp: 'Send on WhatsApp', priceBreakdown: 'Price Breakdown',
  basePrice: 'Base Price', weightCharge: 'Weight',
  deliveryCharge: 'Delivery', paymentCharges: 'Payment Charges',
  total: 'Total', sendPaymentRequest: 'Send Payment Request',
  payNow: 'Pay Now', payCashOnDelivery: 'Pay Cash on Delivery',
  timeNotConfirmed: 'Time not confirmed'
};