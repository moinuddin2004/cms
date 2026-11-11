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
config, so EAS cannot write the id into it (it does not edit TypeScript files). Paste it in
yourself, in `mobile-app/app.config.ts`:

```ts
// line ~53: paste the id printed by `eas init`
const easProjectId = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

// line ~46: the EAS Update endpoint for the same project
const updatesUrl = 'https://u.expo.dev/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
```

Or set `EAS_PROJECT_ID` / `EXPO_UPDATES_URL` in the environment when you run EAS locally or on the
build server. Until `updatesUrl` is set the app runs its embedded JS only (`updates.enabled` is
`false`) — nothing breaks, OTA updates just do not exist yet.

Then replace the placeholder API URL in `eas.json` (`https://api.example.com`, three profiles) with
the real backend URL. `APP_VARIANT` is supplied by the profile; do not set it by hand for EAS builds.

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

- The `development` profile needs `expo-dev-client` in the project. If it is missing:
  `npx expo install expo-dev-client` (see the M0-07 handoff note).
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
- The `--environment` flag selects EAS environment variables and is required on current EAS CLI
  (Expo docs: [Get started with Expo Update](https://docs.expo.dev/eas-update/getting-started/)).

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
