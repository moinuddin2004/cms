<div align="center">

<img src="../docs/images/logo.svg" alt="" width="64" />

<h1>Mobile app</h1>

<p><b>A mobile-first companion for clinic staff, built with Expo.</b></p>

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

**You need:** Node.js 22, the API running on port `5000`, and Expo Go or a development build.

| Step | Command |
| --- | --- |
| 1 · Install | `npm install` |
| 2 · Configure (optional in development) | Set `EXPO_PUBLIC_API_URL` in `.env` to the API's reachable address |
| 3 · Start Expo | `npx expo start` |
| 4 · Open the app | Scan the QR code in Expo Go, or launch an emulator |

During development, the app discovers the Expo host's address and uses port `5000`; Android emulators fall back to `10.0.2.2`. For a physical device, the API must be reachable over the same network. Set `EXPO_PUBLIC_API_URL` explicitly for release builds; the app fails clearly if it is missing.

<br />

## Current scope

The mobile app is an early foundation, not yet a mobile version of every web feature. Its current end-to-end path covers:

- Email and password sign-in
- Selecting an organization and location
- Restoring a session securely and signing out
- Loading the access context and showing the current account and clinic
- Handling offline-at-start and access-loading errors

Patient, appointment, queue, billing, lab and inventory workflows are not implemented in the mobile app yet. Realtime sockets, push notifications, biometric unlock, Google sign-in and registration are also not built.

<br />

## Structure

```text
src/
├── app/          Expo Router routes and layouts
├── features/     Feature pages, components, hooks, API, schemas and types
├── components/   Shared UI, forms and feedback
├── lib/          API, environment, secure storage, dates and utilities
├── providers/    App-wide providers
├── store/        Zustand state
└── types/        Shared API types
```

Keep route files focused on rendering a feature page. Feature APIs live in their own `api/` folders and are consumed through TanStack Query hooks.

<br />

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start Expo |
| `npm run android` | Start Expo and open Android |
| `npm run ios` | Start Expo and open iOS |
| `npm run web` | Start the web target |
| `npm run lint` | Run Expo's ESLint configuration |
| `npm run typecheck` | Run TypeScript without emitting files |

<br />

## Testing

```bash
npm run lint
npm run typecheck
```

There is no mobile unit-test script configured yet. Run lint and typecheck before submitting changes.

<br />

## Rules

| Rule | Use |
| --- | --- |
| Use Expo Router for navigation | Routes live in `src/app/`; keep feature logic elsewhere |
| Use TanStack Form + Zod | Do not use React Hook Form |
| Store refresh credentials only in SecureStore | Access tokens stay in memory; never persist them |
| Use `useAccess().can(...)` for permissions | Do not check role names |
| Use `@/lib/datetime` and `@/lib/currency` | Use clinic timezone and shared money formatting |
| Prefer FlashList for long lists | Keep scrolling performant on phones |
| Use theme tokens and safe-area utilities | Avoid hardcoded colors and device-edge content |

For detailed conventions and Expo SDK guidance, read [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md).

<br />

<div align="center">
<sub>Part of the <a href="../README.md">Clinic Management Platform</a> · API: <a href="../backend/">backend/</a> · Web: <a href="../web-app/">web-app/</a></sub>
</div>
