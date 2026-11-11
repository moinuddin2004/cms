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

## 7. Pre-flight checks

```powershell
npx expo-doctor
npm run lint
npm run typecheck
npm test
npm run lint:fences
```
