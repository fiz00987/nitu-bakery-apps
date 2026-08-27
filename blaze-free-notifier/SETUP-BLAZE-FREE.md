# 🔔 Notifications WITHOUT the Blaze plan (free forever)

Your Firebase project is on the **Spark (free)** plan, and Cloud
Functions scheduling requires **Blaze**, which you couldn't activate.
This folder removes that requirement completely:

```
blaze-free-notifier/
├── index.js                        ← the whole sender (~220 lines)
├── package.json / package-lock.json
└── .github/workflows/notifier.yml  ← free cron scheduler
```

It sends EXACTLY the same two notifications as the cloud functions:

| Notification | When | Text |
|---|---|---|
| 🎂 নতুন অর্ডার | within ~15 min of any new order | name · weight · flavour · amount |
| 🚚 আজকের ডেলিভারি (N) | every morning 09:00 Bangladesh time | list of customer names |

## How it works
A free GitHub Actions job wakes up **every 15 minutes**, reads `/orders`
from your Realtime Database using a service account, remembers which
orders it has already announced **inside your own database**
(`/notifierState`), and pushes via FCM to every device registered under
`/pushTokens`. A second job each morning builds the names summary.
State lives in YOUR db, so you can run it from any machine — nothing is
stored on GitHub except an encrypted key.

---

## Setup — 20 minutes, one time

### STEP 1 — Get the service account key
1. Firebase Console → ⚙️ **Project settings** → **Service accounts** tab
2. Click **"Generate new private key"** → a `.json` file downloads
3. Open it in Notepad, select-all, copy — keep this tab open

⚠️ Treat that JSON like a password. Never commit it anywhere.

### STEP 2 — Create the private GitHub repo
1. github.com → New repository → name e.g. `bakery-notifier`
2. Visibility: **Private** ✅ (important — hides your activity logs)
3. Do NOT initialise with README

### STEP 3 — Upload this folder's files
Upload ALL of these to the repo root (green "uploading an existing
file" link):
- `index.js`
- `package.json`
- `package-lock.json`
- `.github/workflows/notifier.yml`
  (on the upload dialog create the folder by typing
   `.github/workflows/` in the file-name box)

> Gotcha: the workflow only works at the REPO ROOT. If you'd rather push
> your entire bakery repo instead of just this folder, move a copy of
> `notifier.yml` to the root `.github/workflows/` there and add
> `working-directory: blaze-free-notifier` under `defaults.run:` in
> both jobs — but the clean private mini-repo is simpler.

### STEP 4 — Add the key as a secret
Repo page → ⚙️ **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**:
- Name: `FIREBASE_SERVICE_ACCOUNT_JSON`
- Secret: paste the ENTIRE JSON from Step 1
- Add secret ✅

### STEP 5 — First run + bootstrap
Repo → **Actions** tab → enable workflows if asked → click
**"Bakery notifier"** → **"Run workflow"** → Run.
Open the log: first run prints `🧷 Bootstrap: memorised 30 existing
orders; staying silent.` — correct behaviour. Press Run once more:
now it says `✔️ No new orders.` You're live.

### STEP 6 — Register your iPhone (if not done already)
Deploy/update `admin-app/index.html` (with your VAPID key), open the
app from the Home Screen icon, tap 🔔 once. Watch the Actions log or
Firebase Console → Realtime Database → `/pushTokens`: a device entry
must appear BEFORE any push can arrive.

### STEP 7 — Test end-to-end
Place a test order in the customer app → wait ≤15 min → 🎂 push lands
even with the admin app fully closed. Next morning at ~09:00 you get
the names summary (only if that day actually has deliveries).

---

## Cron timing notes
GitHub's scheduler can drift ±10 minutes and pauses repos inactive for
60 days — hence the 04:10 retry slot (the script de-dupes itself per
Bangladesh day), and the lightweight 15-minute polling cadence keeps
your repo permanently active.

## One shared limit to know about
FCM web push allows **~5000 messages/day per token from Google's free
tier on ANY hosting** (this includes Spark projects sending from GitHub,
and Blaze functions alike). A bakery will never come close; dedupe logic
makes double-sends impossible anyway.

---

## Why couldn't Blaze be activated? (fix checklist)
Usually one of these — worth retrying AFTER the notifier above is live,
since scheduled functions are still the more elegant long-term option:

1. **No payment card / card refused** — Blaze needs a card Stripe can
   charge; Bangladeshi dual-currency (USD) Visa/Mastercard work,
   local-taka-only cards often decline. Also try: remove + re-add the
   card, clear browser cache, different browser.
2. **Wrong window/location combo** — you must be signed in as the
   project OWNER, complete EVERY Blaze step in ONE session, same
   browser, no incognito (cookies are required mid-flow).
3. **Google account age/security flags** — very new accounts sometimes
   get auto-refused at the billing step. Let the account age a few
   weeks, secure it with 2FA, then retry.
4. **Region/target-country issues** — billing profiles for some regions
   fail silently; check console.cloud.google.com/billing directly — if
   a billing account exists/creatable there, link the Firebase project
   to it (Project settings → Usage & billing).
5. **Ad-blockers / DNS filters** (e.g. pi-hole) break the Stripe frame
   — disable for the duration of signup.

Error text commonly seen: *"Failed to upgrade project"* or an endless
spinner after the card step → retry steps 2 & 4, they fix most cases.

## If you later DO get Blaze
Keep THIS notifier running anyway, or deploy `cloud-functions/index.js`
and delete the GitHub Actions workflows + the `/notifierState` node —
both systems never run simultaneously (dedupe keys differ), so turning
one off before the other goes on avoids duplicate pushes.

---

## 📱 Android (including your hand-made APK)

Whether closed-app push works on Android depends entirely on WHAT the
APK actually is:

| You use the admin app as… | Order arrives while app is OPEN | App fully CLOSED |
|---|---|---|
| Chrome tab or Chrome "Add to Home screen" PWA | ✅ banner + sound | ✅ FCM push |
| APK built with **PWABuilder / Bubblewrap (TWA)** | ✅ | ✅ |
| Typical online **"Website→APK" WebView converter** | ✅ banner + sound | ❌ almost never — Android WebView doesn't deliver web push when the activity is dead |
| Converter WITH its own paid push add-on | ✅ | Maybe — but that flows through THEIR dashboard/SDK, not this system |

### Which one is YOUR apk? (60-second check)
1. Deploy the updated `admin-app/index.html`, open the APK, tap 🔔.
2. Firebase Console → Realtime Database → `/pushTokens`.
3. Read the `platform` field of the new entry — the app tags it automatically:
   - `android-webview` → the ❌ row above; APK-open banners work, closed-app push won't. Use the Chrome route below for guaranteed push.
   - `android-browser` / `android-standalone` → full ✅ — closed-app push will arrive via the GitHub notifier.
   - `desktop`, `ios-*` → other devices, already covered.

### Guaranteed closed-app push on Android (two options)
- **Option A (zero work, recommended):** Chrome → open the admin URL →
  ⋮ menu → *Add to Home screen* → open from the icon → tap 🔔 once.
  Identical feel to an app, full push support, auto-updates.
- **Option B (true native-feel APK):** rebuild via
  [pwabuilder.com](https://www.pwabuilder.com) with your deployed
  admin-app URL → download the signed Android (TWA) package. TWAs use
  the real Chrome engine, so THIS push system keeps working unchanged;
  host `assetlinks.json` at the URL it prints during packaging for
  verified install prompts.

### The safety net that ALWAYS works, APK or not
While ANY version of the admin app is open (even WebView APKs), the app
itself listens to the database directly — new orders pop the red banner,
play the beep and ring the 🔔 badge instantly. Only the "phone asleep,
app closed" case needs real web push (GitHub notifier + Chrome/TWA).

