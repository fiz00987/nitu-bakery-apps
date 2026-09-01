# 🧩 Home-Screen Widget Setup (Android & iOS)

## ✅ Android — TWO native options (both built & ready)

**Option 1 — Nitu Bakery Manager (recommended, replaces your PWABuilder APK):**
`admin-apk/dist/NituBakeryManager.apk` (~1.3 MB)
- Opens your live admin dashboard in the real Chrome engine (closed-app
  web push works — tap 🔔 once inside, then allow notifications)
- **Includes the home-screen widget** (same as Option 2)
- Full details: `admin-apk/README.md`

**Option 2 — Widget only:** `android-widget/dist/NituBakeryWidget.apk` (~870 KB)

Both: copy the APK to the phone → tap → allow "install unknown apps" once →
Install → Home screen → long-press → **Widgets** → **Nitu Bakery অর্ডার** →
drag out → resize freely. Tap ⟳ refreshes instantly; auto-refresh every
30 minutes. Shows 🎂 আজকের ডেলিভারি: N + names + latest orders with
⚠️ বাকি (red) / ✅ পরিশোধিত (green).

---

## 🍎 iOS — Scriptable (free, ~2 minutes)

A true native iOS widget needs an Apple developer account + Xcode, so the
practical route is the **Scriptable** app rendering a real widget from a
paste-ready script.

**Where the script is:** [`widgets/ios-widget.js`](widgets/ios-widget.js)
in this repo —
raw link: `https://raw.githubusercontent.com/fiz00987/nitu-bakery-apps/main/widgets/ios-widget.js`

1. iPhone → install **Scriptable** (free, App Store).
2. Open the raw link above in Safari → select all → **Copy**
   (or GitHub page → tap *Raw* → copy).
3. Scriptable → **`+`** → paste → **Done** → name it "Nitu Bakery".
4. Tap **▶** once to test. You should see 🎂 আজকের ডেলিভারি + orders.
5. Home screen → long-press → **`+`** → **Scriptable** → Medium or Large.
6. Tap the widget → **Script** = "Nitu Bakery" → done.
   Refreshes automatically every ~5–15 min; tapping it re-runs anytime.

---

## The data feed (already built into your apps ✅)

Both apps now maintain a tiny summary node in your database:

```
https://nitusbakingplanv2-default-rtdb.asia-southeast1.firebasedatabase.app/widgetFeed.json
```

Open that URL in any browser to see the live data:

```json
{
  "updatedAt": 1788234000000,
  "today": { "date": "2026-09-01", "count": 3, "names": ["রিনা", "ফিরোজ", "সাবরিনা"] },
  "latest": [
    { "n": "রিনা", "i": "2 pound ভ্যানিলা স্পঞ্জ", "t": 1500, "d": 750,
      "dt": "2026-09-01", "tm": "3.00 PM", "st": "confirmed" },
    ...
  ]
}
```

Field meanings: `n` name · `i` cake item · `t` total · `d` due ·
`dt` delivery date · `tm` delivery time · `st` status.

**Privacy:** the feed contains ONLY names, item text, amounts, dates
and status — **never** phone numbers, addresses or photos. The database
is already readable without login (your customer "previous orders"
feature needs that), so treat this URL like semi-public. Keep the feed
URL out of public posts.

**Freshness:** the admin app rewrites it in real time whenever it is
open; the GitHub backup notifier rewrites it on every run (≤15 min)
while the app is closed.

> If the URL shows `permission denied`, your database rules don't allow
> public read. Fix in Firebase Console → Realtime Database → Rules, add:
> ```json
> "widgetFeed": { ".read": true }
> ```
> inside the top-level rules object.

---

## iOS setup details (same as above, in depth)

1. Install **Scriptable** from the App Store.
2. Open this repo's `widgets/ios-widget.js`, copy ALL of it.
3. Scriptable → **+** → paste → tap **▶** once to test.
4. Home screen → long-press empty area → **+** → Scriptable → pick
   **Medium** or **Large** → tap the widget → Script → select yours.
5. Done. The widget shows today's delivery count + names and the
   latest orders with due/paid state.

---

## Android alternative — KWGT Pro (only if you prefer it over the APK)

1. Install **KWGT** and buy **KWGT Pro** (the web-data feature needs Pro).
2. Home screen → long-press → Widgets → **Kustom Widget** → drop a
   4×2 (or 4×3) widget → tap it → open the editor.
3. In the editor add a **Web / HTTP data source** (item or global,
   naming differs slightly between KWGT versions — look for "Web" or
   an HTTP option):
   - URL: the `widgetFeed.json` URL above
   - Refresh interval: 15 minutes (or more)
4. Add **Text** items bound to the JSON fields, e.g.:
   - Header: `আজকের ডেলিভারি: $web("today/count")$` — use KWGT's JSON
     path syntax shown in its picker (`today.count`, `latest.0.n`,
     `latest.0.t`, …).
   - One text row per order: `$web("latest.0.n")$ — ৳$web("latest.0.t")$`
   - Due in red: `if($web("latest.0.d")$ > 0, "বাকি ৳$web("latest.0.d")$", "পরিশোধিত ✅")`
5. Save. Long-press → resize freely.

If your KWGT version's web feature differs, search "KWGT fetch JSON"
for a walkthrough — the feed URL and fields above are all it needs.

---

## Future upgrade: a true native iOS widget

For **iOS**, a native WidgetKit widget needs an Apple developer account
($99/yr) + Xcode on a Mac — realistically the Scriptable widget above is
the practical iOS route. (The **Android** native widget is already done —
see the top of this page.) If you ever want a polished iOS app with a
baked-in widget, say the word and we'll plan it.

---

## Already-working "widget-lite" (no extra apps)

- The **admin app's icon badge** shows the live pending-order count on
  Android/desktop (iOS Safari doesn't support web badges).
- The **ntfy app** can pin a persistent notification with the latest
  alert, and notifications themselves land on the lock screen in
  seconds (see `NOTIFICATIONS-SETUP.md`).
