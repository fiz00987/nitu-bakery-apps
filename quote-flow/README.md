# Quote Flow — standalone review build

Custom, admin-tailored order links: **you** fix the flavour, weight, price and
delivery charge — the customer gets a link where those are locked, and can only
fill in their own info (name, phone, address, date/time, payment) and submit.

Completely separate from `admin-app` / `customer-multi` — nothing else in the
repo was modified. Review first; merging decisions later.

## Files

| File | Who | What |
|---|---|---|
| `admin.html` + `admin.js` | you | Login (same email/password as admin-app) → build quote → one click creates a token + link + ready-made WhatsApp message. Live list of all quotes with status; cancel any quote. |
| `quote.html` + `quote.js` | customer | Opens via `?quote=TOKEN`. Shows the locked quote (flavour/weight/writing/price/delivery/total) and the editable form. Submits a real order. |
| `firebase-config.js` | — | Copy of the shared Firebase project config. |

## How it works

1. You fill: flavour(s), weight(s), writing, **cake price (total)**, **delivery
   charge**, delivery/pickup, expiry (24h–7d), optional name/phone (pre-fills
   the customer form but stays editable there).
2. `quotes/<TOKEN>` is created (status `open`) and you get:
   - the link `<base>/quote.html?quote=TOKEN`
   - a ready Bangla WhatsApp message (copy or send directly).
3. Customer opens the link → price & cake are **locked**; they fill name,
   phone, alt phone, address, date, time, receiver, writing, payment method,
   advance amount, TrxID, screenshot, notes → submit.
4. An order is pushed to `orders` with the **same schema as customer-multi**
   (including `quoteToken`), so it appears in your existing admin dashboard
   like any online order. The quote flips to `used` (one-time use).

## Why the locked price can't be tampered with

The customer page has **no price fields at all**. At submit it re-reads
`quotes/<TOKEN>` from Firebase and takes price/delivery/flavour/weight from the
server copy; if the quote was used, cancelled, expired, or its price changed
since the page loaded, submission is blocked. The link token (8 random chars)
is the only "login" the customer needs.

## Test it locally

```
cd quote-flow
python -m http.server 8090
# admin:  http://localhost:8090/admin.html   (log in, create a quote)
# open the generated link (it will point at http://localhost:8090/quote.html?...)
```

Firebase Auth + Realtime DB are the live project — a test quote you create is
real. Cancel it afterwards (✕ বাতিল) or let it expire.

## Notes / honest caveats

- Screenshot upload is mandatory (same as customer-multi) and compressed to a
  small JPEG data URL, stored on the order as `payShot`.
- The customer's advance amount is editable (they may pay less than full);
  gateway charge (bKash 1.82% / Nagad 1.49%) is computed on what they send,
  matching your existing rules.
- No ntfy push from this page (the dashboard's realtime listener already
  notifies you of new orders).
- The integrated quote redemption that already existed on this branch in
  `customer-multi` uses the same `quotes/` schema — a link created here also
  works there, and vice versa. Keep using whichever page you prefer.
