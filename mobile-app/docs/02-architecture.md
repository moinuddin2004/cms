# 02 — Architecture

> Read [01-overview.md](01-overview.md) first. Security reasons behind many rules here are in
> [03-security.md](03-security.md). Code style is in [04-coding-standards.md](04-coding-standards.md).

## 1. Folder structure (STRICT)

```
mobile-app/
├── app.config.ts              # replaces app.json (M0-07): variants, bundle ids, plugins
├── eas.json                   # build profiles: development · preview · production
├── docs/                      # this doc set
└── src/
    ├── app/                   # Expo Router routes ONLY. A route file imports ONE page/layout and renders it.
    │   ├── _layout.tsx        # renders <RootShell/> from @/shell — nothing else
    │   ├── index.tsx          # <EntryRedirect/> from @/shell
    │   ├── welcome.tsx        # space picker
    │   ├── claim/[token].tsx  # deep link: patient claim (always reachable)
    │   ├── (staff)/           # staff space: its own sign-in, offline, select-location, (main)
    │   └── (patient)/         # patient space: its own sign-in, offline, (main)
    │
    ├── shell/                 # Composition root: the ONLY code allowed to import both spaces.
    │   ├── RootShell.tsx      # global providers + root Stack (guards by activeSpace only)
    │   ├── EntryRedirect.tsx
    │   ├── WelcomePage.tsx
    │   ├── UpdateRequiredPage.tsx
    │   └── notification-router.ts  # tapped push → space + route
    │
    ├── core/                  # Shared, space-agnostic. Imports NOTHING from staff/patient/shell.
    │   ├── ui/                # React Native Reusables (CLI-generated; do not hand-edit except documented patches)
    │   ├── components/        # our shared components: layout/, forms/, feedback/, data-display/
    │   ├── datetime/          # pure tz helpers: formatInZone, zonedToUtc, dayBounds … (zone is a parameter)
    │   ├── money/             # formatMoney(amount, currency)
    │   ├── theme/             # tokens, brand palette math, applyBrand()
    │   ├── storage/           # prefs (MMKV plain), secureCache(space) (MMKV encrypted), secure-store wrapper
    │   ├── notifications/     # expo-notifications setup, channels, permission prompt, token getter
    │   ├── network/           # online state hook, OfflineBanner logic
    │   ├── query/             # createQueryClient(), persister factory, query helpers
    │   ├── http/              # createApiClient() factory, ApiResponse types, apiErrorMessage, idempotency key
    │   ├── i18n/              # i18next instance (used by patient space; core components take strings as props)
    │   ├── space/             # useSpaceStore (activeSpace) — the only cross-space state
    │   ├── env.ts
    │   ├── utils.ts           # cn()
    │   └── types/             # ApiResponse<T>, Paginated<T>
    │
    ├── staff/                 # Staff space. Imports core only.
    │   ├── index.ts           # PUBLIC surface for shell only: getStaffStatus(), staff deep-link/push handlers
    │   ├── navigation/        # StaffLayout, StaffMainLayout, resolve-staff-route.ts (pure, unit-tested)
    │   ├── lib/               # api.ts (staff axios), session.ts, realtime.ts, datetime.ts (binds active location tz), currency.ts
    │   ├── store/             # useStaffAuthStore.ts (moved from src/store/useAuthStore.ts)
    │   ├── providers/         # StaffProviders.tsx (QueryClientProvider, AccessProvider, RealtimeProvider, BrandTheme)
    │   └── features/
    │       ├── auth/  access/  dashboard/  queue/  patients/  appointments/  notifications/  devices/  more/  app-link/
    │       └── <feature>/ → api/ hooks/ components/ pages/ schemas/ types/ lib/ index.ts
    │
    └── patient/               # Patient space. Imports core only.
        ├── index.ts           # PUBLIC surface for shell only
        ├── navigation/        # PatientLayout, PatientMainLayout, resolve-patient-route.ts
        ├── lib/               # api.ts (patient axios, /patient-api), session.ts, realtime.ts
        ├── store/             # usePatientAuthStore.ts, usePendingClaimStore.ts
        ├── providers/         # PatientProviders.tsx
        ├── i18n/              # en.json, ur.json (patient strings)
        └── features/
            └── auth/ claim/ today/ reminders/ records/ family/ visit/ appointments/ clinics/ account/ devices/
```

### Import fences (lint-enforced in M0-02)

| From ↓ may import → | core | staff | patient | shell |
| --- | --- | --- | --- | --- |
| `src/core/**` | yes | **no** | **no** | **no** |
| `src/staff/**` | yes | yes | **no** | **no** |
| `src/patient/**` | yes | **no** | yes | **no** |
| `src/shell/**` | yes | only `@/staff` (index) | only `@/patient` (index) | yes |
| `src/app/(staff…)/**` | yes | yes | **no** | no |
| `src/app/(patient…)/**`, `src/app/claim/**` | yes | **no** | yes | no |
| `src/app/` root files | yes | no | no | yes |

Inside a space, cross-feature imports go through the feature's `index.ts` barrel:
`import { useQueueBoard } from '@/staff/features/queue'` — never deep paths into another feature.

## 2. Runtime layers

```
┌──────────────────────────── RootShell (shell) ────────────────────────────┐
│ GestureHandler → SafeArea → Keyboard → Theme (core) → Toaster/PortalHost  │
│ Root Stack: guards by activeSpace only (welcome | (staff) | (patient))    │
│                                                                           │
│  ┌──── (staff)/_layout ─────────────┐  ┌──── (patient)/_layout ─────────┐ │
│  │ StaffLayout: staffQueryClient     │  │ PatientLayout: patientQueryClient│
│  │  (persisted), BrandTheme, restore │  │  (persisted), I18n, restore     │ │
│  │  session, guards: offline/login/  │  │  session, guards: offline/      │ │
│  │  select-location/(main)           │  │  sign-in/(main)                 │ │
│  │  ┌── (main)/_layout ───────────┐  │  │  ┌── (main)/_layout ─────────┐  │ │
│  │  │ AccessProvider (/me/access) │  │  │  │ PatientRealtimeProvider   │  │ │
│  │  │ StaffRealtimeProvider       │  │  │  │ ReminderSync              │  │ │
│  │  │ StaffPushRegistration       │  │  │  │ PatientPushRegistration   │  │ │
│  │  └─────────────────────────────┘  │  │  └───────────────────────────┘  │ │
│  └──────────────┬────────────────────┘  └──────────────┬─────────────────┘ │
└─────────────────┼──────────────────────────────────────┼───────────────────┘
                  ▼                                      ▼
        staff axios (Bearer staff JWT,          patient axios (Bearer patient JWT,
        x-organization-id, x-location-id)       NO org/location headers)
                  ▼                                      ▼
        /auth/*, /queue/*, /patients/* …       /patient-auth/*, /patient-api/*
        socket /realtime                       socket /patient-realtime
```

Providers that depend on a session live in the **space layout**, not in the root. When a space
is not active its layout is unmounted: no queries, no sockets, no timers run for it.

## 3. State model

| State | Where | Persisted? |
| --- | --- | --- |
| Active space (`'staff' \| 'patient' \| null`) | `core/space/useSpaceStore` | Yes, prefs MMKV (not secret) |
| Staff session (user, orgs, active org/location, status, access token) | `staff/store/useStaffAuthStore` | No (memory). Refresh token in SecureStore `auth.refreshToken` |
| Patient session (account, status, access token) | `patient/store/usePatientAuthStore` | No (memory). Refresh token in SecureStore `patient.refreshToken` |
| Pending claim token (from deep link) | `patient/store/usePendingClaimStore` | No (memory only; a killed app loses it — the QR is re-scanned) |
| Server data | Each space's `QueryClient` | Allow-listed queries only, encrypted MMKV per space, 24 h |
| UI state of a screen (filters, sheet open) | Feature Zustand slice or component state | Prefs MMKV only for harmless prefs (last tab, last filter) |
| Reminder plan (scheduled notification ids) | `patient/features/reminders` | Encrypted MMKV (patient) |

`SessionStatus` per space: `restoring | unreachable | signedOut | signedIn` (existing staff
semantics, copied for patient).

## 4. Route tree and guards

Two levels of guards: the **root** only decides the space; each **space layout** decides its own
signed-in state. The shell never reads a space's session to route.

```
src/app/
  _layout.tsx                          RootShell (shell)
  index.tsx                            EntryRedirect → welcome | /(staff) | /(patient)
  welcome.tsx                          X-01 space picker
  claim/[token].tsx                    stores token → activeSpace = 'patient' → patient flow
  (staff)/
    _layout.tsx                        StaffLayout (staff/navigation)
    offline.tsx                        staff session saved but API unreachable
    login.tsx                          S-00
    select-location.tsx                S-00b
    (main)/
      _layout.tsx                      StaffMainLayout: AccessProvider + realtime + push + Stack
      (tabs)/_layout.tsx               Tabs filtered by can()
      (tabs)/today.tsx                 S-01  can any: appointments.view, billing.invoice.view, finance.overview.view
      (tabs)/queue.tsx                 S-02  can any: queue.doctor.own, queue.board.view
      (tabs)/patients.tsx              S-04  can: patients.view
      (tabs)/schedule.tsx              S-06  can: appointments.view
      (tabs)/more.tsx                  S-08  always
      patients/[patientId].tsx         S-05
      queue/walk-in.tsx                S-02c (modal)
      queue/arrivals.tsx               S-03
      queue/close-session.tsx          S-02a close flow (modal)
      notifications.tsx                S-07
      app-link/[patientId].tsx         S-09 (M2-15)
  (patient)/
    _layout.tsx                        PatientLayout (patient/navigation)
    offline.tsx
    sign-in.tsx                        P-00
    verify-code.tsx                    P-00
    (main)/
      _layout.tsx                      PatientMainLayout
      (tabs)/_layout.tsx
      (tabs)/today.tsx                 P-02
      (tabs)/records.tsx               P-03
      (tabs)/family.tsx                P-04
      (tabs)/more.tsx                  P-05
      claim/confirm.tsx                P-01
      visit/[entryId].tsx              P-06
      prescriptions/[id].tsx           P-03
      appointments/[id].tsx            P-03
      profiles/[profileId].tsx         P-04
      clinics/index.tsx                P-08
      account/delete.tsx               P-09
```

### Root guards (`shell/RootShell.tsx`)

```
activeSpace == null      → welcome
activeSpace == 'staff'   → (staff)
activeSpace == 'patient' → (patient)
index, claim/[token]     → always
```

### Space guards (pure functions, unit-tested)

`staff/navigation/resolve-staff-route.ts`:

```
status == 'unreachable'                    → offline
status in (signedOut, restoring)           → login        (splash covers 'restoring')
signedIn && (mustSelectLocation || clinicBlocked) → select-location
signedIn                                   → (main)
```

`patient/navigation/resolve-patient-route.ts`:

```
status == 'unreachable'                    → offline
status in (signedOut, restoring)           → sign-in / verify-code
signedIn                                   → (main)
```

- The space layout restores its own session on mount (`useRestoreStaffSession` / `useRestorePatientSession`).
  Only the active space is mounted, so only its session restores at start.
- `switchSpace(target)` (core/space) sets `activeSpace`; the other space's layout unmounts but its
  memory session and SecureStore token stay — switching never signs out.
- Every layout's `<Stack>` must always render (never return `null` while restoring) — the splash
  (root) or a skeleton covers it.
- Signing out of a space: wipe that space (see [03 §2](03-security.md#2-mobile-rules) rule 5), then
  `activeSpace` → the other space if it is signed in, else `null` (welcome).

## 5. HTTP clients

`core/http/createApiClient(options)` builds an axios instance; each space creates exactly one:

| | Staff `staff/lib/api.ts` | Patient `patient/lib/api.ts` |
| --- | --- | --- |
| baseURL | `env.apiUrl` | `env.apiUrl` (paths start with `/patient-api` or `/patient-auth`) |
| Headers always | `x-client-type: mobile` | `x-client-type: mobile` |
| Auth header | `Bearer <staff access>` | `Bearer <patient access>` |
| Tenant headers | `x-organization-id`, `x-location-id` | **none, ever** |
| Refresh | `POST /auth/refresh` with `x-refresh-token` | `POST /patient-auth/refresh` with `x-patient-refresh-token` |
| 401 handling | single-flight refresh, retry once | same pattern, own single-flight |
| 403 codes | `EMAIL_NOT_VERIFIED`, clinic gate codes (existing) | `ACCOUNT_DISABLED`, `LINK_REVOKED` → refetch links |

The existing logic in `src/lib/api.ts` (single-flight refresh, gate codes, `apiErrorMessage`) is
the reference implementation; the factory generalises it, it does not rewrite it.

Responses are always `ApiResponse<T>`; API functions unwrap `res.data.data` and return `T`.

## 6. Data fetching conventions

- Query keys are built by a per-feature key factory (`queueKeys.board(locationId, ymd)`). Keys
  that depend on tenant context include org + location ids, so switching location refetches.
- `staleTime` defaults: lists 30 s, detail 60 s, reference data 10 min. Realtime-driven screens
  (queue) use `staleTime: 0` plus realtime invalidation.
- Mutations never retry automatically (`retry: false`, existing default). Queue mutations send an
  `Idempotency-Key` created **once per user intent** (see [04 §8](04-coding-standards.md#8-mutations)).
- After a mutation succeeds: invalidate the affected keys. No optimistic updates in MVP except
  where a task card says so.

## 7. Realtime

### Staff (`staff/lib/realtime.ts`, M1-03)

- One socket to namespace `/realtime`, created inside `StaffRealtimeProvider` (mounted in the
  staff layout), `transports: ['websocket']`, auth = `{ token: <staff access token> }`
  (`handshake.auth.token`). Full contract: [07 §2.6](07-backend-contracts.md#26-realtime-realtime).
- The server auto-joins `user:<id>`. The client subscribes (`emit('subscribe', { room }, ack)`) to
  `org:<orgId>` always, `location:<locId>:board` on the reception board, `session:<id>` on the
  doctor screen — only while that screen is mounted.
- Queue events carry `seq`: ignore events with `seq <=` the snapshot's `eventSeq`; otherwise invalidate.
- While disconnected, realtime-driven screens poll every 10 s (same as web).
- Event → **invalidate** query keys (A-07). Mapping table lives in one file
  `staff/lib/realtime-invalidation.ts`; invalidations are coalesced (max once per 300 ms per key).
- `access.changed` → invalidate `accessKeys.all`.
- `notification.new` → invalidate notification list + unread count; show in-app toast if the app
  is foregrounded and the user is not on the notifications screen.
- App goes to background → disconnect after 30 s. Foreground → reconnect, then invalidate all
  realtime-driven keys once (we may have missed events).
- Token refresh → reconnect with the new token. `connect_error` with an auth reason → trigger
  `refreshSession()` once, then reconnect.
- Location switch → leave old rooms, join new ones.

### Patient (`patient/lib/realtime.ts`, M3-06)

Namespace `/patient-realtime`, patient token, rooms `patient:<accountId>` (server joins it) and
`entry:<queueEntryId>` (client asks to watch an entry the server confirms is linked). Events
`visit.event`, `feed.changed` → invalidate. Same background/foreground rules.

## 8. Push and local notifications

- Library: `expo-notifications` (core/notifications). One Expo push token per install.
- Each space registers that token with its own backend endpoint after sign-in
  (`POST /me/devices` staff, `POST /patient-api/devices` patient) and deletes it on sign-out of
  that space. The same token may be registered in both spaces — that is expected.
- Every push carries `data: { space, type, route, organizationId?, locationId?, entityId? }`.
- `shell/notification-router.ts` handles taps: if `space` is not active and that space is signed
  in → switch space, then navigate; if not signed in there → open that space's sign-in. For staff
  pushes for another location → ask "Switch to <location>?" before navigating.
- Android channels (created at start): `queue` (high importance), `reminders` (high, sound),
  `general` (default). Remote pushes must set `channelId`.
- Local dose reminders: planned by a pure function and scheduled in a rolling window — see
  [06-screens.md](06-screens.md#p-today) and task M3-03.
- Permission prompt is never shown at first launch: staff → after first sign-in with an
  explanation sheet; patient → when the first reminder or live token would need it.

## 9. Offline

- `core/network/useOnline()` from NetInfo (already wired into TanStack `onlineManager`).
- `OfflineBanner` (core component) shows on every screen of a space when offline.
- Persisted queries: each space has an allow-list (`staff/lib/persist.ts`,
  `patient/lib/persist.ts`). Persist only queries whose keys are listed. Max age 24 h. Buster =
  `${appVersion}:${spaceUserId}:${orgId ?? ''}:${locationId ?? ''}`.
- Staff allow-list (MVP): access, my queue session, queue board (today), today's appointments,
  recently opened patient summaries (last 20).
- Patient allow-list: links, profiles, today feed, medications, upcoming appointments,
  prescriptions list.
- While offline, mutation buttons are disabled with the label "Offline". There is no write queue.
- Sign-out of a space wipes that space's persisted cache and its encrypted MMKV instance.

## 10. Theming

- Tokens are CSS variables in `src/global.css` (Uniwind `@variant light/dark`). New semantic
  tokens added in M0-05: `success`, `warning`, `info` (+ `-foreground`), queue status tokens.
- **Staff**: `BrandTheme` fetches `GET /theme` for the active org, derives the palette with the
  same OKLCH math as the web (`web-app/src/features/theme/lib/color.ts`, ported to
  `core/theme/brand.ts`) and calls `Uniwind.updateCSSVariables('light' | 'dark', { … })`.
  Cached in prefs so the next cold start shows the brand immediately.
- **Patient**: platform palette (neutral teal-blue, defined in global.css); a clinic's colour is
  only used as a 4 px accent stripe / chip on cards from that clinic (A-11).
- Dark mode follows the system; staff orgs may force `theme.default_mode`.

## 11. Configuration, builds and updates (M0-07)

- `app.config.ts` reads `APP_VARIANT` (`development | preview | production`) → name suffix, bundle
  id suffix (`.dev`, `.preview`), icon badge. Placeholder package until decision O-01.
- `eas.json` profiles with the same names; `EXPO_PUBLIC_API_URL` per profile.
- `expo-updates` with channels `preview` and `production`; runtime version policy `appVersion`.
- `GET /app/min-version` (backend) → `{ android: "1.0.0", ios: "1.0.0" }`; below it the app shows
  a blocking "Update required" screen (shell).
- Deep link scheme: change `mobileapp` → final scheme with O-01; links:
  `<scheme>://claim/<token>`, `<scheme>://s/<route>` (staff), `<scheme>://p/<route>` (patient).

## 12. Performance budgets

| Metric | Budget | How to check |
| --- | --- | --- |
| Cold start → interactive (3–4 GB Android) | < 2.5 s | Release build, stopwatch, 3 runs |
| Android download size | < 40 MB | Play Console / `eas build` artifact |
| Patient "Today" from cache | < 500 ms, works in airplane mode | Manual |
| List scroll | No dropped frames on 200 rows | FlashList, `estimatedItemSize` not needed in v2 but keep items light |

Rules: heavy staff-only libraries (camera/scanner, charts) are imported only inside
`src/staff/**` screens that use them, never at a layout or root level. No barrel re-exports of
heavy modules.

## 13. Backend shape for the patient space (summary)

```
request ─► RateLimiter ─► PatientFenceGuard ─► (staff guards skip: route is @Public) ─►
           PatientJwtGuard (patient secret, aud=patient, session alive) ─►
           PatientLinkGuard (request.patientContext = { accountId, profiles, links }) ─►
           controller in src/patient-app/** ─► thin read service ─► explicit DTO
```

`@PatientApi()` = `@Public()` + `IS_PATIENT_API` metadata + `@UseGuards(PatientJwtGuard, PatientLinkGuard)`.
`PatientFenceGuard` (first global guard): path starts with `/patient-api/` ⇔ handler has
`IS_PATIENT_API`; otherwise 403. Full contracts: [07-backend-contracts.md](07-backend-contracts.md).
Tables: [08-database.md](08-database.md).
