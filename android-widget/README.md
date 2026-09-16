# 🎂 Nitu Bakery — Home-Screen Widget (native Android)

A tiny native Android app (~870 KB) whose only job is a **real home-screen
widget** showing today's deliveries and the latest orders. No frameworks,
no Firebase SDK, no configuration — it just reads the same tiny
`/widgetFeed.json` summary that your other apps keep updated.

## Install (no Play Store needed)

1. Download `dist/NituBakeryWidget.apk` onto your Android phone
   (or open this repo on the phone and grab it).
2. Tap the file → allow "install unknown apps" once → install.
3. Home screen → long-press empty area → **Widgets** → find
   **Nitu Bakery অর্ডার** → drag it out. Resize freely.
4. Done. Tap ⟳ to refresh instantly; it also refreshes itself
   every 30 minutes.

The launcher screen has a **"এখনই রিফ্রেশ করুন"** button and setup hints.

## What the widget shows

- 🎂 আজকের ডেলিভারি: N + customer names
- Latest orders (up to 4 rows): name · total · item · date/time ·
  ⚠️ বাকি (red) or ✅ পরিশোধিত (green)
- Last-updated time; whole widget taps through to the admin app

## Build it yourself

The project needs **no third-party dependencies** — only the Android SDK
that Android Studio already installed on the build machine.

```powershell
cd android-widget
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
& "$env:USERPROFILE\.gradle\wrapper\dists\gradle-9.5.0-bin\<hash>\gradle-9.5.0\bin\gradle.bat" :app:assembleDebug
# → app\build\outputs\apk\debug\app-debug.apk
```

Or simply open this folder in Android Studio and press Run ▶.

## Configuration

Both URLs live in `app/src/main/res/values/strings.xml`:

- `feed_url` — the `/widgetFeed.json` endpoint (already set to your DB)
- `admin_url` — where tapping the widget opens (set to your admin app;
  edit if your hosting address differs)

## Refresh behaviour (honest limits)

- Auto-refresh every 30 minutes (Android's minimum for widgets),
  plus instant refresh on tap / install / app update.
- For **instant** new-order alerts, keep the **ntfy notification
  channel** enabled (see `NOTIFICATIONS-SETUP.md`) — the widget is the
  at-a-glance view, not the alarm.

## Privacy

The widget displays only names, items, amounts, dates and status —
never phone numbers, addresses or photos (the feed never contains them).
