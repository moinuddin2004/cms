# 10 — Roadmap and task cards

> Implementers: pick the **first task in [PROGRESS.md](PROGRESS.md) whose status is `ready`** and
> whose dependencies are `done`. Do exactly that card. Do not start the next card until the
> architect has reviewed yours (A-15), unless PROGRESS marks it `ready` already.
>
> Phase 0 and Phase 1 cards are fully specified. Phase 2–4 cards are specified at contract level;
> the architect expands each to full detail (and marks it `ready`) before it starts.
>
> Sizes: **S** ≤ 1 day · **M** 1–3 days · **L** 3–5 days (one implementer + AI). Area tags:
> `MOB` mobile-app · `BE` backend · `WEB` web-app.

## Card format

```
### <ID> — <title>
Area · Size · Depends on · Branch
Goal:            one sentence
Read first:      docs/sections and code files
Steps:           numbered, concrete
Files:           create / modify / delete
Acceptance:      checklist the reviewer will tick
Out of scope:    things not to do in this card
Install:         commands the user runs (if any)
```

---

# Phase 0 — Foundations (weeks 1–2)

### M0-01 — Split source into core / staff / shell (no behaviour change)

MOB · M · Depends: — · Branch `mobile/M0-01-folder-split`

**Goal:** move existing code into the A-01 structure with identical behaviour.

**Read first:** [02 §1](02-architecture.md#1-folder-structure-strict), all files under `src/`.

**Steps:**
1. Move files (use `git mv` to keep history):

| From | To | Notes |
| --- | --- | --- |
| `src/components/ui/*` | `src/core/ui/*` | update `components.json` aliases: `ui: "@/core/ui"`, `utils: "@/core/utils"`, `components: "@/core/components"`, `lib: "@/core"`, `hooks: "@/core/hooks"` |
| `src/components/forms/*` | `src/core/components/forms/*` | |
| `src/components/feedback/*` | `src/core/components/feedback/*` | |
| `src/lib/utils.ts` | `src/core/utils.ts` | |
| `src/lib/env.ts` | `src/core/env.ts` | |
| `src/types/api.types.ts` | `src/core/types/api.types.ts` + `src/core/types/index.ts` | |
| `src/lib/secure-storage.ts` | `src/core/storage/secure-store.ts` | generalise: `createSecureItem(key)` returning `{ get, set, clear }` with the same keychain options and error handling; staff uses key `auth.refreshToken` (**same key** — existing sessions survive) |
| `src/lib/query-client.ts` | `src/core/query/create-query-client.ts` (factory with today's defaults) + `src/core/query/managers.ts` (`setupQueryManagers`) | `src/staff/lib/query-client.ts` exports `staffQueryClient = createQueryClient()` |
| `src/lib/datetime.ts` | `src/core/datetime/index.ts` (pure, zone is a parameter) + `src/staff/lib/datetime.ts` (binds active location; keeps today's exported names and behaviour) | core API: `formatInZone(v, zone, pattern)`, `formatYmd`, `zonedDateTimeToUtc(ymd, hhmm, zone)`, `dayBoundsInZone(ymd, zone)`, `todayYmdInZone(zone)`, `zonedDate(v, zone)`, `isYmd`, `ymdToDate`, `toUtcIso`, `isValidTimezone`, `deviceTimezone` |
| `src/lib/currency.ts` | `src/core/money/format.ts` (`formatMoney(amount, currency, locale = 'en-PK')`) + `src/staff/lib/currency.ts` (today's API on top) | |
| `src/lib/api.ts` | `src/staff/lib/api.ts` | rename export `api` → `staffApi`; keep all logic; move `apiErrorMessage` to `src/core/http/api-error.ts` and re-import |
| `src/store/useAuthStore.ts` | `src/staff/store/useStaffAuthStore.ts` | rename hook to `useStaffAuthStore`; keep selectors |
| `src/features/{auth,access,dashboard}` | `src/staff/features/{auth,access,dashboard}` | |
| `src/providers/AppProviders.tsx` | `src/shell/RootProviders.tsx` | keep `QueryClientProvider client={staffQueryClient}` here **for now** (moves into the staff layout in M0-04) |

2. Update every import to the new paths (`@/core/...`, `@/staff/...`, `@/shell/...`).
3. Update `backend` script `npm run access:export` output path for mobile from
   `mobile-app/src/features/access/generated/catalog.ts` to `mobile-app/src/staff/features/access/generated/catalog.ts`
   (find the script in `backend/package.json` / `backend/scripts`). Run it once and confirm the file
   is regenerated in the new place with no diff.
4. Delete the now-empty folders `src/components`, `src/lib`, `src/store`, `src/providers`, `src/types`, `src/features`.

**Acceptance:**
- [ ] `npm run lint` and `npm run typecheck` pass.
- [ ] App starts; existing login → select location → home → sign out works exactly as before (screenshots).
- [ ] A user signed in before the change is still signed in after updating (same SecureStore key).
- [ ] No file left in the old folders; `grep -r "@/lib/\|@/store/\|@/features/\|@/components/" src` returns nothing.
- [ ] `core/` contains no import of `@/staff` (grep).
- [ ] `access:export` writes to the new path.

**Out of scope:** new routes, patient code, lint fences (M0-02), any visual change.

---

### M0-02 — Import fences (lint) and lint hygiene

MOB · S · Depends: M0-01 · Branch `mobile/M0-02-lint-fences`

**Goal:** make the [02 §1 fence table](02-architecture.md#import-fences-lint-enforced-in-m0-02) a lint error.

**Steps:**
1. In `eslint.config.js` add file-scoped `no-restricted-imports` blocks using `patterns`:
   - `src/core/**`: forbid `@/staff`, `@/staff/*`, `@/patient`, `@/patient/*`, `@/shell`, `@/shell/*`, and relative
     patterns `**/staff/**`, `**/patient/**`, `**/shell/**`.
   - `src/staff/**`: forbid `@/patient*`, `@/shell*`, `**/patient/**`.
   - `src/patient/**`: forbid `@/staff*`, `@/shell*`, `**/staff/**`.
   - `src/shell/**`: forbid deep imports `@/staff/*` and `@/patient/*` (only the bare barrels `@/staff`, `@/patient` allowed).
   - `src/app/(staff)/**`: forbid `@/patient*`. `src/app/(patient)/**` and `src/app/claim/**`: forbid `@/staff*`.
   Each with a message like `"patient space may not import staff code (docs/02 §1)"`.
2. Add rules: `no-console: error` (allow none), `react/forbid-component-props`? no — instead a custom
   `no-restricted-syntax` rule forbidding JSX `className` string literals containing ` ml-`, ` mr-`,
   ` pl-`, ` pr-`, ` left-`, ` right-` (regex on `Literal[value=/(^|\s)(ml|mr|pl|pr|left|right)-/]`) and
   hex colours (`/#[0-9a-fA-F]{3,8}\b/` inside className strings).
3. Add `scripts/check-fences.mjs`: copies two fixture files (`src/patient/__fence_fixture__.ts`
   importing `@/staff`, and `src/core/__fence_fixture__.ts` importing `@/patient`) into place, runs
   ESLint on them, expects failures, deletes them, exits non-zero if lint passed. Add
   `"lint:fences": "node scripts/check-fences.mjs"` to `package.json`.
4. Fix any existing violations (e.g. `ml-`/`mr-` in generated `core/ui` files are allowed: exclude
   `src/core/ui/**` from the className rule only).
5. Create empty `src/patient/index.ts` (`export {};`) so the barrel exists.

**Acceptance:**
- [ ] `npm run lint` passes; `npm run lint:fences` passes (meaning the fixtures failed lint as expected).
- [ ] Handoff shows the lint output of a deliberate violation.
- [ ] No `eslint-disable` added anywhere.

---

### M0-03 — Storage layer (prefs + encrypted cache)

MOB · S · Depends: M0-01 · Branch `mobile/M0-03-storage`

**Goal:** `core/storage` with a plain prefs store and an encrypted per-space cache store.

**Install:** `npx expo install react-native-mmkv expo-crypto` (verify on the SDK 58 docs that the
installed `react-native-mmkv` version supports the New Architecture; report the version).

**Steps:**
1. `core/storage/prefs.ts`: `prefs = createMMKV({ id: 'prefs' })` (use the API of the installed MMKV major version) with typed helpers
   `getPref<K extends PrefKey>(k)`, `setPref`, `removePref`. `PrefKey` is a string-literal union
   listing every allowed key (`'space.active' | 'staff.queue.segment' | 'staff.theme.cache' | 'patient.language' | …`)
   — adding a key requires editing the union (makes review easy, rule 6 of [03 §2](03-security.md#2-mobile-rules)).
2. `core/storage/secure-cache.ts`: `openSecureCache(space: 'staff' | 'patient')` → gets/creates a
   32-byte random key (`expo-crypto` `getRandomBytes`, base64) in SecureStore `<space>.cacheKey`, opens
   `MMKV({ id: '<space>-cache', encryptionKey })`. `wipeSecureCache(space)` clears all keys, deletes the
   instance file if the API allows, deletes the SecureStore key.
3. `core/storage/query-persister.ts`: a sync-storage persister factory over a secure cache instance,
   for `@tanstack/react-query-persist-client` (install below). Not wired yet (M1-06).
4. Unit tests with an in-memory MMKV mock.

**Install (also):** `npx expo install @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister`

**Acceptance:**
- [ ] Tests: prefs round-trip; unknown pref key is a type error (`// @ts-expect-error` test); secure cache
      uses a key from SecureStore and the same key on second open; wipe removes data and key.
- [ ] No PHI stored anywhere yet.

---

### M0-04 — Space store, welcome screen, two-level guards

MOB · M · Depends: M0-01, M0-02, M0-03 · Branch `mobile/M0-04-spaces`

**Goal:** the route tree of [02 §4](02-architecture.md#4-route-tree-and-guards) with a working staff space and a placeholder patient space.

**Steps:**
1. `core/space/useSpaceStore.ts`: `{ activeSpace: Space | null, setActiveSpace }`, initialised from
   prefs `space.active` synchronously at module load; `setActiveSpace` writes prefs.
   `core/space/switch-space.ts`: `switchSpace(target)`.
2. `shell/RootShell.tsx`: `RootProviders` (without QueryClientProvider now) + root `Stack` with
   `Stack.Protected` for `welcome` (`activeSpace == null`), `(staff)`, `(patient)`; `index` and
   `claim/[token]` always. Splash hides when the active space reports ready (simple: when the space
   layout first renders a non-restoring state; provide `core/splash.ts` with `markReady()`).
3. `shell/WelcomePage.tsx` per X-01 (no product name). `shell/EntryRedirect.tsx`.
4. `staff/navigation/StaffLayout.tsx`: `QueryClientProvider(staffQueryClient)`, restores the staff
   session on mount (existing `useRestoreSession`, renamed `useRestoreStaffSession`), and a `Stack`
   with guards from `resolveStaffRoute()` for `offline`, `login`, `select-location`, `(main)`.
   `staff/navigation/StaffMainLayout.tsx`: `AccessProvider` + `Stack`.
5. Routes: create `src/app/(staff)/{_layout,offline,login,select-location}.tsx`,
   `src/app/(staff)/(main)/{_layout,home}.tsx` (home = existing dashboard page for now). Remove old
   `(auth)`, `(app)`, `offline.tsx`, `select-location.tsx` routes.
6. Patient placeholder: `src/patient/navigation/PatientLayout.tsx` renders a simple page "Patient app
   is coming soon" with [Back] → `switchSpace(null)`. Route `src/app/(patient)/_layout.tsx` + `index.tsx`.
7. Staff login page gets a back arrow to welcome (`switchSpace(null)`). Staff sign-out sets
   `activeSpace` to `null` (patient space does not exist yet).
8. Lint (from M0-02 review): add the remaining 02 §1 fence rows to `eslint.config.js` — root files
   `src/app/*.tsx` may import only `@/shell` and `@/core` (no `@/staff*`, `@/patient*`), and
   `src/app/(staff)/**` / `src/app/(patient)/**` may not import `@/shell*`. Add a third fixture to
   `scripts/check-fences.mjs` (`src/app/__fence_fixture__.tsx` importing `@/staff`).
9. `resolve-staff-route.ts` pure function + unit tests (M0-06 adds the runner; write the test now,
   it runs once M0-06 lands — or do M0-06 first if convenient).

**Acceptance:**
- [ ] First launch → welcome. Choose clinic → staff login → … → home. Kill and reopen → straight to home.
- [ ] Choose patient → placeholder → back → welcome.
- [ ] Sign out → welcome; reopen → welcome.
- [ ] Staff offline at start → staff offline page with retry.
- [ ] Lint fences pass; no shell file imports a deep staff path.
- [ ] **Carry-over from M0-01/M0-08 reviews — must run on a real device or emulator against a running API,
      using a development build** (`npx expo run:android`; Expo Go no longer works since M0-03 added native MMKV):
      a session created *before* updating the app still restores; login → select location → home → sign out
      works; a web sign-in still works (staff tokens now carry `aud: 'staff'`). Screenshots in `docs/reviews/M0-04/`.
      If no device is available, stop and say so in the handoff — do not mark this card `review` without it.

---

### M0-05 — Design tokens, text scale and brand theming

MOB · M · Depends: M0-04 (mounts into `StaffLayout` / `StaffMainLayout`) · Branch `mobile/M0-05-theme`

**Goal:** semantic tokens and the staff clinic brand colour at runtime.

**Read first:** [05 §2–3](05-ui-ux-design-system.md#2-colour-tokens), `web-app/src/features/theme/lib/{color,apply-theme,dark-base}.ts`,
Uniwind docs for `Uniwind.updateCSSVariables(theme, vars)` (exists in uniwind 1.13.2:
`node_modules/uniwind/dist/module/core/config/config.common.d.ts`).

**Steps:**
1. `src/global.css`: add `--color-success`, `--color-success-foreground`, `--color-warning`,
   `--color-warning-foreground`, `--color-info`, `--color-info-foreground` (light + dark), and a platform
   primary (teal-blue, e.g. OKLCH-derived from `#0e7490`) as the default `--color-primary` instead of
   near-black. Verify contrast ≥ 4.5:1 with a small script or test.
2. `core/theme/brand.ts`: port `deriveBrandPalette` (+ helpers it needs) from the web; keep function
   names; header comment "Port of web-app/src/features/theme/lib/color.ts — keep in sync".
3. `core/theme/apply-brand.ts`: `applyBrand(hex | null)` → computes light/dark values for
   `--color-primary`, `--color-primary-foreground`, `--color-ring` and calls `Uniwind.updateCSSVariables`
   for both themes; `null` restores platform defaults.
4. `staff/features/theme/`: `fetchTheme()` (`GET /theme`), `useClinicTheme()` query keyed by org;
   `BrandTheme` component (mounted in `StaffMainLayout`) applies the brand on data and caches
   `{ orgId, brandColor, logoUrl, defaultMode }` in prefs `staff.theme.cache`; `StaffLayout` applies
   the cached brand immediately on mount; leaving the staff space calls `applyBrand(null)`.
5. `core/components/data-display/status-tones.ts` (tables in 05 §2 "Queue status → colour").
6. Text scale (`'staff' | 'patient'`, sizes in [05 §3](05-ui-ux-design-system.md#3-typography)): the two
   spaces are never mounted together, so the scale is global state applied on space mount.
   **Preferred:** `core/theme/apply-text-scale.ts` overrides the Tailwind font-size theme variables
   (`--text-sm`, `--text-base`, `--text-lg`, …) with `Uniwind.updateCSSVariables` for both themes.
   First prove in a 10-line spike that Uniwind resolves `text-*` classes through those variables at
   runtime. **Fallback** if it does not: patch `src/core/ui/text.tsx` to read a `TextScaleContext` and
   map variants to the patient sizes; record the patch in `src/core/ui/PATCHES.md` (with the
   input/textarea `placeholderTextColorClassName` patch that already exists). Report which path you took.
7. Unit tests for `brand.ts`.

**Acceptance:**
- [ ] Changing a clinic's brand colour on the web and pulling to refresh on mobile changes primary buttons.
- [ ] Cold start shows the cached brand without a flash of the default colour (screenshot sequence or note).
- [ ] Welcome screen uses platform colours.
- [ ] Light + dark screenshots of login and home.

---

### M0-06 — Mobile test runner

MOB · S · Depends: M0-01 · Branch `mobile/M0-06-tests`

**Install:** `npx expo install jest-expo jest @testing-library/react-native @types/jest`

**Steps:** per [09 §2](09-testing-and-quality.md#2-mobile-test-setup-task-m0-06). From the M0-03 review: the
`react-native-mmkv` mock must export the **v4** API (`createMMKV`, `deleteMMKV`; prefer the library's own
Jest mock if it exists), and remove the `globalThis` Jest-globals shims at the top of
`src/core/storage/*.test.ts` once `@types/jest` is installed — then make those three files pass. Add first tests: `core/datetime`
(Karachi + New York day bounds, `formatInZone` of a UTC instant), `staff/lib/api` single-flight refresh
(two parallel 401s → one refresh call).

**Acceptance:** `npm test` runs green locally; README "Testing" section updated.

---

### M0-07 — Build configuration: app.config.ts, EAS, updates

MOB · M · Depends: M0-04 · Branch `mobile/M0-07-eas`

**Read first:** SDK 58 docs: app config, EAS Build, EAS Update, `expo-updates`, app variants.

**Install:** `npx expo install expo-updates expo-notifications expo-localization expo-application`

**Steps:**
1. Replace `app.json` with `app.config.ts` keeping every existing field. Read `APP_VARIANT`
   (`development | preview | production`, default `development`). Name: `Clinic` / `Clinic (Dev)` /
   `Clinic (Preview)`. Android package / iOS bundle id: `com.placeholder.clinicapp` + `.dev` / `.preview`
   suffix (O-01). Scheme: `clinicapp` (+ `-dev`/`-preview`). Keep `typedRoutes`, `reactCompiler`.
   Remove `web.output: "server"` (no web target needed) only if the docs confirm nothing depends on it; otherwise leave.
2. `eas.json`: profiles `development` (developmentClient, internal), `preview` (internal APK, channel
   `preview`), `production` (AAB, channel `production`), each with `env.APP_VARIANT` and
   `EXPO_PUBLIC_API_URL` placeholders.
3. `expo-updates`: `runtimeVersion: { policy: 'appVersion' }`, `updates.url` placeholder comment
   (filled after `eas init` by the user).
4. `core/app-version.ts`: current version + `isBelow(min)`; `shell/UpdateRequiredPage.tsx` (X-03);
   `RootShell` checks `GET /app/min-version` (M0-08) once per cold start (fail open on network error).
5. Drop `{ virtual: true }` from the `expo-notifications` mock in `jest.setup.ts` (package now installed).
6. Android notification channels created at start in `core/notifications/channels.ts` (`queue`,
   `reminders`, `general`) — no permission prompt yet.
6. Write `docs/RELEASE.md`: commands the user runs (`npx eas-cli@latest init`, `build --profile preview --platform android`, `update --channel preview`).

**Acceptance:**
- [ ] `npx expo config --type public` prints the expected name/package per `APP_VARIANT` (paste output for all three).
- [ ] Development build installs alongside a preview build (different package ids).
- [ ] `expo-doctor` has no new errors (paste).

---

### M0-08 — Backend: staff token `aud` + min-version endpoint

BE · S · Depends: — · Branch `mobile/M0-08-be-aud`

**Steps:**
1. `src/auth/jwt.service.ts`: add `audience: 'staff'` when signing access tokens.
2. `src/auth/strategies/jwt.strategy.ts`: accept tokens with `aud === 'staff'` **or no `aud`**
   (transition), reject any other `aud` (`UnauthorizedException`). Add a `// TODO(M4-06): require aud` comment.
3. `src/queue/realtime/queue.gateway.ts` `handleConnection`: same rule after `verifyAsync`.
4. Check other verifiers of `JWT_ACCESS_SECRET` (`grep -rn JWT_ACCESS_SECRET src`) and apply the same rule
   where they verify access tokens (not the magic-link HMAC fallback).
5. New `src/app-version/app-version.controller.ts`: `@Public() GET /app/min-version` per [07 §4.3](07-backend-contracts.md#43-app-version--get-appmin-version-public-m0-08);
   env in `.env.example`.
6. Unit tests: strategy accepts no-aud and `staff`, rejects `patient`; gateway same.

**Acceptance:** tests green; web and mobile login still work; `access-coverage.spec.ts` green.

---

### M0-09 — Backend: patient fence skeleton

BE · M · Depends: M0-08 · Branch `mobile/M0-09-be-fence`

**Goal:** the walls exist before any patient route does.

**Steps:**
1. `src/patient-app/decorators/patient-api.decorator.ts`: `IS_PATIENT_API = 'isPatientApi'`;
   `PatientApi()` = `applyDecorators(Public(), SetMetadata(IS_PATIENT_API, true), UseGuards(PatientJwtGuard, PatientLinkGuard))`.
   `PatientAuthRoute()` = `applyDecorators(Public(), SetMetadata(IS_PATIENT_AUTH, true))`.
   For now `PatientJwtGuard` and `PatientLinkGuard` are stubs that **always throw 401** (real ones in M2).
2. `src/patient-app/guards/patient-fence.guard.ts`: path starts with `/patient-api/` ⇔ handler/class
   has `IS_PATIENT_API`; path starts with `/patient-auth/` ⇔ `IS_PATIENT_AUTH`; any mismatch → 403
   `{ code: 'PATIENT_FENCE' }`. Non-http → pass.
3. Register it as the **first** `APP_GUARD` in `app.module.ts` (before RateLimiter — document why:
   cheapest check, and fence errors must never be masked).
4. `src/patient-app/patient-api-coverage.spec.ts`: reflection over all controllers (copy the
   enumeration style of `src/access/access-coverage.spec.ts:36-87`): handlers under `src/patient-app/**`
   must have `IS_PATIENT_API`; handlers under `src/patient-auth/**` must have `IS_PATIENT_AUTH` + a
   `@RateLimit`; no other handler may have either; no handler outside may use path prefix
   `patient-api`/`patient-auth`.
5. `test/patient/route-matrix.int-spec.ts` skeleton: boots the app with the integration harness, lists
   all routes, signs a fake patient token with a test patient secret, asserts 401/403 on every
   non-patient route. (Patient routes don't exist yet — the second half lands in M2-03.)
6. Verify that `guard.acceptance.spec.ts` (GRD-06) and `access-coverage.spec.ts` still pass; if
   GRD-06 needs to know about `@PatientApi`, extend it the same way it treats `LabPortalGuard`.

**Acceptance:** all backend unit + the new int spec green; a dummy controller added in a test proves the
fence returns 403 for a `/patient-api/x` route without `@PatientApi()`.

---

# Phase 1 — Staff space (weeks 3–12)

### M1-01 — Core component kit

MOB · L · Depends: M0-05 · Branch `mobile/M1-01-core-kit`

**Goal:** every component in [05 §6](05-ui-ux-design-system.md#6-core-components-build-in-m1-01-live-in-srccorecomponents)
except `QrCode`, in `src/core/components/{layout,data-display,feedback,forms,overlays}`.

**Install (RNR CLI, user runs):** `npx @react-native-reusables/cli@latest add dialog popover select tabs progress toggle-group`
(only those you need; list them in the handoff).

**Steps:**
1. Move feedback components (already in core) to use `Screen`-friendly padding.
2. Build each component with props as in the table; strings via props only (no `t()`).
3. `FormSheet` on `@gorhom/bottom-sheet` (already installed): `BottomSheetModal` +
   `BottomSheetScrollView`, keyboard handling per the library's RN keyboard-controller guidance,
   dirty guard via a `isDirty` prop and `ConfirmDialog`.
4. A dev-only gallery route `src/app/(staff)/(main)/__gallery.tsx` (hidden in production via
   `__DEV__` guard redirect) that renders every component in every state.
5. Render tests for `StatusBadge` tones, `IconButton` label requirement (type-level), `SearchBar` debounce (fake timers).

**Acceptance:** gallery screenshots light/dark + 1.3× font; tests green; every icon-only control has a label.

---

### M1-02 — Staff tabs shell, More tab, location switch, sign-out

MOB · M · Depends: M1-01, M0-04 · Branch `mobile/M1-02-staff-shell`

**Steps:**
1. `(staff)/(main)/(tabs)/_layout.tsx` → `staff/navigation/StaffTabs.tsx`: Expo Router `Tabs`; each tab
   declares `can` requirements; hidden with `href: null` when not allowed (gates in [02 §4](02-architecture.md#4-route-tree-and-guards)).
   Initial tab: first allowed of Queue, Today, Patients, Schedule, More. Tab icons from lucide.
2. Placeholder pages for Today, Queue, Patients, Schedule (EmptyState "Coming soon") — real ones in later cards.
3. More tab (S-08): profile card, switch location (sheet listing org/locations → `POST /auth/switch-location`
   → `setLocationContext` → `staffQueryClient.clear()` except `access` keys refetch → brand re-applies),
   switch to patient space (placeholder space still), app version, sign out (confirm).
4. Header bell button component (shows unread count — wired in M1-13; render 0 now).
5. Remove the old `home` route / placeholder dashboard.

**Acceptance:** permission matrix: a doctor-only test user sees Queue + Patients + More; a receptionist
sees Queue + Patients + Schedule + More; an owner sees all five (screenshots or test with mocked access).

---

### M1-03 — Staff realtime client

MOB · M · Depends: M1-02 · Branch `mobile/M1-03-staff-realtime`

**Read first:** [02 §7](02-architecture.md#7-realtime), [07 §2.6](07-backend-contracts.md#26-realtime-realtime), the three web socket hooks listed there.

**Steps:**
1. `staff/lib/realtime.ts`: `createStaffSocket(getToken)` with socket.io-client, `transports: ['websocket']`,
   `auth: (cb) => cb({ token: getToken() })` (function form so reconnects use a fresh token).
   Lifecycle per 02 §7 (background 30 s disconnect, foreground reconnect, auth_error → refresh once).
2. `StaffRealtimeProvider` (in `StaffMainLayout`): exposes `useRealtimeStatus()` (`live | reconnecting | offline`)
   and `useRoomSubscription(room | null)` (subscribe on mount/change, unsubscribe on unmount, re-subscribe after reconnect).
   Always subscribes `org:<activeOrgId>`.
3. `staff/lib/realtime-invalidation.ts`: map events to query keys with a 300 ms coalescing window;
   `queue.event` handler compares `seq` with the cached snapshot's `session.eventSeq` (read via
   `queryClient.getQueryData`) and ignores stale.
4. `access.changed` → invalidate `accessKeys.all`. `notification.new` → invalidate `notificationKeys.all`
   and show a toast if `AppState === 'active'` and the current route is not notifications.
5. `ConnectionPill` reads `useRealtimeStatus()`.
6. Tests: invalidation map, stale seq, coalescing.

**Acceptance:** with web + phone open, changing a role on the web refreshes access on the phone within 2 s;
backgrounding the app for 60 s disconnects (server logs) and foregrounding reconnects.

---

### M1-04 — Backend: devices + Expo push provider

BE · M · Depends: M0-08 · Branch `mobile/M1-04-be-push`

**Read first:** [07 §4.2, §8](07-backend-contracts.md#8-push-contract), [08 §4](08-database.md#4-devices-m1-04-staff-m3-07-patient--changesdatepush_devicessql),
`src/notifications/**` (enums, channel-provider, registry, dispatcher, in-app provider).

**Install (backend, user runs):** `npm i expo-server-sdk`

**Steps:**
1. Schema: `user_devices` + outbox CHECK changes (one `changes/` file) + `02_tables.sql` blocks + entity.
2. `src/devices/`: module, entity, service (`register` upsert by token, `unregister`), controller `/me/devices`
   (`@AnyMember() @ContextFree()` — verify which decorators `access-coverage` expects for ContextFree member routes).
3. Notifications: add `PUSH = 'push'` to `NotificationChannel`; add to `CHANNELS_BY_AUDIENCE` for
   doctor/coordinator/staff (not patient yet), `CHANNELS_BY_RECIPIENT` for USER; update
   `notifications.enums.spec.ts` deliberately (patient stays `[]` until M3-07). Add `skipped_no_device`
   status. Add `pushDefault?: boolean` to `EventSeed`; set `true` on `queue.patient_checked_in`.
   Ensure the decision logic only creates push rows for events with `pushDefault` (or in `channels`).
4. `delivery/expo-push.provider.ts`: resolves the user's devices, sends with `expo-server-sdk` (chunks),
   title/body from the rendered payload, `channelId` from a map by event code (`queue.*` → `queue`, else
   `general`), `data` per [07 §8](07-backend-contracts.md#8-push-contract) (route from payload `link`).
   No devices → `SkipSendError('skipped_no_device')`. Handle tickets; store receipt ids for a later
   receipt check job **or** check receipts after 15 min in a simple interval inside the relay role —
   choose the simplest that fits the dispatcher; document. `DeviceNotRegistered` → delete device.
   Env `EXPO_ACCESS_TOKEN` optional.
5. Privacy (A-14): the push body for `queue.patient_checked_in` uses patient **first name** (`full_name`
   split on whitespace, first token) + token. Add a `push_body` template variant if the seed shape needs it.
6. Tests: provider with a mocked Expo client (no devices → skip; DeviceNotRegistered → device deleted);
   enums spec updated.

**Acceptance:** with a real device token (from M1-05) a check-in on the web delivers a push within 5 s.

---

### M1-04a — Push follow-ups (quiet hours, web label, Node engine)

BE + WEB · S · Depends: M1-04 · Branch `mobile/M1-04a-push-followups`

From the M1-04 review: (1) push rows follow the in-app quiet-hours rule (not held) in the notification
decision logic, with a spec; (2) `backend/package.json` gets `"engines": { "node": ">=22.12" }` (the
ESM-only `expo-server-sdk` is loaded through `require`); (3) web `/settings/notifications` shows the
`push` channel with label "Phone (push)" and a working toggle — follow the web CLAUDE.md rules.

---

### M1-05 — Mobile push registration and tap routing

MOB · M · Depends: M1-04, M0-07 · Branch `mobile/M1-05-push`

**Read first:** SDK 58 `expo-notifications` docs (permissions, `getExpoPushTokenAsync` needs `projectId`
from EAS config, Android channels, response listeners, cold-start `getLastNotificationResponse`).

**Steps:**
1. `core/notifications/permissions.ts`: `getPermissionState()`, `requestPermission()`; never at launch.
2. `core/notifications/push-token.ts`: `getExpoPushToken()` (returns null on simulator / denied).
3. `staff/features/devices`: after `StaffMainLayout` mounts, if permission is granted → register
   (`POST /me/devices` with `expoPushToken`, `platform`, `appVersion` — **required**, from `expo-application` — and optional `deviceLabel`); if undetermined → show an explanation sheet once ("Get alerts when patients
   arrive") → request → register. On sign-out → `DELETE /me/devices` before dropping the session.
4. `shell/notification-router.ts` per [02 §8](02-architecture.md#8-push-and-local-notifications): handles
   foreground display (show banner for `queue` channel), taps (warm and cold start), space switching,
   location mismatch prompt. Staff space exposes `handleStaffNotificationRoute(data)` from `@/staff`.
5. Route map: `/queue/doctor` → Queue tab doctor segment; `/patients/:id` → S-05; default → Today/first tab.

**Acceptance:** background, killed-app and foreground cases each demonstrated (screen recording or 3
screenshots + note); signing out stops pushes to that device.

---

### M1-06 — Offline cache and idempotent mutations

MOB · M · Depends: M0-03, M1-02 · Branch `mobile/M1-06-offline`

**Steps:**
1. `core/http/idempotent-mutation.ts`: `useIdempotentMutation({ mutationFn: (vars, key) => …, … })`
   behaviour per [04 §8](04-coding-standards.md#8-mutations); retries only on network error / 503
   `LOCK_TIMEOUT`; exposes `isPending`. Tests.
2. `staff/lib/persist.ts`: `PersistQueryClientProvider` in `StaffLayout` with the encrypted staff cache,
   `maxAge` 24 h, `buster` per [02 §9](02-architecture.md#9-offline), `dehydrateOptions.shouldDehydrateQuery`
   = key root in the allow-list (`access`, `queue`, `appointments` today only, `patients` detail).
3. `core/components/feedback/OfflineBanner` wired into `Screen`; `useOnline()`.
4. A `useCanMutate()` helper → false offline; action buttons use it ("Offline" label).
5. Sign-out wipes cache (`wipeSecureCache('staff')`) — add to `useSignOut`.

**Acceptance:** airplane mode after loading the board → reopen app → board visible with "Updated hh:mm";
actions disabled; reconnect → refresh. Test proves a retried mutation reuses its key.

---

### M1-07 — Queue data layer

MOB · M · Depends: M1-03, M1-06 · Branch `mobile/M1-07-queue-data`

**Goal:** `staff/features/queue` types, api, keys, query hooks and all mutation hooks — no UI.

**Steps:**
1. `types/queue.types.ts` = views and enums from [07 §2.3](07-backend-contracts.md#23-queue) verbatim.
2. `api/queue.api.ts`: one function per endpoint in the doctor + board tables and the two appointment arrival endpoints. Mutations take `(vars, { idempotencyKey, ifMatch? })` and set headers.
3. `api/queue.keys.ts`: `mySession(locId, ymd)`, `board(locId, ymd)`, `session(id)`, `ticket(entryId)`, `patientVisits(patientId)`.
4. Hooks: `useMySession`, `useBoard`, `useSession(id)`; each subscribes the right room through `useRoomSubscription` and falls back to `refetchInterval: 10_000` while realtime is not `live`.
5. Mutation hooks (`useCallNext`, `useStartConsultation`, … one per action) built on `useIdempotentMutation`;
   `onSuccess` invalidates the session/board keys; `onError` maps codes with `queue-errors.ts`
   (table in 07 §2.3) and handles `VERSION_CONFLICT`/`INVALID_TRANSITION` by invalidating.
6. `lib/entry-actions.ts`: pure `availableEntryActions(entry, session, perms, viewer: 'doctor'|'board')`
   → list of action ids, per the tables in [06 S-02a/S-02b](06-screens.md#s-02-queue-tab--staffmaintabsqueuetsx). Exhaustive tests.

**Acceptance:** tests for `availableEntryActions` cover every status × viewer × permission combination listed; typecheck green.

---

### M1-08 — Doctor queue screen (S-02a)

MOB · L · Depends: M1-07 · Branch `mobile/M1-08-doctor-queue`

**Steps:** implement S-02a exactly (wireframe, session states, current-card actions, waiting list in
`waitingOrder`, suggestion line, sticky Call next, ConnectionPill, pull to refresh, haptics, a11y
announcement of the called patient). Segmented control when the user also has `queue.board.view`
(board segment placeholder until M1-09). Reasons (pause, send for test, abort, select out of order)
use a small `ReasonSheet` (FormSheet + one textarea; required where the API requires).

**Acceptance:** manual run of a 10-patient session against a seeded clinic (handoff lists steps and
results); all 4 states screenshotted; no action possible twice while pending.

---

### M1-09 — Reception board (S-02b) and walk-in (S-02c)

MOB · L · Depends: M1-07, M1-01 · Branch `mobile/M1-09-board`

**Steps:** S-02b lanes (doctor chips, open lane `[+]` → doctor picker → `POST /queue/sessions`), entry
ActionSheet per table, ticket sheet; S-02c walk-in sheet with patient search (`GET /patients?search=` via
a small hook in the patients feature, exported from its barrel), new-patient fields, urgent toggle,
`ACTIVE_WITH_OTHER_DOCTOR` force dialog. Form: `walk-in.schema.ts` + `useWalkInForm.ts`.

**Acceptance:** two-phone test (board + doctor) from [09 §4](09-testing-and-quality.md#staff-gate-end-of-phase-1) reception items pass.

---

### M1-10 — Arrivals check-in (S-03) and close session

MOB · M · Depends: M1-08, M1-09 · Branch `mobile/M1-10-arrivals-close`

**Steps:** S-03 list + check-in + late → convert dialog; close-session modal from S-02a (per-entry
cancel/transfer decisions, doctor picker from `GET /appointments/doctors`).

**Acceptance:** late check-in converts; closing with 3 leftovers sends 3 decisions; errors mapped.

---

### M1-11 — Patients list and quick register (S-04)

MOB · M · Depends: M1-01, M1-06 · Branch `mobile/M1-11-patients`

**Steps:** `staff/features/patients`: api/keys/types (from [07 §2.4](07-backend-contracts.md#24-patients-srcpatientspatientscontrollerts-every-id-route-is-scope-checked--404-outside-scope)),
`usePatientsInfinite(filters)`, S-04 page (search, chips, infinite list, recently opened), quick register
`FormSheet` with phone-exists check. Masking helper `maskPhone` in `lib/`. Tests for schema and masking.

**Acceptance:** search, filters, infinite scroll, empty vs no-results states, quick register → opens S-05 stub.

---

### M1-12 — Patient summary (S-05)

MOB · M · Depends: M1-11 · Branch `mobile/M1-12-patient-summary`

**Steps:** S-05 header + alerts (`lib/patient-alerts.ts`, port of the web logic, tested), segments by
permission/feature (`hasFeature('patients.prescriptions')`, `patients.teeth_chart`), Visits (queue visits +
history), Rx list + read-only detail sheet, Chart summary (latest chart: list of teeth with conditions;
no drawing). ⋯ menu: call, WhatsApp, copy MR no. Adds to "recently opened".

**Acceptance:** a user without `patients.clinical.view` sees Overview + Visits only; screenshots of each segment.

---

### M1-13 — Notifications inbox and bell (S-07)

MOB · S · Depends: M1-03 · Branch `mobile/M1-13-notifications`

**Steps:** `staff/features/notifications`: api/keys, `useUnreadCount`, infinite inbox, mark read / all,
link router (shared with push routing: `staff/lib/link-router.ts`), other-clinic rows prompt. Bell in
headers wired. Sound pref toggle in More.

**Acceptance:** realtime `notification.new` increments the badge without refresh.

---

### M1-14 — Schedule tab (S-06)

MOB · M · Depends: M1-07 · Branch `mobile/M1-14-schedule`

**Steps:** day strip, doctor + status filters, grouped list, appointment sheet with check-in (reuses
M1-10 mutation). Uses `clinicDayBounds` from `staff/lib/datetime`.

**Acceptance:** own-scope doctor sees only own; day switching keeps filters; times in clinic tz on a phone set to another timezone (screenshot with phone tz = UTC).

---

### M1-15 — Today snapshot (S-01)

MOB · M · Depends: M1-07, M1-14 · Branch `mobile/M1-15-today`

**Steps:** blocks per [06 S-01](06-screens.md#s-01-today-owner-snapshot--staffmaintabstodaytsx) and
[07 §2.7](07-backend-contracts.md#27-dashboard-data-no-dashboard-endpoint-exists--compose); each block gated
and independently loading; location switcher in header. Replace the old dashboard feature (delete it).

**Acceptance:** owner + receptionist + doctor screenshots show the right blocks.

---

### M1-16 — Staff hardening pass

MOB · M · Depends: M1-08 … M1-15 · Branch `mobile/M1-16-staff-hardening`

**Steps:** run the whole staff gate checklist ([09 §4](09-testing-and-quality.md#staff-gate-end-of-phase-1)),
fix bugs found, measure cold start and APK size (preview build), TalkBack pass, 1.3× font pass, dark mode pass.
Write `docs/reviews/M1-16/report.md` with numbers.

**Acceptance:** all gate items checked or listed as known issues with severity.

---

### M1-17 — Staff Google sign-in (optional for pilot)

MOB + BE · M · Depends: M1-02 · Branch `mobile/M1-17-staff-google`

Needed only if the pilot clinic uses "Google only" sign-in. Backend: `GoogleIdentityService` accepts an
array of audiences (env `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`). Mobile: native Google
sign-in library chosen by the architect at expansion time (check SDK 58 docs), `POST /auth/google`,
handle the three outcomes. Architect expands before start.

---

# Phase 2 — Patient core (weeks 13–24)

Architect expands each card before it starts. Contracts: [07 §5–6](07-backend-contracts.md#5-new-patient-auth-patient-auth--module-srcpatient-auth-m2-02), tables: [08 §1–3](08-database.md).

| ID | Area | Size | Title | Depends | Key acceptance |
| --- | --- | --- | --- | --- | --- |
| M2-01 | BE | M | Identity tables + entities (accounts, identities, sessions, login codes, profiles, links, claim tokens, consents, access log) | M0-09 | change file runs twice without error; entities load |
| M2-02 | BE | L | `src/patient-auth`: email code, Google (multi-audience), sessions with rotation + reuse detection, `patient-jwt` strategy (separate secret, `aud`, attaches to `req.patientAuth` **not** `req.user`), `PatientJwtGuard`, `/patient-api/me` | M2-01 | strategy tests both directions; start-up fails if patient secret missing/equal to staff secret |
| M2-03 | BE | M | `PatientLinkGuard` + `linkedPatientWhere()` + route-matrix second half + link-isolation int spec; int specs refuse a non-local DB URL; `test:int:patient` script | M2-02 | isolation + matrix green **on a disposable Postgres** (first real run of the M0-09 spec) |
| M2-04 | BE | M | `src/patient-links` staff endpoints (claim token, status, revoke) + `/patient-api/claims/*` + events `patient.record_linked/link_revoked` + audit | M2-03 | full claim flow via HTTP in an int spec |
| M2-05 | WEB | S | "Link app" button + QR dialog on web patient detail (`patients.app_link.manage`) | M2-04 | QR scannable from phone; status refresh |
| M2-06 | MOB | L | Patient space foundation (also: StaffLayout skips restore when already `signedIn`, see M0-04 review): `patient/lib/api.ts` (factory `createApiClient` extracted from staff), `usePatientAuthStore`, session restore, `PatientLayout` guards, sign-in + verify-code (P-00), i18n setup (A-12), `PatientProviders`, sign-out wipe, space switching both ways | M2-02, M0-04 | sign-out wipes only patient; both spaces signed in at once |
| M2-07 | MOB | M | Claim flow (P-01): deep link route, pending claim store, confirm page | M2-04, M2-06 | QR → app → linked in < 2 min |
| M2-08 | BE | L | Read services: appointments, visits, prescriptions (+detail), billing summary; visibility rules ([07 §3](07-backend-contracts.md#3-patient-visibility-rules)); access log writes; settings `patient_app.show_billing`, `patient_app.show_diagnosis` | M2-03 | DTO snapshot tests prove no internal fields |
| M2-09 | MOB | L | Records tab (P-03) + prescription/appointment details | M2-08, M2-06 | 4 segments with all states; clinic chips |
| M2-10 | MOB+BE | M | Profiles endpoints + Family tab (P-04) + profile detail | M2-06 | dependents shown with their links |
| M2-11 | MOB+BE | M | Linked clinics (P-08), unlink, link history, delete account (P-09) | M2-06 | delete → re-sign-up is a fresh account |
| M2-12 | BE | S | `patient_app` feature (un-retire `patients.portal`? **No** — new key `patient_app`), permission `patients.app_link.manage`, `npm run access:export` | M0-09 | catalog regenerated in web + mobile |
| M2-13 | BE+MOB | S | `product_events` + `POST /patient-api/events`, staff `POST /me/events`; event list in `docs/analytics-events.md` | M2-06 | pilot metrics queries documented |
| M2-14 | WEB | S | Public landing pages `/c/:token` (open app or go to store) and `/v/:token` (visit state) | M2-04 | works on a phone without the app |
| M2-15 | MOB | S | Staff "Link app" QR screen (S-09) | M2-04, M1-12 | |
| M2-16 | MOB | S | Apple sign-in (iOS only), behind platform check | M2-06 | only when iOS build is planned |

# Phase 3 — Patient hook (weeks 25–30)

| ID | Area | Size | Title | Depends | Key acceptance |
| --- | --- | --- | --- | --- | --- |
| M3-01 | BE | L | `src/medications`: on prescription `finalize()` create/update schedules for every linked profile (event handler, not inside `finalize`'s critical path); parsers: `frequency_timing` tags → default times (`morning` 08:00, `noon`/`afternoon` 14:00, `evening` 20:00, `night`/`bedtime` 22:00; unknown tag → ignored + fallback to `frequency` text: `OD`, `BD`, `TDS`, `QID`, `1+0+1`, `1-1-1`, "twice a day", Urdu "din mein do baar"), `duration` → days ("5 days", "1 week", "2 weeks", "10 din", "1 month") else `endDate=null`, `endDateSource='unknown'`; `prescription.issued` event | M2-08 | parser table tests ≥ 40 cases |
| M3-02 | BE | M | Medications endpoints (list, patch, dose events) | M3-01 | dose-event upsert idempotent |
| M3-03 | MOB | L | Reminder engine: pure `planReminders(schedules, events, now, horizon=72h, cap=60)` → notification requests; scheduler diff (cancel stale ids, schedule new) on app start, foreground, feed change; private reminders; OEM battery guide screen | M3-02 | planner table tests; airplane-mode reminder rings |
| M3-04 | MOB | L | Today screen (P-02) incl. offline dose actions queue + sync | M3-03 | works offline; sync after reconnect |
| M3-05 | BE | M | `/patient-realtime` gateway, entry subscriptions, outbox fan-out `visit.event`, `/patient-api/queue/active`, `queue_visit_tokens` + `/visit/:token/state` | M2-03 | socket auth tests both directions |
| M3-06 | MOB | M | Live token card + visit screen (P-06) | M3-05 | updates within 2 s |
| M3-07 | BE+MOB | M | Patient push: `patient_devices`, `CHANNELS_BY_AUDIENCE.patient = [PUSH]`, patient recipient resolver (patient → active link → account devices), events `queue.turn_near` (threshold from queue policy, default 2, once per entry), `queue.called`, `appointment.reminder` (scheduled 24 h before via `scheduledFor`), mobile registration | M3-05, M1-04 | pushes arrive; no clinical text |
| M3-08 | BE+MOB | S | Appointment confirm (`patient_confirmed_at`) | M2-09 | staff web shows "Confirmed by patient" |
| M3-09 | MOB | S | Emergency/contact sheet (P-07) | M2-09 | |

# Phase 4 — Release (weeks 31–32)

| ID | Area | Size | Title |
| --- | --- | --- | --- |
| M4-01 | MOB | M | Urdu translation pass + Noto Nastaliq font + layout check (O-06) |
| M4-02 | MOB | S | Store assets: icon, splash (neutral), screenshots (3 patient, 3 staff) |
| M4-03 | BE | S | Demo clinic seed + demo staff/patient accounts for store review |
| M4-04 | ALL | M | Privacy policy, terms, Data safety form inputs, account-deletion web URL |
| M4-05 | MOB | M | Release hardening: crash/error reporting decision (no PHI), performance budgets, final QA (patient gate) |
| M4-06 | BE | S | Require `aud` on staff tokens (remove transition) — one release after M0-08 shipped |
