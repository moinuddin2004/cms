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
| `development` | Clinic (Dev) | `com.placeholder.clinicapp.dev` | `clinicapp-dev` |
| `preview` | Clinic (Preview) | `com.placeholder.clinicapp.preview` | `clinicapp-preview` |
| `production` | Clinic | `com.placeholder.clinicapp` | `clinicapp` |

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
config, so EAS cannot write the id into it (it does not edit TypeScript files). Paste the id into the
one `EAS_PROJECT_ID` constant in `mobile-app/app.config.ts` (empty string today). The updates URL
(`https://u.expo.dev/<id>`) and `extra.eas.projectId` are derived from that constant. While it is
empty the app runs embedded JS only (`updates.enabled` is `false`).

### EAS environments (required before any build or update)

`APP_VARIANT` and `EXPO_PUBLIC_API_URL` live in **EAS environments** (`development`, `preview`,
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

Both values are public (they ship inside the app), so `plaintext` is right.

**Every `eas update` MUST pass the matching `--environment` (`preview` channel → `preview`, `production` channel → `production`); builds and updates must read the same environment.** An update bundled without `APP_VARIANT` /
`EXPO_PUBLIC_API_URL` makes `core/env.ts` throw at start and breaks every installed build.

> **Do not run `eas update:configure`**: it writes `app.json`, and this project now uses
> `app.config.ts`. `runtimeVersion` (`{ policy: 'appVersion' }`) and the update channel are already
> configured.

## 3. Builds

```powershell
# Development build (Expo dev client; installs next to preview/production)
npx eas-cli@latest build --profile development --platform android

# Preview: internal APK, channel `preview`
npx eas-cli@latest build --profile preview --platform android

# Production: AAB for Google Play, channel `production`
npx eas-cli@latest build --profile production --platform android
```

- The `development` profile needs `expo-dev-client` (`npx expo install expo-dev-client`, in the M0-07 rework handoff). The profile also has to be built once on a device before M0-D can be ticked.
- `appVersionSource` is `remote` and the production profile auto-increments the Android `versionCode`, so every AAB is accepted by Play.
- Local builds while developing: `$env:APP_VARIANT = "development"; npx expo run:android` (this
  creates the native folders on your machine only; they stay gitignored).
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

Still open: the real app identity (O-01), store listings, signing credentials, the in-app account
deletion page (M4) and the privacy policy. The placeholder package name cannot be uploaded to Play,
so do not submit before O-01 is decided.

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


## 7. Pre-flight checks

```powershell
npx expo-doctor
npm run lint
npm run typecheck
npm test
npm run lint:fences
```
