# 🎂 Nitu Bakery Manager — native Android app

A small native Android app (~1.3 MB) that combines **two things in one**:

1. **The admin dashboard, opened properly** — tapping the app icon launches
   your live admin dashboard (`fiz00987.github.io/nitu-bakery-apps/admin-app/`)
   inside a **Chrome Custom Tab backed by a warm Chrome session**. This is the
   REAL Chrome engine — which is exactly what keeps **closed-app web push
   working** (a WebView wrapper would break it).
2. **The home-screen widget** — today's deliveries + latest orders
   (same widget as the standalone `android-widget` app).

## Install

1. Copy `dist/NituBakeryManager.apk` to your phone → tap → allow
   "install unknown apps" once → Install.
2. Open the app → the dashboard opens. **Tap 🔔 once inside the dashboard**
   and allow notifications — after that, order notifications arrive even
   when the app is fully closed.
3. Home screen → long-press → **Widgets** → **Nitu Bakery অর্ডার** → drag out.

> If you previously installed the standalone `NituBakeryWidget.apk`, you can
> uninstall it — this app includes the same widget.

## Why this is better than a PWABuilder/WebView APK

| | WebView "APK maker" | This app |
|---|---|---|
| Engine | Android WebView (frozen, weak) | **Real Chrome** |
| Closed-app push | ❌ almost never | ✅ via Chrome web push (tap 🔔 once) |
| Battery/perf | heavy | light |
| Widget | ❌ | ✅ included |

## Honest notes

- The dashboard opens in a Chrome Custom Tab, so a slim URL bar may be
  visible. Removing it entirely requires a **custom domain** (GitHub Pages
  project sites can't host Digital Asset Links at the domain root). The
  push behaviour is identical either way.
- The **ntfy app remains the fastest channel** (seconds). This app's push
  is the FCM/web-push backup — both are described in
  `../NOTIFICATIONS-SETUP.md`.

## Configuration

URLs live in `app/src/main/res/values/strings.xml`:
- `admin_url` — the dashboard (set to your GitHub Pages URL)
- `feed_url` — the `/widgetFeed.json` endpoint

## Build

```powershell
cd admin-apk
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
& "$env:USERPROFILE\.gradle\wrapper\dists\gradle-9.5.0-bin\<hash>\gradle-9.5.0\bin\gradle.bat" :app:assembleDebug
# → app\build\outputs\apk\debug\app-debug.apk
```

Or open this folder in Android Studio and press Run ▶.
Only dependency: `androidx.browser:browser:1.8.0` (Google Maven).
