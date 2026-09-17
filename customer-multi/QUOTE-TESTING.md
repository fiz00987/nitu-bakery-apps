# QUOTE-TESTING (customer-multi)

Local dev server:
```
cd customer-multi
python -m http.server 8080
# open http://localhost:8080/
```

Faking a quote (local auth may differ, so write via console):
1. Open DevTools console on the page (after Firebase init).
2. Write a test quote:
```js
await db.ref('quotes/NBQ8K2X4').set({
  cakes: [{ weight: '2 pound', weightLabel: '2 pound', flavour: 'black-forest', flavourName: 'ব্ল্যাক ফরেস্ট', writing: '', deliveryCharge: 60 }],
  cakePrice: 1200, deliveryCharge: 60, total: 1200,
  fulfilment: 'delivery', customer: 'test',
  status: 'open', expiresAt: Date.now() + 86400000,
  createdAt: Date.now(), createdBy: 'admin@test'
});
```
3. Open `http://localhost:8080/?quote=NBQ8K2X4` → banner
`এডমিনের দেওয়া কোটেশন: ... — মোট ৳1200 (ডেলিভারি চার্জ ৳60 সহ)`,
order-mode toggle + cake-count picker hidden, weight/flavour/cake-price/
delivery-charge/fulfilment disabled with grey 🔒 style.
4. Invalid test: `?quote=WRONG01` → red banner + toast
`লিংকটি মেয়াদোত্তীর্ণ বা ভুল`, normal mode.
5. Submit test: fill editable fields (name/phone/address/receiver/date/time/
payment/TRX/screenshot/notes), submit → order pushed with `quoteToken`,
`quotes/NBQ8K2X4` becomes `{status:'used', usedAt, usedOrderId}`.
6. Re-submit same link → blocked with `কোটেশনটি আর কার্যকর নেই`.
7. Tamper test: enable a locked field in DevTools, change price → submit
blocked with `কেকের মূল্য মিলছে না`.

Assumptions: quote schema `{cakes[], cakePrice, deliveryCharge, total,
fulfilment, status, expiresAt}` (matches task spec + admin quote builder).
Only `customer-multi/app.js` + `index.html` touched; no commit/push.
