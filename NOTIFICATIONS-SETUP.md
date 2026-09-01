# 🔔 Notification Setup — No Telegram Needed (2026 update)

Telegram has been **removed** from this project (the old bot token was
public in the repo — **revoke it**: open @BotFather in Telegram →
`/mybots` → the bakery bot → *Delete Bot*).

The new system has **three independent channels**. Any one of them alone
is enough; together they make a missed order nearly impossible.

---

## Channel 1 — ntfy push (PRIMARY — arrives in seconds, app closed OK) ✅

**ntfy.sh** is a free, open-source push service. No account, no phone
number, nothing personal — the notification goes to the ntfy app on your
phone, not to any chat.

### One-time setup (~3 minutes per phone)

1. Install **ntfy** from the Play Store (Android) or App Store (iPhone).
2. Open the app → **+ Subscribe** → type this exact topic:

   ```
   nitu-bakery-Kv7Qm3Xp9TwR
   ```

   (Leave the server as `ntfy.sh`.) Tap Subscribe.
3. Send yourself a test:
   - press the 🔔 **test** in ntfy's subscription menu, or
   - place a test order in the customer app.
4. **Android only (important):** Android Settings → Apps → ntfy →
   Battery → **Unrestricted / no battery optimization**, and allow
   notifications. This guarantees delivery even when the phone sleeps.
5. On iPhone: notifications arrive instantly for ntfy.sh topics
   (delivered through Apple's push service). Enable Lock Screen alerts.

That's it. From now on, **every order placed in the customer app rings
your phone in a few seconds** — with name, weight, flavour, total,
advance and due — even with every app closed.

### How it works
The customer's own browser POSTs the order alert to `ntfy.sh` the moment
they press submit (see `fireNtfyAlert` in `customer-app/app.js`). The
admin app (when open) and the GitHub backup notifier push to the same
topic as extra safety nets. The topic name lives in
`customer-app/notify-config.json` and `admin-app/notify-config.json`.

### Want a different private topic?
Pick any long random name, then update `ntfyTopic` in BOTH
`notify-config.json` files and subscribe to the new topic in the ntfy
app. Anyone who knows the topic name can *send* you notifications
(worst case: a fake alert — they can never read your data), so keep it
random and don't share it.

---

## Channel 2 — FCM web-push (BACKUP — works with the app installed)

The old system, kept as a backup: installed PWA / Chrome receives
🎂 new-order pushes and the 09:00 daily summary via Firebase Cloud
Messaging (GitHub Actions poller, every ≤15 min, free — no Blaze).
Keep your devices registered under `/pushTokens` (tap 🔔 once in the
admin app). Works on Android and installed-iPhone-PWA; a plain
WebView-APK wrapper will NOT receive closed-app push — use the Chrome
"Add to Home screen" route or a PWABuilder TWA.

---

## Channel 3 — In-app alerts (while the app is open)

Red banner + beep + bell + auto popups fire instantly from the live
Firebase listener whenever the admin app is open.

---

## 📱 "Widget" — what your home screen can show

A true Android widget isn't possible for a web app, but two things come
close and are now built in:

1. **App-icon badge (widget-lite):** the admin app's icon on your home
   screen shows the number of pending orders (`navigator.setAppBadge`),
   live while the app runs and whenever a background push arrives.
2. **ntfy persistent notification:** in the ntfy app you can pin the
   bakery subscription as a permanent notification, or add a
   **subscription shortcut** to the home screen (long-press the topic →
   add shortcut) that shows the latest alerts at a glance.

For a real data widget later, the practical path is wrapping the admin
app as a TWA with PWABuilder and adding a native widget — say the word
and we'll plan it.

---

## GitHub backup notifier — enable the ntfy channel

If you already run `blaze-free-notifier` in its private repo:

1. Repo → Settings → Secrets → **New repository secret**
   - Name: `NTFY_TOPIC`
   - Value: `nitu-bakery-Kv7Qm3Xp9TwR`
2. Push the updated `blaze-free-notifier/index.js` + `notifier.yml`
   there (or re-upload the files).

New-order alerts and the morning summary will then ALSO arrive via ntfy
if the primary bridge ever fails.
