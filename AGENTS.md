# Agent instructions

## Repository shape

- This is a multi-site, vanilla HTML/CSS/JavaScript Firebase repository. There is no root bundler or build step; the root `package.json` exposes only `npm test`.
- Hosting targets are defined in `firebase.json` and map as follows: `admin` → `admin-app`, `customer` → `customer-app`, `customerMulti` → `customer-multi`, `review`/`reviewShort` → `review-app`, and `website` → `website`.
- The main browser entrypoints are each app's `index.html` plus its local `app.js`/`utils.js`; do not assume a shared framework or module build exists.
- `cloud-functions/` is a separate Firebase Functions package targeting Node 18. `blaze-free-notifier/` is a separate Node 18+ notifier with its own workflow; neither is covered by the root test command.

## Install and test

- Use Node 24.15+ for the root test suite, then install the locked dependencies with `npm ci`.
- Run the full suite with `npm test` (`node --test tests/*.test.cjs`). Run one focused file with `node --test tests/<file>.test.cjs`, for example `node --test tests/admin-pricing.test.cjs`.
- Before handing off admin changes, run `node --check admin-app/app.js`, `node --check admin-app/sw.js`, and `git diff --check` in addition to the relevant tests.
- Tests load the real HTML and JavaScript in jsdom with in-memory Firebase stubs. They must not authenticate to or write to the production database.
- There is no configured root lint, formatter, typecheck, or build command; do not invent `npm run build` or equivalent.

## Admin notebook and cache gotchas

- The admin notebook intentionally has two surfaces: `basic-notepad.js` and the existing advanced `notepad.js`, wired by `admin-app/app.js` and loaded in that order from `admin-app/index.html`.
- Both notebook modes share `shopNotepad/pages`; `shopNotepad/text` is legacy compatibility. Preserve unknown page fields and do not replace one notebook mode's data with a simplified shape.
- Structured monthly costing is separate from the notebook: `monthly-costing.js` stores entries under `/monthlyCosting/<YYYY-MM>` and the dashboard calculates income from order cake sales plus any saved income adjustment.
- When changing deployed admin assets, update the version query strings in `admin-app/index.html` and the cache/build stamps in `admin-app/sw.js` and `admin-app/firebase-messaging-sw.js`; otherwise installed PWAs may continue serving stale files.

## Firebase release

- `.firebaserc` selects project `nitusbakingplanv2`. Deploy from the repository root with an authenticated Firebase CLI; pushing Git does not deploy hosting.
- Admin release: `firebase deploy --only hosting:admin --project nitusbakingplanv2`
- Public website release: `firebase deploy --only hosting:website --project nitusbakingplanv2 --non-interactive`
- Use the hosting target names in `firebase.json` for the other static apps; deploy only the target affected by a change.

## Secrets and ignored files

- Never commit `customer-app/telegram-config.json`, `blaze-free-notifier/notifier-secrets.json`, `.env*` files, or local Firebase/development caches. These paths are intentionally ignored by `.gitignore`.
