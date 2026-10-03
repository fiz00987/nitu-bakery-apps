# Admin price integrity investigation — 2026-10-03

## Report and verification boundary

Reported: agreed cake price ৳2,500; customer sent ৳2,400; admin displayed
৳1,900. The affected order ID/record has not yet been supplied. The owner
reports that they have already corrected it in the admin app. This investigation
has not read or modified production orders. The cases below are reproducible
code defects, not proof of which one affected that order.

## Confirmed defects

1. **Ambiguous total used as cake price.** Customer submissions store
   `cakePrice` separately and put cake + delivery in `total`. Admin saves use
   cake-only `total`. Previously, the display used `cakePrice` only if
   `cakePrice + current delivery charge === total`; otherwise it used `total`.
   Thus `{cakePrice: 2500, total: 1900}` displayed 1900, and changing just
   delivery could change the displayed cake price. Opening and saving an edit
   could then copy the wrong display into all price aliases.
2. **Price-only live changes did not repaint.** The render fingerprint watched
   the ID, timestamp, status, paid amount and delivery status, but no price
   fields. A writer that changed price without updating `updatedAt` left an
   old price on screen despite the new value having arrived from Firebase.
3. **Sales deducted delivery twice.** `earnOf` subtracted delivery and gateway
   fees from `total`, including when that total was already cake-only. For
   example, a 2500 cake-only total and 600 delivery produced 1900 in sales.
4. **Stale forms could overwrite a newer price.** A form opened on one device
   kept its old price after another device edited the order; saving unrelated
   details rewrote the full order without checking its revision.
5. **Explicit payment corrections were overridden.** The delivered-order
   healer/save path could replace an admin-entered short payment with the full
   cake price. Also, an explicit zero advance fell back to a stale `paid` alias.

## Changes

- Use the explicit, valid `cakePrice` (including zero), falling back to `total`
  only for records without a usable cake price. Do not infer price from payment
  or reverse a legitimate discount using `originalCakePrice`.
- Show a discrepancy notice for conflicting price fields and a source note
  for unquoted customer-entered prices. The normal customer form still accepts
  a typed price; the existing quotation-link flow supplies a locked price.
- Use the same cake-only value in cards, the edit form, copies, sales,
  completed-order database and daily popup.
- Include money fields in live update detection.
- Save existing orders with a Firebase transaction comparing the normalized
  record against the revision captured when the edit form opened. Abort if
  the record changed or was deleted; retain the unsaved form for review.
- Keep intentional admin payment/price corrections authoritative, including
  on delivered orders. The existing explicit "mark delivered" shortcut still
  settles an order; it is not a payment-reconciliation mechanism.
- Log explicit price changes and reconciliation of conflicting price aliases.
- Bump the admin script URL and service-worker cache version.

## Tests

Use Node 24.15+ (the installed test dependency requires a recent Node release):

```sh
npm ci
npm test
node --check admin-app/app.js
node --check admin-app/sw.js
git diff --check
```

Tests load the real admin HTML/JavaScript in jsdom with in-memory Firebase
stubs. They exercise rendered amounts, form edits, audit records, live updates,
transaction conflicts/deletion, discounts, legacy totals, delivery charges,
gateway fees and underpayment corrections. They make no production requests.

## Verify the actual incident

Locate the affected order using its order ID, then inspect an export of:

- `cakePrice`, `total`, `basePrice`, `subtotal`, `originalCakePrice`
- `advance`, `advanceTotal`, `paid`, `dueAmount`, gateway charge fields
- `deliveryCharge`, `deliveryAmount`, `deliveryPaid`
- `source`, `quoteToken`, `reviewRewardId`, `reviewDiscount`
- `createdAt`, `updatedAt`, `adminEditedFields`, `adminEditLog`

Compare the record and any linked quote with the agreed price in the customer
conversation. If every stored price is 1900, a display fix cannot recover an
unrecorded agreement of 2500. Make an explicit, audited correction only after
identifying the order and confirming the agreed amount. For a cake-only price
of 2500 and cake-only payment of 2400, the cake balance is 100; delivery and
gateway fees must be considered separately.

## Release

Local edits do not update Firebase Hosting. Release the admin target with an
authenticated Firebase CLI from the repository root:

```sh
firebase deploy --only hosting:admin --project nitusbakingplanv2
```

Then reopen the admin app online on each device. Existing records are not
automatically repriced by this patch. Customer form/quote verification and
any correction of the reported order are separate from the hosting release.
