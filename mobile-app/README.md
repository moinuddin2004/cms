<div align="center">

<img src="../docs/images/logo.svg" alt="" width="64" />

<h1>Mobile app</h1>

<p><b>MedTrackr on mobile: a staff space and a patient space in one Expo app.</b></p>

<p>
<img src="https://img.shields.io/badge/Expo_58-161b22?style=for-the-badge&logo=expo&logoColor=white" alt="Expo 58" />
<img src="https://img.shields.io/badge/React_Native-161b22?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
<img src="https://img.shields.io/badge/Expo_Router-161b22?style=for-the-badge&logo=expo&logoColor=white" alt="Expo Router" />
<img src="https://img.shields.io/badge/TypeScript-161b22?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript" />
<img src="https://img.shields.io/badge/TanStack_Query-161b22?style=for-the-badge&logo=reactquery&logoColor=FF4154" alt="TanStack Query" />
</p>

<p>
<a href="#quick-start"><b>Quick start</b></a> &nbsp;·&nbsp;
<a href="#current-scope"><b>Current scope</b></a> &nbsp;·&nbsp;
<a href="#structure"><b>Structure</b></a> &nbsp;·&nbsp;
<a href="#testing"><b>Testing</b></a> &nbsp;·&nbsp;
<a href="#rules"><b>Rules</b></a>
</p>

<sub><a href="../README.md">← Back to the main README</a></sub>

</div>

<br />

## Quick start

**You need:** Node.js 22, the API running on port `5000`, and a **development build** (the app uses native modules such as MMKV, so Expo Go cannot run it).

| Step | Command |
| --- | --- |
| 1 · Install | `npm install` |
| 2 · Configure (optional in development) | Copy `.env.example` to `.env`; set `EXPO_PUBLIC_API_URL` (and `EXPO_PUBLIC_WEB_URL`) if the defaults do not fit |
| 3 · Build and run the dev client | `npm run android` (`expo run:android`; creates the git-ignored `android/` folder) or `npm run ios` |
| 4 · Start the dev server on later runs | `npm run dev` (`expo start`) and open the installed dev client |

An installable development APK without a local Android toolchain: `npx eas-cli@latest build --profile development --platform android` (see [`docs/RELEASE.md`](docs/RELEASE.md)).

During development, the app discovers the Expo host's address and uses port `5000` for the API (and `3000` for the web app's public pages); Android emulators fall back to `10.0.2.2`. For a physical device, the API must be reachable over the same network. Release builds must set `EXPO_PUBLIC_API_URL` (the app fails clearly if it is missing) and should set `EXPO_PUBLIC_WEB_URL` (without it the privacy/terms links are hidden).

| Variable | Used for |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | API base URL (required in release builds) |
| `EXPO_PUBLIC_WEB_URL` | Web origin for the public privacy / terms pages |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Native Google sign-in on iOS (optional) |
| `APP_VARIANT` | `development` (default) / `preview` / `production` — read by `app.config.ts`; EAS supplies it |
| `GOOGLE_IOS_URL_SCHEME` | Adds the Google sign-in config plugin for iOS (optional, build time) |

<br />

## Current scope

One app, two isolated spaces (see [`docs/01-overview.md`](docs/01-overview.md)). All cards of phases 0–4 are merged into `mobile/develop`; device checks, UI-02 follow-ups, store screenshots and the legal review are still open ([`docs/PROGRESS.md`](docs/PROGRESS.md)).

**Staff space** — email/password and Google sign-in, organization + location selection, secure session restore, permission-driven tabs (Today, Queue, Patients, Schedule, More), doctor queue, reception board, walk-in, arrivals and close session, patient search / quick register / summary, notifications inbox, push registration and tap routing, "Link app" QR for patients, realtime updates, offline read cache.

**Patient space** — email-code and Google sign-in, claim a clinic link by QR (`/claim/<token>`, `/c/<token>`), multi-clinic records, family profiles, linked clinics, account deletion, Today with local medicine reminders, live token / visit screen, appointment confirm, contact sheet, push, English + Urdu.

**Not built:** biometric unlock, staff-side booking, payments, prescription writing, offline mutation queue (docs/01 §3).

<br />

## Structure

```text
src/
├── app/          Expo Router routes only: (staff)/, (patient)/, welcome, claim/[token], c/[token]
├── shell/        Composition root: root stack, providers, welcome, min-version gate, push-tap router
├── core/         Shared UI kit, http/query/storage/theme/i18n/notifications, datetime, money
├── staff/        Staff space: features/, lib/, navigation/, store/
└── patient/      Patient space: features/, lib/, navigation/, providers/, store/
```

`core` imports neither space; `staff` and `patient` never import each other; only `shell` sees both (lint-enforced, `npm run lint:fences`). Keep route files focused on rendering a page. Feature APIs live in their own `api/` folders and are consumed through TanStack Query hooks. Full layout: [`docs/02-architecture.md`](docs/02-architecture.md).

<br />

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Expo dev server (`expo start`) |
| `npm run android` | Build and run the dev client on Android (`expo run:android`) |
| `npm run ios` | Build and run the dev client on iOS (`expo run:ios`) |
| `npm run web` | Start the web target |
| `npm run lint` | Run Expo's ESLint configuration |
| `npm run lint:fences` | Check that cross-space imports fail lint |
| `npm test` | Jest unit tests |
| `npm run typecheck` | Run TypeScript without emitting files |

EAS build profiles (`eas.json`): `development` (dev-client APK, internal), `preview` (internal APK, channel `preview`), `production` (Play AAB, channel `production`). Commands and environment setup: [`docs/RELEASE.md`](docs/RELEASE.md).

<br />

## Testing

```bash
npm test            # Jest unit tests (jest-expo preset)
npm run lint        # Expo's ESLint configuration
npm run lint:fences # cross-space imports must fail lint
npm run typecheck
```

Unit tests live next to the code as `*.test.ts(x)`. They run on Jest 30 with the `jest-expo` preset, so no device or development build is needed: `jest.setup.ts` replaces the native modules (SecureStore, MMKV, notifications, NetInfo, `expo-crypto.randomUUID`) with in-memory implementations, and `__mocks__/react-native-mmkv.ts` wires the library's own v4 test mock (`createMMKV` / `deleteMMKV`).

Run all four commands before submitting changes — they are the Definition of Done in [`docs/09`](docs/09-testing-and-quality.md#1-definition-of-done-every-task).

<br />

## Rules

| Rule | Use |
| --- | --- |
| Use Expo Router for navigation | Routes live in `src/app/`; keep feature logic elsewhere |
| Keep the spaces apart | No imports between `src/staff` and `src/patient`; shared code goes in `src/core` |
| Use TanStack Form + Zod | Do not use React Hook Form |
| Store refresh credentials only in SecureStore | Access tokens stay in memory; never persist them (`auth.refreshToken` staff, `patient.refreshToken` patient) |
| Use `useAccess().can(...)` for permissions | Do not check role names |
| Use `@/staff/lib/datetime` (staff) or `@/core/datetime` `formatInZone` (patient) and `@/core/money` | Clinic timezone and shared money formatting; never `toLocale*String` |
| Prefer FlashList for long lists | Keep scrolling performant on phones |
| Use theme tokens and safe-area utilities | Avoid hardcoded colors and device-edge content |

For the documentation map, task cards and handoff log start at [`docs/README.md`](docs/README.md); for detailed conventions and Expo SDK 58 guidance read [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md).

<br />

<div align="center">
<sub>Part of the <a href="../README.md">Clinic Management Platform</a> · API: <a href="../backend/">backend/</a> · Web: <a href="../web-app/">web-app/</a></sub>
</div>
