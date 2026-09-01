# 🧩 Home-Screen Widget Setup (Android & iOS)

## The honest platform reality first

A **true native widget** (Android AppWidget / iOS WidgetKit) can only be
created by a **native app** — a web app (PWA) physically cannot place
one. That's an Apple/Google platform limit, not a limitation of this
project.

But you can still get a **real, resizable home-screen widget** that
shows today's orders and the latest orders, using free/cheap
"widget-maker" apps that fetch a small data feed:

| Platform | Widget maker | Cost |
|---|---|---|
| **iOS** | [Scriptable](https://apps.apple.com/app/scriptable/id1405500899) | Free |
| **Android** | [KWGT – Kustom Widget](https://play.google.com/store/apps/details?id=org.kustom.widget) (Pro needed for web data) | ~৳500 one-time |

Both render **real widgets** — place them anywhere, resize them, stack
or swipe between several. iOS widgets refresh every ~5–15 minutes;
Android KWGT refresh interval is configurable (15+ minutes recommended).

---

## Step 1 — The data feed (already built into your apps ✅)

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

## Step 2A — iOS (Scriptable, free)

1. Install **Scriptable** from the App Store.
2. Open this repo's `widgets/ios-widget.js`, copy ALL of it.
3. Scriptable → **+** → paste → tap **▶** once to test.
4. Home screen → long-press empty area → **+** → Scriptable → pick
   **Medium** or **Large** → tap the widget → Script → select yours.
5. Done. The widget shows today's delivery count + names and the
   latest orders with due/paid state.

---

## Step 2B — Android (KWGT Pro)

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

## Want a TRUE native widget (no third-party app)?

The next step up is a small **native Android app (APK)** whose only job
is an AppWidget that reads `widgetFeed.json` — it would look/feel like
any Play-Store widget and could have "tap to refresh". That's real
Android code I can write for you, but you (or I, guided) would need to
compile it in Android Studio once. For iOS a native widget needs an
Apple developer account + Xcode — realistically Scriptable is the
practical route.

Say the word and we'll plan the APK.

---

## Already-working "widget-lite" (no extra apps)

- The **admin app's icon badge** shows the live pending-order count on
  Android/desktop (iOS Safari doesn't support web badges).
- The **ntfy app** can pin a persistent notification with the latest
  alert, and notifications themselves land on the lock screen in
  seconds (see `NOTIFICATIONS-SETUP.md`).
