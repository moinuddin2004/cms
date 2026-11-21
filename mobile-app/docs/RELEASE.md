# Release — builds and updates

> Card M0-07. This is the runbook for **you** (the product owner): the agent never runs
> `eas init` / `eas build` / anything that talks to Expo's servers or creates a project, and never
> creates `ios/` or `android/` folders.
>
> The app identity is still the placeholder **`com.placeholder.clinicapp`** — decision **O-01** is
> open. Do not change the package name to a real domain until that decision is made.

## 1. App variants

`app.config.ts` reads `APP_VARIANT` (`development` default, `preview`, `production`). Each variant
has its own name, URL scheme and package/bundle id, so two builds can be installed side by side
(Expo docs: [Install app variants on the same device](https://docs.expo.dev/build-reference/variants/)).

| `APP_VARIANT` | App name | Android package / iOS bundle id | URL scheme |
| --- | --- | --- | --- |
| `development` | MedTrackr (Dev) | `com.placeholder.clinicapp.dev` | `clinicapp-dev` |
| `preview` | MedTrackr (Preview) | `com.placeholder.clinicapp.preview` | `clinicapp-preview` |
| `production` | MedTrackr | `com.placeholder.clinicapp` | `clinicapp` |

Check what Expo resolves without contacting any server:

```powershell
$env:APP_VARIANT = "development"; npx expo config --type public
$env:APP_VARIANT = "preview";     npx expo config --type public
$env:APP_VARIANT = "production";  npx expo config --type public
```

## 2. One-time setup (needs an Expo account)

```powershell
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
```

`eas init` creates the Expo project and prints its **project id**. `app.config.ts` is a *dynamic*
config, so EAS cannot write the id into it (it does not edit TypeScript files). The id is already pasted
into the one `EAS_PROJECT_ID` constant in `mobile-app/app.config.ts` (project set up 2026-11-17). The
updates URL (`https://u.expo.dev/<id>`) and `extra.eas.projectId` are derived from that constant. If it
were empty the app would run embedded JS only (`updates.enabled` is `false`). On a new Expo account or
project, run `eas init` again and replace the constant.

### EAS environments (required before any build or update)

`APP_VARIANT`, `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` live in **EAS environments** (`development`, `preview`,
`production`). Build profiles select one with `"environment"` in `eas.json`, and `eas update` reads
the same one via `--environment`. Replace the URL with the real backend per environment. (The Expo
docs document `env:set`; it creates or updates a variable.)

```powershell
npx eas-cli@latest env:set --name APP_VARIANT --value development --environment development --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://api.example.com --environment development --visibility plaintext

npx eas-cli@latest env:set --name APP_VARIANT --value preview --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://api.example.com --environment preview --visibility plaintext

npx eas-cli@latest env:set --name APP_VARIANT --value production --environment production --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://api.example.com --environment production --visibility plaintext
```

Also set `EXPO_PUBLIC_WEB_URL` (the web app's origin, e.g. `https://app.example.com`) in the same way for `preview` and `production`: the welcome page's Privacy / Terms links are hidden in a release build without it (`core/env.ts`):

```powershell
npx eas-cli@latest env:set --name EXPO_PUBLIC_WEB_URL --value https://app.example.com --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_WEB_URL --value https://app.example.com --environment production --visibility plaintext
```

Optional for Google sign-in on iOS: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_URL_SCHEME` (adds the config plugin). All values are public (they ship inside the app), so `plaintext` is right.

**Every `eas update` MUST pass the matching `--environment` (`preview` channel → `preview`, `production` channel → `production`); builds and updates must read the same environment.** An update bundled without `APP_VARIANT` /
`EXPO_PUBLIC_API_URL` makes `core/env.ts` throw at start and breaks every installed build.

> **Do not run `eas update:configure`**: it writes `app.json`, and this project now uses
> `app.config.ts`. `runtimeVersion` (`{ policy: 'appVersion' }`) and the update channel are already
> configured.

## 3. Builds

```powershell
# Development build (Expo dev client, internal APK; installs next to preview/production)
npx eas-cli@latest build --profile development --platform android

# Preview: internal APK, channel `preview`
npx eas-cli@latest build --profile preview --platform android

# Production: AAB for Google Play, channel `production`
npx eas-cli@latest build --profile production --platform android
```

- The `development` profile uses `expo-dev-client` (installed) and builds an Android **APK** (`android.buildType: "apk"`, set 2026-11-17) you can side-load; run `npm run dev` afterwards and open the app. It has to be installed on a device once before M0-D can be ticked.
- `appVersionSource` is `remote` and the production profile auto-increments the Android `versionCode`, so every AAB is accepted by Play.
- Local builds while developing: `npm run android` (`expo run:android`; `APP_VARIANT` defaults to
  `development`; this creates the native folders on your machine only; they stay gitignored).
  `.easignore` keeps `docs/`, `.claude/`, env files and keystores out of the EAS upload.
- `ios` builds must compile too (docs/01 §3), but only the Android pilot is in scope.

## 4. Over-the-air updates

One channel per profile: `preview` for preview builds, `production` for store builds. A development
build can load any channel (its `channel` field is not set).

```powershell
# Publish JS/assets to preview builds
npx eas-cli@latest update --channel preview --message "Fix queue label" --environment preview

# Production
npx eas-cli@latest update --channel production --message "..." --environment production
```

- `runtimeVersion` is the app `version` (`1.0.0`). An update only reaches builds with the same
  version. Bump `version` in `app.config.ts` for every store release that changes native code.
- Test an update on a release build by force-closing and reopening the app twice; in a development
  build use the Expo dev-client "Extensions" tab.
- `--environment` makes the update use that EAS environment's variables (Expo docs: [Environment variables](https://docs.expo.dev/eas/environment-variables/)).

## 5. Minimum supported version (X-03)

The app calls `GET /app/min-version` once per cold start (`src/shell/min-version.ts`) and shows the
blocking "Update required" screen when its version is below the floor. Network errors, timeouts and
malformed responses **fail open** — an unreachable API never locks anyone out.

The floors are backend environment variables (docs/07 §4.3):

| Variable | Default | Meaning |
| --- | --- | --- |
| `MOBILE_MIN_VERSION_ANDROID` | `0.0.0` | Oldest Android `version` allowed |
| `MOBILE_MIN_VERSION_IOS` | `0.0.0` | Oldest iOS `version` allowed |
| `MOBILE_MIN_VERSION_MESSAGE` | — | Optional line shown on the X-03 screen |

Raise them on the API after a release; no mobile build is needed.

## 6. Before a store submission (later cards)

Still open: the real app identity (O-01), store listings and screenshots (icon and splash are done, M4-02),
signing credentials, and the owner/lawyer review of the legal drafts (§6c). The in-app account deletion
(P-09) and the public pages exist. The placeholder package name cannot be uploaded to Play, so do not
submit before O-01 is decided.

## 6b. Demo accounts for store review (M4-03)

Play needs working logins (Play Console, App content, App access). Seed a fictional clinic on the **review/staging API database** (never run automatically, never part of startup):

```powershell
cd backend
$env:DEMO_STAFF_PASSWORD = "<a strong password, 12+ chars>"
$env:DEMO_PATIENT_EMAIL  = "<a mailbox you control>"
npm run seed:demo -- --allow-demo-seed
```

| Variable | Meaning |
| --- | --- |
| `DEMO_STAFF_PASSWORD` | Required. Shared password of the staff logins. Never the dev seed password. |
| `DEMO_PATIENT_EMAIL` | Required. The demo patient account signs in with an **emailed 6-digit code**, so this mailbox must be yours. |
| `DEMO_STAFF_EMAIL_DOMAIN` | Optional, default `demo-clinic.example`. Staff logins: `owner@`, `doctor@`, `reception@` on that domain. |

Guards: needs `--allow-demo-seed` (or `ALLOW_DEMO_SEED=1`). With `NODE_ENV=production` it also needs `--allow-demo-seed-in-production` (or `ALLOW_DEMO_SEED_IN_PRODUCTION=1`). Safe to re-run: it creates only what is missing. It prints no secrets. SMTP and Redis are switched off during the run, so nothing is sent.

It creates one approved clinic ("Demo Family Clinic") with one location, a doctor and a receptionist, 5 fictional patients (`Demo Patient One` …), appointments, one queue entry, one finalized prescription, and a patient-app account already linked to "Demo Patient One". The script was unit-tested for its guards and type-checked; it has **not been executed** against a database yet (dry-run it on a scratch database first).

**Reviewer limitation:** patient sign-in uses an emailed code and a Play reviewer cannot read your mailbox. Options: put in the App access notes that you will give the code on request, or add a review-only fixed code (a backend auth change, not done here, owner decision).

## 6c. Legal texts and the deletion URL (M4-04)

DRAFT texts are in `mobile-app/docs/legal/` (privacy policy, terms, account deletion, Play Data safety inputs). A lawyer must review them and every `[PLACEHOLDER]` must be replaced. Public web pages: `<web>/privacy`, `<web>/terms`, `<web>/delete-account`. After editing the Markdown run `node mobile-app/docs/legal/build-web-content.mjs` and commit the regenerated file. Enter `<web>/privacy` and `<web>/delete-account` in Play Console.


## 6d. Backend deploy checklist for the patient space

Set on every backend process (`api`, `worker` and `all`) before deploying a build that includes the patient API:

- `JWT_PATIENT_ACCESS_SECRET` — **required**: the API fails at boot without it. At least 32 characters (e.g. `openssl rand -base64 48`), different from `JWT_ACCESS_SECRET`. Deploys that predate the patient space will not start until it is set.
- Optional tuning (defaults are safe): `PATIENT_LOGIN_CODES_PER_HOUR` / `PATIENT_LOGIN_CODES_PER_DAY` / `PATIENT_LOGIN_CODES_PER_IP_PER_DAY`, `PATIENT_FAILED_VERIFY_PER_24H`, `PATIENT_SESSION_MAX_DAYS`, `PATIENT_SESSION_RETENTION_MONTHS`, `PRODUCT_EVENT_RETENTION_DAYS`, `PATIENT_LOGIN_CODE_RETENTION_DAYS` — see the root `CLAUDE.md` env table. The retention job runs daily at 03:15 on the process that runs jobs (`worker` or `all`).
- `TRUST_PROXY` must match the production proxy, otherwise every per-IP limit shares one bucket.

## 7. Pre-flight checks

```powershell
npx expo-doctor
npm run lint
npm run typecheck
npm test
npm run lint:fences
```
