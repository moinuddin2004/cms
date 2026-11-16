# Handoff log

> Append-only. Newest entry at the **bottom**. One entry per finished task (or rework round).
> The next agent (implementer or architect) reads the last few entries before starting.

## Template (copy below the last entry)

~~~markdown
---
## <TASK-ID> — <title>  ·  YYYY-MM-DD  ·  <model name>
Branch: mobile/<TASK-ID>-<slug>   Commit(s): <sha or "uncommitted">   Status set to: review

### Done
- What was built, in 3–8 bullets, mapped to the card's steps.

### Files
- Created: …
- Modified: …
- Deleted / moved: …

### Install commands for the user
```bash
npx expo install …
```
(or "none")

### Verification
- `npm run lint` → <summary line>
- `npm run typecheck` → <summary line>
- `npm test` → <n passed>
- Backend: … 
- Manual: steps performed and what was seen. Screenshots: docs/reviews/<TASK-ID>/

### Acceptance criteria
- [x] … (how proven)
- [ ] … (why not — blocker?)

### Deviations from the card / docs
- None | what and why

### Questions for the architect
- None | …

### Notes for the next task
- Anything the next implementer must know (traps, half-done parts, TODO ids).
~~~

---

## ARCH-00 — Documentation set created  ·  2026-11-11  ·  Claude Opus (architect)
Branch: master (docs only)   Commit(s): uncommitted   Status set to: —

### Done
- Wrote the mobile doc set in `mobile-app/docs/` (overview, architecture, security, coding standards,
  UI/UX system, screen specs, backend contracts, database, testing, roadmap + task cards, review
  protocol, decisions, progress, this log) and rewrote `mobile-app/CLAUDE.md` as the agent entry point.
- Verified the staff API surface, guard chain, notifications pipeline and patient-related tables
  against the backend code (file:line references in 07 and 08).

### Decisions taken
- A-01 … A-16 in DECISIONS.md. The biggest: source split `core/staff/patient/shell` with lint fences
  (replaces the plan doc's `features/patient-*` prefix), two-level route guards, invalidate-only
  realtime, encrypted MMKV cache, on-device reminder planning.

### Notes for the next task
- Start with **M0-01**. M0-08 (backend) has no mobile dependency and can run in parallel by a second
  implementer on its own branch.
- Open decisions O-01…O-07 do not block Phase 0/1; O-01 (package name) blocks the first store upload.

---
## M0-01 — Split source into core / staff / shell  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M0-01-folder-split   Commit(s): 4924247 (code)   Status set to: review

### Done
- `git mv` of every existing file into the A-01 layout: `src/core/**` (ui, components/{forms,feedback},
  datetime, money, storage, query, http, types, env, utils), `src/staff/**` (features auth/access/dashboard,
  lib, store), `src/shell/RootProviders.tsx`; the old `src/{components,lib,store,providers,types,features}`
  folders are gone.
- `core/storage/secure-store.ts`: `createSecureItem(key)` → `{ get, set, clear }` (same
  `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` options and error handling); the staff item uses the **same** key
  `auth.refreshToken` in `staff/lib/session.ts`, so sessions stored before the split still restore.
- `core/query/create-query-client.ts` (factory, today's defaults) + `core/query/managers.ts`
  (`setupQueryManagers`); `staff/lib/query-client.ts` → `staffQueryClient = createQueryClient()`;
  `shell/RootProviders.tsx` keeps `QueryClientProvider client={staffQueryClient}` (moves into the staff
  layout in M0-04).
- `core/datetime/index.ts` is pure (zone is a parameter) with `formatInZone(v, zone, pattern)`,
  `formatYmd`, `zonedDateTimeToUtc`, `dayBoundsInZone`, `todayYmdInZone`, `zonedDate`, `isYmd`,
  `ymdToDate`, `toUtcIso`, `isValidTimezone`, `deviceTimezone` (+ `inZone`); `staff/lib/datetime.ts`
  binds the active location and keeps every old export name and behaviour.
- `core/money/format.ts` `formatMoney(amount, currency, locale = 'en-PK')` + `staff/lib/currency.ts` with
  today's `DEFAULT_CURRENCY` / `activeCurrency` / `useCurrency` / `formatCurrency`.
- `staff/lib/api.ts` exports `staffApi` (single-flight refresh, gate codes, native headers unchanged);
  `apiErrorMessage` moved to `core/http/api-error.ts`. `useAuthStore` → `staff/store/useStaffAuthStore.ts`
  as `useStaffAuthStore` (selectors `activeOrganization`, `activeClinicBlock`,
  `needsLocationSelection` kept).
- `components.json` aliases → `@/core/ui`, `@/core/components`, `@/core/utils`, `@/core`,
  `@/core/hooks`; `backend/scripts/export-access-catalog.ts` now writes the mobile catalog to
  `src/staff/features/access/generated/catalog.ts` and was run once.
- Every import updated. The route tree is untouched (`app/` still `(auth)`, `(app)`, `offline`,
  `select-location`) — new routes belong to M0-04, not this card.

### Files
- Created: `src/core/{http/api-error.ts, query/managers.ts, datetime/index.ts, money/format.ts,
  storage/secure-store.ts, types/index.ts}`, `src/staff/lib/{session.ts, datetime.ts, currency.ts,
  query-client.ts}`, `src/shell/RootProviders.tsx` (moved from `providers/AppProviders.tsx`).
- Moved: everything in the card's table (`git mv`, history kept); `src/staff/lib/api.ts` was
  `src/lib/api.ts`.
- Modified: `components.json`, `backend/scripts/export-access-catalog.ts`, the `src/app/**` route files
  and all moved files' imports.
- Deleted / moved: `src/{components,lib,store,providers,types,features}` (empty folders removed).

### Install commands for the user
none

### Verification
- `npm run typecheck` → exit 0, no output.
- `npm run lint` (`expo lint`) → `✖ 3 problems (0 errors, 3 warnings)`: two
  `import/no-named-as-default-member` axios warnings and one pre-existing
  `react-hooks/exhaustive-deps` in `core/ui/skeleton.tsx` — no new violations. NOTE: under this
  sandbox the `expo lint` parent process prints the result but never exits (the Expo CLI spawns ESLint
  with piped stdio and the sandbox blocks named pipes). In-process
  `node node_modules/eslint/bin/eslint.js . --no-warn-ignored` → same output in 19 s, exit 0.
- `npm test` → not available yet: the jest runner is card M0-06 (no `test` script in package.json).
  This card adds no tests.
- Backend: `npm run access:export` → `Wrote 70 permissions to
  …/mobile-app/src/staff/features/access/generated/catalog.ts`; `git hash-object` of the new file
  equals `master:mobile-app/src/features/access/generated/catalog.ts` (byte-identical, no formatting
  drift) and the web catalog is unchanged.
- `grep -r "@/lib/\|@/store/\|@/features/\|@/components/" mobile-app/src` → nothing;
  `grep "@/staff\|@/patient\|@/shell" src/core` → nothing; `src/` now contains only `app core shell
  staff` (+ `global.css`, `uniwind-types.d.ts`).
- Manual: **not run** — no Android emulator/device and no local Postgres on this machine.
  `docs/reviews/M0-01/` is therefore absent.

### Acceptance criteria
- [x] `npm run lint` and `npm run typecheck` pass (see above).
- [ ] App starts; login → select location → home → sign out unchanged (screenshots) — not
      demonstrated: no runnable device/database here (see Questions). Static proof: route tree
      unchanged, same provider tree, same QueryClient defaults, same refresh-token key, typecheck clean.
- [x] A user signed in before the change is still signed in: `createSecureItem('auth.refreshToken')`
      with identical options and error handling.
- [x] No file left in the old folders; grep returns nothing.
- [x] `core/` imports no space (grep).
- [x] `access:export` writes to the new path (byte-identical output).

### Deviations from the card / docs
- Added `src/staff/lib/session.ts`: the card generalises `secure-storage` but does not name the staff
  file, and 02 §1 lists `staff/lib/session.ts`, so the staff key lives there.
- `core/datetime` also exports `inZone(zone)` — the internal date-fns `{ in: tz(zone) }` option, reused
  by `formatInZone` and by `staff/lib/datetime.ts`'s `inClinic`.
- M0-08's commits were made on this branch (its own handoff says "as instructed"). I preserved them on
  branch `mobile/M0-08-be-aud` (same commits a2cf96d + 0ab5230) and reset this branch to master before
  committing, so each branch holds one task (A-15). This branch's M0-08 PROGRESS row is back to `ready`;
  M0-08's handoff entry still names `mobile/M0-01-folder-split` as its branch.
- The shared working tree still holds M0-08's backend files (uncommitted here) — they are not part of
  this branch's diff.

### Questions for the architect
- Screenshots/run: this machine has no emulator, no attached device and no local database, so the
  login → select location → home → sign-out flow could not be executed. Is static evidence
  (typecheck + ESLint + import greps + byte-identical catalog + unchanged route tree) enough to mark
  this structural card `done`, or must someone with a device run the flow?
- M0-08 was committed on this branch. I split it onto `mobile/M0-08-be-aud` per A-15 — confirm, or say
  if both tasks should share one branch after all.
- `components.json` now points `hooks` at `@/core/hooks`, which does not exist yet (the card's alias
  text). RNR components added in M1-01 that use `@/core/hooks` will need that folder first.

### Notes for the next task
- M0-02 can add the fences now: the layout is `src/{app,core,shell,staff}`; `src/patient/index.ts`
  (`export {};`) has to be created there.
- `core/log.ts` (docs 03 §2.7) does not exist yet; M0-02 adds `no-console`, so add the helper there or
  in the first card that needs logging.
- `staff/lib/datetime.ts` and `staff/lib/currency.ts` read `useStaffAuthStore`; the future patient
  modules must use `@/core/datetime` and `formatMoney` directly, never these.
- `staff/lib/api.ts` is the only bearer/tenant-header path; M0-04 renames `useRestoreSession` →
  `useRestoreStaffSession` and moves `QueryClientProvider` out of `RootProviders`.

---
## M0-08 — Backend: staff token `aud` + min-version endpoint  ·  2026-11-11  ·  DeepSeek
Branch: mobile/M0-01-folder-split (same branch as requested; the card's `mobile/M0-08-be-aud` was not created)   Commit(s): a2cf96d (backend)   Status set to: review

### Done
- `JwtTokenService.generateAccessToken` now signs with `aud: 'staff'` (shared by the web app and the mobile staff space).
- New `assertStaffAudience()` (`src/auth/staff-audience.ts`): accepts `aud: 'staff'` or no `aud`, throws `UnauthorizedException` for anything else. Both call sites carry the `TODO(M4-06): require aud` marker.
- `JwtStrategy.validate` and `QueueGateway.handleConnection` run the check — the socket answers `auth_error` and gets no `user:<id>` room; display screens still connect anonymously.
- Checked every `JWT_ACCESS_SECRET` reader: only those two verify access tokens; `lab-access/magic-links/magic-link-token.ts` is the magic-link HMAC fallback and is untouched.
- New `src/app-version/`: `@Public() GET /app/min-version` → `{ android, ios, message? }` from `MOBILE_MIN_VERSION_ANDROID` / `MOBILE_MIN_VERSION_IOS` (default `0.0.0`) and optional `MOBILE_MIN_VERSION_MESSAGE`; rate limited 60/min per IP; registered in `app.module.ts`; env documented in `.env.example`.
- Unit tests: strategy (staff + no-aud accepted, `patient` + other rejected), gateway connect (staff/no-aud join the user room, patient → `auth_error`, anonymous display passes), app-version service (defaults, env, message trim) and controller (route + `@Public` + success envelope).

### Files
- Created: `backend/src/auth/staff-audience.ts`, `backend/src/auth/strategies/jwt.strategy.spec.ts`, `backend/src/queue/realtime/queue.gateway.spec.ts`, `backend/src/app-version/{app-version.module.ts,app-version.controller.ts,app-version.service.ts,app-version.controller.spec.ts,app-version.service.spec.ts}`
- Modified: `backend/src/auth/jwt.service.ts`, `backend/src/auth/strategies/jwt.strategy.ts`, `backend/src/queue/realtime/queue.gateway.ts`, `backend/src/app.module.ts`, `backend/.env.example`
- Deleted / moved: none

### Install commands for the user
none

### Verification
- `npm run build` → clean.
- `npx jest --runInBand --testPathPattern "(jwt\\.strategy|queue\\.gateway|app-version)"` → 4 suites, 13 tests passed.
- `npx jest --runInBand` (full unit suite) → 86 suites, 887 tests passed.
- `npx jest --runInBand access-coverage` → 2 suites, 29 tests passed; the new route is `@Public()` so the coverage rule holds.
- `npm run lint` → not usable in this checkout: `core.autocrlf=true` gives the whole tree CRLF line endings and Prettier flags every existing file (an untouched `auth.module.ts` fails the same way). New files are LF and `prettier --check` passes on them; ESLint with the Prettier rule off reports only the pre-existing `no-unsafe-*` / `require-await` findings in `jwt.strategy.ts` and `queue.gateway.ts`.
- Manual login / live DB run → not possible here (no Postgres). The token-shape change is covered by the strategy tests: new tokens (`aud: 'staff'`) and sessions minted before this change (no `aud`) both validate.

### Acceptance criteria
- [x] Tests green (13 new; the access-coverage specs stay green).
- [ ] Web and mobile login still work end-to-end — needs a running API + DB; unit level proves both token shapes are accepted. Reviewer: sign in once in the web app and once with the mobile staff login.
- [x] `access-coverage.spec.ts` green.

### Deviations from the card / docs
- Branch: stayed on `mobile/M0-01-folder-split` as instructed instead of `mobile/M0-08-be-aud`.
- Added `MOBILE_MIN_VERSION_MESSAGE` as the source of the contract's optional `message` (07 §4.3 does not name the env var).
- Added a 60/min per-IP `@RateLimit` to the public endpoint, matching the other `@Public()` routes.

### Questions for the architect
- None.

### Notes for the next task
- M0-09 (fence) / M2-02 (patient auth) must mint patient tokens with `JWT_PATIENT_ACCESS_SECRET` and `aud: 'patient'`; the staff strategy and `/realtime` now reject that audience explicitly, on top of the different secret.
- `TODO(M4-06)` is in `src/auth/staff-audience.ts` and `src/auth/strategies/jwt.strategy.ts`: drop the no-aud acceptance one release after M0-08 ships.
- `/realtime` is staff-only by design; the patient socket must be a separate `/patient-realtime` gateway (07 §2.6).
- `GET /app/min-version` is env-driven, so raising a floor is an env change + API restart — no schema or migration work.

---
## REVIEW M0-01 + M0-08  ·  2026-11-11  ·  Claude Opus (architect)
Branch: reviewed `mobile/M0-01-folder-split` and `mobile/M0-08-be-aud`   Status set to: done (both, merge pending)

### Done
- M0-01: typecheck ✓, ESLint 0 errors ✓, import greps ✓ — verdict done. Review: `docs/reviews/M0-01/review.md`.
- M0-08: 7 suites / 46 tests ✓ (strategy, gateway, app-version, access-coverage, guard acceptance) — verdict done.
  Review: `docs/reviews/M0-08/review.md`.
- Runtime smoke (device + DB) for both moved into M0-04's acceptance.
- PROGRESS: parallel-work rule added (one checkout = one implementer; use `git worktree` for parallel cards).

### Notes for the next task
- Both branches must be merged into `master` (by the user) before M0-02 / M0-03 / M0-05 / M0-06 / M0-09 branch off.
  Expect a small conflict in `docs/PROGRESS.md` and `docs/HANDOFF.md` (both branches edited them) — keep both entries.
- M0-02 also creates `src/core/log.ts` (see M0-01 review notes).

---
## ARCH — Integration branch `mobile/develop`  ·  2026-11-11  ·  Claude Opus (architect)
Branch: mobile/develop (new, from master)   Status set to: M0-01, M0-08 → done (in develop)

### Done
- User decision: no mobile-programme code goes to `master` for now. Created `mobile/develop` from `master`
  and merged `mobile/M0-01-folder-split` and `mobile/M0-08-be-aud` into it (`--no-ff`); doc conflicts in
  PROGRESS/HANDOFF resolved keeping both entries.
- Docs updated: 04 §18, 11 §2, PROGRESS header, CLAUDE.md — every card now branches from `mobile/develop`.

### Notes for the next task
- `git switch mobile/develop && git pull` before creating your card branch.

---
## M0-02 — Import fences (lint) and lint hygiene  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M0-02-lint-fences   Commit(s): 7a3c4f8 (code)   Status set to: review

### Done
- `eslint.config.js`: file-scoped `no-restricted-imports` fences for every row the card lists —
  `src/core/**` (no staff/patient/shell, alias or relative), `src/staff/**` (no patient/shell),
  `src/patient/**` (no staff/shell), `src/shell/**` (deep `@/staff/*` and `@/patient/*` only; the bare
  barrels stay allowed), `src/app/(staff)/**` (no patient) and `src/app/(patient)/**` + `src/app/claim/**`
  (no staff). Every pattern carries a docs/02 §1 message.
- Added `no-console: error` and a `no-restricted-syntax` rule for JSX `className` string literals:
  physical direction classes (`ml-/mr-/pl-/pr-/left-/right-`) and hex colours are errors; `src/core/ui/**`
  is excluded from the className rule only (generated RNR files keep upstream classes).
- `scripts/check-fences.mjs` (`npm run lint:fences`): writes the two fixtures
  (`src/patient/__fence_fixture__.ts` → `@/staff`, `src/core/__fence_fixture__.ts` → `@/patient`), lints
  them through ESLint's Node API (no child process, so it also runs under the sandbox), deletes them in a
  `finally`, and exits non-zero unless both are rejected by `no-restricted-imports`.
- Fixed the one existing violation the new shell fence exposed: `shell/RootProviders.tsx` deep-imported
  `@/staff/lib/query-client`. Added the `src/staff/index.ts` public barrel (02 §1) and import `@/staff`.
- Created the empty patient barrel `src/patient/index.ts` (`export {};`).
- Created `src/core/log.ts` per the M0-01 review notes (03 §2.7): `debug`/`warn` compile out of release
  builds, `error(name, code?, route?)` carries only the error's name/code/route — never a payload.

### Files
- Created: `mobile-app/scripts/check-fences.mjs`, `mobile-app/src/core/log.ts`,
  `mobile-app/src/patient/index.ts`, `mobile-app/src/staff/index.ts`
- Modified: `mobile-app/eslint.config.js`, `mobile-app/package.json`,
  `mobile-app/src/shell/RootProviders.tsx`, `mobile-app/docs/PROGRESS.md`
- Deleted / moved: none (the temporary fixtures and the violation probe are removed by the script/me)

### Install commands for the user
none (no package added; `eslint` and `eslint-config-expo` were already installed)

### Verification
- `npm run lint` (`expo lint`) → `✖ 3 problems (0 errors, 3 warnings)`, exit 0. The three warnings are the
  pre-existing ones M0-01 recorded (two `import/no-named-as-default-member` on axios in
  `core/http/api-error.ts` and `staff/lib/api.ts`, one `react-hooks/exhaustive-deps` in `core/ui/skeleton.tsx`).
- `npm run lint:fences` → exit 0:
  `PASS patient space importing @/staff: '@/staff' import is restricted from being used by a pattern. patient space may not import staff or shell code (docs/02 §1)`
  `PASS core importing @/patient: '@/patient' import is restricted from being used by a pattern. core code may not import a space or the shell (docs/02 §1)`
  `lint:fences: both forbidden directions failed lint as expected.`
- `npm run typecheck` → exit 0, no output. NOTE: this fresh worktree had no `expo-env.d.ts` (it is
  gitignored and generated by Expo); typecheck failed on `src/app/_layout.tsx`'s `@/global.css` import until
  I created the standard generated file locally. It is not committed.
- `npm test` → not available: the Jest runner is card M0-06 (no `test` script); this card adds no tests.
- Deliberate violations (temporary `src/staff/__lint_probe__.tsx`, deleted afterwards):
  ```
  5:3   error  Unexpected console statement                                     no-console
  6:26  error  Use theme tokens instead of hex colours in className (docs/04 §4)  no-restricted-syntax
  6:26  error  Use logical direction classes (...) instead of ml-/mr-/pl-/pr-/left-/right- (docs/04 §4, A-13)  no-restricted-syntax
  ✖ 3 problems (3 errors, 0 warnings)
  ```
- No suppression directives were added (checked the changed/created files for disable comments).
- Manual: n/a — configuration-only card, no screen.

### Acceptance criteria
- [x] `npm run lint` passes; `npm run lint:fences` passes (fixtures failed lint as expected) — outputs above.
- [x] Handoff shows the lint output of a deliberate violation — see Verification.
- [x] No suppression directive added anywhere.

### Deviations from the card / docs
- Added `src/staff/index.ts` (the card does not name it) because card step 4 requires fixing existing
  violations, and 02 §1 says the shell may import staff only through that barrel. `RootProviders` now
  imports `{ staffQueryClient } from '@/staff'`.
- `src/core/log.ts` needs a console sink, so `no-console` is turned off for that single file in
  `eslint.config.js` (every other file stays at `error`). "allow none" cannot hold for the logger itself.

### Questions for the architect
- 02 §1 also forbids staff/patient imports in `src/app/` root files (shell is allowed there) and forbids
  `@/shell` from the `(staff)`/`(patient)` route groups; card step 1 lists only `@/patient*` (staff routes)
  / `@/staff*` (patient routes). Enforcing the root row now would fail lint (`src/app/_layout.tsx` still
  imports `@/staff/features/auth` and `@/staff/store/...`) and that move is M0-04's. Confirm the remaining
  rows are intentionally deferred, or should the route-group `@/shell` patterns be added now?
- Is the file-scoped `no-console: off` for `src/core/log.ts` acceptable, or should the logger have no
  console call at all until M4-05 decides crash reporting?

### Notes for the next task
- The fences are live: any `src/core` import of `@/staff`/`@/patient`/`@/shell`, any cross-space import, and
  any deep `@/staff/*` / `@/patient/*` import from `src/shell` is an ESLint error.
- `src/core/log.ts` is the only console sink; feature code uses `log.debug` / `log.warn` / `log.error`
  (name, code, route only — no payloads). No `console.*` anywhere else.
- `src/patient/` currently contains only the empty barrel; M0-04 fills it.
- `npm run lint:fences` writes and deletes its two fixtures on every run — do not commit them.

---
## M0-03 — Storage layer (prefs + encrypted cache)  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M0-03-storage   Commit(s): b235a1f (code)   Status set to: review

### Done
- `core/storage/prefs.ts`: plain MMKV instance `prefs` (`createMMKV({ id: 'prefs' })`, v4 API) behind
  typed `getPref` / `setPref` / `removePref`. `PrefKey` is the whole unencrypted allow-list — active
  space, queue segment, theme cache, last tab/filter, dismissed tips, patient language — so adding a
  pref requires editing the union (docs/03 §2.6).
- `core/storage/secure-cache.ts`: `openSecureCache(space)` reads/creates the key in SecureStore
  `<space>.cacheKey`, opens `createMMKV({ id: '<space>-cache', encryptionKey, encryptionType: 'AES-256' })`,
  caches one instance per space and single-flights concurrent opens. `wipeSecureCache(space)` awaits an
  in-flight open, clears all keys, calls v4 `deleteMMKV(id)` and deletes the SecureStore key.
- `core/storage/query-persister.ts`: `createSecureQueryPersister(cache, key?)` adapts the encrypted
  MMKV to `createSyncStoragePersister` for `@tanstack/react-query-persist-client`. Not wired (M1-06).
- Colocated unit tests: `prefs.test.ts` (round-trip, remove, unknown-key type error), `secure-cache.test.ts`
  (SecureStore key reused, wipe removes data and key), `query-persister.test.ts` (restore/remove).
- Reported installed version: **react-native-mmkv 4.3.2** (Nitro); the code uses `createMMKV` /
  `deleteMMKV`, not the v3 `new MMKV()` / instance `delete()` API.

### Files
- Created: `mobile-app/src/core/storage/{prefs.ts, secure-cache.ts, query-persister.ts, prefs.test.ts, secure-cache.test.ts, query-persister.test.ts}`
- Modified: `mobile-app/package.json`, `mobile-app/package-lock.json` (installs), `mobile-app/docs/PROGRESS.md`, `mobile-app/docs/HANDOFF.md`
- Deleted / moved: none

### Install commands for the user
```bash
npx expo install react-native-mmkv expo-crypto
npx expo install @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister
```
Already installed in this worktree: `react-native-mmkv@4.3.2`, `expo-crypto@58.0.8`,
`@tanstack/react-query-persist-client@5.107.1`, `@tanstack/query-sync-storage-persister@5.107.1`.
The lockfile also installed `@tanstack/react-query@5.107.1` (from `^5.106.1`).
`react-native-mmkv` v4 is a Nitro module: `react-native-nitro-modules@0.37.2` and `nitro-core@0.37.2`
are present via its peer dependency. If a clean install ever misses it:
`npx expo install react-native-nitro-modules`.

### Verification
- `npm run lint` → `✖ 3 problems (0 errors, 3 warnings)`; all three are pre-existing
  (`core/http/api-error.ts`, `core/ui/skeleton.tsx`, `staff/lib/api.ts`), no new findings.
- `npm run typecheck` → exit 0, no output.
- `npm test` → `npm error Missing script: "test"` — the Jest runner is card M0-06. The three test files
  are written next to the code and will run once M0-06 lands (`npm test -- src/core/storage`).
- Manual: no device/emulator needed; this is a pure storage card, no UI. No screenshots.
- Note: a fresh worktree has no generated `expo-env.d.ts` (gitignored), so baseline `tsc` failed on
  `@/global.css`; I copied the generated file from the main checkout to verify. It is not committed.

### Acceptance criteria
- [x] Prefs round-trip — `prefs.test.ts`.
- [x] Unknown pref key is a type error — `// @ts-expect-error` in `prefs.test.ts`, enforced by
      `npm run typecheck` (which includes the test files).
- [x] Secure cache uses the key from SecureStore and the same key/instance on second open —
      `secure-cache.test.ts`.
- [x] Wipe removes data and the SecureStore key — `secure-cache.test.ts`.
- [x] No PHI stored anywhere yet: prefs only accepts `PrefKey`; nothing writes to the secure cache
      until M1-06.
- [ ] `npm test` green — not possible until M0-06 (runner missing, as the task note says).

### Deviations from the card / docs
- **Key length:** MMKV v4 rejects AES-256 keys longer than 32 bytes, while base64 of the card's 32
  random bytes is 44 characters. Implemented as 32 random bytes → base64 → keep the first 32 characters,
  stored in SecureStore and passed to MMKV (192 bits of entropy, exactly the key MMKV receives).
  Storing the full 44-character string makes `createMMKV` throw in v4.
- `wipeSecureCache` uses v4's `deleteMMKV(id)`; the v3 `instance.delete()` does not exist.
- Test files read Jest's globals from `globalThis` with a local type instead of relying on `@types/jest`,
  which is not installed until M0-06; this keeps `tsc --noEmit` green without a shim or tsconfig change.
- `expo-env.d.ts` copied only for local verification (gitignored, not committed).

### Questions for the architect
- Confirm the 32-character key adaptation above, or name the preferred derivation (e.g.
  `getRandomBytes(24)` for an exact 32-character base64 AES-256 key).
- M0-06's `react-native-mmkv` mock must export `deleteMMKV` (v4 API) for `wipeSecureCache`; the
  library's own Jest auto-mock already does. Please pass this to M0-06.
- The card puts the persister factory in `core/storage`, while 02 §1 lists `core/query/` as the home of
  a "persister factory". I followed the card; say if it should move in M1-06.

### Notes for the next task
- `openSecureCache(space)` and `wipeSecureCache(space)` are both async; instances are shared per space.
- Prefs values are strings; a new pref key must be added to `PrefKey` before use.
- `createSecureQueryPersister(cache, key = 'query-cache')` is ready for M1-06's
  `PersistQueryClientProvider`; only allow-listed queries should be dehydrated into it.
- The cache key uses the same SecureStore options as tokens (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`).

---
## M0-09 — Backend: patient fence skeleton  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M0-09-be-fence   Commit(s): 36630a2 (backend)   Status set to: review

### Done
- `src/patient-app/decorators/patient-api.decorator.ts`: `IS_PATIENT_API = 'isPatientApi'`, `IS_PATIENT_AUTH = 'isPatientAuth'`, `@PatientApi()` = `@Public()` + metadata + `@UseGuards(PatientJwtGuard, PatientLinkGuard)`, `@PatientAuthRoute()` = `@Public()` + metadata.
- `src/patient-app/guards/patient-jwt.guard.ts` and `patient-link.guard.ts`: stubs that always throw 401, with `TODO(M2-02)` / `TODO(M2-03)` markers.
- `src/patient-app/guards/patient-fence.guard.ts`: HTTP path ↔ decorator equivalence, `403 { code: 'PATIENT_FENCE' }` on any mismatch, non-HTTP passes; `request.path` with a `request.url` (query-stripped) fallback.
- Registered as the **first** `APP_GUARD` in `app.module.ts`, before `RateLimiterGuard` (cheapest check; a fence 403 must never be masked by 401/429).
- `src/patient-app/patient-api-coverage.spec.ts`: reflection over every controller — the four card rules, plus fixture controllers proving each rule fires (the tree has no patient controllers yet, so the self-check keeps it meaningful).
- `src/patient-app/guards/patient-fence.guard.spec.ts`: 9 cases incl. the dummy `@Controller('patient-api')` handler without `@PatientApi()` → 403 `PATIENT_FENCE`.
- `test/patient/route-matrix.int-spec.ts`: boots `AppModule` (real global guard chain, fence first) on its own `patientit` schema, enumerates every controller route by `PATH_METADATA`/`METHOD_METADATA`, signs a patient token (`aud: 'patient'`, patient test secret) and asserts 401/403 on every non-patient route. **Not run here — see Verification.** The patient-token-on-`/patient-api` half is marked for M2-03.

### Files
- Created: `backend/src/patient-app/decorators/patient-api.decorator.ts`, `backend/src/patient-app/guards/{patient-fence.guard.ts,patient-fence.guard.spec.ts,patient-jwt.guard.ts,patient-link.guard.ts}`, `backend/src/patient-app/patient-api-coverage.spec.ts`, `backend/test/patient/route-matrix.int-spec.ts`
- Modified: `backend/src/app.module.ts` (guard import + provider, rate-limiter comment now "Then")
- Deleted / moved: none

### Install commands for the user
none

### Verification
- `npm run build` → clean (`nest build`, no diagnostics).
- `npx jest --runInBand` → 88 suites, 900 tests passed (84.7 s), including `access-coverage.spec.ts` and `guard.acceptance.spec.ts`.
- `npx jest --runInBand --testPathPattern "patient-fence|patient-api-coverage"` → 2 suites, 13 tests passed.
- `npx jest --runInBand --testPathPattern "access-coverage|guard.acceptance"` → 3 suites, 33 tests passed.
- `npx tsc -p test/tsconfig.int.json --noEmit` → clean (the new int spec typechecks).
- ESLint (`npx eslint "src/patient-app/**/*.ts" "test/patient/*.ts" "src/app.module.ts"`) → clean; Prettier `--write` run on the new files and `app.module.ts`.
- `npm run lint` was **not** run: it is `eslint --fix` over the whole tree and this checkout has CRLF line endings, so Prettier flags every existing file (the M0-08 finding; no `.gitattributes` yet). New/changed files are clean under Prettier + ESLint as above.
- `test/patient/route-matrix.int-spec.ts` was **not run**: the only reachable database is `DATABASE_URL`, which resolves to a **remote/shared** host; `BILLING_IT_DATABASE_URL` is unset, nothing listens on `127.0.0.1:5432`, and Docker is not installed. Per the task rule I did not point tests at the shared DB. Reviewer: run it with a disposable Postgres, e.g. `BILLING_IT_DATABASE_URL=<url> npx jest --config test/jest-int.json --runInBand test/patient/route-matrix.int-spec.ts`.

### Acceptance criteria
- [x] All backend unit tests green (88 suites / 900 tests); `access-coverage.spec.ts` and `guard.acceptance.spec.ts` stay green.
- [x] A dummy controller in `patient-fence.guard.spec.ts` proves `/patient-api/x` without `@PatientApi()` returns 403 `PATIENT_FENCE`.
- [ ] The new int spec green — written and typechecked, but not executed (no local/disposable DB; the only DB is the shared remote one — see above). The staff-token-on-`/patient-api` half is M2-03.

### Deviations from the card / docs
- The route-matrix spec **skips `@Public()` routes** (e.g. `/auth/login`, `/app/min-version`) instead of requiring 401/403 from them: they are unauthenticated by design, and every non-public non-patient route is asserted.
- The route-matrix spec boots `AppModule` on a throw-away schema rather than reusing `test/access/acceptance/harness.ts`: that harness swaps `JwtAuthGuard` for an `x-test-user` header guard, which would never exercise the patient-token rejection this spec exists to prove. It mirrors the harnesses' `TypeOrmModule.forRoot({ synchronize: true, search_path })` + real global filter/pipes instead.
- The card names only the decorator file for step 1; the two stub guards live next to the fence in `src/patient-app/guards/` so M2 can replace them in place.
- `guard.acceptance.spec.ts` (GRD-06) needed no change: there are no patient controllers yet, and `@PatientApi()` already carries `@Public()` (which GRD-06 accepts); adding `patient-app` to its `MODULE_DIRS` can happen in M2-03 when the first controllers exist.

### Questions for the architect
- Route-matrix DB config: `test/billing/db.config.ts` falls back to `DATABASE_URL` when `BILLING_IT_DATABASE_URL` is unset, so on this machine it would target the shared dev DB. Is the intended reviewer run `BILLING_IT_DATABASE_URL=<disposable>` only (as noted above), or should M2-03 add a guard that refuses a non-local/`BILLING_IT_*` URL?
- No dedicated `test:int:patient` script was added (the card did not ask for one); the spec is picked up by `npm run test:int`. Want a dedicated script in M2-03?

### Notes for the next task
- M2-02: replace `PatientJwtGuard` (`TODO(M2-02)`) with the real `JWT_PATIENT_ACCESS_SECRET` + `aud: 'patient'` guard and add `JWT_PATIENT_ACCESS_SECRET` to `.env.example` (still absent).
- M2-03: replace `PatientLinkGuard` (`TODO(M2-03)`) and add the first patient controllers under `src/patient-app/**`; the coverage spec will then start enforcing `@PatientApi()` for real. Add the second half of `test/patient/route-matrix.int-spec.ts` (staff token → 401 on every `/patient-api` route).
- `PatientApi()`'s guards are not provided by any module yet (no patient controllers exist); create the `PatientAppModule` in M2-02/03 so Nest can resolve them.
- The fence compares `request.path` to the literal `/patient-api/` / `/patient-auth/` prefixes; any future patient route must sit under those paths or the coverage spec fails on the prefix rule.

---
## REVIEW M0-02 + M0-03 + M0-09  ·  2026-11-11  ·  Claude Opus (architect)
Branch: reviewed the three task branches (parallel worktrees)   Status set to: done (merge pending)

### Done
- M0-02 done, M0-03 done (one major fixed at merge: add `react-native-nitro-modules` as a direct dependency),
  M0-09 done (route-matrix int spec carried over to M2-03). Reviews in `docs/reviews/<ID>/review.md`.
- Cards updated: M0-04 (remaining fence rows + dev-build smoke), M0-06 (MMKV v4 mock, drop test shims),
  M2-03 (disposable DB guard, `test:int:patient`). 02 §1 storage/query lines, CLAUDE.md dev-build note,
  PROGRESS fresh-worktree note.

### Notes for the next task
- **Expo Go no longer works** (native MMKV). Device runs need `npx expo run:android` (Android SDK) or the
  EAS development build from M0-07.
- After merging, M0-04, M0-05 and M0-06 can run in parallel worktrees; M1-04 (backend push) is also free.

---
## M0-06 — Mobile test runner  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M0-06-tests   Commit(s): e881b03 (code)   Status set to: review

### Done
- `package.json`: `"test": "jest"`, `"jest": { "preset": "jest-expo" }`, `setupFilesAfterEnv`
  (`<rootDir>/jest.setup.ts`) and `transformIgnorePatterns` copied from the SDK 58 unit-testing docs
  (npm/Yarn variant). The four test packages moved to `devDependencies` with the installed versions:
  `@testing-library/react-native ^14.1.0`, `@types/jest 30.0.0`, `jest ~30.5.2`, `jest-expo ~58.0.14`.
- `jest.setup.ts`: in-memory `expo-secure-store` (Map), `react-native-mmkv` (via the library's own mock,
  see below), `expo-notifications` (scheduled list, `virtual: true` until M0-07 installs it), NetInfo
  (always online), and `expo-crypto.randomUUID` (counter). `getRandomBytes` stays real.
- `__mocks__/react-native-mmkv.ts`: Jest manual mock that wires the library's **own** v4 test mock
  (`createMockMMKV`) and keeps `createMMKV` / `deleteMMKV` / `existsMMKV`. Instances are shared per id;
  `deleteMMKV` drops the instance so a wipe is observable (next open starts empty). The automatic
  in-Jest detection could not run because importing `react-native-mmkv` eagerly loads the Nitro ESM
  runtime (`nitro-core`), which Jest cannot `require`.
- `tsconfig.json`: `"types": ["jest"]` (SDK 58 docs step; the Expo base config no longer auto-includes
  `@types`, so `describe`/`it`/`expect` were untyped).
- Removed the `globalThis` Jest-globals shims from `core/storage/{prefs,secure-cache,query-persister}.test.ts`;
  all three files now run and pass unchanged otherwise.
- New tests: `core/datetime/index.test.ts` (Karachi day bounds; New York day bounds on both 2026 DST
  boundaries; `formatInZone` of the same UTC instant in both zones; date roll-over; calendar date;
  wall-time→UTC) and `staff/lib/api.test.ts` (two parallel 401s → exactly one `/auth/refresh`, both
  requests retried with the refreshed token, session + SecureStore refreshed).
- README "Testing" section replaced with the four commands and how the mocks work.

### Files
- Created: `mobile-app/jest.setup.ts`, `mobile-app/__mocks__/react-native-mmkv.ts`,
  `mobile-app/src/core/datetime/index.test.ts`, `mobile-app/src/staff/lib/api.test.ts`
- Modified: `mobile-app/package.json`, `mobile-app/package-lock.json`, `mobile-app/tsconfig.json`,
  `mobile-app/README.md`, `mobile-app/src/core/storage/{prefs,secure-cache,query-persister}.test.ts`,
  `mobile-app/docs/PROGRESS.md`, `mobile-app/docs/HANDOFF.md`
- Deleted / moved: none

### Install commands for the user
none — `jest-expo`, `jest`, `@testing-library/react-native` and `@types/jest` are already installed and are
now in `devDependencies`. A fresh checkout/worktree only needs `npm ci` (or `npm install`) in `mobile-app/`.

### Verification
- `npm test` → `Test Suites: 5 passed, 5 total` · `Tests: 16 passed, 16 total` · `Time: 7 s`
  (prefs 3, secure-cache 2, query-persister 1, datetime 9, staff api 1).
- `npm run typecheck` → exit 0, no output.
- `npm run lint` → `✖ 3 problems (0 errors, 3 warnings)`; all three are the pre-existing ones
  (`core/http/api-error.ts`, `core/ui/skeleton.tsx`, `staff/lib/api.ts`), no new findings.
  `node node_modules/eslint/bin/eslint.js src` → same; `eslint jest.setup.ts __mocks__` → clean.
- `npm run lint:fences` → `PASS` both directions + `lint:fences: both forbidden directions failed lint as expected.`
- Manual: none — configuration/tests only, no screen and no device needed.

### Acceptance criteria
- [x] `npm test` runs green locally (5 suites / 16 tests) — output above.
- [x] README "Testing" section updated — shows `npm test`, lint, fences and typecheck plus the mock story.
- [x] Jest config + `jest.setup.ts` with the docs/09 §2 mocks — see Files; MMKV uses the library's own v4 mock.
- [x] Storage test shims removed and the three files pass.
- [x] First tests added: Karachi + New York day bounds / `formatInZone`; single-flight refresh.

### Deviations from the card / docs
- The `react-native-mmkv` mock is a manual mock in `__mocks__/react-native-mmkv.ts` rather than code inside
  `jest.setup.ts`. The card says "prefer the library's own jest mock if it ships one": it does, but its
  auto-selection is unreachable because the package import loads the Nitro ESM runtime first, so the manual
  mock wraps the library's own `createMockMMKV` instead of reimplementing MMKV.
- `expo-notifications` is not installed yet (M0-07 owns it), so its mock is registered with
  `{ virtual: true }`. Once the package exists the same mock keeps working; drop `virtual` then.
- `tsconfig.json` gained `"types": ["jest"]` — not in the card text, but the SDK 58 unit-testing docs require
  it and typecheck fails without it (`Cannot find name 'describe'`).
- `package-lock.json`: only the root `dependencies` / `devDependencies` lists were moved. Transitive `dev`
  flags still reflect `npx expo install` (which recorded the packages as production); no installer was run,
  and the next `npm install`/`npm ci` normalises them.

### Questions for the architect
- Is the manual `__mocks__` MMKV mock acceptable, or do you prefer `nitro-core` added to
  `transformIgnorePatterns` (which would still need a Nitro runtime mock)? Behaviour is identical for the
  storage tests either way; this route avoids touching the transform pattern beyond the docs value.
- docs/09 §2's "What must have tests" table also lists route resolvers, `brand.ts`, `core/http` idempotent
  mutation, realtime invalidation and queue row actions. Those modules do not exist on this branch, so M0-06
  added only the three items the card names. Confirm each is picked up by its own card rather than M0-06.

### Notes for the next task
- `npm test` and `npm test -- <path>` work on Windows without a device; jest-expo runs the iOS/Node env.
- The manual MMKV mock is global for all tests; if a later card imports the `useMMKV*` hooks, add them to
  `__mocks__/react-native-mmkv.ts` (they do not exist there yet).
- `jest.setup.ts` registers the mocks per test file; tests can still `jest.spyOn`/`jest.mock` on top.
- `tsconfig.json` now restricts global `@types` to `jest`. Adding another global type package means extending
  that array.
- `transformIgnorePatterns` replaces the jest-expo preset array with the documented one. If a future library
  (e.g. a Nitro module) is not transformed, mock it with a manual mock rather than widening the pattern first.

---
## M0-04 — Space store, welcome screen, two-level guards  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M0-04-spaces   Commit(s): 649d323 (code) + this docs commit   Status set to: **blocked (device check not run)**

### Done
- `core/space/useSpaceStore.ts`: `{ activeSpace: 'staff' | 'patient' | null, setActiveSpace }`, read synchronously from
  prefs `space.active` at module load (`getPref`) and written with `setPref` (`removePref` for `null`).
  `core/space/switch-space.ts`: `switchSpace(target)` (card step 1).
- `core/splash.ts`: `preventAutoHideAsync()` in global scope + `markReady()` (hide once). Welcome, staff and patient
  layouts call it; the staff layout waits until its restore is no longer `restoring` (card step 2).
- `shell/RootShell.tsx`: `RootProviders` + root `Stack` with `Stack.Protected` on `activeSpace` for
  `welcome` / `(staff)` / `(patient)`; `index` always available (card step 2). `shell/WelcomePage.tsx` (X-01: neutral
  mark, two card buttons, no product name) and `shell/EntryRedirect.tsx` (routes by `activeSpace` only).
  `shell/RootProviders.tsx` no longer owns `QueryClientProvider` (card steps 2–3).
- `staff/navigation/`: `resolve-staff-route.ts` (pure, every row of 02 §4) + `resolve-staff-route.test.ts`
  (7 cases), `StaffLayout.tsx` (`QueryClientProvider(staffQueryClient)`, `useRestoreStaffSession` on mount,
  four `Stack.Protected` guards), `StaffMainLayout.tsx` (`AccessProvider` + `Stack`) (card steps 4 and 9).
- `useRestoreSession` → `useRestoreStaffSession` (git mv); the staff login page has a Back button →
  `switchSpace(null)`; `useSignOut` clears the session/cache and then `switchSpace(null)` (card step 7).
- `patient/navigation/PatientLayout.tsx` (Stack + `markReady`) and `PatientPlaceholderPage.tsx` ("Patient app is
  coming soon", [Back] → `switchSpace(null)`); `patient/index.ts` exports `PatientLayout` for the shell (card step 6).
- Routes: `src/app/(staff)/{_layout,offline,login,select-location}.tsx`, `src/app/(staff)/(main)/{_layout,home}.tsx`
  (home = existing `DashboardPage`), `src/app/(patient)/{_layout,index}.tsx`, `src/app/welcome.tsx`. Deleted
  `(auth)/`, `(app)/`, `app/offline.tsx`, `app/select-location.tsx` and the superseded staff `EntryRedirect.tsx`
  (card step 5).
- Lint: root `src/app/*.tsx` may not import `@/staff*` / `@/patient*`; `(staff)`/`(patient)`/`claim` may not import
  `@/shell*`; third fixture `src/app/__fence_fixture__.tsx` → `@/staff` in `scripts/check-fences.mjs` (card step 8).

### Files
- Created: `src/core/space/{useSpaceStore.ts,switch-space.ts}`, `src/core/splash.ts`,
  `src/shell/{RootShell.tsx,WelcomePage.tsx,EntryRedirect.tsx}`,
  `src/staff/navigation/{resolve-staff-route.ts,resolve-staff-route.test.ts,StaffLayout.tsx,StaffMainLayout.tsx,index.ts}`,
  `src/patient/navigation/{PatientLayout.tsx,PatientPlaceholderPage.tsx,index.ts}`,
  `src/app/(staff)/{_layout,offline,login,select-location}.tsx`, `src/app/(staff)/(main)/{_layout,home}.tsx`,
  `src/app/(patient)/{_layout,index}.tsx`, `src/app/welcome.tsx`
- Modified: `src/app/{_layout,index}.tsx`, `src/shell/RootProviders.tsx`, `src/patient/index.ts`,
  `src/staff/features/auth/{index.ts,hooks/useSignOut.ts,pages/LoginPage.tsx,pages/OfflinePage.tsx}`,
  `eslint.config.js`, `scripts/check-fences.mjs`, `docs/PROGRESS.md`
- Deleted / moved: `src/app/(auth)/*`, `src/app/(app)/*`, `src/app/{offline,select-location}.tsx`,
  `src/staff/features/auth/components/EntryRedirect.tsx`; `hooks/useRestoreSession.ts` →
  `hooks/useRestoreStaffSession.ts` (git mv, history kept)

### Install commands for the user
```bash
npx expo install jest-expo jest @testing-library/react-native @types/jest   # card M0-06, makes typecheck green again
```
No package is needed for this card (none added).

### Verification
- `npm run lint` (`node node_modules/eslint/bin/eslint.js src`) → `✖ 3 problems (0 errors, 3 warnings)`; the same three
  pre-existing warnings M0-01/M0-03 recorded (`core/http/api-error.ts`, `core/ui/skeleton.tsx`, `staff/lib/api.ts`).
- `npm run lint:fences` → exit 0:
  `PASS patient space importing @/staff …` · `PASS core importing @/patient …` · `PASS root app route importing @/staff …`
  `lint:fences: all forbidden directions failed lint as expected.`
- Fence probe (temporary files, deleted): `src/app/(staff)/__probe__.tsx` importing `@/shell/RootShell` and
  `src/app/__probe__.tsx` importing `@/staff/features/auth` both failed with `no-restricted-imports` (2 errors),
  proving the two new rows including deep imports.
- `npm run typecheck` → **fails only in `src/staff/navigation/resolve-staff-route.test.ts`**: `TS2593 Cannot find name
  'describe'/'it'` ×8 and `TS2304 Cannot find name 'expect'` ×7. Expected: the test is written with normal Jest globals
  and `@types/jest` is installed by M0-06 (per the task note I did not shim, reference or exclude it). Every other file
  typechecks, including the typed `/(patient)` redirect and `Stack.Protected` usage.
- `npm test` → `npm error Missing script: "test"` (runner is M0-06).
- Static bundle check (best evidence available without a device): `npx expo export --platform android` → exit 0,
  `Android Bundled … node_modules\expo-router\entry.js (4547 modules)`; output directory removed afterwards (not committed).
- Device check: **not run — no device/emulator available.** `adb devices` → empty; `%LOCALAPPDATA%\Android\Sdk` has no
  `emulator/` and no `system-images/`; no AVDs in `~/.android/avd`; the backend probe on `http://localhost:5000` timed out.
  The M0-04 acceptance explicitly forbids setting this task to `review` without it, so the row says `blocked`.

### Acceptance criteria
- [ ] First launch → welcome; choose clinic → staff login → … → home; kill and reopen → home (not run: no device)
- [ ] Choose patient → placeholder → back → welcome (not run: no device)
- [ ] Sign out → welcome; reopen → welcome (not run: no device)
- [ ] Staff offline at start → offline page with retry (not run: no device)
- [x] Lint fences pass; no shell file imports a deep staff path (lint + probe outputs above; shell imports only `@/core`)
- [ ] Carry-over: pre-update session restores, login → select location → home → sign out, web sign-in still works, screenshots
      in `docs/reviews/M0-04/` (not run: no device)

### Deviations from the card / docs
- `claim/[token]` is **not declared** in the root Stack yet: the route does not exist (M2-14) and declaring a missing
  screen would break the navigator. Expo Router includes routes by default, so M2-14 only has to keep it outside
  `Stack.Protected` (02 §4 "always"). Documented here so it is not forgotten.
- The patient placeholder is split into `PatientLayout` (`<Stack>`) + `PatientPlaceholderPage` (rendered by
  `(patient)/index.tsx`) instead of one layout file rendering the page: a group `_layout.tsx` must return a navigator and
  a route file must render one page.
- Deleted the superseded `staff/features/auth/components/EntryRedirect.tsx` (step 3 moves EntryRedirect to `shell`;
  leaving the staff copy would keep root route logic in the wrong space; nothing imported it after the move).
- X-01's language toggle (English / اردو) is not rendered: patient i18n (`i18next`) arrives with M2-06 and there is
  nothing to switch yet. "Privacy · Terms" is plain muted text — the legal routes do not exist (M4); no dead links added.
- `space.active` is **removed** (`removePref`) when `activeSpace === null`, not stored as `''`; a stored value outside
  the union also reads as `null`.

### Questions for the architect
- Typecheck is red only for the Jest globals in the new test, as the task instructions anticipated. OK to keep the
  branch in that state and merge M0-06 first, or should I add a temporary `globalThis` shim like M0-03 did?
- Card step 6 puts the patient placeholder at `(patient)/index.tsx`, so `/` has two candidates (root `index.tsx` and
  the patient group index). I navigate with the group-qualified `/(patient)`; the router resolves the root `/` through
  the protected groups correctly in the bundle, but a device run is needed to confirm the patient cold start.
- `resolveStaffRoute` takes `mustSelectLocation` and `clinicBlocked` as two inputs (the 02 §4 table lists them together);
  StaffLayout computes both from the existing selectors. Fine, or prefer one combined flag?

### Notes for the next task
- M0-06: add `@types/jest`; remove the `globalThis` shims in `core/storage/*.test.ts`; then `resolve-staff-route.test.ts`
  (7 cases) runs with the rest. The runner is still missing here.
- M0-05: mount `BrandTheme` in `StaffMainLayout` (access + brand live there); WelcomePage deliberately uses the platform
  `primary` token, and the staff login/home are still on the default palette.
- M0-07: the native splash is now controlled by `core/splash.ts` (`preventAutoHideAsync` + `markReady`); keep the
  `expo-splash-screen` plugin when `app.json` becomes `app.config.ts`.
- M1-02: staff tabs nest under `(staff)/(main)`; `staff/index.ts` still exposes `staffQueryClient` (the shell no longer
  needs it) — replace that barrel with the real public surface when the tabs arrive.
- M2-06: add the patient session restore/guards/`resolve-patient-route.ts` around `PatientLayout`; signing out of staff
  currently always goes to welcome (`useSignOut`), switch to the other space once it can be signed in.

---
## M1-04 — Backend: devices + Expo push provider  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M1-04-be-push   Commit(s): 6491789 (code)   Status set to: review

### Done
- Schema (step 1): `user_devices` block in `database/schema/02_tables.sql` + the entity
  `src/devices/entities/user-device.entity.ts`, and one idempotent change script
  `database/changes/2026-11-11_push_devices.sql` (`BEGIN/COMMIT`, all `IF NOT EXISTS` / `DROP … IF EXISTS`).
  The same file extends **every** CHECK that lists `'in_app'` (`notification_outbox.channel`,
  `notification_templates.channel`, `notification_rules.channel`) with `'push'`, and
  `notification_outbox.status` with `'skipped_no_device'`.
- `src/devices/` (step 2): module, entity, `DevicesService` (register = upsert by token, moves a token to the
  calling user; unregister = own token only; `pushTokensOf` / `removeTokens` for the provider), controller
  `POST/DELETE /me/devices` returning `{ id }` / `{ deleted }`, DTO per 07 §4.2. Registered in `app.module.ts`.
- Notifications (step 3): `NotificationChannel.PUSH`, `OutboxStatus.SKIPPED_NO_DEVICE`,
  `CHANNELS_BY_AUDIENCE` doctor/coordinator/staff = in-app + email + push (lab and patient unchanged;
  `CHANNELS_BY_RECIPIENT.USER` already gets every channel), `defaultRuleEnabled(..., pushDefault)`.
  Push is **opt-in per event**: `channelsFor`/`eventChannels` only offer push when the event's own
  `channels` list contains it, so `channels: null` ("every audience channel") never starts pushing every
  event. `EventSeed.pushDefault` marks the event; `queue.patient_checked_in` is `[in_app, push]` with
  `pushDefault: true`. `notifications.enums.spec.ts` updated deliberately — patient still `[]`.
- `EnqueueInput.scheduledFor?: Date` added; final `scheduled_for` = later of it and the quiet-hours decision.
  Also: push rows are no longer failed at enqueue for "no address" (devices are resolved at send time).
- Provider (step 4): `delivery/expo-push.provider.ts` (`ExpoPushProvider` + lazy `ExpoPushClientFactory`,
  registered in `ChannelProviderRegistry` and `NotificationsModule`). Resolves the user's tokens, chunks with
  the SDK, title/body from the rendered payload, `channelId` = `queue` for `queue.*` else `general`, `data`
  = `{ space:'staff', type, route: payload.link, organizationId, locationId, entityId }`. No devices →
  `SkipSendError('skipped_no_device')`. Tickets: `DeviceNotRegistered` deletes the device row; other ticket
  errors are `PermanentSendError`; receipts are checked once after 15 min (in-process timer in the worker
  role) and also delete `DeviceNotRegistered` devices. `EXPO_ACCESS_TOKEN` optional (added to `.env.example`).
- Privacy (step 5): the push template for `queue.patient_checked_in` is
  `pushTitle: 'Patient checked in'` / `pushBody: '{patient_first_name} · Token {token}'`.
  `NotificationService.enqueue` derives `patient_first_name` from `patient_name` with
  `notifications/privacy.ts#firstNameOf` (first whitespace token) for every event, so a full name can never
  reach a push body; the bell/email keep the full name. Template seeding (`defaultTemplateSeeds`) emits the
  push variant only for push events.
- Web settings parity: the notification-settings view/rule validation now use the same push opt-in
  (`defaultRuleEnabled(..., event.channels.includes('push'))`, `channelsFor`), so the screen and the sender
  agree.
- Tests (step 6): `delivery/expo-push.provider.spec.ts` with a mocked Expo client (no device → skip; payload
  + channel + data; ticket `DeviceNotRegistered` → device deleted; receipt after 15 min → device deleted;
  other ticket errors permanent) and `notifications/privacy.spec.ts`; `notifications.enums.spec.ts` rewritten
  for the new channel/defaults/privacy.

### Files
- Created: `backend/src/devices/{devices.module.ts,devices.controller.ts,devices.service.ts}`,
  `backend/src/devices/dto/device.dto.ts`, `backend/src/devices/entities/user-device.entity.ts`,
  `backend/src/notifications/privacy.ts`, `backend/src/notifications/privacy.spec.ts`,
  `backend/src/notifications/delivery/expo-push.provider.ts`,
  `backend/src/notifications/delivery/expo-push.provider.spec.ts`,
  `backend/database/changes/2026-11-11_push_devices.sql`
- Modified: `backend/database/schema/02_tables.sql`, `backend/src/app.module.ts`,
  `backend/src/notifications/notifications.enums.ts`, `backend/src/notifications/notifications.enums.spec.ts`,
  `backend/src/notifications/notifications.module.ts`, `backend/src/notifications/seeds/notification-events.seed.ts`,
  `backend/src/notifications/services/notification.service.ts`,
  `backend/src/notifications/services/notification-settings.service.ts`,
  `backend/src/notifications/delivery/channel-provider.ts`,
  `backend/src/notifications/delivery/channel-provider.registry.ts`,
  `backend/src/notifications/delivery/notification-dispatcher.service.ts`,
  `backend/src/notifications/delivery/{email,in-app}.provider.spec.ts` (two new required fields in the
  `OutgoingNotification` fixtures), `backend/.env.example`, `backend/package.json` + `package-lock.json`
  (`expo-server-sdk`, installed by the user before this task), `mobile-app/docs/PROGRESS.md`
- Deleted / moved: none

### Install commands for the user
```bash
cd backend && npm i expo-server-sdk   # already installed in this worktree (8.0.0); package.json/lock committed
```
Nothing else is new. No `npm install` was run by me.

### Verification
- `npm run build` → clean (`nest build`, no diagnostics), run again after formatting.
- `npx jest --runInBand` → **90 suites, 922 tests passed** (121 s), including `access-coverage.spec.ts`,
  `guard.acceptance.spec.ts`, `notifications/**` and `patient-api-coverage.spec.ts`.
  Named re-run: `npx jest --runInBand --testPathPattern "access-coverage|guard.acceptance|patient-api-coverage"`
  → 4 suites, 37 tests passed.
- `npx jest --runInBand --testPathPattern "src/notifications"` → 7 suites, 58 tests passed.
- Prettier: `npx prettier --check --end-of-line auto <changed files>` → "All matched files use Prettier code
  style!". ESLint `npx eslint --rule 'prettier/prettier: off' <changed files>` → clean.
  `npm run lint` was **not** run: it is `eslint --fix` over the whole tree and this checkout has CRLF line
  endings (`core.autocrlf=true`), so `prettier/prettier` flags every existing file with "Delete ␍" (the M0-08
  finding; no `.gitattributes`). No `eslint-disable` was added.
- **Change file not executed**: no local/disposable Postgres on this machine (`127.0.0.1:5432` closed, no
  `psql`, no Docker), and the only configured `DATABASE_URL` is the shared one — per the task rule I did not
  point SQL at it. Reviewer: `psql "<disposable>" -v ON_ERROR_STOP=1 -1 -f database/changes/2026-11-11_push_devices.sql`.
- Manual: no device — real push is the M1-05 carry-over below. Provider behaviour proven with mocked
  `expo-server-sdk` (no live network).

### Acceptance criteria
- [x] `POST /me/devices` upserts by token, moves a token to the calling user, returns `{ id }`;
      `DELETE /me/devices` removes only the caller's token, returns `{ deleted }` (07 §4.2).
- [x] `push` channel + `skipped_no_device` exist in the TS enums, entity CHECKs and the SQL schema/change file.
- [x] The decision path only creates push rows for events that opt in (`queue.patient_checked_in`), never for
      patients — proven in `notifications.enums.spec.ts`.
- [x] Provider: mocked-Expo tests prove sending (chunk/title/body/channel/data), no-device skip and
      `DeviceNotRegistered` device deletion (ticket and receipt).
- [x] Push privacy (docs/03 §5): first name + token only; `firstNameOf` unit-tested.
- [x] `npm run build` clean; full unit suite green incl. access-coverage, guard.acceptance, notifications,
      patient-api-coverage.
- [ ] **Carry-over — real device push within 5 s**: needs M1-05 (mobile registration + a device token). Not
      possible in this backend-only worktree; provider proven with mocked tests as the task allows.

### Deviations from the card / docs
- Card step 2 says `@AnyMember() @ContextFree()`; I used **`@ContextFree()` only** (like `/me/notifications`).
  Verified against `access-coverage.spec.ts`: `CONTEXT_FREE_KEY` is an accepted marker, so coverage passes.
  `@AnyMember()` additionally makes `AccessGuard` require an organisation header and a membership
  (`access.guard.ts:84`), which would 403 a lab user or a user whose active org is not selected — for a
  device that belongs to the user, not the clinic. Documented in the controller.
- `EventSeed.pushDefault` has **no DB column** (08 §4 adds none): the seed's `channels` list is what the boot
  seed writes to `notification_events.channels`, so the enqueue path derives the push default from
  `event.channels.includes('push')`. A spec asserts `push in eventChannels(e) ⇔ e.pushDefault`.
- `OutgoingNotification` gained `locationId` and `entityId` (07 §8 push `data` needs them; the dispatcher claim
  now returns them) — two existing spec fixtures were updated.
- The enqueue "no address → failed" rule now applies only to email/SMS/WhatsApp; otherwise every push row would
  be failed before the worker could resolve devices.
- The notification-settings service (view + rule validation) was aligned with the push opt-in; without that the
  web screen would show push "off" for the queue event while the sender pushes.
- Receipts: chose the in-process 15-minute check (no new table, no receipt job); a worker restart drops a
  pending check — the stale device is then cleaned on the next ticket/receipt. Documented in the provider.
- `appVersion` is required in `POST /me/devices` (07 §4.2 has no `?` on it); `deviceLabel` optional.
- Prettier also re-wrapped two pre-existing long lines in `notification-events.seed.ts` (whitespace only).

### Questions for the architect
- Is `EventSeed.pushDefault` as a seed-only marker acceptable (runtime reads `notification_events.channels`),
  or should M3-07 add a `push_default` column/receipt table?
- Confirm `@ContextFree()` only for `/me/devices` (rationale above), or insist on `@AnyMember()`.
- Confirm `appVersion` required — M1-05 must send it or the registration 400s.
- Push is currently held by quiet hours (it is not in-app, so `decide()` holds it until the window ends).
  Keep that, or treat push like in-app for quiet hours?
- The web `/settings/notifications` screen now receives `push` in `channelsByAudience`/rules (this is what the
  card asks). It needs a label + toggle handling in the web app — flag for a web task (not touched here).

### Notes for the next task
- M1-05: `POST /me/devices` body `{ expoPushToken, platform: 'android'|'ios', appVersion, deviceLabel? }`;
  `DELETE /me/devices` `{ expoPushToken }` before dropping the staff session.
- Push `data` to route on: `{ space: 'staff', type, route, organizationId, locationId, entityId }`
  (`route` = the payload link, e.g. `/queue/doctor`); Android channels `queue` / `general`.
- Run `database/changes/2026-11-11_push_devices.sql` on a database **before** deploying this build: the boot
  seed inserts the new `push` template for `queue.patient_checked_in`, which the old CHECK would reject.
- No push rows exist for any other event; add `channels: [.., PUSH]` + `pushDefault` to a seed to opt one in,
  and keep its `pushBody` free of full names (docs/03 §5).
- Patient push stays off (`CHANNELS_BY_AUDIENCE.patient = []`) until M3-07.

---
## REVIEW round 2: M0-04 + M0-06 + M1-04  ·  2026-11-11  ·  Claude Opus (architect)
Branch: reviewed the three task branches   Status set to: M0-06, M1-04 done · M0-04 done (code), device check → M0-D

### Done
- M0-06 done (16 tests). M1-04 done (95 related backend tests; ESM SDK loads on Node 22.16). M0-04 code done;
  its device acceptance is now its own gate row **M0-D** (user needs an emulator or phone + dev build), and
  M1-02 depends on M0-D. Reviews in `docs/reviews/<ID>/review.md`.
- New card **M1-04a** (push not held by quiet hours, Node ≥ 22.12 engine, web push label/toggle).
- Cards updated: M1-05 (`appVersion` required), M0-07 (drop virtual notifications mock), M2-06 (no restore
  when already signed in). 07 §4.2: `/me/devices` is `@ContextFree()` only.

### Notes for the next task
- Merge order: M0-06 before M0-04 (M0-04's test needs jest types). Normalise `package-lock.json` with `npm install`.
- `changes/2026-11-11_push_devices.sql` has not been run anywhere yet.

---
## M0-05 — Design tokens, text scale and brand theming  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M0-05-theme   Commit(s): this commit (code + docs)   Status set to: review

### Done
- Picked up the uncommitted M0-05 work already in the worktree (brand math, `applyBrand`, theme feature
  files, status tones) and completed the card. Card steps 1–7:
- Step 1: `src/global.css` gets `success` / `warning` / `info` (+ `-foreground`) for light and dark, and
  the platform `primary` is now the teal-blue seed `#0e7490` (light) / `#3a92af` (dark, the OKLCH-lifted
  brand) instead of near-black. `platform-tokens.test.ts` keeps `platform-tokens.ts` and the stylesheet in
  sync and asserts every tone pair is ≥ 4.5:1 (light primary 5.36, success 5.02, warning 6.59, info 5.17;
  dark primary 5.91, success 12.05, warning 14.56, info 8.26).
- Step 2: `core/theme/brand.ts` is the port of the web `color.ts` (same names: `isHexColor`,
  `hexToOklch`, `oklchToHex`, `luminance`, `contrastRatio`, `readableForeground`,
  `deriveBrandPalette`, `RAMP_STEPS`, plus the web's `checkBrandContrast` / `ContrastCheck`).
- Step 3: `core/theme/apply-brand.ts` — `applyBrand(hex | null)` writes `--color-primary`,
  `--color-primary-foreground` and `--color-ring` for both themes; `null` (and a malformed value) writes
  the platform tokens back.
- Step 4: `staff/features/theme/`: `fetchTheme()` (`GET /theme`), `useClinicTheme()` (key = org + location,
  reference-data `staleTime` 10 min), `BrandTheme` (applies + caches `{ orgId, brandColor, logoUrl,
  defaultMode }` in prefs `staff.theme.cache`), `applyCachedBrand()`. `BrandTheme` is mounted in
  `StaffMainLayout`; `StaffLayout` paints the cache on mount and its unmount cleanup calls
  `applyBrand(null)` (welcome screen stays platform-coloured).
- Step 5: `core/components/data-display/status-tones.ts` — queue / appointment / dose tables from 05 §2
  (one source, labels included so colour is never the only signal).
- Step 6: **preferred path** — `core/theme/apply-text-scale.ts` overrides `--text-4xl`, `--text-3xl`,
  `--text-2xl`, `--text-lg`, `--text-base`, `--text-sm` for both themes; applied in `StaffLayout`
  (`staff`) and `PatientLayout` (`patient`), reset to `staff` on patient unmount. No `text.tsx` patch,
  so `src/core/ui/PATCHES.md` is untouched. **Spike (10 lines, build-level):**
  `npx expo export --platform android --no-bytecode` then search the bundle — `text-sm` compiles to
  `["fontSize",function(t){return t["--text-sm"]?.(t)}]` and the vars block contains
  `"--text-sm":t=>14`. `Uniwind.updateCSSVariables` writes the same `UniwindStore.vars[theme]` map the
  getter reads (`dist/common/core/config/config.native.js`), so runtime override is the supported path.
  Runtime confirmation on a device joins M0-D.
- Step 7: unit tests for `brand.ts` (5 sample colours: exact round-trip, readable foreground ≥ 4.5 in both
  schemes, dark lift, 50–900 ramp, hue) plus `apply-brand.test.ts`, `apply-text-scale.test.ts`,
  `platform-tokens.test.ts`.

### Files
- Created: `src/core/theme/{brand.ts,apply-brand.ts,apply-text-scale.ts,platform-tokens.ts}`,
  `src/core/theme/{brand,apply-brand,apply-text-scale,platform-tokens}.test.ts`,
  `src/core/components/data-display/status-tones.ts`,
  `src/staff/features/theme/{index.ts,api/theme.api.ts,hooks/useClinicTheme.ts,components/BrandTheme.tsx,lib/theme-cache.ts,lib/apply-cached-brand.ts,types/theme.types.ts}`
- Modified: `src/global.css`, `src/staff/navigation/{StaffLayout.tsx,StaffMainLayout.tsx}`,
  `src/patient/navigation/PatientLayout.tsx`, `docs/PROGRESS.md`
- Deleted: the throwaway spike files from the earlier attempt (`src/core/theme/__spike-colors.test.ts`,
  `mobile-app/_spike-dist/` — both untracked, never committed)

### Install commands for the user
```bash
# none — this card adds no dependency
```

### Verification
- `node node_modules/eslint/bin/eslint.js src` → `✖ 3 problems (0 errors, 3 warnings)`; only the
  pre-existing warnings (`core/http/api-error.ts`, `core/ui/skeleton.tsx`, `staff/lib/api.ts`).
- `npm run typecheck` → exit 0 (after `CI=1 npx expo start --offline` regenerated
  `.expo/types/router.d.ts`, 21:27).
- `npm test` → `Test Suites: 10 passed, 10 total · Tests: 53 passed, 53 total`.
- `npm run lint:fences` → exit 0, all three forbidden directions fail as expected.
- Bundle check: `npx expo export --platform android --no-bytecode` → exit 0 (6.3 MB bundle); used for the
  text-scale spike, output deleted afterwards.
- Manual: **not run — no device/emulator.** `adb devices` → empty; `%LOCALAPPDATA%\Android\Sdk` has no
  `emulator/` or system images. Screenshots of login/home (light + dark) were therefore not produced.

### Acceptance criteria
- [x] Theme tokens exist for success/warning/info with 4.5:1 foregrounds (automated contrast test).
- [x] Clinic brand is fetched, applied to primary/ring in both schemes, cached and re-applied on mount
      (code + unit tests); changing it on the web needs a device + API to see the button change.
- [ ] Cold start shows the cached brand without a flash — implemented (cache painted on staff mount, before
      the theme query answers, under the splash) but not observed on a device.
- [x] Welcome screen uses platform colours — `applyBrand(null)` runs when the staff space unmounts and no
      brand is applied before entering staff.
- [ ] Light + dark screenshots of login and home — no device; joins the M0-D device gate.
- [x] Unit tests for `core/theme/brand.ts` (09 §2).

### Deviations from the card / docs
- 05 §3's variant sizes do not line up with the Tailwind classes in `core/ui/text.tsx`; mapped
  `h1→text-4xl`, `h2→text-3xl`, `h3→text-2xl`, `large→text-lg`, `p/default→text-base`,
  `small/muted→text-sm` (staff 28/22/18/17/15/13, patient 30/24/20/18/17/15). `h4`, `lead` and `mono`
  have no row in 05 §3, so they keep the platform values (`text-xl` / `text-sm`).
- The text scale is reset to `staff` when the patient layout unmounts, so the welcome screen always uses
  the staff/platform sizes. The card only says "applied on space mount".
- `checkBrandContrast` was ported as well (web parity, used by its colour picker) even though the mobile
  card does not call it yet.

### Questions for the architect
- Is the Tailwind-class → 05 §3 variant mapping above the intended one? (05 gives seven variants; the
  generated `Text` has `h4`, `lead` and `mono` too.)
- `theme.default_mode` is fetched and cached but not applied: the card's steps only name the three brand
  colour variables. Which card should call `Uniwind.setTheme(default_mode)` — M1-01 (kit) or M1-02 (tabs)?
- `applyCachedBrand()` currently does not check the cached `orgId` against the restored session; after a
  clinic change the previous clinic's colour can show until `GET /theme` answers. Should the cold-start
  paint be filtered by `activeOrganizationId` (needs the restore to finish first, so it would lose the
  no-flash benefit)?

### Notes for the next task
- M1-01: use `status-tones.ts` for `StatusBadge`; `<Text variant>` now renders at the scale applied by the
  space layout (staff 28/22/18/17/15/13, patient 30/24/20/18/17/15). Do not add another text-scale mechanism.
- M1-02: the theme query key includes location, so switching location refetches the brand.
- M1-05 / M0-07: `default_mode` is in `staff.theme.cache` but no code applies it yet.
- `docs/reviews/M0-05/` has no screenshots on purpose (no device); they belong in the M0-D gate.

---
## M1-04a — Push follow-ups (quiet hours, web label, Node engine)  ·  2026-11-11  ·  DeepSeek Flash
Branch: mobile/M1-04a-push-followups   Commit(s): ecb5af8 (code) + this docs commit   Status set to: review

### Done
- Backend decision logic (`notifications/decision/notification-decision.ts`): quiet hours now hold only
  channels that can wait. Added `isQuietHoursExempt()` = `in_app` + `push`; every other channel still returns
  `held_quiet_hours` until the window ends. Push therefore follows the in-app rule and is never delayed —
  a "patient checked in" push is queued immediately at night. Order is unchanged: mandatory → audience
  switch → rule switch → opt-out → quiet hours → queued.
- Spec (`notification-decision.spec.ts`): two new cases — push inside an overnight quiet window → `queued`
  at `now` with reason `enabled`; push with the rule off before quiet hours → still `skipped_disabled`
  (quiet hours never bypass the switches).
- `backend/package.json`: `"engines": { "node": ">=22.12" }` (the ESM-only `expo-server-sdk` is loaded
  through CommonJS `require`; Node 22.12 is the first release that supports it).
- Web `/settings/notifications`: `NotificationChannel` type + `CHANNEL_LABEL.push = 'Phone (push)'`. The page
  already builds its channel columns from the API's `channelsByAudience`, so the `push` column appears as soon
  as M1-04's settings payload includes it; each cell uses the existing `RuleSwitch` → `PUT
  /notification-settings/rules` toggle (tooltip, pending state, disabled while saving).
- Web message log (same screen): added the `skipped_no_device` status label/tone M1-04 emits, so a push row
  with no registered device reads "Skipped — no phone registered" instead of an unlabelled status.
- Web test (`notifications.test.tsx`): mock overview now contains a doctor push rule; new test asserts the
  "Phone (push)" column header and that clicking the "Patient waiting" push switch PUTs
  `{ eventCode: 'queue.patient_checked_in', audience: 'doctor', channel: 'push', isEnabled: false }`.

### Files
- Created: none
- Modified: `backend/package.json`,
  `backend/src/notifications/decision/notification-decision.ts`,
  `backend/src/notifications/decision/notification-decision.spec.ts`,
  `web-app/src/features/notifications/types.ts`,
  `web-app/src/features/notifications/components/MessageLogPanel.tsx`,
  `web-app/src/features/notifications/notifications.test.tsx`,
  `mobile-app/docs/PROGRESS.md`, `mobile-app/docs/HANDOFF.md`
- Deleted / moved: none

### Install commands for the user
None — no dependency was added or changed (the `engines` field is metadata only). Deploy/CI must run Node
≥ 22.12; nothing to install locally.

### Verification
- Backend `npm run build` → clean (`nest build`, no diagnostics).
- Backend `npx jest --runInBand` → **90 suites, 924 tests passed** (357 s), including
  `access-coverage.spec.ts`, `guard.acceptance.spec.ts`, `patient-api-coverage.spec.ts` and all notification
  suites. Targeted: `npx jest --runInBand --testPathPattern "src/notifications/decision"` → 1 suite, 20 tests.
- Backend formatting: `npx prettier --check --end-of-line auto` on the 3 changed files → clean;
  `npx eslint --rule 'prettier/prettier: off'` on the 2 changed TS files → clean. `npm run lint` was not run
  (whole-tree `eslint --fix`, CRLF checkout → the known M0-08 `prettier/prettier` "Delete ␍" noise).
- Web `npm run build` → success (TanStack Start + Nitro, `✓ built`), no type errors.
- Web `npm run test` → **42 files / 387 tests: 382 passed, 5 failed** — **all failures are pre-existing on this
  branch's base**, proven by stashing this task's diff and re-running the same suites (identical failures):
  `features/access/acceptance/builders.acceptance.test.tsx` (THEME-15 expects 14 blue/indigo lines, finds 11),
  `features/notifications/notification-realtime.test.tsx` (2 socket/timer assertions, io mock not called),
  `features/roles/roles.test.tsx` ("escalation error from the server"), and `components/shared/DataTable.test.tsx`
  ("Showing 1–2 of 3"), which passes when run alone (flaky under the full parallel run). None touches the
  notification settings, the push channel or the decision logic.
- Web lint: `npx eslint` on the 3 changed files → clean; `npx prettier --check` (after `--write`) → clean.
- Screenshot: **not taken** — `/settings/notifications` needs a running API and a signed-in clinic admin, and
  no backend server/credentials are available in this worktree. Reviewed by component test instead.

### Acceptance criteria
- [x] Push rows follow the in-app quiet-hours rule (never held) in the decision logic — `isQuietHoursExempt`,
      proven by the new push spec case (night + overnight window → queued now).
- [x] `backend/package.json` has `"engines": { "node": ">=22.12" }`.
- [x] `/settings/notifications` shows the `push` channel labelled exactly "Phone (push)" with a working toggle —
      column header + switch asserted by the new web test; toggle goes through the existing `PUT` path.
- [x] Backend `npm run build` + full `npx jest --runInBand` green (90/924), incl. access-coverage,
      guard.acceptance, patient-api-coverage.
- [x] Web `npm run build` green; changed-file ESLint/Prettier clean.
- [ ] Web `npm run test` fully green — blocked only by the pre-existing failures listed above (not caused by
      this diff; reproduced with the diff stashed).

### Deviations from the card / docs
- Also added `skipped_no_device` to the web status type/labels/tone. M1-04 already emits it and the message log
  lives on the same screen; without it the push log row shows an unlabelled status.
- Prettier re-wrapped one pre-existing long `<SelectTrigger>` line in `MessageLogPanel.tsx` (whitespace only).
- No DB/schema change (none needed).

### Questions for the architect
- Web `npm run test` is not green on the branch base (4 suites above). Do you want a separate cleanup card, or
  should the reviewer accept this task on changed-file evidence (full backend suite + web build + notifications
  test are green)?
- The wording sheet still hides the title field for `push` (`hasSubject` is `in_app`/`email` only; a push
  template keeps its title in `subject`). Editing a push title is not in this card — should it be added to a
  follow-up card?
- The card's label is "Phone (push)" for every audience (doctors, coordinators, staff). Keep it universal?

### Notes for the next task
- Push is now exempt from quiet hours globally (decision level). If a future event needs "don't wake me",
  use `EnqueueInput.scheduledFor` or a per-event rule — not quiet hours.
- `engines` is advisory to npm only; make sure the deploy image/CI Node is ≥ 22.12 or `expo-server-sdk` (ESM)
  fails to load at boot.
- The web column is fully data-driven: adding another channel to `channelsByAudience` only needs a
  `CHANNEL_LABEL` entry.

---
## REVIEW round 3: M0-05 + M1-04a  ·  2026-11-11  ·  Claude Opus (architect)
Branch: reviewed `mobile/M0-05-theme`, `mobile/M1-04a-push-followups`   Status set to: done (merge pending, both)

### Done
- M0-05 done (53 mobile tests); its screenshots / no-flash check join gate M0-D. M1-04a done.
- M0-07 was **not** reviewed: still uncommitted in worktree B with no handoff.
- M1-02 card: apply `theme.default_mode`. 05 §3: variant → Tailwind class mapping recorded.

### Notes for the next task
- 5 web-app tests fail on the base branch (not mobile work) — see `reviews/M1-04a/review.md`.

---
## REVIEW round 4: M1-01 + M0-07 + M2-01 + M2-12  ·  2026-11-11  ·  Claude Opus (architect)
Branch: reviewed four lanes (independent reviewer agent per lane; every Blocker verified by the architect)   Status set to: M2-01 done (merge pending) · M1-01, M0-07, M2-12 changes-requested

### Done
- M2-01 done (968 backend tests). M1-01: FormSheet keyboard blocker (gorhom needs BottomSheetTextInput), footer remount, floating FAB.
  M0-07: OTA updates would bundle without APP_VARIANT / API URL (EAS environments), plus project id and dev-client.
  M2-12: cross-group bundle grant breaks matchBundle; the card's wording was wrong and is fixed.
- Doc fixes: 10 (M2-12 step 3, M1-02 gallery row), 08 (file name, synchronize note), 03 §2 rule 10 (store intents).

### Notes for the next task
- Rework happens in the same worktree and branch; fix only the listed findings; append "Rework <ID> #1".

---
## M2-01 — Patient identity tables + entities  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M2-01-patient-identity   Commit(s): 971dcfb   Status set to: review

### Done
- Step 1: `backend/database/changes/2026-11-12_patient_identity.sql` — the nine tables of 08 §1–3 copied verbatim from the doc (names, columns, constraints, indexes), `IF NOT EXISTS` throughout, wrapped in `BEGIN; … COMMIT;`. CHECKs are inline in `CREATE TABLE` (no DROP/ADD needed: no table is altered).
- Step 2: same nine blocks in `schema/02_tables.sql` right after `user_devices` (without `IF NOT EXISTS`, with the usual header naming the entity file). FKs to `organizations`, `patients`, `patient_*` inline; `patient_access_log.account_id` has no FK.
- Step 3: nine entities — `patient-auth/entities/` (account, identity, session, login-code), `patient-app/entities/` (profile, record-link, consent, access-log), `patient-links/entities/` (claim-token). `@Index`/`@Check` names identical to SQL; partial unique indexes use `where`.
- Step 4: `PatientAuthModule`, `PatientAppModule`, `PatientLinksModule` (only `TypeOrmModule.forFeature`, exported) imported in `app.module.ts`. No providers/controllers.
- Step 5: `patient-app/entities/patient-entities.spec.ts` (44 tests) — for each entity compares table name, columns, index names and CHECK names against BOTH the change file and `02_tables.sql`; asserts the six named unique indexes, WHERE on the two partial ones, no relations on the access log, and that the change file never alters `patients`.
- Step 6: `patients.user_id` untouched.

### Files
- Created: `backend/database/changes/2026-11-12_patient_identity.sql`; 9 entity files; `patient-auth/patient-auth.module.ts`, `patient-app/patient-app.module.ts`, `patient-links/patient-links.module.ts`; `patient-app/entities/patient-entities.spec.ts`
- Modified: `backend/database/schema/02_tables.sql`, `backend/src/app.module.ts`, PROGRESS row, this file
- Deleted / moved: none

### Install commands for the user
none

### Verification
- `npm run build` → clean.
- `npx jest --runInBand` → 91 suites / 968 tests passed (incl. new spec, access-coverage, guard.acceptance, patient-api-coverage).
- `npm run lint` not run (whole-tree `--fix`, CRLF noise); `npx eslint` (prettier rule off) + `prettier --write` on the changed TS files → clean.
- SQL **not executed**: no `psql` / local Postgres in this environment and the shared DATABASE_URL was never touched. The change file is unexecuted — reviewer must run it twice on a disposable Postgres (and `schema/run_all.sql` on an empty one).

### Acceptance criteria
- [x] build clean, full jest green, new spec green.
- [x] no service/controller/endpoint added.
- [ ] Change file executed twice on a real Postgres — not possible here; left for reviewer.

### Deviations from the card / docs
- `uq_patient_accounts_email` (expression index on `lower(email)`) and `idx_patient_login_codes_email` (`created_at DESC`) cannot be expressed with column lists, so the entity declares them as `@Index('<name>', { synchronize: false })` — name only, SQL stays the source of truth.
- `patient_access_log.id` is `PrimaryGeneratedColumn('increment', { type: 'bigint' })` (TS type `string`).
- `package-lock.json` was already modified in the worktree before this task; not staged.
- `database/README.md` still says "156 tables" (was already stale); left alone (not a listed file).

### Questions for the architect
- Should `action` / `resource_type` on `patient_access_log` and `relation`-style unions get CHECKs? 08 §3 specifies none, so none were added.

### Notes for the next task
- Entities are registered via `autoLoadEntities`; M2-02 can inject `Repository<PatientAccount>` etc. by importing `PatientAuthModule` (it exports `TypeOrmModule`).

---
## M2-12 — `patient_app` feature, permissions, settings keys  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M2-12-patient-app-keys   Commit(s): a62d9ab (code) + docs commit   Status set to: review

### Done
- Feature seed `patient_app` (module `patients`, `enabledByDefault: false`, sortOrder 6); `patients.portal` left retired.
- Permissions `patients.app_link.manage` (risk high) and `appointments.requests.manage`, both `feature: 'patient_app'`.
- Bundles: `patients.app_link.manage` added to the Queue bundle (holds `queue.checkin`); `appointments.requests.manage` added to the Appointments bundle. No role names in code.
- `src/patient-app/patient-app.settings.ts`: `patient_app.show_billing`, `patient_app.show_diagnosis` (boolean, default true, ORG, not lockable); imported as a side effect in `app.module.ts`.
- `npm run access:export` regenerated web + mobile catalogs (both contain the two keys).
- Tests: `catalog.spec.ts` updated (extra keys listed; new spec mapping both to `patient_app`).

### Files
- Created: backend/src/patient-app/patient-app.settings.ts
- Modified: backend/src/access/catalog/{permissions,bundles,catalog.spec}.ts, backend/src/feature-flags/feature-catalog.seed.ts, backend/src/app.module.ts, both generated catalog.ts files, PROGRESS.md, HANDOFF.md

### Install commands for the user
none

### Verification
- Backend `npm run build` → clean. Full `npx jest --runInBand` → 90 suites / 925 tests passed (incl. catalog, access-coverage, guard.acceptance, patient-api-coverage).
- Changed-file ESLint (prettier rule off) → clean; `npm run lint` not run (CRLF `prettier/prettier` noise).

### Acceptance criteria
- [x] Build clean, full unit suite green, both catalogs contain the keys.

### Deviations from the card / docs
- The "bundle group = permission group" check in `catalog.spec.ts` gained a small `CROSS_MODULE_BUNDLE_GRANTS` allowance, because the Queue bundle now holds a Patients-group permission as the card requires.

### Questions for the architect
- Is a cross-group bundle grant (Queue bundle → `patients.app_link.manage`) acceptable, or should a front-desk Patients bundle entry be used instead?

### Notes for the next task
- Nothing reads the settings yet; the `/patient-api` read services (M2-xx) consume `PATIENT_APP_SETTINGS`.

## Rework M2-12 #1
Branch `mobile/M2-12-patient-app-keys`. Finding → fix:
1. **Blocker** — removed `patients.app_link.manage` from the Queue bundle; added it to the Patients **basic** bundle (Patients full gets it via `fullOf`). `appointments.requests.manage` stays in Appointments basic. Removed `CROSS_MODULE_BUNDLE_GRANTS`; the strict "bundle group = permission group" test is restored. Both catalogs regenerated with `npm run access:export`.
2. **Major** — added tests: `matchBundle(g, BUNDLES[g][l]) === l` for every group and level; basic ⊆ full per group; Patients basic carries the app-link permission and Queue basic does not.
3. No code change. `patients.app_link.manage` is high-risk and opt-in: only new orgs' Admin template gets it (via Patients full). Receptionists must be granted it explicitly.
4. No code change. Existing orgs' roles are not updated on deploy (templates are insert-missing).
5. Left as is. The settings import in `app.module.ts` moves into `PatientAppModule` after M2-01 is merged (note for M2-02).

Install commands: none. Questions: none.

---
## M1-01 — Core component kit  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M1-01-core-kit   Commit(s): bf55629 (code) + this docs commit   Status set to: review

### Done
- Every 05 §6 component except `QrCode`, in `src/core/components/{layout,data-display,feedback,forms,overlays}` with a barrel (`@/core/components`):
  layout `Screen` (safe-area edges, banner/header slots, pull-to-refresh, `KeyboardAwareScrollView`), `ScreenHeader` (auto back arrow from `router.canGoBack()`), `IconButton` (`accessibilityLabel` required by type, 44 pt, `loading`), `ListRow` (reads as one sentence), `SectionHeader`, `FAB`;
  data-display `StatusBadge` (tones from `status-tones.ts`), `TokenBadge`, `Avatar` (ui/avatar + expo-image, deterministic 8-tint palette in `avatar-tint.ts`), `StatTile`;
  feedback `OfflineBanner`, `ConnectionPill` (+ pure `deriveConnectionState`), existing four states (added optional `className`; `ErrorState` `retryLabel`);
  forms `SearchBar` (300 ms debounce), `FilterChips` (single/multi, Clear chip with count), `SegmentedControl` (selection haptic);
  overlays `FormSheet`, `ActionSheet` (both `BottomSheetModal`), `ConfirmDialog` (ui/alert-dialog, async confirm with spinner).
- `FormSheet`: dynamic height ≤ 90 %, `keyboardBehavior="interactive"`, `android_keyboardInputMode="adjustResize"`, `BottomSheetScrollView` (+ `keyboardShouldPersistTaps="handled"`), sticky `BottomSheetFooter` submit (content padded by the measured footer height), server-error banner, dirty guard: with `isDirty` pan-down is off and X / backdrop / Android back open the "Discard changes?" `ConfirmDialog`.
- Dev gallery: `src/app/(staff)/(main)/__gallery.tsx` → `@/staff/features/gallery` `GalleryPage` (route has no logic; the page redirects to `/home` when `!__DEV__`). Shows every component/state.
- Tests (16 new): `StatusBadge` (every status spec renders its label; tone classes), `IconButton` (label, loading blocks press, `@ts-expect-error` proves the label is required), `SearchBar` (fake-timer debounce, clear, external reset), `FilterChips`, `SegmentedControl`, `avatar-tint`, `connection-state`.

### Files
- Created: `src/core/components/{index.ts, layout/{IconButton,Screen,ScreenHeader,ListRow,SectionHeader,FAB}.tsx (+IconButton.test.tsx), data-display/{StatusBadge,TokenBadge,Avatar,StatTile}.tsx, data-display/avatar-tint.ts, feedback/{OfflineBanner,ConnectionPill}.tsx, feedback/connection-state.ts, forms/{SearchBar,FilterChips,SegmentedControl}.tsx, overlays/{FormSheet,ActionSheet,ConfirmDialog,sheet-parts}.tsx}` + 7 test files, `src/staff/features/gallery/{index.ts,pages/GalleryPage.tsx}`, `src/app/(staff)/(main)/__gallery.tsx`
- Modified: `src/core/components/feedback/{EmptyState,ErrorState,LoadingSkeleton}.tsx` (optional `className`, `retryLabel`), `src/shell/RootProviders.tsx` (+`BottomSheetModalProvider`), `package.json` (jest `moduleNameMapper` for `lucide-react-native` → its CJS build; `transformIgnorePatterns` += `@rn-primitives/.*|uniwind`), `docs/PROGRESS.md`, `docs/HANDOFF.md`
- Deleted / moved: none

### Install commands for the user
```bash
# none required — built with the RNR components that already exist
# (alert-dialog, avatar, button, card, input, label, separator, skeleton, switch, text, textarea).
# Not needed: dialog / popover / select / tabs / progress / toggle-group.
```

### Verification
- `node node_modules/eslint/bin/eslint.js src` → `✖ 3 problems (0 errors, 3 warnings)` — only the 3 pre-existing warnings.
- `npm run typecheck` → exit 0, after `CI=1 npx expo start --offline` regenerated `.expo/types/router.d.ts` (contains `/__gallery`).
- `npm test` → `Test Suites: 17 passed · Tests: 69 passed` (53 before + 16 new).
- `npm run lint:fences` → all three forbidden directions fail as expected.
- `npx expo export --platform android --no-bytecode` → exits 0 (bundle check; output deleted).
- grep for hex colours / `ml- mr- pl- pr- left- right-` in the new code → none.
- Manual: **not run — no device/emulator** (`adb devices` empty). Gallery screenshots (light/dark, 1.3× font), TalkBack pass and keyboard behaviour of `FormSheet` are not done; they join gate M0-D.

### Acceptance criteria
- [x] Every 05 §6 component except `QrCode` exists in core, props as in the table.
- [x] Tests green (StatusBadge tones, IconButton label at type level, SearchBar debounce).
- [x] Every icon-only control has a label (`IconButton`, SearchBar clear, FormSheet close, back arrow; `FAB` label doubles as its a11y label).
- [ ] Gallery screenshots light/dark + 1.3× — no device; joins gate M0-D. The gallery itself is built.

### Deviations from the card / docs
- Added `BottomSheetModalProvider` to `src/shell/RootProviders.tsx` (outside the card's file list): `BottomSheetModal` cannot render without it and M1-02+ all need it.
- Changed jest config in `package.json` (M0-06 file): component tests could not load `lucide-react-native` (ESM-only `react-native` export) or `@rn-primitives/slot` (JSX in dist) otherwise.
- RNTL here is v14: `render`/`fireEvent`/`act` are async — tests `await` them (relevant for every later component test).
- `ConnectionPill` "reads realtime + network state" in 05 §6; core cannot import a space's socket, so it takes `state` + `labels` props and exports `deriveConnectionState({ online, realtimeConnected })`. The staff space wires it in M1-07/M1-09. Likewise `OfflineBanner` takes `message`/`visible` (no `core/network/useOnline` exists yet).
- `FormSheet` takes `discard`/`closeLabel` strings as required props (core never calls `t()`); `ScreenHeader.backLabel` and `SearchBar.clearLabel` have English accessibility defaults.
- `GalleryPage` lives in `staff/features/gallery` (not the route file) to keep routes logic-free; it is 250 lines (dev-only).
- No hex / `ml-` anywhere. StatusBadge `soft`/`outline` keep text on `text-foreground` with a tone dot (tone-coloured text on a tint can miss 4.5:1, e.g. warning).

### Questions for the architect
- Is it OK that `BottomSheetModalProvider` was added to `RootProviders` (shell) and the jest config touched?
- `FormSheet` pan-down is disabled while dirty (the library has no way to veto a drag); users must use X / Android back. Acceptable?
- `Screen` defaults `edges` to top+bottom; tab screens (M1-02) should pass `['top']`. Want the default flipped?
- Gallery has no entry point; open it in a dev build with `router.push('/__gallery')` or the deep link `<scheme>://__gallery`. Should M1-02's More tab get a dev-only "Gallery" row?

### Notes for the next task
- Import from `@/core/components` (barrel). Spread tone specs: `<StatusBadge {...QUEUE_STATUS_TONES[status]} />`.
- `FormSheet` needs the provider that `RootProviders` now mounts; in tests mock `@gorhom/bottom-sheet` with its `mock.js`.
- `FormSheet`'s footer is a render-prop component re-created when `submit` changes; keep `submit` stable-ish (the React Compiler handles it).
- Native behaviour not yet seen on a device: sheet keyboard handling (interactive + adjustResize), footer padding, Android back handling, haptics.

## Rework M1-01 #1

Branch `mobile/M1-01-core-kit`. Tests 18 suites / 83 tests ✓ · typecheck ✓ · ESLint 0 errors · lint:fences ✓.

| # | Result |
| --- | --- |
| 1 Blocker | **Fixed.** `overlays/sheet-input-context.ts` (`SheetInputContext`, `useInSheet`); `FormSheet` provides it inside the modal content (gorhom portals content, so it is provided inside, not outside). `FormInput` swaps to `withUniwind(BottomSheetTextInput)` with the same classes as `ui/input`. Wrong doc comment removed. Test `FormSheet.test.tsx`: `FormInput` in `FormSheet` renders the sheet input; outside renders the plain one. No textarea component exists in core, so nothing else to swap. |
| 2 Major | **Fixed.** Backdrop: module-level `SheetBackdrop` + `useSheetBackdrop(onPress)` (stable callback, latest `onPress` via ref) in `sheet-parts.tsx`, used by FormSheet and ActionSheet; `makeBackdrop` removed. Footer: module-level `SubmitFooter` reading `submit` from a per-sheet store (`createFooterStore`), because the footer renders in the library portal where React context from FormSheet is not available; the footer component is created once per sheet, so no remount. |
| 3 Major | **Fixed.** `Screen` has a `floating` slot outside the scroll container; gallery FAB moved into it. |
| 4 | **Fixed.** `accessibilityState.disabled = !!(disabled \|\| pending)` in `SubmitFooter`. |
| Answer 3 | **Done.** `Screen` default `edges = ['top']`. |
| 5 | **Fixed.** Non-user dismissal → `onClose`; Android back closes an open confirm first. |
| 6 | **Fixed.** New `Spinner` (`colorClassName` accent token) used by IconButton, ConfirmDialog, FormSheet submit; exported from the barrel. |
| 7 | **Partly.** `checkbox` role + `checked` state when `multiple`. Not moved the count to a "Filters" chip: the Clear chip already carries the count and a separate chip adds an element for no extra function; say if you want it. |
| 8 | **Fixed.** `h3`, count in its own `Text` with a gap. |
| 9 | **Fixed.** ListRow title, FilterChips and SegmentedControl labels allow 2 lines. |
| 10 | **Fixed.** Prop docs on ScreenHeader, SearchBar, ErrorState state "patient callers must pass a translated string". |
| 11 | **Fixed.** Status-tones table test (in `StatusBadge.test.tsx`) and SearchBar echo-while-typing test. |

Not run: device checks (keyboard behaviour of the sheet still joins gate M0-D). No new installs.

---
## M0-07 — Build configuration: app.config.ts, EAS, updates  ·  2026-11-11  ·  DeepSeek Flash (finished by Claude Sonnet 5.5)
Branch: mobile/M0-07-eas   Commit(s): 2fd216d   Status set to: review

### Done
- `app.json` → `app.config.ts` with `APP_VARIANT` (development default / preview / production): name, scheme, package + bundle id `com.placeholder.clinicapp` (+ `.dev`/`.preview`); kept splash + localization plugins, `typedRoutes`, `reactCompiler`.
- `eas.json` profiles development / preview (APK, channel) / production (AAB, channel) with `APP_VARIANT` + `EXPO_PUBLIC_API_URL` placeholders.
- expo-updates: `runtimeVersion: appVersion`; `updates.url`/`eas.projectId` come from `EXPO_UPDATES_URL`/`EAS_PROJECT_ID` (updates disabled until set).
- `core/app-version.ts` (`isBelow`), `shell/min-version.ts` (fail open, 6 s timeout), `shell/UpdateRequiredPage.tsx` (X-03), wired into `RootShell`.
- `core/notifications/channels.ts`: Android channels queue/reminders/general, no permission prompt, created at start.
- `{ virtual: true }` dropped from expo-notifications mock. `docs/RELEASE.md` written.

### Files
- Created: app.config.ts, eas.json, docs/RELEASE.md, src/core/app-version(.test).ts, src/core/notifications/channels.ts, src/shell/{min-version(.test).ts,UpdateRequiredPage.tsx}
- Modified: package.json, package-lock.json, jest.setup.ts, src/shell/RootShell.tsx
- Deleted / moved: app.json

### Install commands for the user
Already installed in the working tree. Normalise the lockfile with `npm install` after merge.

### Verification
- `npm test` → 8 suites, 32 passed; `npm run typecheck` clean; `npm run lint:fences` green
- eslint src → 0 errors, 3 pre-existing warnings
- `expo config --type public`: development → "Clinic (Dev)", com.placeholder.clinicapp.dev, scheme clinicapp-dev; preview → "Clinic (Preview)", .preview, clinicapp-preview; production → "Clinic", com.placeholder.clinicapp, clinicapp. All: runtimeVersion.policy appVersion, updates.enabled false.
- `expo-doctor`: one failed check — 11 packages a patch behind SDK 58 (expo, expo-router, expo-font, …); none are from this task.

### Acceptance criteria
- [x] config output per variant (above)
- [x] distinct package ids → dev installs beside preview
- [x] expo-doctor: no new errors (only pre-existing patch drift)

### Deviations from the card / docs
- `web.output: "server"` left in place (docs do not confirm nothing depends on it).

### Questions for the architect
- Remove `web.output: "server"`? Run `npx expo install --check` to fix doctor drift in a separate chore?
- iOS Update button links to the generic App Store URL until O-01/M4 gives a listing.

### Notes for the next task
- M1-05 needs `EAS_PROJECT_ID` (after `eas init`, see docs/RELEASE.md).

---
## Rework M0-07 #1  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M0-07-eas   Commit(s): see `git log` ("fix(mobile): M0-07 rework #1 …")   Status set to: review

### Finding → fix
1. **Blocker** — `APP_VARIANT` / `EXPO_PUBLIC_API_URL` now come from EAS environments. `eas.json` profiles use `"environment"` (env blocks removed). RELEASE.md §2 has the commands per environment and a bold warning that every `eas update` passes the matching `--environment`. Deviation: the Expo docs (environment-variables + manage pages) document `eas env:set`, not `env:create`, so the runbook uses `env:set` (flags `--name --value --environment --visibility plaintext`).
2. **Major** — single `EAS_PROJECT_ID` constant in `app.config.ts` (empty placeholder; comment says paste after `eas init`); `updates.url` and `extra.eas.projectId` derive from it. `EXPO_UPDATES_URL`/`EAS_PROJECT_ID` env options removed from code and RELEASE.md.
3. **Major** — `npx expo install expo-dev-client` listed below; "dev build installs beside preview" is NOT ticked, pending gate M0-D (needs a device).
4. `appVersionSource: "remote"`, `autoIncrement: true` on production.
5. `UpdateRequiredPage` opens `market://details?id=…`, falls back to the https Play URL (`Linking.openURL`); expo-web-browser import dropped there. iOS uses `IOS_APP_STORE_URL` placeholder constant (decided with O-01 at M4).
6. `RootShell` caches the check in a module-level promise (one request per cold start, also under StrictMode); new `RootShell.test.tsx` mocks `fetchMinVersion` and asserts the update screen renders and one fetch happens.
7. RELEASE.md refers to constant names (`EAS_PROJECT_ID`), no line numbers.
Also: `web.output: "server"` removed (favicon kept).

### Install commands for the user
```
npx expo install expo-dev-client
```
(not run by me). Then run the `env:set` commands in docs/RELEASE.md §2 after `eas init`.

### Verification
- `npm test` 9 suites / 33 tests pass; `npm run typecheck` clean; eslint src 0 errors (3 pre-existing warnings); `lint:fences` green.
- `expo config --type public`: development → "Clinic (Dev)", .dev, clinicapp-dev; preview → "Clinic (Preview)", .preview, clinicapp-preview; production → "Clinic", com.placeholder.clinicapp, clinicapp. All: runtimeVersion appVersion, updates.enabled false (until EAS_PROJECT_ID is set).

### Acceptance criteria
- [x] config output per variant · [x] distinct package ids (config level)
- [ ] dev build installs beside preview — pending gate M0-D (device)

### Questions
- None. Note: the review and updated docs (03 rule 10) live on mobile/develop, not on this branch; I read them from the main checkout.

---
## REVIEW round 5  ·  2026-11-11  ·  Claude Opus (architect)
Branch: six branches reviewed (reworks by the architect; new cards with an independent reviewer agent each; key claims verified in code)   Status set to: M1-01, M0-07, M2-12 done (merge pending) · M1-07a, M1-11a, M2-02 changes-requested · M1-06a not handed off yet

### Done
- Reworks M1-01, M0-07 (EAS `env:set` verified in Expo docs), M2-12 all pass — see `reviews/<ID>/rework-1.md`.
- M1-07a: two board action cells came from a wrong 06 S-02b table (skip from waiting, transfer from skipped) — 06 fixed against `queue-transitions.ts`.
- M1-11a: boolean query bug (`"false"` → true), phone masking, schema tightening. M2-02: atomic attempt counter (Major) + small fixes.
- DECISIONS: open risks R-01 (login-code rate limits in memory), R-02 (backend boolean filters). Cards M2-06, M2-11, M1-06 annotated.

### Notes for the next task
- Rework branches must read updated docs from mobile/develop (`git show mobile/develop:<path>`).

---
## M1-06a — Idempotent mutation helper + online state  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M1-06a-idempotent   Commit(s): see `git log` on the branch (code commit + docs commit)   Status set to: review

### Done
- Step 1: `core/network/use-online.ts` — `useOnline()` (NetInfo, `isConnected !== false`) + `isOnlineNow()`; barrel `core/network/index.ts`.
- Step 2: `core/http/idempotency.ts` — `newIdempotencyKey()` (expo-crypto `randomUUID`), `isRetryable()` (no response, or 503 `LOCK_TIMEOUT`; cancel is not retried), `retryDelayMs()` (250 × (attempt+1) + 0–100 ms).
- Step 3: `core/http/idempotent-mutation.ts` — `useIdempotentMutation`; one key per `mutate()` call, retries inside `mutationFn` (max 3) with TanStack `retry: false`; 4xx and other errors stop at once.
- Step 4: `core/http/use-can-mutate.ts` — `useCanMutate()` = `useOnline()`.
- Step 5: tests (fake timers) for same key across retries, new key per call, stop on 4xx, 503 non-LOCK_TIMEOUT not retried, give up after 3 retries (4 calls), backoff delay, `isRetryable`, `retryDelayMs`, `useOnline`, `useCanMutate`.
- Added `core/http/index.ts` barrel (docs/04 §8 says import from `@/core/http`); re-exports the existing `apiErrorMessage` too.

### Files
- Created: `src/core/network/{use-online.ts,index.ts,use-online.test.ts}`, `src/core/http/{idempotency.ts,idempotent-mutation.ts,use-can-mutate.ts,index.ts,idempotent-mutation.test.tsx}`
- Modified: `docs/PROGRESS.md` (my row), `docs/HANDOFF.md`
- Deleted / moved: none

### Install commands for the user
none

### Verification
- `npm test` → 12 suites / 63 tests passed before final edits; http+network suites 8 passed after the last import tweak (full run before it: all green)
- `npm run typecheck` → clean (after `expo start --offline` generated `.expo/types/router.d.ts`)
- eslint `src` → 0 errors; 1 pre-existing warning (`api-error.ts` axios default import)
- `npm run lint:fences` → all forbidden directions fail as expected
- Manual: none (no UI).

### Acceptance criteria
- [x] tests green — see above
- [x] no import outside `src/core` — only `@/core/network` inside core
- [x] no UI

### Deviations from the card / docs
- `retryDelayMs` jitter is an integer 0–100.
- This worktree's `node_modules` was still being copied when I started and has no `.bin`; I ran jest/tsc/eslint via `node node_modules/<pkg>/bin/...` directly.
- `mobile-app/package-lock.json` shows as modified in the worktree (not by me, not staged).

### Questions for the architect
- `isOnlineNow()` returns a module-level value that is only updated while a `useOnline` hook is mounted (default `true`). Should it instead be fed by `setupQueryManagers` / a NetInfo subscription started at app boot? Left minimal per card.

### Notes for the next task
- M1-06 can build the OfflineBanner on `useOnline` and call mutations via `useIdempotentMutation` (`mutationFn(vars, { idempotencyKey })` → send header `Idempotency-Key`).

---
## REVIEW round 6: M1-02 + M1-06a  ·  2026-11-11  ·  Claude Opus (architect)
Branch: reviewed `mobile/M1-02-staff-shell` (reviewer agent + architect) and `mobile/M1-06a-idempotent` (architect)   Status set to: M1-06a done (merge pending) · M1-02 changes-requested

### Done
- M1-06a done (63 tests). M1-02: Major — access load failure leaves a More-only app with no retry; small fixes listed in `reviews/M1-02/review.md`.
- Card fixes: M1-02 acceptance (receptionist sees Today), M1-03 resubscribe on org/location change; 04 §4 navigator-chrome style exception.
- Reworks M1-07a, M1-11a, M2-02 have no new commits yet.

---
## M1-07a — Queue data layer: types, API, keys, pure logic  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M1-07a-queue-api   Commit(s): 6ac0c68 (code) + docs commit   Status set to: review

### Done
- Step 1 `types/queue.types.ts`: unions, `EntryView`, `SessionView`, `SessionSnapshot`, `BoardResponse`, `EntryResult`, `ArrivalResult`, `CallNextResult`, `TransferResult`, `TicketView`, `PatientVisit`, `NextPreview`, `QueuePolicy`, request types, `MutationOptions`. Verified field by field against `queue-query.service.ts`, `queue.dto.ts`, `queue-policies.service.ts`, orchestrator return shapes.
- Step 2 `api/queue.api.ts`: every endpoint of both 07 §2.3 tables plus check-in and convert-to-walk-in (+ `next-preview`). Mutations are `fn(vars, { idempotencyKey, ifMatch? })`; `If-Match` is sent quoted (`"7"`). Reads take plain args. All via `staffApi`.
- Step 3 `api/queue.keys.ts`; step 4 `lib/entry-actions.ts` (`availableEntryActions`, rule tables for S-02a/S-02b); step 5 `lib/queue-errors.ts` (`queueErrorMessage`, `shouldRefetch`, plus `queueErrorCode`); step 6 barrel. No React, no hooks.

### Files
- Created: `mobile-app/src/staff/features/queue/{index.ts, types/queue.types.ts, api/queue.api.ts, api/queue.keys.ts, api/queue.api.test.ts, lib/entry-actions.ts, lib/entry-actions.test.ts, lib/queue-errors.ts, lib/queue-errors.test.ts}`
- Modified: `docs/PROGRESS.md`, `docs/HANDOFF.md`
- Deleted / moved: none

### Install commands for the user
None.

### Verification
- `node node_modules/jest/bin/jest.js` → 13 suites, 120 tests passed (queue: 3 suites, 67 tests).
- `tsc --noEmit` (after `CI=1 expo start --offline` generated `.expo/types/router.d.ts`) → **no errors in any file I touched**. The only errors are TS7016 "no declaration file for `lucide-react-native`" in 8 older files (core/ui, shell, auth…) — environment issue in this worktree's `node_modules`, present without my change.
- `eslint src` → 0 errors, 3 pre-existing warnings (api-error.ts, skeleton.tsx, staff/lib/api.ts).
- `npm run lint:fences` → all 3 forbidden directions rejected as expected.

### Acceptance criteria
- [x] typecheck clean for the new code; [x] `availableEntryActions` tested for every status × viewer × permission combination (board: all 16 permission masks × 9 statuses vs. an independent table); [x] `queue-errors` tested for all 12 codes + 3 developer-bug codes + fallbacks; [x] api test proves `Idempotency-Key` + `If-Match` on a mutation (fake axios adapter on the real `staffApi`); [x] nothing imports React.

### Deviations from the card / docs
- `availableEntryActions` extras beyond the tables: `select` also needs `session.status === 'open'` (backend `assertOpen` → `SESSION_NOT_OPEN`); `patient-file` needs `entry.patient` and `patients.view`; on the doctor viewer it appears only on the current card (called / in_consultation). `show-ticket` is board-only.
- `openSession` (`POST /queue/sessions`) is not Idem in 07, but accepts `MutationOptions` for uniformity (header is harmless).
- Contract types follow the code where 07 differs: `EntryView.checkedInAt` is non-null, `patient.phone/patientNumber` nullable, `SessionView.lastCallReason` typed `SelectionReason | null`, `select` returns `{ entry, eventSeq }` (EntryResult), not CallNextResult as web types it.

### Questions for the architect
- **S-02b table vs backend transitions:** `ENTRY_TRANSITIONS` (backend `queue-transitions.ts`) allows `skip` only from `called` (`waiting → skipped` is not allowed → 422 INVALID_TRANSITION), and `transfer` is a normal entry move out of waiting/in_consultation (not clearly from `skipped`). The card says implement the table exactly, so `skip` is offered for waiting and called and `transfer` for waiting and skipped. Should I restrict skip to `called`? (One-line change per rule table + test.)
- `setPriority` backend also accepts `skipped` and `on_hold` (table says waiting only) — kept the table. Also "Mark urgent" is still offered on an entry that is already `authorized_urgent`; hide it?
- `GET /queue/my-session` also accepts `?doctorId=` (needs `queue.doctor.any`); not in 07, so `fetchMySession()` takes no args. Add later if a "run another doctor's queue" screen is wanted.

### Notes for the next task
- M1-07 hooks: call `fn({ ...vars }, { idempotencyKey, ifMatch: entry.version })` from `useIdempotentMutation`; use `queueErrorMessage` for toasts and `shouldRefetch` to invalidate `queueKeys.mySession/board`. `ACTIVE_WITH_OTHER_DOCTOR` and `LATE_LIMIT_EXCEEDED` should be intercepted with `queueErrorCode` to open the dialogs.
- `queueErrorMessage` logs (`log.error`) for IDEMPOTENCY_* / REQUEST_IN_FLIGHT codes only.

## Rework M1-07a #1  ·  2026-11-12  ·  Claude Sonnet 5.5
Branch: mobile/M1-07a-queue-api   Status set to: review

| # | Result | What changed |
| --- | --- | --- |
| 1 | fixed | `lib/entry-actions.ts`: board `skip` valid only for `called` |
| 2 | fixed | board `transfer` valid only for `waiting` |
| 3 | fixed | board `transfer` gated on `queue.entry.manage` |
| 4 | fixed | `SelectResult = { entry, reason: 'MANUAL_SELECT', suggestedEntryId: string \| null, eventSeq }`; `selectEntry` returns it |
| 5 | fixed | `openSession(vars)` takes no options and sends no `Idempotency-Key` |
| 6 | fixed | new `IdemOptions { idempotencyKey }`; `MutationOptions extends IdemOptions` (+`ifMatch`). Session actions, `callNext`, `recallEntry`, `registerWalkIn`, `checkInAppointment`, `convertToWalkIn` take `IdemOptions` (backend has no `@IfMatch` there) |
| 7 | fixed | `queueKeys.nextPreview(sessionId)` |

Also (review answer 2): `mark-urgent` hidden when `priorityClass === 'authorized_urgent'`. Tests updated for #1-#3 (oracle table) plus new cases for skip/transfer/urgent.

Verification: jest 13 suites / 122 tests pass; `tsc --noEmit` clean; eslint 0 errors (3 pre-existing warnings); `lint:fences` pass. Install commands: none. Questions: none.

---
## M1-11a — Patients data layer: types, API, keys, pure logic  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M1-11a-patients-api   Commit(s): 0354cac (code) + docs commit   Status set to: review

### Done
- Step 1: `types/patients.types.ts` — `PatientDetail` (= `PatientResponseDto`, field names verbatim), `PatientListItem`, `PatientQuery` (`PatientQueryDto`), `CreatePatientInput` (`CreatePatientDto` subset), `PatientHistory`, `Vitals`, `PatientTeethChart`, `PrescriptionListItem`/`PrescriptionPage`, `PatientAlert`.
- Step 2: `api/patients.api.ts` (list, detail, create, check-phone, history, vitals, teeth-charts, `GET /prescriptions/patient/:id`) + `api/patients.keys.ts` (every key has org + location).
- Step 3: `lib/mask-phone.ts` (`03001234567` → `0300•••4567`; short/odd/null safe) and `lib/patient-alerts.ts` (web port: allergies split, blacklist + reason, minor + guardian), with table tests.
- Step 4: `schemas/quick-register.schema.ts` (Zod 4): name 1–150, phone 1–20 digits/`+`/space/dash, gender optional, dob optional real `YYYY-MM-DD` not after `todayYmd()`, minor → guardian name + phone required; blank optionals → `undefined`. Table tests (todayYmd mocked).
- Step 5: `index.ts` barrel. No hooks, no components.

### Files
- Created: `mobile-app/src/staff/features/patients/{index.ts, types/patients.types.ts, api/patients.api.ts, api/patients.keys.ts, lib/mask-phone.ts(+test), lib/patient-alerts.ts(+test), schemas/quick-register.schema.ts(+test)}`
- Modified: `docs/PROGRESS.md` (M1-11a row), `docs/HANDOFF.md`
- Deleted / moved: none

### Install commands for the user
none

### Verification
- `npm test` → 13 suites, 106 passed (53 in patients: 3 suites)
- `tsc --noEmit` → 0 errors (after generating `.expo/types/router.d.ts`)
- eslint `src` → 0 errors, 3 pre-existing warnings in other files
- `lint:fences` → all pass
- Backend: none touched. Manual: none (no UI).

### Acceptance criteria
- [x] typecheck green; tests for masking, alerts, schema; types use backend DTO names (compared with the three DTO files).

### Deviations from the card / docs
- History appointment/treatment rows are typed with only the columns the app is likely to read (`id`, dates, status…); the card says "fields mobile screens need" — extend in M1-12 if more are needed.
- `Vitals` decimal columns typed `number | string | null` (Postgres decimals can arrive as strings).
- `maskPhone` keeps 4+4 chars for numbers ≥ 9 chars, 2+2 for 7–8, last 2 for ≤ 6 (card only gave the 11-digit example).

### Questions for the architect
- `GET /prescriptions/patient/:id` returns `{ data, total }` (no `totalPages`, no `page`/`limit`), so `PrescriptionPage` is separate from `Paginated<T>`; paging rule `page * limit < total`. It returns ALL statuses (incl. DRAFT) — card S-05 says "finalized first"; should the screen filter/sort client-side?
- Vitals returns the whole list, not just the latest; `fetchPatientVitals` returns the array and the hook (M1-12) should take `[0]`. Confirm the backend sorts newest first (not verified in the service).

### Notes for the next task
- The worktree's `node_modules` was still being copied in by another process while I worked; `npx expo start` also tried to fetch expo from npm once (npx cache only). `mobile-app/package-lock.json` shows an unrelated local modification (34 lines removed) that I did NOT commit — please check where it came from.
- Run tools with `node node_modules/<pkg>/bin/…` here: `node_modules/.bin` is absent in this worktree.

## Rework M1-11a #1  ·  2026-11-12  ·  Claude Sonnet 5.5
Branch: mobile/M1-11a-patients-api   Status set to: review

| # | Result |
| --- | --- |
| 1 | Fixed. `isBlacklisted` / `isMinor` typed `true` only with a doc comment; new `lib/patient-query.ts` `patientQueryParams` (used by `fetchPatients`) drops anything but `true`; tests in `patient-query.test.ts`. |
| 2 | Fixed. `maskPhone` works on digits only, keeps a leading `+`; 4+4 when >= 3 digits stay hidden, else 2+2, <= 4 digits keep last 2. New rows incl. `+92 300 1234567`, `123456789`, `---`, `+`. |
| 3 | Fixed. Phone regex `^\+?[0-9][0-9 -]*$` + >= 7 digits for `phone` and `guardianPhone`; tests for `---`, `+`, tab, newline, few digits. |
| 4 | Fixed. Final `.transform` drops guardian fields when `!isMinor`; test added. |
| 5 | Fixed. `gender: ''` preprocessed to `undefined`; test added. |
| 6 | Noted, no change. |
| 7 | Noted, no change (card already updated). |

### Deviation
- Finding 2 says 4+4 "only when >= 4 digits stay hidden", but that would turn the S-04 example `03001234567` (11 digits, 3 hidden) into `03•••67`. I used >= 3 hidden (>= 11 digits) so the doc example still holds and the 9-digit bug is fixed. Say if you want the stricter rule.

### Results
mobile: `npm test` 125 passed, typecheck clean, ESLint 0 errors (3 pre-existing warnings), `lint:fences` pass. No install needed. `mobile-app/package-lock.json` remains an unrelated uncommitted local change (not staged).

---
## M1-02 — Staff tabs shell, More tab, location switch, sign-out  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M1-02-staff-shell   Commit(s): c1398eb   Status set to: review

### Done
- `(staff)/(main)/(tabs)/` routes (zero logic) + `staff/navigation/StaffTabs.tsx` (`expo-router/js-tabs`, since `Tabs` from `expo-router` is deprecated in SDK 58). Gates in `tab-access.ts` exactly as docs/02 §4; hidden with `href: null`; once `/me/access` is ready the app moves to the first allowed of Queue → Today → Patients → Schedule → More.
- Placeholders for Today/Queue/Patients/Schedule: one `TabPlaceholderPage` (EmptyState "Coming soon") in `staff/navigation/pages`, so the queue/patients features stay untouched; later cards swap the route file import.
- More (S-08) in `staff/features/more`: profile card, Switch location (ActionSheet → `switchLocation` in `auth.api.ts` → cache cleared except `access`, which is invalidated → `setLocationContext`; brand re-applies from the new theme query), Switch to patient space, App version (`currentVersion`), Sign out via `ConfirmDialog`, `__DEV__`-only "Component gallery" row. "No mobile features for your role" empty state when only More is visible (docs/05 §7).
- `NotificationBell` (`staff/features/notifications`), count 0, labelled IconButton, shown in every tab header. No onPress yet (TODO M1-13).
- Theme `default_mode`: `core/theme/apply-theme-mode.ts`; applied from the cache in `applyCachedBrand`, from the live theme in `BrandTheme`, `'system'` restored in `StaffLayout` cleanup.
- Removed `home` route and `features/dashboard`; gallery non-dev redirect now goes to `/more`.

### Files
- Created: app/(staff)/(main)/(tabs)/{_layout,today,queue,patients,schedule,more}.tsx, core/theme/apply-theme-mode(.test).ts, staff/navigation/{StaffTabs.tsx,tab-access(.test).ts,pages/TabPlaceholderPage.tsx}, staff/features/more/**, staff/features/notifications/**
- Modified: staff/features/auth/{api/auth.api.ts,index.ts}, staff/features/theme/{components/BrandTheme.tsx,lib/apply-cached-brand.ts}, staff/features/gallery/pages/GalleryPage.tsx, staff/navigation/{StaffLayout.tsx,index.ts}
- Deleted: app/(staff)/(main)/home.tsx, staff/features/dashboard/**

### Install commands for the user
None (expo-application and uniwind already installed).

### Verification
- Route types regenerated (`CI=1 npx expo start --offline`); `npm run typecheck` clean; `npm test` 26 suites / 107 tests pass; eslint src 0 errors (3 pre-existing warnings); `lint:fences` green.
- Tests: tab matrix (doctor / receptionist / owner / nobody), cache clear keeps access and marks it stale, location options, sign-out only after dialog confirm, theme mode mapping.
- No device: screenshots and the real Tabs / sheet / Uniwind.setTheme behaviour are not seen (gate M0-D).

### Acceptance criteria
- [x] Doctor-only → Queue + Patients + More; owner → all five; nobody → More only (unit test)
- [~] Receptionist → Queue + Patients + Schedule + More, **plus Today**: the Today gate includes `appointments.view`, which Schedule also needs (see questions)
- [ ] Device screenshots — not available

### Deviations from the card / docs
- "Switch location" row is hidden when the user has only one place to work in (nothing to switch to).
- Access-ready jump to the first allowed tab is an effect in `StaffTabs` (js-tabs has no dynamic `initialRouteName`); before access loads the tab bar shows only More.
- Tab bar colours use `useCSSVariable` tokens in `tabBarStyle` (navigator chrome cannot take classes).

### Questions for the architect
- Receptionist matrix: should Today be gated without `appointments.view`, or is Today expected for a receptionist? Gates were kept exactly as docs/02 §4.
- Docs 06 S-08 also lists Notifications settings, Check for updates and Help; not in the card, so not built.
- A switched location changes the brand but `StaffLayout`'s cached brand is only repainted on cold start (existing M0-05 behaviour).

### Notes for the next task
- M1-13: pass the real count to `NotificationBell` and add `onPress` → notifications route. Real tab pages replace `TabPlaceholderPage` by changing the import in the route file.

---

## Rework M1-02 #1

Branch: mobile/M1-02-staff-shell   Status set to: review   (PROGRESS row already `review`)

| # | Result |
| --- | --- |
| 1 (Major) | Fixed. New `AccessErrorBanner` (slim banner with Retry, above the tabs in `StaffTabs`) and `AccessErrorState` (full `ErrorState` with retry, on More) in `staff/features/access/components/AccessErrorNotice.tsx`; both call `access.refetch` and render only when `status === 'error'`. Tests: `AccessErrorNotice.test.tsx`. |
| 2 | Fixed. `clearStaffCacheExceptAccess` no longer invalidates/awaits the old access key; it cancels + removes non-access queries, then `setLocationContext` runs and the new key fetches. Test updated (access left untouched). |
| 3 | Fixed. `useSwitchLocation.test.tsx`: success clears cache before the store moves; error leaves store and cache unchanged. |
| 4 | Fixed (cheap). Sheet label gets " (current)"; `SheetAction` has an optional `selected` -> `accessibilityState.selected`. Tapping the current row still closes the sheet (the generic ActionSheet always closes) but triggers no switch. |
| 5 | Fixed. `NotificationBell` passes `disabled={!onPress}`. |
| 6 | Fixed. Comment in `StaffTabs` documents the run-once jump and expo-router's fallback to the first visible tab. |
| 7 | Accepted by the reviewer; no change. |

Verification: `npm test` 28 suites / 112 tests pass; `npm run typecheck` clean; eslint src 0 errors (3 pre-existing warnings); `lint:fences` green. Route types already present. No device check.
Note: `AccessErrorNotice` imports `ErrorState` from its file rather than the `@/core/components` barrel, because the barrel pulls native keyboard-controller into jest for anything importing the access barrel.
Install commands: none. Questions: none.

---
## M2-02 — Patient auth: email code, sessions, patient JWT, guard  ·  2026-11-11  ·  Claude Sonnet 5.5
Branch: mobile/M2-02-patient-auth   Commit(s): see git log   Status set to: review

### Done
- Boot check (`patient-config.ts`): `JWT_PATIENT_ACCESS_SECRET` missing/equal to staff secret throws; optional `PATIENT_CODE_PEPPER`.
- `PatientTokenService`, `PatientSessionService` (sha256, rotation, reuse revokes, CAS on rotate), `LoginCodeService` (hashed, 10 min, 5 attempts, single use, one `CODE_INVALID`).
- `PatientJwtStrategy` (`patient-jwt`) + real `PatientJwtGuard` attaching `request.patientAuth`; `PatientLinkGuard` interim: allows, sets empty `patientContext`.
- `/patient-auth/{email/start,email/verify,refresh,logout}` and `/patient-api/me` GET/PATCH; `MailService.sendLoginCode`; `.env.example`.
- Unit specs for all of step 10; int spec written.

### Files
- Created: `backend/src/patient-auth/{patient-config,patient-token.service,patient-session.service,login-code.service,patient-auth.service,patient-auth.controller}.ts`, `dto/`, `strategies/`, 4 specs; `backend/src/patient-app/{me.controller,patient-me.service}.ts`, `dto/`; `backend/test/patient/patient-auth.int-spec.ts`
- Modified: patient-auth/patient-app modules, both guards, `mail.service.ts`, `.env.example`, `test/patient/route-matrix.int-spec.ts` (asserts patient routes now exist)

### Install commands for the user
none (set `JWT_PATIENT_ACCESS_SECRET` in `backend/.env`, different from `JWT_ACCESS_SECRET`, or the API will not boot)

### Verification
- `npm run build` clean. `npx jest --runInBand` → 95 suites / 995 tests passed.
- ESLint + Prettier on changed files clean (whole-tree lint not run).
- Int spec NOT run: no disposable Postgres used; shared DATABASE_URL untouched.

### Acceptance criteria
- [x] build, full unit suite, all step-10 tests present
- [ ] int spec executed — needs disposable Postgres

### Deviations from the card / docs
- Security log skipped (staff `SecurityLogService` is user-bound; no patient ids in `users`).
- Consents deduped per (account, kind, version).
- `x-device-label` header optional for session label.
- `package-lock.json` was already modified; not staged.

### Questions for the architect
- None.

### Notes for the next task
- M2-03 replaces the interim `PatientLinkGuard` (TODO there) and adds the staff-token half of the route matrix.
- M2-02b can reuse `PatientAuthService.issue/build` pattern (make `issue` public).

## Rework M2-02 #1
Date: 2026-11-12 · Branch `mobile/M2-02-patient-auth`

| # | Result |
| --- | --- |
| 1 Major | Fixed. `verify()` claims an attempt atomically (`UPDATE ... SET attempts = attempts + 1 WHERE id AND attempts < 5 AND used_at IS NULL AND expires_at > now() RETURNING id`); no row → `CODE_INVALID`. Unit test with the claim returning 0 rows. |
| 2 Minor | Fixed. `start()` closes earlier open codes for the email; a successful verify closes all open codes. Test added. |
| 3 Minor | Fixed. `termsVersion` / `privacyVersion`: `@IsNotEmpty()` + `@Matches(/^[\w.-]{1,20}$/)`. |
| 4 Minor | Not fixed: accepted as existing behaviour per review. |
| 5 Minor | Not fixed here: M2-11 (card already updated). |
| 6 Minor | Fixed. New `patient-app/guards/patient-jwt.guard.spec.ts` (real passport, fake `patient-jwt` strategy): sets `request.patientAuth`, `request.user` unset. |
| 7 Decision | No code; R-01 logged by architect. |
| 8 Info | No code; M2-06 note. |

Verification: `npm run build` clean; full `npx jest --runInBand` 96 suites / 998 tests passed (re-ran `src/patient-auth` + build after a final lint-only tweak). ESLint on changed files: only the repo-wide CRLF prettier noise remains. Int spec still not run (no disposable Postgres).
Install commands: none.

---
## REVIEW round 7: reworks M1-02 + M1-07a + M1-11a + M2-02  ·  2026-11-12  ·  Claude Opus (architect)
Branch: four rework branches verified against every finding   Status set to: all four done (merge pending)

### Done
- All required findings fixed; tests: mobile 112 / 122 / 125, backend 998. Notes in `reviews/<ID>/rework-1.md`.
- The user's `expo-dev-client` install committed on mobile/develop.

### Notes for the next task
- M2-02's int spec and the M2-01 change file still need one run on a disposable Postgres.

---
## REVIEW round 8 (part 1): M1-03 + M1-06  ·  2026-11-13  ·  Claude Opus (architect)
Branch: reviewed `mobile/M1-03-staff-realtime`, `mobile/M1-06-offline` (reviewer agent each; Majors verified in code)   Status set to: both changes-requested

### Done
- M1-03: realtime dies after a second effect run (permanent dispose); stale check uses max seq across caches. M1-06: throttled
  trailing write lands after the wipe; gcTime 10 min defeats the 24 h cache. Details in `reviews/<ID>/review.md`.
- 02 §7 (no token-driven reconnect, live after ack, per-snapshot seq) and §9 (staff gcTime 24 h) updated. New follow-up card M1-06b.
- M2-02b and M2-03 not handed off yet (uncommitted work in folders C and D).

---
## M1-03 — Staff realtime client  ·  2026-11-13  ·  Claude Sonnet 5.5
Branch: mobile/M1-03-staff-realtime   Commit(s): f37c3b9 (code), docs commit follows   Status set to: review

### Done
- Step 1 `staff/lib/realtime.ts`: `createStaffSocket(getToken)` (`transports: ['websocket']`, `auth: (cb) => cb({ token })`, `autoConnect: false`) and `StaffRealtime`, a plain controller: connect/disconnect/reconnect, counted `joinRoom(room)` → leave fn, re-subscribes every wanted room on each `connect`, background → disconnect after 30 s, foreground → reconnect (the `connect` after a first one invalidates all once) or, if the socket survived a >=30 s background, invalidate all once. `auth_error` → `refreshSession()` once → reconnect; the one-shot flag resets when an `org:` subscribe ack is `ok` or on foreground. Token change in the store → `reconnectIfTokenChanged()`.
- Step 2 `staff/lib/realtime-provider.tsx`: `StaffRealtimeProvider` (mounted in `StaffMainLayout` inside `AccessProvider`), `useRealtimeStatus()` (`live | reconnecting | offline` via core `deriveConnectionState` + `useOnline`), `useRoomSubscription(room | null)`. Always joins `org:<activeOrgId>`. The hook's effect depends on `[room, activeOrganizationId, activeLocationId]`, so every room is left and re-joined whenever either changes (M1-02 review note).
- Step 3 `staff/lib/realtime-invalidation.ts`: `queueEventKeys` (session, next-preview, board prefix, my-session prefix, ticket), `cachedEventSeq` (own snapshot, board lanes, my-session) and `isStaleQueueEvent` (`seq <= cached` ignored; nothing cached → invalidate), `createRealtimeInvalidator` with a 300 ms window (one timer, each distinct key invalidated once per window). Invalidates only; never writes cache (A-07).
- Step 4 `access.changed` → `accessKeys.all`; `notification.new` → `notificationKeys.all` + `toast(title)` only when `AppState` is `active` and the path is not `/notifications`. New `staff/features/notifications/api/notifications.keys.ts` (`notificationKeys`: `all`, `list()`, `unreadCount()`), exported from the feature barrel.
- Step 5 `staff/lib/realtime-connection-pill.tsx`: `RealtimeConnectionPill` = core `ConnectionPill` fed by `useRealtimeStatus()` (core cannot read the staff socket; M1-08/09 place it).
- Step 6 tests: 22 new (invalidation map, stale seq, board-lane seq, coalescing, access/notification maps; controller events, room replay + reconnect invalidation, shared rooms, auth_error once / signed-out, token change, 30 s background disconnect + foreground, quick return; provider rooms on location and org change).

### Files
- Created: `staff/lib/realtime.ts`, `realtime-invalidation.ts`, `realtime-provider.tsx`, `realtime-connection-pill.tsx`, three `*.test.ts(x)`; `staff/features/notifications/api/notifications.keys.ts`
- Modified: `staff/navigation/StaffMainLayout.tsx`, `staff/features/notifications/index.ts`, PROGRESS row
- Deleted / moved: none

### Install commands for the user
none (`socket.io-client` already in package.json)

### Verification
- Contract checked against `queue.gateway.ts` (namespace `/realtime`, `handshake.auth.token`, `subscribe`/`unsubscribe` acks, `auth_error` is an EVENT on an accepted socket — not `connect_error`), `queue-tx.ts` (`queue.event` payload with `seq`), web hooks, and `SocketOptions.auth` function form in socket.io-client types.
- `npm run typecheck` → clean. `npm test` → 40 suites / 285 tests passed. ESLint `src/staff src/core` (and the touched dirs) → 0 errors (1 pre-existing `axios.create` warning in `api.ts`). `npm run lint:fences` → ok.
- Manual (web↔phone, background 60 s): NOT done — needs a device and running API. Joins gate M0-D.

### Acceptance criteria
- [x] unit-level: role change → `access.changed` → `accessKeys.all` invalidated within 300 ms; 30 s background disconnect + foreground reconnect (fake timers)
- [ ] live: web role change refreshes phone within 2 s; 60 s background shows disconnect in server logs (device needed)

### Deviations from the card / docs
- `realtime-invalidation.ts` imports key modules directly (`.../hooks/useMyAccess`, `.../notifications.keys`, `.../queue.keys`), not feature barrels: the barrels pull screens/native UI into a pure-logic file (jest failed on `react-native-keyboard-controller`).
- `RealtimeConnectionPill` lives in `staff/lib` (core must not import the staff store); card step 5 "ConnectionPill reads useRealtimeStatus()" is met by this wrapper.
- Toast shows the notification title only, not the body (body may carry patient details).
- "While disconnected, poll every 10 s" (02 §7) is NOT in this card; screens (M1-07/08/09) own it. `useRealtimeStatus()` is what they key it off.

### Questions for the architect
- Token refresh reconnects the socket (02 §7), and every reconnect after the first invalidates all realtime keys. That costs one refetch burst per access-token refresh. Keep, or skip the invalidate for token-driven reconnects?
- Foreground with a socket that survived a >=30 s background: I invalidate all once as a safety net. Fine?

### Notes for the next task
- Screens: `useRoomSubscription(\`location:${locationId}:board\`)` / `session:<id>`; pass `useRealtimeStatus()` to the 10 s fallback poll.
- M1-13: build the inbox/unread queries on `notificationKeys.list()` / `unreadCount()`; the toast already skips paths matching `/notifications`.
- `auth_error` leaves an anonymous connection open; status reports `reconnecting` until an org-room ack succeeds.


## Rework M1-03 #1  ·  2026-11-13  ·  Claude Sonnet 5.5

Review: `docs/reviews/M1-03/review.md` (from mobile/develop). Status stays `review`.

| # | Fix |
| --- | --- |
| 1 | `StaffRealtime.dispose()` is now reversible: `connect()` clears `disposed`, `dispose()` resets `everConnected`/`authRetried` and notifies (not drops) listeners, so a second effect run opens a fresh socket. Tests: `realtime.test.ts` dispose→connect leaves one active socket of two; `realtime-provider.strict.test.tsx` renders the provider under `<StrictMode>` with a counted fake `socket.io-client` → exactly one live socket. |
| 2 | `queueEventKeys(queryClient, e)` compares `e.seq` per cached snapshot: session key, each board query (its lane for the session), each my-session query. A key is invalidated when its own seq is missing or `< e.seq`, skipped when at/above. `cachedEventSeq` / `isStaleQueueEvent` removed. Tests: board ahead + session behind; board behind / lane missing. next-preview and ticket always refresh. |
| 3 | Token subscription and `reconnectIfTokenChanged` (and `tokenUsed`) removed. `auth_error` → `refreshSession` once → reconnect stays. |
| 4 | `connect` no longer sets `live`; only an `ok` org-room subscribe ack does. Tests: not live on connect alone; ack `ok:false` then ok on next connect. |
| 5 | Done: `log.warn` with the room name only on `ok:false`; every connect re-subscribes all rooms, so it retries then. |
| 6 | Toast id `notification-${e.id}` (dedupe); when `e.organizationId` differs from the active org the toast carries description "Another clinic". Not unit-tested (provider test mocks the controller). |
| 7 | Done: `queueKeys.boardAll()` / `mySessionAll()` added and used. |

Verification: `npm test` 41 suites / 289 tests ✓ · `npm run typecheck` ✓ · ESLint src 0 errors (3 pre-existing warnings) · `npm run lint:fences` ✓.
Note: `mobile-app/package-lock.json` is modified in this worktree from before this rework; not staged.

---
## M1-06 — Offline cache (persistence, banner, wipe)  ·  2026-11-13  ·  Claude Sonnet 5.5
Branch: mobile/M1-06-offline   Commit(s): see git log   Status set to: review

### Done
- Step 1 `staff/lib/persist.ts`: pure allow-list `isPersistableKey` (access/me; queue my-session+board for today; appointments with today's date and no object in the key; patients/detail), `shouldPersistQuery` (∧ success), `staffDehydrateOptions` (mutations never dehydrated), `staffPersistBuster`, `savedDataTime` (clinic clock).
- Step 2 `StaffLayout`: one `PersistQueryClientProvider`, encrypted staff cache, maxAge 24 h, buster `${appVersion}:${userId}:${orgId}:${locationId}`. Splash (`markReady`) waits for session restore AND cache open/failed.
- Step 3 `Screen` shows `OfflineBanner` automatically when `!useOnline()` ("Showing saved data from <savedAt>", or "You are offline"); new `savedAt` prop, `banner` prop still overrides.
- Step 4 `core/components/forms/OfflineAwareButton` (uses `useCanMutate`, label "Offline", disabled).
- Step 5 `useSignOut` → `wipeStaffPersistedCache()` (removeClient + seal against late writes + `wipeSecureCache('staff')`) before `queryClient.clear()`; failure of the wipe never blocks sign-out.
- Step 6 tests (below).

### Files
- Created: `src/staff/lib/persist.ts`, `persist-cache.ts` (+ tests), `src/core/components/forms/OfflineAwareButton.tsx` (+ test), `layout/Screen.test.tsx`, `auth/hooks/useSignOut.test.tsx`
- Modified: `StaffLayout.tsx`, `useSignOut.ts`, `core/components/layout/Screen.tsx`, `core/components/index.ts`, PROGRESS row

### Install commands for the user
none

### Verification
- `npm test` → 42 suites / 295 tests passed; `npm run typecheck` clean; eslint `src` 0 errors (3 old warnings); `npm run lint:fences` ok.
- Airplane-mode device check NOT done (no device) — joins gate M0-D.

### Acceptance criteria
- [x] allow-list table test; nothing outside it persists (`persist.test.ts`)
- [x] buster changes on build/user/org/location; sign-out wipe; banner offline
- [ ] device check (gate M0-D)

### Deviations from the card / docs
- TanStack restores only once per provider mount, so a buster change would never re-restore. The provider therefore carries `key={buster}` (still ONE provider, remounted on user/clinic/location change; the Stack below remounts then). While identity or cache is not ready it uses an idle persister (reads/writes nothing) so it cannot wipe a saved cache.
- Appointments have no key factory yet; the rule is "root `appointments`, only primitives in the key, one of them is today's YYYY-MM-DD". The appointments feature must follow that shape.
- docs/02 §9 "last 20 patient summaries" is NOT enforced: all `patients/detail` queries persist (in-memory gcTime bounds them).

### Questions for the architect
- Buster needs user/org/location, which exist only after a successful silent refresh. A cold start in airplane mode ends in `unreachable` (offline screen), so the cached board is not shown. Persisting a non-secret "last identity" hint in prefs would fix it — want that as a follow-up card?
- Remount of the Stack on location switch acceptable? Alternative: manual `persistQueryClientRestore` controller outside the Stack.

---

## Rework M1-06 #1 — 2026-11-13
Branch: `mobile/M1-06-offline` · Status set to: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Seal checked at call time, not write time | `createSecureQueryPersister(cache, key, canWrite)` — the storage `setItem`/`removeItem` are no-ops when `canWrite()` is false. The seal is per persister instance (`{ sealed }` in a `liveSeals` set); `wipeStaffPersistedCache` seals every live instance, so there is no module-global flag reset in render. Tests: persistClient → wipe → advance timers → no `set`/`remove` on the old MMKV instance; a persister created after sign-out is not sealed. |
| 2 | gcTime 10 min < maxAge 24 h | `createQueryClient({ gcTime })` option (default 10 min, other defaults unchanged); `staffQueryClient` passes `PERSIST_MAX_AGE`. New `create-query-client.test.ts`. |
| 3 | Last 20 patient details | Done (cheap). `trimPersistedClient` (persist.ts) keeps the 20 newest `patients/detail` by `dataUpdatedAt`; applied inside the staff persister's `persistClient`. `shouldDehydrateQuery` cannot see sibling queries, so it is done on the dehydrated client, not there. Tested end to end. |
| 4 | Appointments rule too loose | Matches exactly `['appointments','list', orgId, locationId, today]`. No appointments feature/key factory exists yet, so there is none to consume; the appointments card must build this exact shape (tests added for wrong shapes). |
| 5 | "Never written" proven on the predicate only | New `persist-e2e.test.ts`: real `persistQueryClientSave` + `staffDehydrateOptions` + persister over mock MMKV. Seeds allowed keys and forbidden ones (patient list, check-phone, theme, history, an errored detail, yesterday's board/appointments); parses the stored JSON and asserts only the allowed keys are there, no phone/search text, no mutations. |
| 6 | Forced sign-out did not wipe | `doRefresh` (401/403) calls `wipeStaffPersistedCache()` (failure swallowed) before `dropSession()`. Test in `api.test.ts`. |
| 7 | Sign-out order not asserted | `useSignOut.test.tsx` asserts the wipe's `invocationCallOrder` is before `queryClient.clear()`. |
| 8 | Stack remount on location switch | Note only: accepted for MVP (`key={persistKey}` remounts navigation on login / location switch). |

Verification: jest 44 suites / 305 tests green; typecheck clean; eslint `src` 0 errors (3 old warnings); lint:fences ok.

---
## REVIEW round 8 (part 2): reworks M1-03 + M1-06  ·  2026-11-13  ·  Claude Opus (architect)
Branch: verified both reworks against every finding   Status set to: M1-03, M1-06 done (merge pending)

### Done
- M1-03: reversible dispose + StrictMode test, per-key seq, no token reconnect, live on ack. M1-06: write-time seal, 24 h gcTime, e2e allow-list test, forced sign-out wipe.
- M2-02b and M2-03 still not handed off (uncommitted work in folders C and D).

---
## M1-07 — Queue hooks  ·  2026-11-14  ·  Claude Sonnet 5.5
Branch: claude/m1-07-queue-hooks-487ca3 (worktree branch; card name mobile/M1-07-queue-hooks)   Commit(s): ae8c52f   Status set to: review

### Done
- Step 1: `useMySession`, `useBoard`, `useSession`, `useTicket`, `usePatientQueueVisits` (keys from `queueKeys` + active location + `todayYmd()`, staleTime 0). The three live reads join `session:<id>` / `location:<id>:board` via `useRoomSubscription` and set `refetchInterval` 10 s only when `useRealtimeStatus() !== 'live'`. `useMySession` joins once the session id is known.
- Step 2: all 23 mutation hooks (`useSessionMutations`, `useEntryMutations`, `useArrivalMutations`) on `useIdempotentMutation`; entry actions take `{ entryId, version, ... }` and send `ifMatch: version`. `useRecallEntry` takes no version (api: IdemOptions only).
- Step 3: success invalidates `queueKeys.all`; error toasts `queueErrorMessage`, invalidates when `shouldRefetch`. CallNext `NO_ELIGIBLE_PATIENT` → plain toast "No one is waiting".
- Step 4: `useEntryActions`. Step 5: barrel exports. Step 6: 24 tests in 3 files.

### Files
- Created: `src/staff/features/queue/hooks/{queue-rooms,queue-mutation,useMySession,useBoard,useSession,useTicket,usePatientQueueVisits,useEntryActions,useSessionMutations,useEntryMutations,useArrivalMutations}.ts`, tests `queue-reads.test.tsx`, `queue-mutations.test.tsx`, `useEntryActions.test.tsx`
- Modified: `src/staff/features/queue/index.ts`, `docs/PROGRESS.md`

### Install commands for the user
none (`npm ci` from the lockfile only; package-lock unchanged)

### Verification
- `npm run typecheck` → clean
- ESLint (`node node_modules/eslint/bin/eslint.js src`) → 0 errors, 3 pre-existing warnings
- `npm run lint:fences` → all PASS
- `npm test` → 51 suites, 355 tests passed (one run under heavy load showed 1 unidentified failure; the rerun was fully green)
- Router types: `expo start --offline` generated `.expo/types/router.d.ts` after a clean `npm ci`; no routes added.

### Acceptance criteria
- [x] typecheck + tests green; no component or route added

### Deviations from the card / docs
- Invalidation uses the whole `queueKeys.all` prefix (no session-prefix key exists; tickets/visits/next-preview also depend on entry state).
- `openSession`: the api still requires `MutationOptions`, so the hook mints a throw-away key per call (plain `useMutation`, no retry).
- `useTicket` / `usePatientQueueVisits` have no room and no polling (card names rooms only for session/board).

### Questions for the architect
- Should `openSession` drop its options in the api (M1-07a review #5 said so; the code still has them)?

### Notes for the next task
- Entry-action vars must include the on-screen `version`. Room names live in `hooks/queue-rooms.ts`.

---
## Rework M1-07 #1  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-07-queue-hooks-487ca3   Commit(s): 801157b   Status set to: review (unchanged)

### Findings
1. **Dialog codes** — `lib/queue-errors.ts` exports `DIALOG_ERROR_CODES` (ACTIVE_WITH_OTHER_DOCTOR, LATE_LIMIT_EXCEEDED) and `isDialogError(err)` (also in the barrel). The shared mutation `onError` returns early for them: no toast, no invalidate; the caller's mutate-level `onError` handles them. Tests: `isDialogError` table; hook test that both codes toast nothing and call the caller's `onError`.
2. **Midnight rollover** — new `src/staff/lib/clinic-today.ts` `useClinicToday()`: timer to the next clinic midnight (`clinicDayBounds(today).end + 1`, re-armed on tick/zone change) and re-read on AppState → active. Used by `useBoard` and `useMySession`. Fake-timer tests (23:30 Karachi → rolls at 00:00; foreground re-read after a slept-through midnight; listener removed) plus hook tests that the key/fetch moves to the new day.
3. **openSession** — `api/queue.api.ts` `openSession(vars)` is a plain post (no options, no Idempotency-Key); `useOpenSession` no longer mints a key; api test asserts no `Idempotency-Key`/`If-Match`. Found while testing: `usePlainQueueMutation` passed TanStack's 2nd (context) argument into the api fn; it now calls `mutationFn(vars)` only.
4. **Timer leaks** — both hook test files now `await cleanup()`, `client.clear()` for every client, then `useRealTimers()` in `afterEach`. The queue/clinic-today suites no longer print "worker failed to exit".
5. **New tests** — board room switches when the active location changes (leave l1 / join l2, new key); LOCK_TIMEOUT toast once after 4 calls (3 retries) on an Idem hook; day rollover (see 2).

### Verification
- `npm run typecheck` → clean; ESLint → 0 errors (3 pre-existing warnings); `npm run lint:fences` → all PASS
- `npm test` → 52 suites, 371 passed, **1 failed**: `src/core/components/forms/FilterChips.test.tsx` "single select…" times out at 5000 ms in the full parallel run only; it passes alone (2/2) and is not touched by this card (it explains the earlier unidentified failure and the remaining "worker failed to exit" warning). Queue + clinic-today: 7 suites, 110 tests green.

### Questions for the architect
- FilterChips flake is outside this card: want a separate fix card (raise timeout / look at its leaked timer)?

---
## M1-11b — Patients hooks  ·  2026-11-14  ·  Claude Sonnet 5.5
Branch: claude/m1-11b-patients-hooks-30cce3   Commit(s): eb2f23c   Status set to: review

### Done
- Step 1 `usePatientsInfinite(filters)`: page size 20, `getNextPageParam` from `page < totalPages`, search trimmed and dropped under 2 chars, boolean filters only ever `true` (`normalizePatientFilters`).
- Step 2 `usePatient`, and gated `usePatientHistory`, `usePatientVitals`, `usePatientPrescriptions` (sorted finalized/amended first, drafts last, `lib/sort-prescriptions.ts`), `useLatestTeethChart` (`lib/latest-teeth-chart.ts`). Gated hooks return `{ allowed, query }`; when not allowed the query never runs (`fetchStatus: 'idle'`, no error).
- Step 3 `useCheckPhone(phone, excludeId?)`: enabled only when `isValidPhone` (new export of the schema's phone rule), `staleTime` 30 s.
- Step 4 `useQuickRegister()` (invalidates `patientKeys.lists`, toasts on error) and `useQuickRegisterForm(onCreated?)` (schema as `validators`, `isDirty`, resets on success, keeps values on failure). `lib/quick-register-input.ts` `toCreatePatientInput` maps raw form values to the POST body because TanStack passes raw values to `onSubmit` and `.parse()` there is banned.
- Step 5 `store/useRecentPatientsStore.ts`: ids only, memory only, max 10, `push` moves to front, cleared by a module-level subscription to the staff auth store on sign-out and on org/location change.
- Step 6 barrel exports + tests (hooks, form, store, lib).
- Added `patientKeys.lists` (prefix for invalidation). No list/search/checkPhone key is persisted; `persist.ts` untouched.

### Files
- Created: `hooks/*` (9 hooks + 2 test files), `lib/{sort-prescriptions,latest-teeth-chart,quick-register-input}.ts`, `lib/patient-lib.test.ts`, `store/useRecentPatientsStore.ts` (+ test)
- Modified: `api/patients.keys.ts`, `schemas/quick-register.schema.ts`, `index.ts`, PROGRESS row

### Install commands for the user
none (`npm install` from the lockfile only; its lockfile change was reverted)

### Verification
- `npm run typecheck` clean · eslint `src` 0 errors (3 old warnings) · `npm run lint:fences` ok.
- `npm test`: all patients suites pass. Under heavy machine load (disk full, many concurrent installs) one full run had 5 `src/core/components` suites fail by timeout; they pass when run alone (core + patients: 126 tests green). One paging test in `patients-hooks.test.tsx` failed once under load and passed on isolated rerun.

### Acceptance criteria
- [x] tests green; no component or route

### Deviations from the card / docs
- Gated hooks return `{ allowed, query }` (not a spread query result). `allowed` is also false while `/me/access` is still loading.
- `useCheckPhone` is not debounced (the card says debounce in the UI card M1-11; the hook only takes the phone string).

### Questions for the architect
- Is `{ allowed, query }` the shape you want for M1-12?
- Backend `check-phone` returns only `{ exists }`, so S-04's "exists: <name>" copy cannot show a name without a backend change.

---
## Rework M1-11b #1 — 2026-11-14
Branch: `claude/m1-11b-patients-hooks-30cce3` · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Paging test read `hasNextPage` before re-render | Post-fetch assertions (`data.pages` length, `hasNextPage`) are inside `waitFor`. Patients suite run 3 times in a row: 8 suites / 101 tests green each time. |
| 2 | `excludeId` missing from check-phone key | `patientKeys.checkPhone(org, loc, phone, excludeId = null)`; `useCheckPhone` passes `excludeId ?? null`. Test: create and edit checks of the same phone are two calls and two distinct keys. |
| 3 | Gated hooks could not tell loading from denied | New `hooks/gated-query.ts`: `GatedQuery<T> = { access: 'loading' } \| { access: 'denied' } \| { access: 'allowed', query }`; query only enabled when `useAccess().status === 'ready'` and the grant holds. History, vitals, prescriptions, teeth chart updated; tests cover loading (even with grants), denied, allowed, feature missing. |
| 4 | `onSuccess` returned the invalidate promise | `void queryClient.invalidateQueries(...)` — `mutateAsync` no longer waits for refetches. |
| 5 | Recent store cleared on every signed-out auth change | Clears only when `ids.length > 0`; test that the `ids` array identity is untouched while empty. |
| 6 | UI calls `useCheckPhone` on blur only | No code change (noted for M1-11). |
| 7 | Mapper vs schema | Test: `toCreatePatientInput(v)` equals the relevant `quickRegisterSchema.parse(v)` fields for four samples. |

Verification (full DoD): `npm run typecheck` ✓ · `npm test` 52 suites / 360 tests ✓ · eslint `src` 0 errors (3 old warnings) · `npm run lint:fences` ✓.

---
## M1-14a — Appointments data layer  ·  2026-11-14  ·  Claude Sonnet 5.5
Branch: claude/m1-14a-appointments-data-4dcf38 (worktree, from mobile/develop)   Commit(s): 4a02d19   Status set to: review

### Done
- Step 1 `types/appointments.types.ts`: `AppointmentStatus`, `AppointmentType` unions, `AppointmentListItem` (`queueEntry`, optional `kind`), `AppointmentDetail`, `AppointmentPage` (no `totalPages`), `AppointmentStats` (`avgWaitMinutes` nullable), `DoctorOption`, `AppointmentFilters` — checked against controller, `AppointmentFilterDto`, service list/walk-in/stats/doctors code and enums.
- Step 2 `api/appointments.api.ts`: list (`startDate`/`endDate` from `clinicDayBounds`, `doctorId`, `status`, `includeWalkIns` default true, `search`, `page`, `limit` 50), detail, stats, doctors, plus `fetchAllDayBookings` (pages until `page*limit >= total`).
- Step 3 `api/appointments.keys.ts`: org + location + day in every list/stats key. Unfiltered day list = exactly `['appointments','list',org,loc,ymd]` (the shape `persist.ts` already accepts, per M1-06 rework #4); any active filter appends a filter object so it is never persisted. `persist.ts` needed no change; a test runs real keys through `isPersistableKey`.
- Step 4 `hooks/useAppointments.ts`: `useDayAppointments` (infinite), `useAppointment`, `useAppointmentStats`, `useDoctors` (10 min), `useArrivals` (all day bookings, `select: selectArrivals`).
- Step 5 `lib/group-by-hour.ts` (zone param), `lib/day-strip.ts` (yesterday…+6), `lib/arrivals.ts`; tests.
- Step 6 barrel + tests (hooks: paging, scope in key, no request without location).

### Files
- Created: `src/staff/features/appointments/{index.ts, types/, api/ (+keys, tests), hooks/ (+test), lib/ (+lib.test.ts)}`
- Modified: `docs/PROGRESS.md`, `docs/HANDOFF.md`

### Install commands for the user
none (`npm ci` only; package-lock reverted after a stray `npm install` touched it)

### Verification
- `npm test` → 52 suites / 353 tests passed (22 new in 4 suites)
- `npm run typecheck` → clean
- eslint `src` → 0 errors (3 old warnings); `npm run lint:fences` → ok
- No device/screen check (no UI in this card).

### Acceptance criteria
- [x] tests green; no screen or route

### Deviations from the card / docs
- `.expo/types/router.d.ts` copied from the main checkout (expo start crashed on a half-extracted install after a disk-full); routes unchanged by this card.
- `AppointmentListItem.kind` is optional: the backend only sets it on the `includeWalkIns` path.
- `groupByHour(rows, zone)` takes the zone as a parameter (pure); the screen passes `clinicTimezone()`.

### Questions for the architect
- `useArrivals` fetches all of the day's bookings (50/page, max 20 pages) and filters client-side, because the backend `status` filter accepts one value. OK for S-03?
- `useDayAppointments` is not gated on `can('appointments.view')`; callers gate (like other data hooks). Confirm.

### Notes for the next task
- M1-15a: `useAppointmentStats(today)` is ready; "next appointments" should use `fetchAppointments(ymd, { includeWalkIns: false }, 1, 5)` or filter `useDayAppointments` by time.

---
## Rework M1-14a #1 — 2026-11-15
Branch: claude/m1-14a-appointments-data-4dcf38 · Status set to: review (unchanged)

| # | Finding | What I did |
| --- | --- | --- |
| 1 | `fetchAllDayBookings` can see repeated rows across pages (sort by startTime only + skip/take); page cap implicit | De-duplicates by `id` (Map, first wins). Cap is the named export `MAX_DAY_PAGES = 20`; hitting it calls `log.warn('appointments: day list truncated at the page cap')` (`@/core/log`, no payload). Tests: dedupe across pages; cap stops at 20 calls + exactly one payload-free warn. |
| 2 | "Next appointments" must start from NOW | `fetchAppointmentsRange({ start, end }, filters, page, limit)` (UTC ISO bounds; `fetchAppointments(ymd, …)` now delegates to it). `fetchUpcomingAppointments(from, ymd, limit)` and `useUpcomingAppointments(limit = 5)` (now → end of clinic day via `clinicDayBounds(todayYmd()).end`, `includeWalkIns: false`; `from` read when the request runs). Key `['appointments','upcoming',org,loc,ymd,limit]`; `persist.ts` untouched, test asserts it is not persistable. Tests: API params, hook (start ≥ now, scope+limit key). |
| nits | doctor `fullName === ''`; DST test TZ | Commented both. Left `patientNumber`/`designation` nullable: the walk-in SQL path selects `p.patient_number` / employee data without a non-null guarantee, so non-null would be a guess. |

Verification: see numbers in the report (full DoD run).

---
## M2-03 — Patient link guard, linked-patient helper, isolation tests  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: mobile/M2-03-patient-links-guard   Commit(s): see git log (continues the previous implementer's WIP commit)   Status set to: review

### Done
- Step 1: real `PatientLinkGuard` — 401 without `patientAuth`; ONE query (profiles LEFT JOIN active/frozen links, never revoked); `patientAppEnabled` via `FeatureFlagsService.isFeatureEnabled(orgId,'patient_app')`, one call per distinct org per request; sets `request.patientContext` per 07 §6.
- Step 2: `src/patient-app/context/patient-context.ts` — type, `@PatientCtx()`, `linkedPatientWhere` (no links / foreign profile → `1 = 0`; bound parameters only; identifiers validated), `assertProfile` (404), `assertWritableLink` (404 / 403 `PATIENT_APP_DISABLED`).
- Step 3: `patient-app.settings` import moved into `patient-app.module.ts`.
- Step 4: unit tests for guard and helpers.
- Step 5: `test/patient/test-db-safety.ts` (`assertSafePatientTestDb`, used by all three patient int specs) + `npm run test:int:patient`.
- Step 6: route-matrix second half (staff token → 401 on every `/patient-api/*` and protected `/patient-auth/*` route).
- Step 7: `test/patient/link-isolation.int-spec.ts` with a test-only controller declared inside the spec.

### Files
- Created: `src/patient-app/context/patient-context.ts` (+spec), `test/patient/test-db-safety.ts`, `test/patient/link-isolation.int-spec.ts`, `test/jest-int-patient.json`
- Modified: `guards/patient-link.guard.ts` (+spec), `patient-app.module.ts`, `me.controller.ts`, `patient-me.service.ts`, `app.module.ts`, `test/patient/{route-matrix,patient-auth}.int-spec.ts`, `backend/package.json` (script only)

### Install commands for the user
none (`npm ci` only; lockfile untouched)

### Verification
- `npm run build` → clean
- Full `npx jest --runInBand` → see report in the session summary
- Integration specs (`test:int:patient`): WRITTEN, **NOT RUN** — no local Postgres here and I never touch a shared DB. They need a local Postgres or `PATIENT_IT_DATABASE_URL`.

### Acceptance criteria
- [x] build clean; unit suite green; no read endpoint added to `src/`
- [ ] int specs green on a disposable Postgres (not run — see above)

### Deviations from the card / docs
- `test:int:patient` uses its own `test/jest-int-patient.json` WITHOUT the billing `globalSetup`: that setup connects and drops/creates a schema on `DATABASE_URL` before any spec runs, which would bypass the safety check. Patient specs create/drop their own schema.
- `linkedPatientWhere` takes any `WhereExpressionBuilder` (select/update/delete builders), not the bare `QueryBuilder` (which has no `andWhere`).

### Questions for the architect
- None.

---
## Rework M2-03 #1 — 2026-11-15  ·  Claude Sonnet 5.5
Branch: mobile/M2-03-patient-links-guard · Status set to: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | `jest-int-patient.json` invalid JSON | `\.` escapes. `npx jest --config test/jest-int-patient.json --listTests` lists the 4 patient specs. |
| 2 | `afterAll` ran after a refused `beforeAll` | `assertSafePatientTestDb()` now runs at module level (before `describe`) in all three int specs, so a refusal fails the file before ANY hook; no teardown can connect. Verified: `DATABASE_URL=postgres://…prod.example.com…` → "Refusing…", 0 tests, no connection. |
| 3 | `host=` query override | `isLocalDatabaseUrl` parses with `pg-connection-string` (what pg uses), rejects `hostaddr`, requires the URL authority to be local too, treats `/…` socket hosts and no host as local. Table tests in `test/patient/test-db-safety.int-spec.ts` (10 cases incl. `?host=prod…`, hostaddr, socket, neon-with-host=localhost). No package added. |
| 4 | `jest-int.json` matched patient specs | `testPathIgnorePatterns: ["/node_modules/", "/patient/"]`; `--listTests` shows no `test/patient/` file. |
| 5 | Fixed param names | Per-call unique prefix (`patientLink<N>Org<i>`); new unit test calls it twice on one builder with different profiles → 4 distinct names. |
| 6 | patient_app off → 403 | Int case: test controller `writable` route → 403 `PATIENT_APP_DISABLED` (org1 has no `patient_app` row) and 404 for B's link. Written, not run (no disposable DB). |

Verification: build clean; full jest — see session report. Int specs still not run (no disposable Postgres).

---
## REVIEW baseline wave 1: M1-07 + M1-11b + M1-14a + M2-03  ·  2026-11-15  ·  Claude Opus (team lead)
Branch: four Sonnet developer sessions; each reviewed by an independent reviewer agent, reworked once, fixes verified in code, tests re-run by the team lead   Status set to: all four done (merged)

### Done
- Reviews in `reviews/<ID>/review.md`. M1-13a and M2-02b are blocked: `npm install` in their worktrees was denied by the permission system — waiting for the user.
- Architect miss owned: the M1-07a rework sign-off said `openSession` was fixed; it was not (fixed in M1-07). Rework reviews now always check the code, never only the handoff.


---
## M1-15a — Today snapshot data  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-15a-today-data-099306 (worktree, from mobile/develop)   Commit(s): dea91ac   Status set to: review

### Done
- `today/api/today.api.ts`: `fetchDailySummary(ymd)` (`GET /financial-summary/daily?date=`), `fetchInvoiceStats(from, to)` (`GET /invoices/stats?from&to`). Shapes checked against `FinancialSummaryService.getDailySummary` and `InvoiceQueries.stats`; money is a DECIMAL amount.
- `today/hooks/useToday.ts`, all A-18 gated (`{access:'loading'|'denied'}|{access:'allowed',query}`, copy of the patients `gated-query` helper kept inside the feature — patients does not export it):
  - `useTodayStats()` — `appointments.view`; same key/fetcher as `useAppointmentStats`.
  - `useTodayCollections()` — `billing.invoice.view`; daily summary when `reports.financial.view` AND feature `billing.financial_summary`, else invoice stats (`from = to = today`). Data is normalised to `TodayCollections { source, collected, outstanding, overdueCount, invoicesGenerated|null, unpaidCount|null }`.
  - `useDoctorsNow()` — `queue.board.view`; lanes → `DoctorNow { doctorId, doctorName, status|'no_session', nowServing, nowServingStatus, waitingCount }`.
  - `useNextAppointments(5)` — `appointments.view`; same key/fetcher as `useUpcomingAppointments`.
- `lib/today-blocks.ts` `visibleTodayBlocks(can, hasFeature)` → ordered `stats, collections, doctors, next`; `lib/doctors-now.ts`, `lib/collections.ts` pure mappers.
- Keys: org + location + clinic day (`useClinicToday`, so a screen left open past midnight switches day). Barrel `today/index.ts`.

### Files
- Created: `src/staff/features/today/{index.ts, api/, hooks/ (+test), lib/ (+test), types/}`
- Modified: `docs/PROGRESS.md`, `docs/HANDOFF.md`

### Install commands for the user
none (`npm install` of the existing lockfile only; lockfile untouched)

### Verification
- `npm test` → 62 suites; 454 passed, 2 failed on the first full run (`StatusBadge`, `FilterChips` — timeouts under heavy machine load); both suites pass on rerun (15/15). New: 2 suites / 29 tests.
- `npm run typecheck` → clean
- eslint `src` → 0 errors (4 warnings, none in new code); `npm run lint:fences` → ok
- No device/screen check (no UI in this card).

### Acceptance criteria
- [x] tests green; no screen or route

### Deviations from the card / docs
- **`useAppointmentStats`, `useUpcomingAppointments` and `useBoard` are not used directly.** They have no `enabled`/gate, and a hook cannot be called conditionally, so using them would send requests without permission. The new hooks call the same exported fetchers with the same keys (`appointmentKeys.stats` / `.upcoming`), so the cache is shared and nothing in other features was edited.
- `useDoctorsNow` uses its own key `['today','doctors-now',org,loc,day]` and **no socket room subscription** (`boardRoom` is private to queue); it polls every 30 s and pull-to-refresh refetches. A `select` on the raw board key would have shared cache but still needs the room helper — a small export from `queue` would let M1-15 subscribe.
- Invoice-stats fallback is by invoice ISSUE date (backend filters `issue_date`), so "collected" is paid amount on invoices issued today, not payments taken today. The daily summary is the accurate one.
- `visibleTodayBlocks` ignores `hasFeature` today (a permission already implies its feature in the access context); the parameter is kept per the card.
- `.expo/types/router.d.ts` generated by `expo start --offline`; routes unchanged.

### Questions for the architect
- OK to export `boardRoom` (or a `useBoardLive` hook) from the queue barrel so Today can go live, or is 30 s polling enough?
- Collections block hidden or shown to a `billing.invoice.view` user without `reports.financial.view`? I show it (fallback), per card.

### Notes for the next task
- M1-15: render `visibleTodayBlocks(can, hasFeature)`; each hook has its own `access` state, so a block is a skeleton on `loading`, absent on `denied`.

---
## M1-13a — Notifications api, hooks, link router  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: `claude/m1-13a-notifications-data-d3f6b8` (card name `mobile/M1-13a-notifications-data`)   Commit(s): see `git log`   Status set to: review

### Done
- Step 1 `api/notifications.api.ts`: list (limit clamped ≤ 50, `unreadOnly` sent only when true), unread count, read one, read all, get prefs, put prefs (`sound` only). Contract verified against `my-notifications.controller.ts`, `notifications.dto.ts` and `user-notifications.service.ts`.
- Step 2 `hooks/useNotifications.ts`: `useUnreadCount`, `useNotificationsInfinite`, `useMarkRead` (optimistic row read + count −1 only if the row was cached unread; rollback of lists and count on error), `useMarkAllRead` (invalidates `notificationKeys.all`), `useNotificationPrefs`, `useSetNotificationSound` (optimistic, rollback).
- Step 3 `staff/lib/link-router.ts`: `resolveStaffLink(link)` → `{ pathname, params? } | null`.
- Step 4 `lib/notification-row.ts`: `describeNotification(n, activeOrgId, orgNames)`.
- Step 5 barrel exports + tests (api, hooks, both pure modules).

### Files
- Created: `features/notifications/{api/notifications.api.ts, hooks/useNotifications.ts, lib/notification-row.ts, types/notifications.types.ts}` (+ `.test` files), `staff/lib/link-router.ts` (+ test)
- Modified: `notifications.keys.ts` (added `inbox(unreadOnly)`, `prefs()`; `list()` kept as the prefix), `notifications/index.ts`, `docs/PROGRESS.md`

### Install commands for the user
none (`npm install` from the lockfile only; the resulting `package-lock.json` change was reverted)

### Verification
- `eslint src` → 0 errors, 3 old warnings
- `npm run typecheck` → clean
- `npm test` → 52 suites / 361 tests passed (jest needs `--forceExit` here: a worker does not exit cleanly, as before)
- `npm run lint:fences` → ok

### Acceptance criteria
- [x] tests green; no screen or route

### Deviations from the card / docs
- Link router return shapes (card did not fix them): `/queue/doctor` → `{ pathname: '/queue', params: { segment: 'doctor' } }`; `/queue`, `/appointments` → `{ pathname: '/queue', params: { segment: 'board' } }`; `/patients/:id` → `{ pathname: '/patients/<id>' }`. The Queue screen must read the `segment` param (M1-13 / M1-07 UI). No `/patients/[id]` route exists yet. Query string/hash and trailing slash are ignored; ids must match `[A-Za-z0-9-]+`.
- Keys carry no org/location: the inbox is per user and spans clinics.
- `describeNotification` falls back to "Another clinic" when the org name is unknown.

### Questions for the architect
- Is `segment` (`doctor` | `board`) the param name you want for the Queue tab?

### Notes for the next task
- M1-05 and M1-13 reuse `resolveStaffLink`. Realtime already invalidates `notificationKeys.all`, which covers all new keys.

---
## M1-14 — Schedule tab (S-06)  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-14-schedule-24ec32   Commit(s): see `git log` (feat commit, then this docs commit)   Status set to: review

### Done
- Day strip (`DayStrip`): yesterday … +6 from `dayStrip(useClinicToday())`, so it follows the clinic clock and rolls at clinic midnight; a picked day that left the strip falls back to today.
- Doctor chips (`useDoctors`) and status chips (`FilterChips`, single select each). Filters live in the page state above the selected day, so switching days keeps them. A doctor id not in the active location's list is ignored.
- List: `groupByHour` → `buildScheduleList` (flat header + row items, `stickyHeaderIndices`) in a FlashList v2. Row = clinic-clock time, patient, doctor · type, status badge (`APPOINTMENT_STATUS_TONES`), queue token. Infinite scroll via `fetchNextPage`, pull to refresh, "Loading more…" footer.
- States: loading skeleton, error + retry, empty day, no-results (+ Clear all filters), a failed refresh with rows kept, offline banner (Screen) with "saved data from HH:mm".
- Read-only `AppointmentSheet` (FormSheet) with [Check in] only when `canCheckIn`: `queue.checkin`, booking today on the clinic clock, `scheduled|confirmed`, no queue entry, not a walk-in row. Offline: button reads "Offline", disabled; pending spinner while checking in.
- `useCheckInFlow`: `useCheckIn`; success → invalidate `appointmentKeys.all`, toast with the token, close sheet. `LATE_LIMIT_EXCEEDED` → `LateWalkInDialog` ("Too late for this appointment. Add as walk-in?") → `useConvertToWalkIn` (dialog stays open on failure). `shouldRefetch` errors also invalidate appointments.
- Route `schedule.tsx` renders `ScheduleTabPage` from the appointments barrel (zero logic).

### Files
- Created (all `src/staff/features/appointments/`): `pages/ScheduleTabPage.tsx` (+ test), `components/{DayStrip,ScheduleRow,AppointmentSheet,LateWalkInDialog}.tsx`, `hooks/useCheckInFlow.ts`, `lib/{checkin-rule,schedule-view}.ts`, `lib/schedule-view.test.ts`
- Modified: `src/app/(staff)/(main)/(tabs)/schedule.tsx`, `appointments/index.ts` (exports `ScheduleTabPage`), `docs/PROGRESS.md`

### Install commands for the user
none (`npm install` from the existing lockfile only)

### Verification
- `npm run typecheck` → clean (router types generated first: `.expo/types/router.d.ts` exists)
- eslint `src` → 0 errors (3 old warnings); `npm run lint:fences` → ok
- `npm test` → 462 tests; 459 passed first run, the 3 failures were first-test timeouts in `FilterChips`, `SearchBar`, `FormSheet` (parallel sessions loading the machine); `npx jest src/core/components --runInBand` → 33/33 pass. Appointments suites: 61/61 (23 new in the page test, 14 in `schedule-view.test.ts`).
- **No device / emulator**: no screenshots, no manual run. The timezone acceptance (phone tz = UTC) is covered by tests only: the page test formats on `Asia/Karachi` and asserts `10:00 AM` for 05:00Z and no `5:00 AM`.

### Acceptance criteria
- [x] own-scope doctor sees only own — server-side; the screen sends no doctor override (nothing to test client-side)
- [x] day switching keeps filters — page test
- [ ] times on a phone set to another timezone — unit-tested on the clinic zone; device check pending M0-D (waived for now)

### Deviations from the card / docs
- No search box (not in the S-06 spec). `search` is supported by the data layer if wanted later.
- Sheet fetches `useAppointment` only for cancelled bookings (to show the cancel reason); every other field comes from the list row. Walk-in rows never fetch it (their id is a queue entry id).
- Day and filter state are `useState` in the page, not persisted (no PHI-risk, no need).

### Questions for the architect
- The status filter is single-select (backend takes one `status`). OK?
- Doctors with `fullName === ''` show as "No name" in chips / "No doctor" in rows.

### Notes for the next task
- Tests need stand-ins for `react-native-reanimated`, `@gorhom/bottom-sheet`, `expo-router`, `react-native-keyboard-controller` when a page imports the `@/core/components` barrel (see `ScheduleTabPage.test.tsx`); a shared jest mock would remove the repetition.

---
## Rework M1-14 #1 — 2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-14-schedule-24ec32 · Status set to: review (unchanged)

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Clear only on status chips, clears only status | Removed the status-chip `clearLabel`; one "Clear all (n)" outline button (label "Clear all filters (n)", 44 pt) shows whenever a doctor or status filter is active and resets both. Tests: doctor-only filter shows "(1)" and clears; doctor + status shows "(2)" and clears both. |
| 2 | Offset paging can repeat a row (duplicate FlashList keys) | The flattened pages are de-duplicated by id in the `useMemo` (first copy wins). Test: two pages repeating `a2` render it once. |
| 3 | Dialog description repeats the title | Now "The patient joins the queue as a walk-in." (title unchanged). |
| 4 | Unreachable discard copy in the read-only sheet | Kept (FormSheet requires `discard`), with a comment saying why it cannot show. |

Verification: `npm run typecheck` clean; eslint 0 errors (3 old warnings); `lint:fences` ok; `npm test` → 62 suites, 465 passed (appointments: 64). Device check pending M0-D (screenshot waived by the team lead).

---
## M1-11 — Patients list and quick register (S-04, UI only)  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-11-patients-list-118fe2   Commit(s): see git log (feat + docs)   Status set to: review

### Done
- `PatientsPage` (new `pages/PatientsPage.tsx`) rendered by `(tabs)/patients.tsx`: `SearchBar` (300 ms, min 2 via `usePatientsInfinite`), `FilterChips` Active (default on → `isActive: true`) and Minors (`isMinor: true`), FlashList of `PatientRow` (`ListRow`: initials avatar, name, `MR no · masked phone`, `age · gender`), pull to refresh, "Loading more…" footer, "Recently opened" (ids → rows via `usePatient`) while search is empty, `LoadingSkeleton` / `EmptyState` / `NoResultsState` (Clear resets search + chips to default) / `ErrorState` (retry; a failed refresh with rows shows a retry banner above them). Header ＋ only with `patients.create` (sheet not mounted without it either).
- `QuickRegisterSheet` (FormSheet + `useQuickRegisterForm`): name, phone, gender chips, DOB, minor switch → guardian name/phone/relation. `useCheckPhone` runs only for the value the phone field was last blurred with → "A patient with this phone already exists" + **Search** (resets the form, closes the sheet, fills the search box with the phone — A-17). Submit disabled on `!canSubmit || isSubmitting`; dirty guard via FormSheet; success → close, toast "Patient registered" (no name in the toast), push id to the recent store, `router.push` to the patient.
- **DOB is a `YYYY-MM-DD` text field**: core has no date picker (hint "Format YYYY-MM-DD").
- Navigation uses `router.push({ pathname: '/patients/[patientId]', params })`; the detail route/page are M1-12's and untouched.

### Files
- Created: `staff/features/patients/pages/PatientsPage.tsx` (+test), `components/{PatientRow,RecentPatients,QuickRegisterSheet}.tsx`, `components/patient-row-text.ts` (+test)
- Modified: `src/app/(staff)/(main)/(tabs)/patients.tsx`, `staff/features/patients/index.ts` (+1 line: `export { PatientsPage }` — M1-12 may also touch this file; trivial merge)

### Install commands for the user
none (lockfile install only)

### Verification
- `npm run typecheck` clean; eslint `src`: 0 errors (3 pre-existing warnings in other files); `lint:fences` pass; patients tests: 14 page + 2 row-text new tests green. Full `npm test`: 62 suites / 443 tests, 442 passed; the 1 failure was `core/.../FilterChips.test.tsx` "single select replaces the value" (not touched by M1-11) — it failed once in the full run and once in an immediate solo rerun, then passed on the next solo run: looks flaky.
- **No device/emulator**: nothing was run on a phone; no screenshots (gate M0-D).

### Deviations from the card / docs
- No "Clear" chip / count badge on `FilterChips`: Active is on by default, so the count would always read 1. "Clear all filters" lives on the no-results state.
- Page test replaces `@shopify/flash-list` with `FlatList` (the package is ESM and not in `transformIgnorePatterns`; I did not edit shared jest config) and stubs reanimated + the sheet internals.
- "Age" shows months under one year ("8m").

### Questions for the architect
- Should `transformIgnorePatterns` include `@shopify/flash-list` so later page tests can use the real list?

---
## Rework M1-11 #1 — 2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-11-patients-list-118fe2 · Status: review (unchanged)

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Stale duplicate-phone answer survived a successful register | `useQuickRegister` also invalidates `['patients','check-phone']`; the sheet clears `blurredPhone` in its `onCreated` path. Test: duplicate shown → register → retype the same phone → notice gone. |
| 2 | Failed `fetchNextPage` showed "Could not refresh" and retried with `refetch()` | Footer "Could not load more" + Retry → `fetchNextPage()` on `isFetchNextPageError`; the banner now only for `isRefetchError`; `onEndReached` no longer auto-retries after a page error. Test added (rows stay, retry fetches page 2 only). |
| 3 | Refresh control spun on background refetches | Local `pulling` state set in `onRefresh`, cleared when that refetch settles. |
| 4 | (optional) blank skeleton on a new search | `placeholderData: keepPreviousData` in `usePatientsInfinite`. |

FlashList in jest: kept the FlatList stand-in (real FlashList is ESM and needs native layout; not fighting shared jest config). The mock now records `onEndReached` so the paging test can drive it.
Touched M1-11b files as asked: `hooks/useQuickRegister.ts`, `hooks/usePatientsInfinite.ts`.
Verification: typecheck clean, eslint 0 errors, fences pass, patients tests green (page suite 16). Full `npm test`: 62 suites / 445 tests all green (the earlier FilterChips flake did not recur). No device.

---
## M2-02b — Patient Google sign-in  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: mobile/M2-02b-patient-google   Commit(s): f65ab70 (+ WIP 2261b77 by previous developer)   Status set to: review

### Done
- `GoogleIdentityService.verify(credential, audiences?)`: array of audiences from `GOOGLE_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` (unset skipped, `patientAudiences`); staff path (no array) unchanged, proven by spec.
- `POST /patient-auth/google { idToken, termsVersion, privacyVersion }`: `@PatientAuthRoute()`, `@RateLimit` 30 / 15 min per IP, returns the PatientSession shape. Resolution: ('google', sub) → account; else verified email → existing account + identity; else create. Consents as M2-02. Any verify failure → `GOOGLE_TOKEN_INVALID`.
- Continued the WIP; finished it by fixing two failing specs: handler count in `patient-auth.controller.spec.ts` (4 → 5) and a TS cast + two lint nits in `patient-auth.service.spec.ts`.

### Files
- Modified: `auth/google/google-identity.service.ts` (+spec), `patient-auth/{controller,service,module,dto}`, specs, `.env.example`.

### Install commands for the user
none (`npm ci` from lockfile only; lockfile changes discarded)

### Verification
- `npm run build` → clean
- full `npx jest --runInBand`: 98 suites / 1004 tests; the only 2 failures were the specs fixed above, re-run green (patient-auth, auth/google, access, patient-app: 19 suites / 178 tests). Not re-run as one full pass after the fix.
- ESLint on changed files: only repo-wide CRLF prettier noise.

### Questions for the architect
- None.

## Rework M2-02b #1
Date: 2026-11-15 · Branch `mobile/M2-02b-patient-google`

| # | Result |
| --- | --- |
| 1 Medium | Fixed. Email-matched account that already has a `provider='google'` identity (different sub) → 409 `ACCOUNT_LINK_CONFLICT`; spec; code documented in 07 §5. |
| 2 Med-low | Fixed. Identity inserted with `insert().orIgnore()` and re-read (other account → conflict); a 23505 on the transaction retries the whole resolve once. Specs: mocked 23505 (retry finds winner) and non-23505 not retried. |
| 3 Low | Fixed. `ServiceUnavailableException` (Google not configured) is rethrown as 503; only verify failures → 401 `GOOGLE_TOKEN_INVALID`. Spec. |
| 4 Low | Fixed. `GoogleIdentity.rawName` (Google's real `name` claim or null); patient flow stores only that, so `needsName` stays true without one. Staff `name` fallback unchanged. Specs in both services. |
| 5 Nit | Fixed. `new OAuth2Client()` without client id. Spec updated. |
| 6 Note | **For the account-deletion card:** soft-deleted accounts keep their `patient_account_identities` rows, so that Google account is blocked forever — deletion must remove identity rows. |

Verification: `npm run build` clean; patient-auth + auth/google specs 6 suites / 41 tests; full `npx jest --runInBand` 98 suites / 1014 tests passed. No int specs run (no DB). Install commands: none.

---
## M1-08 — Doctor queue screen (S-02a)  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-08-doctor-queue-d5f636 (worktree of mobile/develop)   Commit(s): see git log (feat + docs)   Status set to: review

### Done
- `DoctorQueueView` replaced (data via `useMySession`; wiring, sheets, session states). Body for open/paused in `doctor/DoctorQueueList.tsx` (FlashList in `waitingOrder`, header = pill + ⋮ + summary + paused banner + current card + suggestion line; footer = collapsible On hold / Skipped).
- Session states: `waiting_for_doctor` (Start session), `open`, `paused` (banner with reason + Resume, Call next disabled), `closed` (summary counts).
- `doctor/CurrentPatientCard`: actions come from `useEntryActions(…, 'doctor')` (primary Start/Done, secondary Recall / Undo call / Skip / Send for test / Abort, Patient file → `/patients/[patientId]`).
- `doctor/WaitingRow`: ⋯ → ActionSheet "Call this patient"; selecting the suggested patient goes straight through, jumping the order opens the ReasonSheet (optional reason).
- `doctor/ReasonSheet` + `hooks/useReasonForm.ts` + `schemas/reason.schema.ts`: FormSheet + TanStack Form + Zod 4 (`validators`, `fieldError`); pause requires a reason, others optional; max 500. Sheet stays open on a plain failure, closes on success or a stale entry (`shouldRefetch`).
- `doctor/useDoctorQueueActions`: all mutations in one hook; `busyEntryIds` (from each mutation's `isPending` + `variables.entryId`) locks a row/card while any action on it runs; `ifMatch: entry.version` comes from the entry on screen; haptics success/warning; `AccessibilityInfo.announceForAccessibility("Called A-008, Sara K.")` after Call next; NO_ELIGIBLE_PATIENT → the hook's "No one is waiting" toast.
- ConnectionPill via existing `RealtimeConnectionPill`; pull to refresh; offline: Call next/Start/Resume use `OfflineAwareButton`, other buttons disabled via `useCanMutate`.

### Files
- Created: `components/DoctorQueueView.test.tsx`, `components/doctor/{CurrentPatientCard,DoctorQueueList,ReasonSheet,SessionPanels,WaitingRow}.tsx`, `doctor/{doctor-labels,haptics,useDoctorQueueActions}.ts`, `doctor/useDoctorQueueActions.test.tsx`, `hooks/useReasonForm.ts`, `schemas/reason.schema.ts`
- Modified: `components/DoctorQueueView.tsx`, `docs/PROGRESS.md`, `docs/HANDOFF.md`

### Install commands for the user
none (`npm install` from the existing lockfile only)

### Verification
- `npm test` → 62 suites, 446 tests passed (19 new: 15 view, 4 actions hook)
- `npm run typecheck` → clean
- eslint `src` → 0 errors, 3 pre-existing warnings (api-error.ts, skeleton.tsx, staff/lib/api.ts)
- `npm run lint:fences` → all directions fail as expected
- Manual: **no device or emulator here — not run on a device.** Screenshots of the 4 session states and the 10-patient seeded-clinic run join gate M0-D.

### Acceptance criteria
- [x] session states render; actions by status; Call next + NO_ELIGIBLE_PATIENT; actions disabled while pending; reason sheet validation (tests)
- [ ] manual 10-patient run + 4 screenshots (no device)

### Deviations from the card / docs
- **Close session** (⋮ menu) is not here: the card text says M1-10 builds the close sheet. The menu has Pause / Resume / Smart order (needs `queue.entry.reprioritize`).
- Current card shows the patient number and reason, not "34y · M": `EntryPatient` has no age or gender.
- Segmented control + board placeholder already live in `QueueTabPage` (not touched).
- Tests mock `FormSheet` / `ActionSheet` (native gesture runtime) and `FlashList` (no layout in Jest); the real `ReasonSheet` form logic runs.
- Prettier was not configured in `mobile-app`; files were formatted with single quotes / width 100 to match the existing sources.

### Questions for the architect
- Abort asks via the ReasonSheet (title "Abort consultation", consequence text) instead of a separate ConfirmDialog; is that enough as the confirm?

---
## Rework M1-08 #1 — 2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-08-doctor-queue-d5f636 · Status set to: review (PROGRESS stays `review`)

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Abort needs a confirm | The ReasonSheet submit (now destructive) no longer sends; it opens a destructive `ConfirmDialog` ("Abort consultation? This ends the visit without completing it. It cannot be undone."). `actions.abort` runs only on confirm, with the entry as it is on screen then (fresh `version`); a plain failure keeps the dialog open. Test: abort not called until confirmed. Needed one additive field in core: `SubmitSpec.destructive` (`core/components/overlays/SubmitFooter.tsx`) — flag for the review. |
| 2 | Call next + "Call this patient" can both fire | `locked = sessionBusy \|\| busyEntryIds.size > 0` disables Call next and every row menu (`WaitingRow.locked`, no spinner on other rows); `callThisPatient` also returns early when locked. Tests for entry-busy and session-busy. |
| 3 | Announce after select | `select` announces "Called A-009, Umar" via the shared `announceCalled`, same as Call next. Test. |
| 4 | my-session NOT_FOUND | `queueErrorCode(error) === 'NOT_FOUND'` → `EmptyState` "You are not set up as a doctor at this location." (no retry). Test. |
| 5 | Waiting minutes froze | `doctor/useTickingNow`: server `now` + phone-elapsed time, ticked each minute, re-based on every snapshot. Tests with fake timers. |

Verification: `npm test` 63 suites / 452 tests passed · typecheck clean · eslint 0 errors (3 old warnings) · lint:fences ok.
Not run on a device: device items wait for gate M0-D (the 10-patient run and the 4 state screenshots).

---
## M1-09 — Reception board (S-02b) and walk-in (S-02c)  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-09-board-745a66   Commit(s): 3c56a1a (code)   Status set to: review

### Done
- `components/BoardView.tsx` (body replaced): `useBoard` states (skeleton / error+retry / "No doctors on the board" / "No open lanes" + Open a lane), `RealtimeConnectionPill`, `DoctorChips` (waiting counts, `[+]` only when a doctor has no session), one `FlashList` per lane: Arrivals link row, session banner (paused / closed / not started), Now serving, Waiting (server `waitingOrder`), On hold / Skipped (with inline Back from test), pull to refresh, walk-in FAB (`queue.checkin`).
- Open lane: `[+]` -> ActionSheet of doctors with `snapshot === null` (taken from the board response, no extra fetch) -> `useOpenSession` -> that lane is selected.
- Row ActionSheet = `availableEntryActions(..., 'board')` in S-02b order (Mark urgent hidden when already urgent): Mark urgent (reason sheet, TanStack form), Transfer (doctor picker), Skip, Rejoin, Back from test, Cancel visit (ConfirmDialog), Patient file (`/patients/[patientId]`), Show ticket (`useTicket` sheet). Offline: only Patient file / Show ticket remain, FAB, `[+]` and Back from test are disabled. The row is disabled while its action is pending (`pendingEntryId`).
- Walk-in: route `(staff)/(main)/queue/walk-in.tsx` -> `WalkInPage` (modal, `Screen`), `walk-in.schema.ts`, `useWalkInForm.ts`, `lib/walk-in-input.ts` (`toWalkInInput`, because `.parse()` in onSubmit is banned). Doctor chips (preselect the open lane), Existing patient (debounced `usePatientsInfinite` search) / New patient (name + phone), reason, Urgent switch -> reason, discard-changes dialog. `ACTIVE_WITH_OTHER_DOCTOR` -> "Add anyway?" dialog -> `confirmForce` calls `mutateAsync` again with `force: true` = new Idempotency-Key. Success: toast "Token A-015 for Hina" + Show ticket action, board focuses/scrolls to the new row, sheet closes.
- UI state in `board/useBoardUiStore.ts` (ids only, no patient data). Barrel: added `WalkInPage`.

### Files
- Created: `components/board/**` (model, lane-items, rows, chips, host, sheets, store, actions hook + 3 tests), `pages/WalkInPage.tsx`, `hooks/useWalkInForm.ts`, `lib/walk-in-input.ts`, `schemas/walk-in.schema.ts`, route `walk-in.tsx`, tests `BoardView.test.tsx`, `useWalkInForm.test.tsx`, `walk-in.schema.test.ts`.
- Modified: `components/BoardView.tsx`, `index.ts` (one export line), PROGRESS row.

### Install commands for the user
none (`npm install` from the lockfile only).

### Verification
- `npm run typecheck` clean (router types generated, `/queue/walk-in` and `/patients/[patientId]` validated) · eslint `src` 0 errors (3 old warnings) · `npm run lint:fences` ok.
- Tests: queue feature 11 suites / 144 tests green; full run 65 suites / 464 tests green (`npx jest -i --forceExit`; jest does not exit by itself — open handle in an older suite).
- NO DEVICE: not run on a phone or simulator; screenshots and the two-phone test join gate M0-D.

### Acceptance criteria
- [x] board, row actions per table, ticket, walk-in with force flow implemented and unit/component tested
- [ ] two-phone test and screenshots (needs device, gate M0-D)

### Deviations from the card / docs
- Arrivals row shows no count and pushes `/queue/arrivals` with an untyped cast (`ARRIVALS_ROUTE as never`): the arrivals screen/route is M1-10, which should replace it with a typed href and may add the count. Until then the tap shows the unmatched-route screen.
- Transfer target list = every doctor on the board except the entry's own (including ones without a session); the server decides if the target is valid.
- The walk-in modal's Android hardware back is not intercepted by the discard dialog (only the X button and swipe gesture are).
- Tests mock `ActionSheet`/`FormSheet`/`ConfirmDialog`, FlashList and reanimated (no gesture runtime in Jest).

### Questions for the architect
- Is a transfer to a doctor without an open session accepted by `PATCH entries/:id/transfer`, or should the picker list open lanes only?

---
## Rework M1-09 #1 — 2026-11-15
Branch: `claude/m1-09-board-745a66` · Commit: b7df3af · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Open lane needs `queue.checkin` | `[+]` chip and the empty-board "Open a lane" button show only with `can('queue.checkin')` (and online). Tests: no `[+]`, no button without it. |
| 2 | Walk-in search over-fetches / 403 | `usePatientsInfinite(filters, { enabled })` (additive, default true; patients-hooks test). `WalkInPatientSearch` passes `enabled` = 2+ chars. Without `patients.view` the walk-in has no Existing mode and starts on New patient (`useWalkInForm(doctorId, defaultMode, onCreated)`). Tests: `WalkInPage.test.tsx`, hook mode test. |
| 3 | Arrivals row -> missing route | Row hidden (`buildLaneItems(..., false)`, `TODO(M1-10)` in `BoardView.tsx`); the untyped route cast is gone; `onOpenArrivals` is optional in `BoardLaneList`. Test: no Arrivals text. |
| 4 | Name the other doctor | Backend `QueueErrors.activeElsewhere` sends `error.entries: [{ entryId, token, doctorName, status }]` (`queue-orchestrator.service.ts:235`). `lib/walk-in-conflict.ts` `activeElsewhereDoctor(err)` reads the first `doctorName`; dialog title "Already in <name>'s queue", falls back to the generic title when absent. Tests: with and without a name. |
| 5 | Vanished entry fails silently | Mark urgent, transfer and cancel on an entry that left the lane toast "This patient is no longer in the queue."; urgent also closes the sheet. Test: `EntryActionsHost.test.tsx`. |

Verification: `npm run typecheck` ✓ · eslint `src` 0 errors (3 old warnings) · `npm run lint:fences` ✓ · full jest 67 suites / 474 tests ✓ (`--forceExit`). No device.
---
## M1-12 — Patient summary (S-05)  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-12-patient-summary-c4f480 (from mobile/develop)   Commit(s): feat(mobile): M1-12 …   Status set to: review

### Done
- `PatientDetailPage` (same props): uuid-validated route param (invalid or API 404 → ErrorState "Not found"), loading / error+retry, pull-to-refresh, header (name; `MR · age · gender · blood group`), alert strip from `patientAlerts`, `SegmentedControl` with Overview / Visits always and Rx / Chart only when the gated hook is `allowed` (never while `loading`).
- Overview: phone, guardian, medical history, today's queue entry (from `usePatientQueueVisits`, serviceDate = clinic today, not finished), latest vitals (hidden when denied). Visits: queue visits + clinical history (history hidden when denied). Rx: list (hook order: finalized/amended first) + read-only detail in `FormSheet`. Chart: latest chart as a list of findings (current jsonb model + legacy strings, "planned" marked), no drawing.
- ⋯ `ActionSheet`: Call (`tel:` digits only), WhatsApp (`https://wa.me/<digits>`, `whatsappNumber` first), Copy MR no. (explicit, toast). Failed `openURL` → generic toast (no number in it).
- Id pushed into `useRecentPatientsStore` only after a valid patient loaded (ids only, memory).
- Every block has loading / empty / error(retry); denied blocks render nothing.

### Files
- Modified: `staff/features/patients/pages/PatientDetailPage.tsx`
- Created: `patients/components/detail/{DetailBlock,AlertStrip,OverviewSegment,VisitsSegment,RxSegment,ChartSegment}.tsx`, `patients/lib/{patient-detail,copy-text}.ts`, tests `lib/patient-detail.test.ts`, `pages/PatientDetailPage.test.tsx`
- Docs: PROGRESS row, this entry. Barrel untouched (no new exports needed).

### Install commands for the user
none left. `expo-clipboard ~58.0.4` was added by the team lead/user for this card (package.json + lockfile committed here); `lib/copy-text.ts` now uses `Clipboard.setStringAsync` (false on failure → toast "Could not copy"). Native module → needs a new dev build.

### Verification
- `npm test` → 63 suites / 467 tests, all green (after the clipboard change; `copy-text.test.ts` added). `npm run typecheck` clean. ESLint on `src`: 0 errors (existing warnings only; my new axios warning fixed). `npm run lint:fences` all PASS.
- **No device / emulator here:** no screenshots; visual and 44 pt checks are by code only.

### Acceptance criteria
- [x] User without `patients.clinical.view` sees Overview + Visits only (test: rx/chart denied → only those two tabs; vitals and history blocks absent, no error)
- [ ] Screenshots of each segment (needs a device)

### Deviations / notes
- Lists are plain mapped Views inside the screen's scroll (first page only: visits full list, Rx first 20, history all encounters), not FlashList — nesting a FlashList in a ScrollView is worse; revisit if histories get long.
- WhatsApp: a local number (`03…`) is sent as is; wa.me needs country code, so it only resolves when `whatsappNumber`/phone is stored in international form.
- Rx detail uses `FormSheet` (no submit, dummy discard strings) since core has no read-only sheet.
- Tests stub reanimated, bottom-sheet and both overlays (native runtime) — same approach as `FormSheet.test.tsx`.
- "Link app (M2-15)" menu item not added (later card).

### Questions for the architect
- None.


---
## M1-13 — Notifications inbox and bell (S-07), UI  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: `claude/heuristic-torvalds-98bdbd` (card name `mobile/M1-13-notifications`, based on develop 1ab8e4f)   Commit(s): see `git log`   Status set to: review

### Done
- Step 4 `pages/NotificationsPage.tsx` + route `(staff)/(main)/notifications.tsx`: FlashList inbox (`NotificationRow`: unread = bold + dot), "Mark all as read" header icon (disabled at 0 unread, pending spinner), tap → optimistic mark read → `resolveStaffLink` → `router.navigate` (unknown link: stay). States: skeleton, error + retry, "You're all caught up" empty, refresh-error banner, load-more error/spinner footer, pull to refresh. No filters on this screen, so no "no results" state.
- Other-clinic rows show the clinic name; tapping one with a known link asks "Switch to <clinic>?" (`ConfirmDialog`), then `useSwitchLocation` (M1-02 flow, deep import of its hook, no cycle) to that clinic's primary/first location, then navigates. A failed switch keeps the dialog open. Helper `lib/clinic-switch-target.ts`.
- Step 5 `NotificationBell` now self-wired (`useUnreadCount`, push `/notifications`); presentational `NotificationBellButton` (badge hidden at 0, 99+ cap). All existing header call sites (`<NotificationBell />`) pick it up with no edits to other features.
- Step 6 `NotificationSoundRow` in More (Switch, optimistic via `useSetNotificationSound`, disabled until prefs load).
- Nits: link-router UUID regex (+ `/patients/new` and non-UUID → null tests); `useMarkRead` invalidates list + unread-count only (test); `QueueTabPage` honours `params.segment` over the saved pref when the user has both permissions, tab switch updates the param; clinic-clock comment in `notification-row.ts`.

### Files
- Created: `notifications/pages/NotificationsPage(.test).tsx`, `components/NotificationRow|NotificationSoundRow.tsx`, `NotificationBell.test.tsx`, `lib/clinic-switch-target(.test).ts`, route file.
- Modified: `NotificationBell.tsx`, `index.ts`, `useNotifications.ts(+test)`, `notification-row.ts`, `staff/lib/link-router.ts(+test)`, `MorePage.tsx` (one row), `QueueTabPage.tsx` (segment param only), PROGRESS.

### Install commands for the user
none.

### Verification
- `npm run typecheck` clean (router types regenerated with `CI=1 npx expo start --offline`) · eslint 0 errors (4 old warnings) · `lint:fences` ok · full jest 83 suites / 628 tests green (`npx jest -i --forceExit`).
- NO DEVICE: realtime badge increment (acceptance) is covered only by the existing invalidation unit tests; live check, screenshots, the switch-clinic flow and the sound switch on a phone join gate M0-D.

### Deviations / notes
- Clinic switch picks the org's primary location (else first); the card does not say which.
- `QueueTabPage` users with only one queue permission ignore the param (they have one segment).
- Tapping a push/notification link to `/queue` with no segment is unaffected.

---
## M1-10 — Arrivals check-in (S-03) and close session — 2026-11-15
Branch: `claude/upbeat-hopper-2688e6` (based on `mobile/develop` 1ab8e4f) · Status: review

### What was built
- **Arrivals screen** `ArrivalsPage` (route `(staff)/(main)/queue/arrivals.tsx`): today's `scheduled|confirmed` bookings without a queue entry (`useArrivals`, earliest first), row = clinic-clock time, patient, doctor · type, **[Check in]** and a triangle icon button "check in as urgent" (reason sheet, reuses `UrgentReasonSheet` with `title` / `submitLabel` props). `LATE_LIMIT_EXCEEDED` → existing `LateWalkInDialog` → convert-to-walk-in; the urgent reason is kept for the convert. Loading / empty / error (+ stale banner) states; offline disables the buttons.
- **Board**: Arrivals row un-hidden for `queue.checkin` and pushes `/queue/arrivals` (TODO(M1-10) removed).
- **Close session** (doctor view, S-02a): session menu → "Close session" (`queue.doctor.own`, destructive; toast "Finish the current patient first." while someone is with the doctor) → `CloseSessionSheet`: per leftover (waiting / skipped / on hold) cancel or transfer + doctor chips (own doctor excluded, list from `GET /appointments/doctors`). Backend rule mirrored: only waiting patients can transfer, skipped / on-hold are cancelled without a tap; no other doctor → all cancel. Submit stays disabled until every CURRENT leftover is decided; the body is built from live leftovers. TanStack Form + `closeSessionSchema` as validators; one Idempotency-Key per tap (`useCloseSession`); failure keeps the sheet and choices.

### Deviations
- `ArrivalsPage` lives in `features/appointments` (not `queue`): it needs `useArrivals` / `useCheckInFlow`, and appointments already imports the queue barrel — placing it in queue would create an import cycle. The route imports it from the appointments barrel.
- `useCheckInFlow.start(id, urgentReason?)` gained an optional reason (backward compatible; the convert reuses it).
- The close sheet's doctor list uses its own `useDoctorChoices` (queue key `['queue-doctors', org, loc]`, outside `queue.all`) for the same reason (queue cannot import appointments).
- `UrgentReasonSheet` exported from the queue barrel; `DoctorQueueView.test.tsx` got sonner + `useDoctorChoices` mocks.

### Files
- New: `appointments/{pages/ArrivalsPage(.test),components/ArrivalRow}`, `queue/{components/doctor/CloseSessionSheet(.test),hooks/useCloseSessionForm,hooks/useDoctorChoices,lib/close-decisions(.test),schemas/close-session.schema}`, route `arrivals.tsx`.
- Modified: `BoardView(.test)`, `DoctorQueueView(.test)`, `useDoctorQueueActions`, `UrgentReasonSheet`, queue `api/types/keys/index`, appointments `index`, `useCheckInFlow`.

### Install commands
none.

### Verification
typecheck ✓ · `expo lint` 0 errors (4 old warnings, none in touched files) · lint:fences ✓ · full jest 83 suites green. NO DEVICE: screenshots / two-phone check wait on gate M0-D.

### Acceptance
- [x] late check-in converts (dialog flow, tested via flow mock) · [x] closing with 3 leftovers sends 3 decisions (sheet + lib tests) · [x] errors mapped via `queueErrorMessage`

---
## Rework M1-10 #1 — 2026-11-15
Branch: `claude/upbeat-hopper-2688e6` · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | No visible pending on Check in | `ArrivalRow` shows a Spinner in the button while that row's check-in runs (label per patient for screen readers). |
| 2 | Stale Transfer draft blocks close | Validators prune drafts to the currently listed leftovers; `canSubmit` derives from live leftovers; the form revalidates when the leftover id set changes. Test: Transfer chosen without a doctor, patient leaves, close works with `[]`. |
| 3 | Doctors-only transfer picker | `GET /appointments/doctors` (`appointments.service.getDoctors`) returns `{ id, fullName, designation, profilePictureUrl }` for EVERY active assignment at the location; `designation` is free text from the assignment, not a doctor marker. Left as is. **Backend follow-up:** add an `isDoctor` flag (or filter by employment role type / doctor profile) to that endpoint, then filter the picker. The server still validates the target (`assertDoctorAtLocation`). |
| 4 | Gating | `ArrivalsPage` needs `queue.checkin` AND `appointments.view`; without them "You don't have access" empty state, no buttons and the arrivals query is disabled (`useArrivals(ymd, allowed)`). Board Arrivals row needs both too. Tests for both. |
| 5 | Destructive submit | Close-session submit is `destructive`. |
| 6 | Realtime | `queueEventKeys` and `ALL_REALTIME_KEYS` now also invalidate `appointmentKeys.arrivalsAll()` (`['appointments','arrivals']`) through the existing invalidator (no new listener); `realtime-invalidation.test.ts` updated. |

Skipped: count on the Arrivals row (optional; would need the arrivals query on the board).
Verification: typecheck ✓ · lint 0 errors · lint:fences ✓ · full jest green. No device.

---
## M1-15 — Today snapshot (UI), screen S-01  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: mobile/M1-15-today-ui (from mobile/develop)   Status set to: review

### Done
- `pages/TodayPage.tsx` (route `today.tsx` renders it): header "Today" + clinic-clock date · active location + bell; blocks from `visibleTodayBlocks` only: stats tiles (appointments, waiting now, avg wait), collections tiles (collected + unpaid invoices, or outstanding when the daily summary answered), Doctors now (row -> Queue tab), Next appointments (All -> Schedule). Pull to refresh refetches every allowed block.
- `components/BlockShell.tsx`: each block has its own skeleton / error + retry; denied renders nothing. No visible block -> "Nothing to show here" empty state.
- Money: `formatCurrency` on the DECIMAL amounts (no minor-unit division). `lib/today-format.ts`: avg wait and doctor summary text.
- No old dashboard feature exists in mobile-app, so nothing to delete.

### Files
- Created: `components/{BlockShell,TodayBlocks}.tsx`, `pages/TodayPage.tsx` + test, `lib/today-format.ts`. Modified: route `today.tsx`, `index.ts` (one export). No core component added.

### Install commands for the user
none.

### Verification
- eslint 0 errors (4 old warnings) · `lint:fences` ok · full jest 81 suites / 622 tests green (`-i --forceExit`).
- NO DEVICE: owner/receptionist/doctor screenshots wait on gate M0-D.

### Acceptance criteria
- [x] right blocks per permission set (component tests for owner, receptionist, doctor)
- [ ] screenshots on device (gate M0-D)

### Deviations from the card / docs
- Location switcher: see Rework #1 below.
- Doctor row tap opens the Queue tab, not that doctor's lane (the queue tab has no lane param yet).
- Tests mock the core kit (Screen etc.), since Jest has no native runtime.

---
## Rework M1-15 #1 — 2026-11-15
Branch: `mobile/M1-15-today-ui` · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Location switcher required | Added `LocationSwitcherButton` in `features/more/components` (reuses `SwitchLocationSheet` + `useSwitchLocation`), exported from `more/index.ts` (approved exception). Rendered in TodayPage header actions before the bell; "Switch location" label, `IconButton` 44pt; hidden with fewer than 2 places. Tests: shown with 2 locations, hidden with 1. |
| 2 | Neutral empty copy | "There is no clinic overview available for your account." (no tab names). |
| 3 | typecheck | The earlier note was wrong: `uniwind-types.d.ts` is present; the missing file was the gitignored, Expo-generated `expo-env.d.ts`. Generated with `CI=1 npx expo start --offline`; `tsc` now clean. |

Follow-up (accepted as-is): the doctor row opens `/queue` without a lane param; the queue tab has no lane param yet.

Verification: `npm run typecheck` clean · eslint 0 errors (4 old warnings) · `lint:fences` ok · full jest 82 suites / 624 tests green. No device.

---
## M1-05 — Mobile push registration and tap routing  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: mobile/M1-05-push (from mobile/develop)   Status set to: review

### Done
- `core/notifications`: `permissions.ts` (`getPermissionState` never prompts, `requestPermission` shows the OS prompt), `push-token.ts` (`getExpoPushToken` → null on simulator / not granted / no EAS project id / Expo unreachable; `projectId` from `extra.eas.projectId`), `push-data.ts` (`parsePushData`, the typed `data` contract), `foreground.ts` (queue events → banner + sound, everything else list only), `tap-events.ts` (`subscribeToPushTaps`: warm listener + cold `getLastNotificationResponseAsync`, de-duplicated per notification id, cold response cleared after use).
- `staff/features/devices`: `POST/DELETE /me/devices` (checked against `backend/src/devices`: `DELETE` carries `{ expoPushToken }` in the body, `appVersion` required ≤ 20, `deviceLabel` ≤ 80), `registerThisDevice` / `unregisterThisDevice` (registered token kept in SecureStore `staff.pushToken` so sign-out can delete it offline-token-free), `usePushRegistration` + `PushRegistration` (granted → register on every mount; undetermined → explanation sheet "Get alerts when patients arrive" ONCE (pref `staff.push.asked`) → OS prompt → register; denied → quiet), `decidePushRoute` (pure), `usePushRouteStore` + `PushRoutePrompt`.
- Tap routing: `shell/notification-router.ts` (`createNotificationRouter` + `useNotificationTaps`, mounted in `RootShell`) → staff signed in → `switchSpace('staff')` if needed → `handleStaffNotificationRoute(data)` (exported from `@/staff`) parks the tap in a store; `PushRoutePrompt` (in `StaffMainLayout`) acts when the session is `signedIn`: same location → `router.navigate(resolveStaffLink(route) ?? /today)`; other location the user can open → "Switch to <clinic – location>?" then switch + navigate; unknown/blocked place → dropped. Taps older than 2 min are dropped. Staff not signed in → opens sign-in, tap dropped (never replayed for the next user).
- Sign-out: `useSignOut` calls `unregisterThisDevice()` first (access token still valid), best effort.

### Files
- Created: `core/notifications/{permissions,push-token,push-data,foreground,tap-events}.ts` + `notifications.test.ts`; `staff/features/devices/**` (api, lib, store, hooks, components, index + tests); `shell/notification-router.ts` + test.
- Modified: `RootShell.tsx` (install foreground handler, `useNotificationTaps()`), `staff/index.ts` (+ `handleStaffNotificationRoute`, `isStaffSignedIn`), `StaffMainLayout.tsx` (mount `PushRegistration`, `PushRoutePrompt`), `useSignOut.ts` (+ test), `core/storage/prefs.ts` (+ `staff.push.asked` key), `jest.setup.ts` (expo-notifications mock gained `getLastNotificationResponseAsync`, `clearLastNotificationResponseAsync`, `DEFAULT_ACTION_IDENTIFIER`).

### Install commands for the user
none (`expo-notifications`, `expo-device`, `expo-application` were already installed).

### Verification
- typecheck clean · eslint 0 errors (4 old warnings) · `lint:fences` ok · full jest 97 suites / 743 tests green (`-i --forceExit`).
- NO DEVICE: foreground / background / killed-app recordings and "signed-out phone gets no push" wait on gate M0-D (needs a dev build + EAS `projectId` + FCM/APNs keys).

### Acceptance criteria
- [x] unit tests: permission state, register/unregister, warm + cold tap routing, route map
- [ ] device recordings (gate M0-D)

### Deviations / notes for review
- SDK 58 has `getLastNotificationResponseAsync` (the card says `getLastNotificationResponse`); the async one is used, plus `clearLastNotificationResponseAsync`.
- `PushRoutePrompt` deep-imports `more/hooks/useSwitchLocation` (same precedent as `NotificationsPage`; it is not in the `more` barrel).
- `useSignOut` deep-imports `devices/lib/device-registration` (not the barrel) to avoid an import cycle auth → devices → more → auth.
- Registering with a different user on the same phone moves the token server-side (07 §4.2); an offline sign-out leaves the old row until that happens or Expo reports the token dead.
- Device label is the phone MODEL (`Device.modelName`), never the owner's device name.
- Patient pushes are ignored by the router until M3-07 (patient registers its own token then).

---
## M1-17 — Staff Google sign-in (BE + MOB)  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-17-staff-google-3ed844 (from mobile/develop)   Status set to: review

### Done
- **Backend:** `GoogleIdentityService.clientAudiences` (web + `GOOGLE_ANDROID_CLIENT_ID` + `GOOGLE_IOS_CLIENT_ID`; `patientAudiences` now returns it). Staff `POST /auth/google` (`GoogleAuthService.signIn`) verifies against that list. Everything else unchanged: `verify()` without audiences stays web-only (register, join-request, link, desktop hand-off), Workspace/"Google only"/gate rules and the no-account outcome are untouched. Native refresh token already works: `issueLogin` returns `refreshToken` in the body for `x-client-type: mobile` (no Origin). Specs: `google-auth.service.spec.ts` (audiences, signed_in, no_account never creates a user), identity spec (audience list).
- **Mobile:** `src/core/auth/google.ts` adapter (`isNativeGoogleAvailable()`, `getGoogleIdToken(webClientId, iosClientId?)` → token or null on cancel). The library is `require`d lazily inside try/catch, so the app builds/runs before the package is installed and the button simply stays hidden. `useGoogleSignIn` (staff auth feature): shown only when the library is present AND `GET /auth/google/config` says enabled; `POST /auth/google`; `signed_in` → `persistSession` (root guards go to location selection); `no_account` → "Register your clinic on the web, or ask your clinic owner for an invite link."; `link_required` → server message; an error from the call itself (e.g. 403, 503 not configured) → the server message through `apiErrorMessage`. Clinic sign-in policy (Google only / disabled / domain / pending) is enforced at location selection via `signInBlock`, not as a 403 from `POST /auth/google`. "Continue with Google" outline button on `LoginPage`. Tokens unchanged: access in memory, refresh in SecureStore via `persistSession`.
- `env.googleIosClientId` reads `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (public id, optional on Android-only builds).

### Install commands for the user
```
cd mobile-app
npx expo install @react-native-google-signin/google-signin
```
Then add this to `plugins` in `app.config.ts` (NOT added: the config plugin needs the package at prebuild, and `iosUrlScheme` is required when not using Firebase):
```
['@react-native-google-signin/google-signin', { iosUrlScheme: 'com.googleusercontent.apps.<IOS_CLIENT_ID_PREFIX>' }]
```
Then a new development build (`npx expo run:android` / `run:ios`; not Expo Go). No `google-services.json` is needed (no Firebase). Source: library's Expo setup + "original" API docs (`configure({ webClientId, iosClientId })`, `signIn()` → `{ type: 'success' | 'cancelled', data.idToken }`).

### Needs the user (Google Cloud console + env)
1. Create an **Android** OAuth client (package `com.placeholder.clinicapp[.dev|.preview]`, SHA-1 of the debug/EAS keystore) and an **iOS** OAuth client (bundle id). Android needs no id in the app; iOS id goes in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and the plugin's `iosUrlScheme`.
2. Backend env: `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` (and the existing `GOOGLE_CLIENT_ID` web id; the app uses it as `webClientId`, so tokens are minted for it).
3. Device test (gate M0-D): Google-only clinic sign-in, no-account message, cancel, a clinic whose policy blocks Google shows its `signInBlock` message at location selection.

### Verification
See the report: backend specs, build and mobile typecheck/lint/fences/jest results.

### Deviations
- App config plugin left in HANDOFF (see above). Link/unlink and register/join stay web-only.


---
## M2-08 — Patient read services (BE)  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m2-08-patient-reads-d759cf (from mobile/develop)   Status set to: in-progress

### Plan (written before coding)
1. Module `src/patient-app/reads/` inside `PatientAppModule`: `PatientReadsController` (`GET /patient-api/appointments | visits | prescriptions | prescriptions/:id | billing/summary`), `PatientReadsService`, `PatientClinicsService`, pure mappers + DTO interfaces, `PatientAccessLogService`.
2. Scope: `PatientClinicsService.visibleContext(ctx)` loads the clinics of the account's links (name, approval, is_active, currency, theme logo/brand, `patient_app.show_*`). Approved clinics only (A-19: pending/rejected → no records); `is_active = false` → kept, `clinicStatus: 'suspended'`. The result is a *filtered* `PatientContext`; every query then goes through `linkedPatientWhere()` with it (no id from URL/query is trusted; `profileId` goes through `assertProfile`).
3. Visibility rules (07 §3) live in pure functions (`visibility.ts`): prescriptions = FINALIZED/AMENDED + `signed_at`; billing only when the clinic's `show_billing`; diagnosis/treatments only when `show_diagnosis`; cancelled invoices never shown.
4. DTOs are explicit-allowlist mappers from narrow raw rows (SQL selects only the needed columns); snapshot specs prove no extra keys.
5. Times: instants as UTC ISO; visit `date` computed in SQL with `AT TIME ZONE locations.timezone`; each record carries `location.timezone`. Money: decimal columns → `*Minor` via `toMinor`.
6. Access log (`patient_access_log`, table already exists from M2-01 → no schema change): `view_list` per distinct (org, patient) in the result, `view_detail` with resource id; best effort, never fails a read, no PHI in logs.
7. Specs: visibility tables, clinic status, mappers + snapshots, service (mocked query builders), controller metadata; int spec written (not run unless disposable local Postgres).

### Done (M2-08)
- `backend/src/patient-app/reads/`: `PatientReadsController` (`GET /patient-api/appointments | visits | prescriptions | prescriptions/:id | billing/summary`), `PatientReadsService`, `PatientClinicsService` (clinic status + `patient_app.show_billing/show_diagnosis` per org), `PatientAccessLogService`, pure `visibility.ts` + `patient-reads.mappers.ts`, query DTOs. Registered in `PatientAppModule`.
- Scope: every query uses `linkedPatientWhere()` over the visible context (approved clinics only). A-19: pending/rejected clinic = nothing; `organizations.is_active = false` = readable with `clinicStatus: 'suspended'`. `profileId` goes through `assertProfile` (404); unknown/unlinked ids → 404 `NOT_FOUND`.
- Visibility (07 §3): prescriptions FINALIZED/AMENDED + `signed_at`; billing only for `show_billing` clinics, cancelled invoices never; `diagnosis`/`treatments` keys absent when `show_diagnosis` is off. Money → `*Minor`; visit date on the location's clock in SQL.
- Access log: `view_list` (one row per distinct clinic patient) / `view_detail` (resource id); best effort, warning carries no ids. No schema change (table from M2-01).
- 07 §6.4 documents the as-built behaviour.

### Verification
- jest `src/patient-app`: 9 suites / 108 tests green (incl. DTO allow-list tests with polluted rows, visibility tables, clinic-status, scoping with a recording query-builder double). Full backend unit suite: 103 suites / 1064 tests green.
- `tsc --noEmit`: 4 errors, none in `src/` and none from this card (`nestjs-cli/` templates need mongoose; `test/labs/access.int-spec.ts` type mismatch). `nest build` not run separately.
- NOT RUN: the SQL against Postgres — no local Postgres here, no integration spec written. The raw selects/joins (`AT TIME ZONE`, `json_agg`, `COALESCE(ap.doctor_id, qs.doctor_id)`) are unproven; run a smoke on a disposable local DB before relying on them.

### Deviations / notes
- `canConfirm: false`, `patientConfirmedAt: null` until M3-08 (no column). `location.whatsapp: null` (no column).
- `ClinicRef` gained `clinicStatus`; invoices gained `profileId`.
- Visit `doctorName` = appointment doctor, else the queue session's doctor (encounters have no doctor column).
- Did not touch `src/patient-links` or `PatientLinkGuard` (A-19 filtering is in the read layer). A later card may move it into the guard.

### Questions for architect
- "Suspended" = `organizations.is_active = false` — confirm that is the intended flag.

---
## Rework M2-08 #1 — 2026-11-15
Branch: `claude/m2-08-patient-reads-d759cf` · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | PDF URL public + prints diagnosis | `pdfUrl` removed from the detail DTO (and from the SQL select). `hasPdf` = clinic `show_diagnosis` on. New `GET /patient-api/prescriptions/:id/pdf`: same scoped lookup (`findPrescription`), 404 when `show_diagnosis` is off, access-log `download`, then `PrescriptionPdfService.generatePdfBuffer` streamed through the API with `private, no-store` (the stored row has only the public URL, not the storage key, so a signed URL was not possible; rendering per request avoids any reusable link). `PrescriptionPdfService` is now exported from `PrescriptionsModule` (one-line change) and `PatientAppModule` imports that module. DTO tests assert no `pdfUrl` even when the row carries one. |
| 2 | Unfinished visits | Visits `INNER JOIN queue_entries ... AND status = 'completed'`. Signal chosen: the queue entry's `completed` status (set by the doctor's Complete action); encounters have no completion column. Spec asserts the join condition on both visit queries. |
| 3 | Global 400-invoice cap | One totals query + one list query (limit 50) per clinic, in parallel. |
| 4 | Overdue timezone | Invoice rows select `l.timezone`; `clock.today(thatTimezone)` per invoice. Spec checks the tz passed. |
| 5 | `page` max | `@Max(10000)`. |
| 6 | Profile label | With a `profileId` filter rows are labelled with that id directly (spec with two profiles on one patient). |

Verification: see the final lines below. Still NOT run: SQL against Postgres (no local DB); the PDF endpoint was not exercised end to end (no real renderer in unit specs; the service is mocked).

Verification (rework 1): `tsc --noEmit` no errors under `src/` (the 4 pre-existing non-src errors remain) - jest `src/patient-app` + `src/prescriptions`: 11 suites / 134 tests green - full backend unit suite: 103 suites / 1070 tests green.

---
## Rework M1-17 #1 — 2026-11-15
Branch: `claude/m1-17-staff-google-3ed844` (on mobile/develop) · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Config says disabled but native ids accept tokens | `GoogleAuthService.signIn` throws 503 "Google sign-in is not configured on this server." when `GOOGLE_CLIENT_ID` (the web id, the on/off switch) is unset, before any verification, even with Android/iOS ids set. Spec added. |
| 2 | `/auth/google` 401 triggered auto-refresh | `staff/lib/api.ts` skips refresh/retry for `/auth/google` like `/auth/login`. Test in `api.test.ts`. |
| 3 | Wording | HANDOFF text and the hook test name now say clinic sign-in policy is enforced at location selection via `signInBlock`, not as a 403 from `POST /auth/google`. |

Verification: backend build ✓ · `jest src/auth` 7 suites / 42 tests ✓ · mobile typecheck clean · lint 0 errors (4 old warnings) · `lint:fences` ✓ · full jest 93 suites / 707 tests ✓. No device.

---
## M2-04 — Patient links + claim API  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m2-04-patient-links-46d50e (from mobile/develop)   Status set to: review (when finished)

### Plan (written before coding)
**Endpoints** (module `src/patient-links/`)
- Staff (`@PatientInScope('patientId')`): `POST /patients/:patientId/app-link/claim-token` (`@Can('patients.app_link.manage')`) → `{ token, url, expiresAt }`; `GET /patients/:patientId/app-link` (`@Can('patients.view')`) → status; `DELETE /patients/:patientId/app-link` (`@Can('patients.app_link.manage')`, body `{ reason? ≤200 }`) → `{ revoked: true }`.
- Patient (`@PatientApi()`): `GET /patient-api/claims/:token` (preview, read-only) and `POST /patient-api/claims/:token/accept` `{ relation, profileId?, newProfileName?, confirm: true }` → `{ link, profile }`.
**Token:** 32 random bytes, base64url (43 chars); only sha256 hex stored in `patient_claim_tokens.token_hash`. Valid 30 min (`CLAIM_TOKEN_TTL_MINUTES`), single use (`used_at`), a new token sets `invalidated_at` on older unused ones of the same patient. Raw token is returned only by the create call and never logged/audited. Unknown / used / invalidated / expired → one error `404 CLAIM_INVALID`.
**Tables:** no schema change (all four tables exist from M2-01): `patient_claim_tokens`, `patient_record_links`, `patient_profiles`, `patient_account_consents` (kind `link`), `patient_access_log` (action `link`/`unlink`), `audit_logs` (entity `patient_app_link`, subject = patient), `outbox`.
**Rules:** A-19: org `approval_status` ≠ approved → claim/preview = `CLAIM_INVALID`; org `is_active=false` (suspended) → `403 CLINIC_SUSPENDED` for create/preview/accept (revoke still allowed); feature `patient_app` off → `403 PATIENT_APP_DISABLED`. Accept runs in one transaction (token row `FOR UPDATE`); one active link per clinic patient (partial unique index) → `409 ALREADY_LINKED`; same account re-scanning its own link is idempotent.
**Events:** `patient.record_linked` / `patient.link_revoked` are written as a realtime outbox row to topic `patient:<accountId>` (`{ type: 'feed.changed', kinds: ['links'], event, linkId }`, 07 §7) in the same transaction. The patient push/email delivery itself is not built (patient audience has no channel yet — M3-07), so the notification catalog is untouched.
**Rate limits:** claim preview/accept 30 / 15 min per IP; staff token creation 30 / 10 min per IP.

### Done
- `src/patient-links/`: `claim-token.ts` (token/hash/mask/age-band helpers), `ClaimEligibilityService` (A-19 + `patient_app` feature), `PatientLinksService` + `PatientLinksController` (staff create / status / revoke), `ClaimsService` (preview + accept in one transaction, token row `FOR UPDATE`), `patient-link-events.ts` (outbox rows). `src/patient-app/claims.controller.ts` (`@PatientApi`, so the fence spec stays true). `PatientAppModule` imports `PatientLinksModule`.
- Contract details and error codes: 07 §4.1 / §6.2 / §8 (updated).

### Files
Created: everything under `src/patient-links/` except the two M2-01 files (module rewritten), `src/patient-app/claims.controller.ts`, `test/patient/patient-claims.int-spec.ts`, 2 unit specs. Modified: `patient-app.module.ts`, `app.module.ts` (comment), docs 07 / PROGRESS / HANDOFF. No schema, no catalog change (so no `access:export`).

### Install commands for the user
none.

### Verification
- `tsc --noEmit`: clean for all new/changed files (pre-existing errors only: `nestjs-cli/` templates, `test/labs/access.int-spec.ts`).
- ESLint on the new files: clean (with prettier `endOfLine: auto`; the checkout's CRLF working copies make every file fail the default rule, not related to this card).
- Jest (`-i`; workers cannot spawn here): `src/patient-links` + `src/patient-app` 8 suites / 76 tests green. Full backend unit suite (`jest -i`): 102 suites / 1032 tests green.
- **NOT RUN: `test/patient/patient-claims.int-spec.ts`** — no local Postgres in this environment (it compiles and lints). First real run belongs on a disposable DB (`npm run test:int:patient`). It exercises: create → preview (masked) → accept → status → single-use → revoke → re-link; newest-token-wins; expiry; dependent profile + `NAME_REQUIRED`; `ALREADY_LINKED` race; A-19 pending/suspended; cross-clinic patient 404. Staff side is driven through the controller methods (guards not exercised).

### Deviations / decisions to review
- Patient push/email for `patient.record_linked` / `link_revoked` is NOT built (no patient channel; catalog + its spec untouched). Events go to the realtime outbox only → M3-07.
- Token TTL 30 min is my choice (card gave none).
- `LocationRef.whatsapp` is always `null` (locations have no WhatsApp column).
- Clinic logo/brand colour are read from `config_values` (`theme.*`), default brand `#2563eb`.
- Patient-side audit row uses actor side `system` with `userId: null` (ids of account/profile in `changes.after`).

---
## Rework M2-04 #1 — 2026-11-15
Branch: claude/m2-04-patient-links-46d50e · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | `dob` came back as a JS Date | Every dob the claim code reads is cast `::text` (claim lookup `p.dob::text AS patient_dob`; profile selects and `RETURNING` use `dob::text AS dob`). `claims.service.spec.ts`: text dob → `ageBand '18-39'`; asserts the cast is in the SQL; a Date-typed row would not band (documents the failure). Int-spec expectations (`18-39`, `0-12`) unchanged. |
| 2 | TTL | `CLAIM_TOKEN_TTL_MINUTES = 15`; docs/07 says 15 min. (The plan section above says 30; superseded.) |
| 3 | Tokens in logs | `maskTokens` (now exported) also masks `/patient-api/claims/<token>[/accept]` and `/c/<token>`, `/v/<token>`; `mask-tokens.spec.ts`. The handler logs `maskTokens(request.url)` for every status, so 403/409 on the claim routes log the masked path. |
| 4 | Revoke with `patient_app` off | The M2-03 context does NOT hide links when the feature is off: `PatientLinkGuard` keeps active/frozen links and only sets `patientAppEnabled=false` (read-only for the patient). On the staff side `patients.app_link.manage` belongs to feature `patient_app`, so `AccessResolver` drops it while the feature is inactive and `@Can` refuses revoke (403) — the clinic must re-enable the feature first. **Left as is**: a revoke that bypasses the feature needs an access-layer exception (a permission not tied to the feature, or a resolver carve-out) which is outside this card. Follow-up for the architect: decide whether `patients.app_link.manage` revoke should survive a disabled feature. |
| 5 | Re-accept status | Idempotent re-accept returns the existing link's real status (`active` or `frozen`). |
| 6 | `createdByUserId ?? ''` | `createClaimToken` throws 401 when the actor has no user id. |
| 7 | Patient row lock | `createClaimToken` locks the patient row (`SELECT … FOR UPDATE`, also checks org / active / not deleted) before invalidating old tokens. |

Verification: tsc clean for changed files · changed specs green · full backend unit suite (`jest -i`): 104 suites / 1038 tests green · int spec still NOT RUN (no local Postgres).

---
## M2-06 — Patient space foundation  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m2-06-patient-space-982123   Status set to: review

### Plan (written before coding)
1. `core/http/create-api-client.ts`: `createApiClient` (request hook, 403 hook, 401 → refresh → retry once) + `createSingleFlight`; staff `api.ts` rebuilt on it, behaviour and `api.test.ts` unchanged. `extractErrorCode` shared.
2. `core/i18n` (team-lead decision, DECISIONS A-21): typed `en`/`ur` catalogs, `t(key, params)`, locale from expo-localization + prefs override, RTL flag, `useT()`.
3. `core/space`: refresh-token key constants, `leaveSpaceAfterSignOut(current)` (go to the other space when it has a stored session, else welcome). No cross-space import.
4. Patient: `lib/api.ts` (factory; NO tenant headers, `x-patient-refresh-token`, single-flight `refreshSession`), `lib/session.ts`, `store/usePatientAuthStore`, `lib/persist-cache` wipe (patient only), `resolve-patient-route`, `useRestorePatientSession`, `PatientProviders` (own QueryClient + persist), `PatientLayout` guards, sign-in + verify-code screens (TanStack Form + Zod, `/patient-auth/email/start|verify`), name step when `needsName` (PATCH `/patient-api/me`), sign-out (wipe patient only), Google slot hidden.
5. Staff: `StaffLayout` skips restore when already `signedIn` (M0-04 MUST); staff sign-out returns to patient space when it has a session; patient home has "switch to clinic staff".
6. Tests: single-flight refresh (parallel 401s + restore racing a 401), restore states, sign-out wipe isolation, space switching, route resolver, i18n, factory.

### Done
- `core/http/create-api-client.ts`: `createApiClient` (request hook, 403 hook, 401 → one refresh → retry once), `createSingleFlight`, `extractErrorCode`. Staff `lib/api.ts` rebuilt on it; behaviour and `api.test.ts` unchanged and green.
- `core/i18n` (A-21): typed `en`/`ur` catalogs (`ur` copies English with `// TODO(ur)` where untranslated), `t`, `useT`, `setLocale` (prefs `patient.language`), `isRtl`. Tests: lookup, interpolation, fallback to `en`, override, key parity.
- `core/space`: `session-keys.ts`, `leaveSpaceAfterSignOut`, `hasSavedSession`. Signing out of a space goes to the other space when its refresh token is still in SecureStore, else welcome — no cross-space import.
- Patient space: `lib/api.ts` (`patientApi`, NO tenant headers, `x-patient-refresh-token`, **single-flight** `refreshSession` shared by restore and the 401 interceptor; 401/403 on refresh = wipe patient cache + drop token; network error = keep session, never auto-retry), `session.ts`, `usePatientAuthStore`, `persist*` (empty allow-list, wipe seals persisters), `patientQueryClient`, `PatientProviders`, `resolvePatientRoute`, `PatientLayout` guards (offline / sign-in / verify-code / name / main), `useRestorePatientSession` (skips when already `signedIn`).
- P-00: `SignInPage` → `POST /patient-auth/email/start`; the pending email lives in the store (never in a URL), the guard then shows `VerifyCodePage` (`email/verify`, terms/privacy `1.0`, 60 s resend, generic wrong-code message); `NamePage` when `needsName` (`PATCH /patient-api/me`). Google slot is an empty component (A-20).
- Patient home (`PatientPlaceholderPage`): signed-in-as, **Switch to clinic staff**, **Sign out** (confirm → `signOutPatient`: server logout best effort, drop token, wipe patient encrypted cache + key, clear patient queries, leave space).
- MUST 2: `useRestoreStaffSession` returns early when `signedIn` (StaffLayout calls it); tested. Staff sign-out now uses `leaveSpaceAfterSignOut('staff')`.
- Routes: `(patient)/{sign-in,verify-code,name,offline}.tsx`, `(patient)/(main)/{_layout,index}.tsx`; `EntryRedirect` sends patient to `/sign-in` (guards pick the screen).

### Files
- Created: `src/core/http/create-api-client{,.test}.ts`, `src/core/i18n/*`, `src/core/space/{session-keys,switch-space.test}.ts`, `src/patient/{lib,store,providers,features/auth,navigation/{PatientMainLayout,resolve-patient-route}}/…`, `src/app/(patient)/{sign-in,verify-code,name,offline}.tsx`, `src/app/(patient)/(main)/_layout.tsx`, `src/shell/space-isolation.test.ts`, `src/staff/features/auth/hooks/useRestoreStaffSession.test.ts`.
- Modified: `src/staff/lib/{api,session}.ts`, staff `useSignOut{,.test}`, `useRestoreStaffSession`, `core/http/index.ts`, `core/space/switch-space.ts`, patient `index.ts`/layout/placeholder, `EntryRedirect`, DECISIONS (A-21), PROGRESS.
- Moved: `src/app/(patient)/index.tsx` → `(patient)/(main)/index.tsx`.

### Install commands for the user
none (i18n is in-house, A-21).

### Verification
- `tsc --noEmit` clean · eslint 0 errors (3 pre-existing warnings: `api-error.ts`, `skeleton.tsx`, `useToday.test.tsx`) · `lint:fences` ok · full jest 99 suites / 736 tests green (`-i --forceExit`).
- Tests added: patient single-flight (parallel 401s, restore racing a 401, rotated token reuse, reject = sign-out, network error keeps session, no refresh on `/patient-auth/*`, no tenant headers), restore states (patient + staff skip), route resolver, factory, i18n, space switching, sign-out isolation (patient wiped; staff token/cache/queries intact; lands in staff or welcome).
- NO DEVICE: sign-in/verify/name screens, split-view of both spaces, `oneTimeCode` autofill, keyboard behaviour — wait on gate M0-D.

### Acceptance criteria
- [x] sign-out of patient wipes only patient data (isolation test)
- [x] both spaces signed in at once (separate stores, tokens, caches; switching never signs out)
- [ ] on-device check (gate M0-D)

### Deviations / notes for the architect
- Code input is one styled input (not 6 boxes) — visual boxes can follow.
- Added a `name` route (`needsName` step); docs/02 route tree has no such screen yet.
- Resolver also returns `verify-code` from `awaitingCode` (pending email in memory), so no router call is needed to move between the two auth screens.
- Known server-side limit: a refresh whose response is lost (timeout after the server rotated) leaves the old token stored; the next refresh then looks like replay and the backend revokes the session. Needs a short server grace window or client-side retry design — not solved here.
- `LINK_REVOKED` only invalidates `['links']` (no links query exists yet). Push-device unregister joins sign-out with M3-07.
- Shell test mocks `PatientLayout` (Jest cannot load the router/native runtime); `patient/index.ts` also exports `signOutPatient` and `patientQueryClient` for the shell.

---
## Rework M2-06 #1 — 2026-11-15
Branch: `claude/m2-06-patient-space-982123` · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Sign-out races a refresh in flight | `core/http` `createRefreshCoordinator` (per-space session generation + `signingOut` flag): `beginSignOut()` invalidates and WAITS for the refresh in flight, `endSignOut()` after the local drop. `doRefresh` checks `guard.isCurrent()` before storing; a stale result is discarded and the freshly rotated token is revoked on the server (`/patient-auth/logout`, `/auth/logout`). Wired into `signOutPatient` and staff `useSignOut` (order: begin → server logout → dropSession → end). Tests for BOTH spaces: refresh in flight → sign-out → refresh resolves → signed out, SecureStore empty, rotated token revoked; a refresh started between begin and end is discarded; refresh works again after. |
| 2 | `LINK_REVOKED` not a backend code | Replaced by `PATIENT_APP_DISABLED` (403 for frozen links / clinic app off, `patient-context.ts`); revoked links answer 404 `NOT_FOUND`, which needs no special handling. |
| 3 | Cache handle after wipe | `PatientProviders` drops the handle when the account becomes null after having been set, and reopens (fresh key + instance) when the next `accountId` arrives; the cache key is never re-created while signed out. |
| 4 | OfflinePage | "Switch to staff" (only when a staff session is saved) and "Sign out" next to Retry; Retry label is now translated. |
| 5 | Nits | `t('home.greeting', { name })` (en + ur); email trimmed in the Zod schema (`z.string().trim().pipe(z.email())`). |
| 6 | Note for M0-D | Both spaces have an `/offline` route (`(staff)/offline`, `(patient)/offline`): check the device run for a duplicate-route warning. |

Verification: `tsc --noEmit` clean · eslint 0 errors (pre-existing warnings only) · `lint:fences` ok · full jest 101 suites / 741 tests green (`-i --forceExit`). No device.

---
## Rework M1-05 #1 — 2026-11-15
Branch: `mobile/M1-05-push` (merged `mobile/develop`; conflicts in `useSignOut.ts/.test.tsx` and HANDOFF resolved) · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Cold tap overwritten by StaffTabs' first-tab jump | `decidePushRoute` waits until `useAccess().status === 'ready'` (`accessReady` in its context). `usePushRouteStore` has a `handled` flag (set by `consume()` when the tap navigates or asks); `StaffTabs` calls `takePushRouteHandled()` once access is ready and skips `router.replace(first tab)` when a tap is pending or was handled. Test `StaffTabs.push.test.tsx` mounts both together (tap wins; without a tap the tabs still open on Queue). |
| 2 | Sign-out can freeze | `DELETE /me/devices` has a 4 s timeout and is skipped when `isOnlineNow()` is false (token kept for the next sign-out). Tests for the offline skip + retry. |
| 3 | Deprecated async APIs | `tap-events.ts` uses sync `getLastNotificationResponse()` / `clearLastNotificationResponse()` (try/catch for no native module); `jest.setup.ts` mock updated. |
| 4 | Other clinic without `locationId` dropped | Switch prompt now targets that clinic's primary / first location. Test. |
| 5 | Barrels | `useSignOut` imports `unregisterThisDevice` from `@/staff/features/devices`; `useSwitchLocation` is exported from the `more` barrel and used by `PushRoutePrompt`. `src/staff/index.ts` takes the two handlers from `devices/lib/handle-staff-notification-route` (not the barrel) so the real `@/staff` barrel stays free of UI/native imports (space-isolation test loads it). |
| 6 | Setup | `expo-notifications` config plugin added to `app.config.ts` (icon = `android-icon-monochrome.png` placeholder, colour = platform blue); no new package. |

### User steps before a real push token exists (gate M0-D)
1. Create the EAS project (`eas init`) and put its id in `EAS_PROJECT_ID` in `app.config.ts` (empty now → `getExpoPushToken()` returns null, no registration).
2. FCM: create a Firebase project, add the Android app, upload the FCM V1 service-account key to EAS (`eas credentials`); add `google-services.json` per the Expo push setup. iOS needs APNs keys via EAS.
3. Rebuild the dev build (the config plugin changes native config).
4. Replace the notification icon with the brand's white-on-transparent glyph when it exists.

Verification: typecheck clean · eslint 0 errors (3 old warnings) · `lint:fences` ok · full jest 110 suites / 808 tests green. No device.

---
## M2-10 + M2-11 — Profiles, Family tab, linked clinics, unlink, delete account  ·  2026-11-15  ·  Sonnet 5.5
Branch: `claude/m2-10-family-clinics-5e4548` (worktree branch off `mobile/develop`)   Commit(s): see `git log -1`   Status set to: review

### Plan (written first)
**Endpoints** (all `@PatientApi()`; account = `ctx.accountId`, ids checked against the account's own rows; wrapped in `ResponseWrapper`):

| Method + path | Body | Response | Rules |
| --- | --- | --- | --- |
| GET `/patient-api/profiles` | — | `Profile[]` `{ id, relation, fullName, dob, gender, isSelf, links: { id, clinic, location, status, linkedAt }[] }` | self first, then oldest first; links = active + frozen; never-approved clinics hidden (A-19) |
| POST `/patient-api/profiles` | `{ relation: child\|parent\|spouse\|other, fullName 1–150, dob? (YYYY-MM-DD real, not future), gender? }` | `Profile` (201) | `self` refused; max 20 profiles per account (`409 TOO_MANY_PROFILES`) |
| PATCH `/patient-api/profiles/:id` | `{ relation?, fullName?, dob?: string\|null, gender?: …\|null }` | `Profile` | `null` clears dob/gender; self keeps its relation (`400 SELF_RELATION_FIXED`); foreign id → 404 |
| DELETE `/patient-api/profiles/:id` | — | `{ removed: true }` | self → `400 CANNOT_REMOVE_SELF`; a profile with an active/frozen link → `409 PROFILE_HAS_LINKS` (unlink first, so the clinic audit trail of the unlink exists) |
| GET `/patient-api/links` | — | `PatientLink[]` `{ id, profileId, clinic, location, status: active\|frozen\|revoked, linkedAt, linkMethod, linkedByLabel, revokedAt, revokedBy }` | live links first, then revoked (history); max 200; never-approved clinics hidden |
| DELETE `/patient-api/links/:id` | — | `{ revoked: true }` | patient-side revoke, allowed for frozen links / app-disabled clinics; not-own or already revoked → 404 |
| GET `/patient-api/links/:id/history` | — | `{ at, action: linked\|unlinked_by_you\|revoked_by_clinic\|revoked_by_system, label }[]` newest first | derived from the link row (linked, revoked) |
| DELETE `/patient-api/me` | `{ confirm: 'DELETE' }` | `{ deleted: true }` | rate limit 5 / 15 min; one transaction (below) |

**Unlink** (`PatientAccountLinksService.unlink`, shared `revokeLinkByPatient`): lock link `FOR UPDATE` joined to the account's profiles → `status='revoked', revoked_by_type='patient', revoked_by_id=<account>` → `patient_access_log` (`unlink`) → clinic-visible `audit_logs` row (`patient_app_link`, subject = clinic patient, `{status→revoked, revokedBy:'patient'}`) → realtime outbox `patient.link_revoked` (M2-04's `publishPatientLinkEvent`). All in one transaction. The clinic can issue a new claim token for that record right after.

**Delete account** (`PatientAccountService`, one transaction): lock account (a second delete → 404) → revoke every active/frozen link exactly like an unlink (audit + access log + event per link, reason `account_deleted`) → delete profiles (links cascade) → **delete `patient_account_identities`** (M2-02 review #5) and `patient_login_codes` of the email → revoke all `patient_sessions` → null the IP of `patient_account_consents` (rows stay as the legal record) → soft-delete the account (`status='deleted'`, `deleted_at`, name/phone/email stripped, email becomes `deleted+<id>@deleted.invalid`) → platform audit row (`patient_account`, ids and link count only). `patient_access_log` keeps the account id only. Reminders / dose history tables do not exist yet (M3): they hang off profiles and will cascade.

**Tables:** none added or changed (no schema change, so no `database/schema` or `changes/` script). Re-sign-up works because the unique email index is partial on `deleted_at IS NULL` and the identities are gone.

**Mobile:** `src/patient/features/{profiles,clinics,account}`; shared `src/patient/lib/clinic-types.ts`. Routes: `(main)/(tabs)/family.tsx` (P-04), `(main)/profiles/[profileId].tsx`, `(main)/clinics/index.tsx` (P-08), `(main)/account/delete.tsx` (P-09).

### Done
- Backend `src/patient-app/{profiles,links,account}` + `DELETE /patient-api/me` on the existing me controller; module wiring; unit spec (DTOs, guards, delete SQL order/audit) + int spec `test/patient/profiles-account.int-spec.ts`.
- Mobile: Family tab page (loading / empty / error / list, add via bottom-sheet form), profile detail (own data, linked clinics per profile, edit sheet, remove with confirm; remove is disabled while links exist), Linked clinics page (live links + history, unlink with destructive confirm, per-link history), Delete account page (what goes / what stays, type DELETE, then a second destructive confirm, then the sign-out wipe of token + encrypted cache + query cache).
- Forms: TanStack Form + Zod validators, `FormSheet`, submit disabled on `!canSubmit || isSubmitting`; dirty guard.
- All strings through `useT` (en + ur; ur copy still English with `TODO(ur)` where not translated). Dates of a link are shown on the clinic location's clock (`formatInZone`).
- Doc 07 §6.2 updated "as built".

### Files
- Backend created: `src/patient-app/profiles/{patient-profiles.controller,.service,.dto,.spec}.ts`, `src/patient-app/links/{patient-links.controller,patient-account-links.service,patient-links.dto}.ts`, `src/patient-app/account/{patient-account.service,delete-account.dto}.ts`, `test/patient/profiles-account.int-spec.ts`.
- Backend modified: `src/patient-app/me.controller.ts`, `src/patient-app/patient-app.module.ts`, `src/patient-auth/patient-auth.controller.spec.ts` (me controller now has 3 handlers).
- Mobile created: the three feature folders, `src/patient/lib/clinic-types.ts`, 4 route files under `src/app/(patient)/(main)/`.
- Mobile modified: `src/core/i18n/{en,ur}.ts` (blocks `relation`, `gender`, `family`, `clinics`, `account`, inserted before `offline`), `src/patient/navigation/PatientPlaceholderPage.tsx` (entry buttons).
## M2-09 — Patient Records tab  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m2-09-records-ff83ad (from mobile/develop)   Status set to: review

### Done
- Data layer `src/patient/features/records/{api,hooks,types,lib}`: `/patient-api/appointments` (not paged, max 300), `visits` and `prescriptions` (paged, limit 20, infinite query), `prescriptions/:id`, `billing/summary`; checked against `backend/src/patient-app/reads/*` (query `profileId`, `from`, `to`, `page`, `limit`). All keys carry the account id (`['records-<kind>', accountId, profileId]`). Only `records-appointments` and `records-prescriptions` are persisted (encrypted patient cache, `patient/lib/persist.ts`); visits, details and bills are online-only.
- P-03 `RecordsPage`: segments Appointments · Visits · Prescriptions · Bills (Bills hidden once billing is known to be empty), debounced search over clinic / place / doctor / diagnosis / number, each segment with loading skeleton, empty, error + retry, no-results (search active) and pull-to-refresh. Clinic chip on every record (accent stripe from `brandColor`, only if valid hex; a calm "This clinic is paused" chip for `clinicStatus: 'suspended'`, record still readable, A-19).
- Detail screens: `appointments/[id]` (time on the record's clock, clinic, doctor, status, Call clinic via `tel:`, Directions via maps search link — only when the location has phone / address) and `prescriptions/[id]` (medicines with Urdu name / instructions, dose, how often, timing + meal relation, duration).
- Times: instants through `formatInZone(v, location.timezone, …)`, visit / follow-up dates as calendar dates; money as `*Minor / 100` with the clinic currency.
- i18n: `records.*` in `en` + `ur` (`TODO(ur)` where untranslated).
- Routes (zero logic): `(patient)/(main)/(tabs)/records.tsx`, `prescriptions/[id].tsx`, `appointments/[id].tsx`. **The patient tab layout did not exist**, so I created a minimal `PatientTabs` (Home + Records) at `(main)/(tabs)/_layout.tsx` and moved the placeholder home to `(main)/(tabs)/index.tsx` (git mv). M2-10 / M2-07 add their tabs / screens to `PatientTabs` (`patient/navigation/PatientTabs.tsx`).

### NOT done — needs the user / a later card
1. **Prescription PDF (share / open):** needs packages that are not installed. Install, then add a "Share PDF" button (only when `hasPdf`) that downloads `GET /patient-api/prescriptions/:id/pdf` with the bearer header (no token in a URL) to the cache directory and shares it:
   ```bash
   npx expo install expo-file-system expo-sharing
   ```
2. **Profile filter chips:** the hooks already take `profileId`, but the profiles list endpoint and `profiles` feature belong to M2-10; the chip row joins once that exists (pass the selected id into the `useRecord*` hooks).
3. Appointment **Confirm** button: `canConfirm` is always false until M3-08.
4. Prescription search by medicine name (docs/06): the list DTO has only `medicinesCount`, so search runs over clinic / doctor / number. Needs medicine names in the list DTO if wanted.

### Deviations / notes for the architect
- Invoices carry no timezone: the bill date is the UTC calendar day of `issuedAt` (could be one day off near midnight). A `timezone` on `PatientInvoiceDto` would fix it.
- Appointment detail reads from the appointments list cache (no single-appointment endpoint).
- Clinic accent colour is applied through `style` from the API value (validated `#rrggbb`); all other colours are theme tokens.
- Files touched outside the feature: `core/i18n/{en,ur}.ts`, `patient/lib/persist.ts` (two roots), `patient/navigation/{index,PatientTabs}`, `app/(patient)/(main)/*`.

### Verification
typecheck clean · lint 0 errors (3 old warnings) · `lint:fences` ok · jest: new `records-format.test.ts` (11) + `RecordsPage.test.tsx` (7: loading→data on clinic clock + chip, empty, error→retry, no-results, paused clinic, Bills hidden, detail navigation). No device.


## M1-16 + M1-06b — Staff hardening pass (code half) and offline cold start  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m1-16-staff-hardening-8f8db8 (from mobile/develop)   Commit(s): see git log   Status set to: review

### Done
- All carried-over nits except the Jest open handle (see below): patient-detail pull-to-refresh invalidates children + queue visits; Rx "Showing latest N of TOTAL"; WhatsApp country code (from clinic currency); `ReadOnlySheet` in core used by RxSegment / TicketSheet / AppointmentSheet; `QueueTabPage` tests; Mark-all disabled logic; board waiting minutes tick (`useTickingNow` moved to `queue/hooks`); `formatMoney` 0-or-2 decimals; Queue tab `doctorId` param + Today doctor row passes it.
- Gate checklist walked in code: fixed fixed-height controls that clip at 1.3x (`FormInput`, `SearchBar`, `SelectLocationPage`, reason textarea). Everything else (tokens, logical classes, labels, states, PHI, permissions) was already clean. Details in `docs/reviews/M1-16/report.md`.
- M1-06b: identity hint parsed from the persisted client buster in the ENCRYPTED staff cache (`staff/lib/offline-hint.ts`); loaded only after a network-error restore (no response), never after 401/403 or 5xx; Offline page shows "Open saved data"; snapshot mode (`offlineSnapshot`, no token) refuses non-GET locally and clears on the next real session.

### Files
- Created: `core/components/overlays/ReadOnlySheet.tsx`, `staff/lib/offline-hint.ts`, tests (`QueueTabPage`, `format`, `offline-hint`, `useRestoreStaffSession`), `docs/reviews/M1-16/report.md`.
- Modified: patient detail page/Rx/lib, notifications page, board lane list, Today page, Queue tab, `staff/lib/api.ts`, staff auth store, `OfflinePage`, `useRestoreStaffSession` (in `staff/features/auth`, the M1-17 session was already merged), core inputs.
- Moved: `useTickingNow` (+ test) to `queue/hooks`.

### Install commands for the user
none

### Verification
- Backend: `npm run build` ✓; `jest src/patient-app` 131+ tests ✓; full `jest` run: 1 failure (the me-controller handler count, fixed afterwards and re-run alone ✓) — no other failures. Int spec (`npm run test:int:patient`) is written and compiles but was **not run** (no disposable local Postgres; never touched the shared DB).
- Mobile: `tsc --noEmit` → only the pre-existing `src/app/_layout.tsx` `@/global.css` declaration error (uniwind types are generated by Metro; not from this change); `npm run lint` 0 errors; `lint:fences` ✓; full jest 115 suites / 835 tests ✓; `CI=1 npx expo start --offline` run once after adding routes.
- No device / UI run (gate M0-D).

### Acceptance criteria
- [x] dependents are shown with their links — `GET /profiles` embeds each profile's links; Family card shows the count, detail lists each clinic (int spec: child profile claimed → list shows 1 link).
- [x] delete → re-sign-up is a fresh account — int spec (written, not run): same email signs up again with a new account id, `isNewAccount: true`, no profiles; unit spec proves identities / login codes / sessions SQL.
- [x] unlink audited — audit row + access log + outbox event asserted in the unit/int specs.

### Deviations / notes for the architect
- **No tab layout exists on `mobile/develop`**: I created only my routes. `family.tsx` sits in a `(tabs)` group without a `_layout`; whoever builds the tab bar adds `family` to it. Until then the signed-in placeholder home has buttons to Family, Linked clinics and Delete account (small edit to `PatientPlaceholderPage.tsx`; expect a trivial merge conflict if M2-07/M2-09 edit it too). The same applies to `i18n/en.ts` + `ur.ts` (my keys are one block before `offline`).
- P-04 text says "no self-service dependent creation in MVP", but the card asks for a create endpoint: `POST /profiles` makes the empty profile (no clinic data); linking still needs the clinic's QR claim with `profileId`. The sheet explains this.
- `DELETE /profiles/:id` refuses while links exist (instead of cascading) so each unlink is audited on the clinic side. Removing a profile deletes its revoked-link rows with it (the clinic audit rows stay).
- `GET /links` returns revoked links too (history section). The history endpoint is derived from the link row; `patient_access_log` is not read.
- Unlink invalidates the whole patient query cache (records of that clinic may be cached under keys owned by M2-09).
- Prettier was never run on files I did not write (I had to revert an accidental `prettier --write src/patient-app`); my new backend files are prettier-clean.
- Root-level scratch logs `.be-build.log` / `.be-jest.log` from the backend run were deleted before commit.
- `tsc --noEmit` clean · `expo lint` 0 errors (5 pre-existing warnings) · `lint:fences` ok · full jest 97 suites / 730 tests green.
- NOT done: Jest "worker failed to exit" (cause not found; see report section 4); everything needing a device (list in report section 5).

### Deviations / notes
- Dial code comes from the clinic currency because no country field exists; a backend country/dial code would be better.
- Snapshot mode lacks the org/location objects (timezone, currency) so it falls back to phone timezone / PKR until the next login.


---
## Rework M1-16 #1 — 2026-11-15
Branch: `claude/m1-16-staff-hardening-8f8db8` (merged mobile/develop) · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | api.ts after develop's `createApiClient` | Took develop's file; the read-only guard now lives in `onRequest` and throws (nothing is sent). `/auth/google` in `noRefreshUrls` and the sign-out generation guard kept. `api.test.ts` "refuses writes locally" kept (now expects `READ_ONLY_OFFLINE`). |
| 2 | Restore early-return | `signedIn && !offlineSnapshot`, so saved-data mode retries the refresh. Test added. |
| 3 | Push registration | `usePushRegistration` skips while `offlineSnapshot`, flag in the effect deps. Test added. |
| 4 | Saved-data writes | Distinct code `READ_ONLY_OFFLINE` (core `api-error.ts`), never retried by `isRetryable`, message "Saved data is read-only."; `useCanMutate` is false while on saved data (core flag `core/network/read-only.ts`, set by a store subscription). Tests in `core/http/read-only.test.ts`. |
| 5 | Lane re-select | Queue tab effect also depends on a `lane` nonce param; the Today row sends `lane: String(Date.now())`. |
| 6 | Nits | eslint --fix applied; pull-to-refresh no longer invalidates the `detail` key (it is refetched directly); test asserts it. |

Verification: tsc clean · lint 0 errors (4 warnings) · lint:fences ok · full jest 115 suites / 836 tests green.
---
## M2-07 + M2-15 — Claim flow (patient) and staff "Link app" QR  ·  2026-11-15  ·  Claude Sonnet 5.5
Branch: claude/m2-07-claim-flow-b5aeae (from mobile/develop)   Status set to: review (both rows)

### Done
- **Deep link**: `src/app/claim/[token].tsx` (and `c/[token].tsx` for the web link shape) → `ClaimLinkPage` (patient feature): token shape check → `usePendingClaimStore` (`core/claim`, memory only) → `switchSpace('patient')` → `/`. Bad token → kind "doesn't work" screen. `buildClaimLink(token)` (`core/claim`) = `Linking.createURL('claim/<token>')`, the same scheme for every build variant.
- **Sign-in detour**: patient layout guards unchanged; sign-in page shows "Sign in to link your record." while a token is pending; `PatientMainLayout` redirects to `/claim/confirm` while a token is pending. Sign-out clears the token.
- **Confirm page (P-01)** `features/claims`: preview (`GET /patient-api/claims/:token`, no retry, no cache), relation choice (Me hidden for minors), name for dependents, consent switch, accept → "Linked. You'll now see visits and medicines from <clinic>" → home. Error codes → `claim.errors.*` via `claimErrorInfo` (CLAIM_INVALID, CLINIC_SUSPENDED, PATIENT_APP_DISABLED, ALREADY_LINKED = terminal, token dropped; NAME_REQUIRED, RELATION_MISMATCH, 429, offline, other = stay and retry). Strings in `en`/`ur` (ur copies English, TODO).
- **Staff S-09** `staff/features/app-link`: route `(staff)/(main)/app-link/[patientId]`, gated `patients.app_link.manage`; status polled every 5 s; Generate QR → QR + m:ss countdown (15 min) + regenerate; linked state shows masked email + since + Revoke (ConfirmDialog, destructive). The raw token lives only in component state. S-05 only gained the "Link app" menu entry (needs the permission).
- `core/components/QrCode` added and exported.
- eslint fence: `src/app/c/**` added next to `src/app/claim/**` (patient route fence).

### INSTALL NEEDED (user runs)
No QR library is installed (only `react-native-svg`). Until then `QrCode` shows the link as text. Run:
```
npx expo install react-native-qrcode-svg
```
then in `src/core/components/data-display/QrCode.tsx` replace the text body with `<QRCode value={value} size={size} />` (keep the wrapper `View` for the label).

### Decisions to review
- The QR encodes the app deep link (`clinicapp[-dev|-preview]://claim/<token>`), NOT the backend `url` (`FRONTEND_URL/c/<token>`): no web landing page / universal-link association exists yet, so a camera scan of the web URL would open a browser. Phone camera → installed app works with the custom scheme. Switch to `claim.url` once the landing page exists (the `c/[token]` route is ready for it). "Share via WhatsApp" from docs/06 is not built for the same reason.
- Pending token is memory only (not SecureStore): a killed app asks for a new QR (15 min TTL).
- Existing-profile picker not built: `GET /patient-api/profiles` is M2-10. "Me" uses the account's self profile; other relations create a new profile from the typed name.
- Sign-in hint does not name the clinic (preview needs a signed-in patient).

### Verification
`tsc --noEmit` clean (only the pre-existing generated `global.css` message appears before `expo start` generates it; clean after) · eslint 0 errors (3 old warnings) · `lint:fences` ok · full jest 107 suites / 770 tests green · `CI=1 npx expo start --offline` ran to generate route types.
New tests: claim token/link/store, claim error mapping (all codes), claim form schema, countdown.

### Needs a device
Scanning the QR with the phone camera and the app opening on `claim/<token>` (cold start and warm); sign-in detour (email code) resuming at the confirm page; keyboard on the name field; the staff QR once the library is installed; both spaces on one phone (staff creates, patient space accepts).


---
## Rework M2-07 + M2-15 #1 — 2026-11-15
Branch: claude/m2-07-claim-flow-b5aeae · Status stays: review (merged `mobile/develop` first)

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Terminal accept error landed on home | `useClaimForm` hands the `MessageKey` to the page (`onTerminalError(key)`); the page shows the Failure state translated at render and drops the token only when the patient taps Close. Tests: hook (all 4 terminal codes, recoverable error, success) + page. |
| 2 | Patient trapped on a recoverable preview error | "Not now" next to Retry → `leave` (clears token, goes home). Page test. |
| 3 | Pending token age | Store keeps `{ token, savedAt }`; `freshPendingToken` selector ignores/drops it after 15 min (`dropIfStale`). Tests. |
| 4 | Token format | exactly `^[A-Za-z0-9_-]{43}$`. |
| 5 | Countdown clock drift | `deadlineFromResponse`: server `expiresAt` minus the server `Date` response header, counted from receipt (capped at 15 min; falls back to 15 min without a header). Tests with a wildly wrong phone clock. |
| 6 | QR content + share | QR encodes `claim.url` (https `/c/<token>`); "Share link" uses RN `Share` with the same URL (label says "Share link" because the sheet is the OS one, WhatsApp is one target); `selectable` removed. `buildClaimLink` and its expo-linking use were deleted. |
| 7 | `text-white` | `text-destructive-foreground`. |
| 8 | Device check | **On device: confirm `(patient)/(main)/claim/confirm` resolves as a static route and does not get swallowed by root `claim/[token]` (a token is never "confirm", but check both paths), including cold-start deep link.** |

Note: the app only opens from the https link once M2-14 (web landing + association) exists; until then scanning the QR opens the browser page.

Verification: tsc clean · lint 0 errors (3 old warnings) · `lint:fences` ok · full jest 116 suites / 834 tests ✓ · `CI=1 npx expo start --offline` run. No device.

### Addendum — real QR (after rework 1)
`react-native-qrcode-svg` (installed by the user, on mobile/develop) now renders the code in `core/components/QrCode` (black on white, quiet zone; the text fallback shows only if encoding fails). It encodes `claim.url`. The install note in the first M2-07 entry is obsolete. Tests: `QrCode.test.tsx` (renders for the value; falls back on error). Note for the lead: this worktree's own `node_modules` did not contain the package, so I copied `react-native-qrcode-svg`, `qrcode`, `text-encoding` and `dijkstrajs` from the main checkout's `node_modules` (untracked; no package.json/lockfile change by me).

---
## Rework M2-10 + M2-11 #1 — 2026-11-16
Branch: `claude/m2-10-family-clinics-5e4548` (merged `mobile/develop`; conflicts in `HANDOFF.md`, `PROGRESS.md`, `core/i18n/en.ts`, `ur.ts` resolved by keeping both sides) · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Keep the clinic's link history | `patient_profiles.deleted_at` added (entity + `schema/02_tables.sql` + `changes/2026-11-15_patient_profiles_soft_delete.sql` + doc 08). Removing a family profile and deleting an account now **soft-delete** profiles (`deleted_at = now()`, name → `'Removed profile'`, dob / gender / `private_reminders` cleared); `patient_record_links` rows (revoked, `revoked_by_*`, reason) are never deleted. Every profile read/write excludes deleted rows: `PatientLinkGuard`, profiles list/count/update/remove, claim accept (existing-profile + self lookups), account links list / unlink / history. Doc 07 §6.5 and DECISIONS **A-22** updated. Unit specs assert UPDATE-not-DELETE and the stripped columns; the int spec (not run) asserts the stripped rows and that the revoked link row survives. |
| 2 | Concurrency with delete | Create-profile and claim accept both lock the account (`SELECT … FROM patient_accounts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`) and answer 404 when no row. Specs for both (create on a deleted account inserts nothing; accept stops before touching profiles / links). Lock order: accept = claim token → account → link; delete = account → links; create = account. No cycle. |
| 3 | Session PII | Account delete sets `revoked_at = COALESCE(revoked_at, now()), ip = NULL, device_label = NULL` on all the account's sessions; spec asserts it. |
| 4 | Unlink audit actor | The `ActorSide` enum has no patient side, so the audit rows keep `SYSTEM` (as M2-04's claim accept does); the account id is in `after.revokedBy` / the access log. Recorded in A-22 and doc 07. |
| 5 | Rate limit | `DELETE /patient-api/links/:id` has `@RateLimit` 30 / 15 min (same as claims). |
| 6 | Delete retry | `deleteWithRetry` (`features/account/lib`): a network error is retried once; a 401 / 404 on the retry counts as success so the wipe still runs; any other failure (or a 401 / 404 on the FIRST call) is thrown and nothing local is touched. Table tests. |

Also fixed while merging: the merge dropped the closing braces of my `account.delete` block in `en.ts` / `ur.ts` (placed before develop's `claim` block).

Install commands: none.

Verification: see the commit message / report (backend build, changed specs, full backend unit suite; mobile typecheck after `CI=1 npx expo start --offline`, lint, `lint:fences`, full jest). The int spec was still not run (no local Postgres).

---
## M3-01 + M3-02 — Medication schedules + patient medication endpoints — 2026-11-15
Branch: claude/m3-01-medications-9171d2 · Status: in-progress (plan written before coding)

### Plan
**Tables** (docs/08 §5 as written, plus one column): `medication_schedules`, `medication_dose_events`; extra column `patient_edited boolean NOT NULL DEFAULT false` (set when the patient changes times/endDate/status via PATCH, so an amended prescription never overwrites the patient's choices). Entities in `src/medications/entities`; schema in `02_tables.sql`; `changes/2026-11-15_medications.sql`.

**Event hook**: no event-emitter package exists and none may be added → `PrescriptionEvents` (RxJS `Subject`, provided + exported by `PrescriptionsModule`). `PrescriptionService.finalize()` calls `events.issued(...)` AFTER its history log inside try/catch (never throws, never awaited work). `MedicationsModule` subscribes on init (`prescription.issued` `{ prescriptionId, organizationId }`); the handler swallows+logs every error. A crash between save and handler loses a sync; `MedicationSyncService.syncPrescription(id)` is idempotent and callable for backfill (backfill on link accept = follow-up).

**Sync** (`MedicationSyncService.syncPrescription`): load FINALIZED prescription + medicines; links = `patient_record_links` active for (org, patient) whose org has `patient_app` enabled (revoked/frozen → skipped); per link profile: existing `source='prescription'` schedules of (profile, prescription) matched to medicines by normalized name (amend re-creates medicine rows with new ids, so the id is re-pointed). Matched: update name/dose/instructions/meal; times/endDate/status kept if `patient_edited`, else recomputed. Unmatched medicine → insert. Existing schedule whose medicine disappeared → `status='stopped'` (unless already stopped/completed). Unique index `(profile_id, prescription_medicine_id)` honoured. `startDate` = issue day in the location's timezone (`ClockService`).

**Parsers** (`src/medications/parsing/`, pure): `parseDoseTimes(tags, frequencyText)` → `{ times, source: 'tags'|'frequency'|'none' }`; `parseDurationDays(text)`; `computeEndDate(start, days)` (inclusive: start + days − 1). Tag table + frequency forms from the card; SOS/PRN/unknown → `times: []` (schedule exists, no reminders).

**Endpoints** (controller lives in `src/patient-app/medications/` because the coverage spec forbids `@PatientApi` elsewhere): GET `/patient-api/medications?updatedSince=&profileId=`, PATCH `/:id` `{times?, endDate?, status?}` (strict allowlist DTO, `forbidNonWhitelisted`), GET `/dose-events?from&to`, POST `/dose-events` `{events[≤200]}`. All scoped by `profile_id IN account profiles` (404 otherwise, one code). Dose events upsert `ON CONFLICT (schedule_id, due_at) DO UPDATE ... WHERE acted_at <= EXCLUDED.acted_at` (latest wins); events for schedules not owned by the account → whole request 404. Schedules are the patient's property (survive link revoke); mutations are therefore not blocked by link state.

### Built (status → review)
- **Schema**: `database/changes/2026-11-15_medications.sql` + block in `schema/02_tables.sql`; entities `src/medications/entities`. Deviation from docs/08: extra `patient_edited` column + two indexes (documented in docs/08 §5).
- **Event**: `PrescriptionEvents` (`prescriptions/events`, exported by `PrescriptionsModule`); `finalize()` publishes after its history log. `MedicationsModule` subscribes (`concatMap`, errors logged, never thrown). `MedicationSyncService.syncPrescription(id)` is idempotent and reusable for a backfill. Writes `feed.changed {kinds:['medications']}` to the outbox for the patient room.
- **Parsers**: `src/medications/parsing/medication-parsers.ts` (`parseDoseTimes`, `parseDurationDays`, `computeEndDate`); table spec has 70 time cases + 34 duration cases.
- **Endpoints**: `src/patient-app/medications/*` (controller must live under `patient-app` for the coverage spec). Contract notes: docs/07 §6.5.
- **Specs**: parsers, sync service (in-memory fakes: create, idempotent, amend-by-name, add/stop lines, patient edits kept, revoked link, feature off, multi-profile), patient service (IDOR 404s, whole-batch rejection, replay-safe upsert SQL), controller (route order, DTO allowlist/limits).

### Verification
`tsc -p tsconfig.build.json` clean · full backend jest 112 suites / 1253 tests ✓ (run in background: this machine needs ~10 min). Pre-existing, untouched: `tsc -p tsconfig.json` errors in `nestjs-cli/` templates and `test/labs/access.int-spec.ts`.
No integration spec: no local Postgres, so the `ON CONFLICT` upsert SQL and the sync against real tables were **not run** against a database.

### Decisions to review
- Schedules stay readable/editable after link revoke or `patient_app` off (patient-owned data); only creation needs an active link + feature on.
- `endDate: null` via PATCH sets `endDateSource: 'patient'` (app asks only when `'unknown'`).
- No backfill when a patient links *after* a prescription was finalized (follow-up: call `syncPrescription` for the patient's recent finalized prescriptions on claim accept).
- An in-process event is lost if the process dies between finalize and handler; `syncPrescription` can be re-run.

---
## Rework M2-09 #1 — 2026-11-16
Branch: `claude/m2-09-records-ff83ad` (merged `mobile/develop`; conflicts in HANDOFF, PROGRESS, `core/i18n/{en,ur}.ts` resolved by keeping both sides) · Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Raw backend codes shown | `records.appointment.types.*` (consultation, follow_up, treatment, checkup, emergency, cleaning) and `records.prescription.timing.*` (morning, afternoon, evening, night, sos) in en + ur (`TODO(ur)`); `appointmentTypeKey` / `timingKey` in `lib/records-format.ts`; the raw value is the fallback for an unknown code. Test. |
| 2 | Offline cache scope | New query `records-appointments-upcoming` (`GET /appointments?from=<now>`), the ONLY appointments root in `PERSISTABLE_ROOTS`; the full list (`records-appointments`, past included) stays in memory. The segment shows the full list, falling back to the cached upcoming ones when it fails (`useRecordAppointmentList`). Tests: key persistence + fallback page test. |
| 3 | Bill date on the clinic clock | Backend: `PatientInvoiceDto.timezone` (`mapInvoice` uses the already-selected `l.timezone`), mapper spec updated, docs/07 §6.3/§6.4 updated. Mobile: `BillCard` uses `formatIssuedDate(issuedAt, invoice)` (zone of the invoice) — no more `.slice(0,10)`. |
| 4 | Next-page error | `RecordsList` takes `nextPageFailed` / `onRetryNextPage`: footer "We couldn't load more" + Try again; scroll no longer re-triggers a failed page. |
| 5 | Loading vs not-found | Prescription detail uses `isPending`; appointment detail's loading state is `all.isPending && upcoming.isPending`, so a disabled query shows the skeleton. |
| 6 | PDF (deferred) | see below |
| — | `formatMoney` change after merge | Re-checked: whole amounts show no decimals, fractional show two (`PKR 2,500.50`); my money test updated. |

### PDF — still deferred (needs a package)
```bash
npx expo install expo-file-system expo-sharing
```
Planned flow: "Share PDF" button on prescription detail only when `hasPdf` → `patientApi.get('/patient-api/prescriptions/:id/pdf', { responseType: 'arraybuffer' })` (bearer header, no token in a URL) → write to the cache directory (`expo-file-system`) → share (`expo-sharing`, mime `application/pdf`) → delete the file afterwards (also on failure); pending state on the button, toast without any PHI on failure.

Verification: mobile typecheck (after `CI=1 npx expo start --offline`) clean · lint 0 errors · `lint:fences` ok · full jest 124 suites: all pass except two timing-sensitive failures on the first run (SearchBar debounce under machine load — passes alone; my own retry test fixed for the new upcoming fallback and re-run green) · backend `jest src/patient-app` 9 suites / 114 tests green.

---
## M2-05 + M2-14 — Web: Link app dialog, public landing pages  ·  2026-11-15  ·  Sonnet 5.5
Branch: claude/m2-05-web-link-cca268   Commit(s): see git log   Status set to: review

### Done
- **M2-05**: "Link app" button in `PatientDetailHeader` (only with `can('patients.app_link.manage')`) opens `AppLinkDialog`: status (`GET /patients/:id/app-link`, polled every 5 s while open + manual refresh), QR of `url` from `POST .../claim-token`, countdown from the server's `expiresAt` (+ clinic-clock time), regenerate, revoke via `ConfirmDialog` (`DELETE`). Token lives only in mutation state; reset on close / when linked. Errors mapped: ALREADY_LINKED, CLINIC_SUSPENDED, PATIENT_APP_DISABLED.
- QR uses the existing in-house encoder (`@/features/lab-orders` `QrCode`) — no new package.
- **M2-14**: public routes `/c/$token` (validates 43-char base64url shape, "Open the app" -> `clinicapp://claim/<token>` deep link, store buttons) and `/v/$token` (visit state). Both added to `OPEN_PATHS` in `__root.tsx` (no auth redirects, no dashboard shell); `no-referrer` meta while mounted; token is never logged or sent anywhere except the deep link (and, for `/v/`, the documented endpoint path).
- `/v/$token` is built against docs/07 §6.3 `GET /visit/:token/state`; that endpoint does **not exist yet** (M3-05) so the page shows "coming soon" on any failure.

### Files
- Created: `features/patients/{services/appLink.api.ts,hooks/useAppLink.ts,components/AppLinkDialog.tsx}`, `features/public-links/**`, `routes/c.$token.tsx`, `routes/v.$token.tsx`
- Modified: `PatientDetailHeader.tsx`, `routes/__root.tsx`, `routeTree.gen.ts` (regenerated)

### Install commands for the user
none

### Open items / for the architect
- Missing backend: `GET /visit/:token/state` (M3-05).
- Store buttons read `VITE_PLAY_STORE_URL`, `VITE_APP_STORE_URL` (unset -> "coming soon" text); deep-link scheme `VITE_APP_SCHEME` (default `clinicapp`; dev/preview variants use `clinicapp-dev`/`-preview`). Universal/App Links (so `/c/` opens the app directly) need `assetlinks.json` / apple-app-site-association on the web host — O-01 dependent.
- Backend `url` uses `FRONTEND_URL`; set it to the web host that serves `/c/`.
- Not browser-tested against a live backend; QR scan not device-tested.

### Rework 1 (2026-11-16)
- Merged `mobile/develop`. Public routes: `head` meta `noindex, nofollow` + `no-referrer` (PublicShell effect removed). `/v/` uses `lib/publicApi.ts` (bare axios, no auth/tenant headers, no 401 redirect; test `publicApi.test.ts`). Visit page: 404 -> "coming soon", 400/410 -> invalid/expired, other -> error + retry; visit tokens only length/charset checked. Claim countdown offsets by the server clock from the response `Date` header (0 if the browser can't read it — backend would need `Access-Control-Expose-Headers: Date`). `web-app/.env.example` documents `VITE_APP_SCHEME` (`clinicapp-dev` / `clinicapp-preview` / `clinicapp`), `VITE_PLAY_STORE_URL`, `VITE_APP_STORE_URL`.
- Full `npm run test` after rework: 383 passed / 5 failed, all in files this branch does not touch: `DataTable.test.tsx` (paginates client-side rows), `builders.acceptance.test.tsx` (THEME-15 blue/indigo count), `notification-realtime.test.tsx` (2), `patient-messages.test.tsx` (1). Not run separately on plain `mobile/develop`; none of these files or their imports changed here. Build ok, eslint clean on touched files.

### Verification
- `npm run build` ok · eslint clean on touched files · `npm run test`: 382 passed / 5 failed — all in files this card did not touch (DataTable pagination text, builders THEME-15 blue-token count, notifications, roles escalation); same family as the existing fix-5-failing-web-app-tests task. tsc has no errors in touched files.



---
## Rework M3-01 + M3-02 #1 — 2026-11-16
Branch: claude/m3-01-medications-9171d2 · Status stays: review (merged `mobile/develop` first; one HANDOFF conflict resolved by keeping both sides)

| # | Finding | What I did |
| --- | --- | --- |
| 1 | `MedicationsModule` / `PatientMedicationsService` not registered (my scripted edit silently missed because of CRLF) | Registered in `PatientAppModule` (`imports` + `providers`). `MedicationsModule` is imported only there, so its subscriber starts once. New `patient-app.module.spec.ts`: compiles `PatientAppModule` + `MedicationsModule` with only infrastructure stubbed (DataSource, config, clock, settings, and stub versions of the prescriptions / feature-flags / patient-links modules), asserts controller + service resolve, and that a `prescription.issued` event reaches `syncPrescription`. |
| 2 | Missed syncs never repaired | `MedicationSweepService`: on boot (30 s) and every 5 min re-runs `syncPrescription` for FINALIZED prescriptions of the last 14 days that have an active-linked profile with no schedule at `prescription_version >= prescriptions.version`. Every sync stamps `prescription_version` (new column). Also covers a patient who links shortly after a prescription. I chose the sweep (allowed fallback) over an outbox consumer: the outbox/relay only fans out to sockets and has no job-consumer. Spec. |
| 3 | Weekly / alternate-day wording | Parser returns no default times for weekly / monthly / "every other day" / "every N days" / "har doosre din" / "hafte mein …" / Urdu forms. 15 new table cases (an explicit `frequency_timing` tag still wins). |
| 4 | Clinic revoke vs patient unlink | **A-23** in DECISIONS. `PatientLinksService.revoke` (clinic) stops + hides (`hidden = true`) that patient's prescription schedules in the same transaction and sends `feed.changed ['links','medications']`. Hidden rows: omitted from the full list, 404 on PATCH, returned once as `stopped` tombstones when `updatedSince` is given (so an incremental app cancels the reminders). Patient-left / frozen / app-off: visible, PATCH → 403 `PATIENT_APP_DISABLED`; dose events still accepted. Re-finalize stops schedules of any profile without an active link. docs/07 §6.5 + docs/08 updated. |
| 5 | Rate limits | `@RateLimit` 120 / 15 min on PATCH and POST dose-events (+ metadata spec). |
| 6 | Concurrent syncs | `pg_advisory_xact_lock(hashtext(prescriptionId))` at the start of each profile transaction (event + sweep serialize; no 23505). |
| 7 | updatedSince paging | List ordered `updated_at, id` ascending, 500 per call, response is now `{ items, nextUpdatedSince }` (cursor = last item's `updatedAt` when more exist). **Contract change** vs the earlier array — docs/07 table + notes updated; M3-03/04 must use it. |
| 8 | Feature check / `completed` | `isFeatureEnabled(org, 'patient_app', locationId)` so location overrides apply. **`status = 'completed'` is not set by the backend**: nothing flips it when `endDate` passes; the app should treat `endDate < today` (phone clock) as finished. A server sweep that sets it is a follow-up (not in this card). |

Schema (same commit): `medication_schedules.prescription_version int`, `hidden boolean NOT NULL DEFAULT false` — entity, `schema/02_tables.sql`, `changes/2026-11-15_medications.sql` (also ALTERs, safe on a DB that already ran the first version), docs/08.

### Notes
- `backend/node_modules/.bin` is absent in the shared junction right now, so `npx jest` / `npx tsc` fail ("not recognized"); I ran `node node_modules/jest/bin/jest.js` and `node node_modules/typescript/bin/tsc` instead. Nothing installed.
- Still no database: the new SQL (`pg_advisory_xact_lock`, the sweep query, the revoke UPDATE, the version-stop UPDATE) is covered only against fakes / SQL-text assertions — **not run on Postgres**.
- The foreground rule: full suite takes ~10 min on this machine, so build + the targeted specs + full suite were run as background commands and awaited.

### Verification
`tsc -p tsconfig.build.json` clean · full backend jest 114 suites / 1283 tests green (incl. the new module smoke spec, sweep spec, weekly parser cases).


---
## M2-13 — Product events (privacy-safe analytics)  ·  2026-11-16  ·  Claude Sonnet 5.5
Branch: claude/m2-13-product-events-f86696 (merged mobile/develop)   Status set to: review

### Done
- **Backend** `src/product-events/` (+ `patient-app/events.controller.ts`): `product_events` entity; `POST /me/events` (`@ContextFree`, justified: the sign-in event is sent before org/location selection, nothing clinic-scoped is read) and `POST /patient-api/events` (`@PatientApi`); both `@RateLimit` 60 / 5 min, ≤ 50 events per call. Catalog (`product-event-catalog.ts`) = event names + per-prop enum values; the service drops unknown names (also names of the other space), unknown props and out-of-enum values, clamps client time to the last 7 days. Stored: actor type + account/user id, name, props, time. `organization_id` is never client-supplied (currently always null; per-clinic staff metrics join `employee_org_location_assignments`).
- **Schema**: entity + block in `database/schema/02_tables.sql` + `database/changes/2026-11-15_product_events.sql`.
- **Mobile** `core/analytics` `createTracker({ send })` (batched 5 s, in-memory, fire-and-forget, retry on network/5xx/429, drop on other 4xx, capped queue, no-op under Jest); senders in `staff/lib/analytics.ts` and `patient/lib/analytics.ts`. One `track` call each in: staff sign-in (password + Google), check-in from the schedule sheet, call next; patient email sign-in, claim accepted, Records tab list shown.
- **Docs** `docs/analytics-events.md`: rules, event list, retention (400 days + delete statement), six pilot metric queries.

### Install commands for the user
none

### Verification
- Backend: `nest build` clean; new `product-events.spec.ts` (sanitising, other-space names, time clamp, rate limit + fence metadata). Full backend jest: see the lead's note below.
- Mobile: eslint 0 errors (4 old warnings) · `lint:fences` ok · new `tracker.test.ts`. 
- **tsc**: the ONLY error is `mobile-app/node_modules/@types/node/test.d.ts(453)` — that file in the shared node_modules is TRUNCATED (23 959 bytes, ends mid-word) from the disk-full incident. Nothing in `src` errors. Fix: reinstall `@types/node` in `mobile-app/node_modules` (lead/user, not me).

### Deviations / notes
- `app_opened` / `patient_app_opened` are in the catalog but not sent yet (daily use is measured from any event).
- Events are memory-only: a phone closing within ~5 s of an action can lose it (documented caveat).
- Not run against Postgres; SQL in the docs is untested.


---
## Rework M2-13 #1 - 2026-11-16
Branch: claude/m2-13-product-events-f86696 - Status stays: review

| # | Finding | What I did |
| --- | --- | --- |
| 1 | Queued events survive sign-out | `createTracker` takes `getActor`; each queued event stores its actor, a batch is sent only while that actor is signed in (signed out = drop all, `track()` ignored while signed out). `clearStaffEvents` / `clearPatientEvents` run first in both sign-out flows; forced session loss is covered by the actor check. Tests added. |
| 2 | Flush on background | AppState listener inside `createTracker` (`flushOnBackground`, default on when enabled). |
| 3 | Out-of-range times | Server DROPS events > 5 min in the future or > 7 days old (small skew clamped to now). Spec. |
| 4 | org index | `idx_product_events_org_name_at` removed from entity, schema block, changes script; org tagging noted as future work. |
| 5 | Docs | Rate limit is per IP (shared NAT); retention delete is manual (open item); sign-out/actor behaviour documented. |

Verification: backend build clean, product-events + patient-app + access specs green (260 tests); mobile lint 0 errors (4 old warnings), lint:fences ok, jest on core/analytics + staff/patient auth + queue + lib + shell green (43 suites). tsc: only the known `@/global.css` message (expo-env.d.ts not generated; I did not run expo start - my attempt to kill its node process was refused by the sandbox). Full-suite runs were not completed on this memory-starved machine.
Note: my first pass re-encoded three existing files through PowerShell (mojibake); restored from HEAD and re-edited byte-safely - the final diff touches only the intended lines.


---
## M4-01 — Urdu translation pass + Noto Nastaliq font + layout check - 2026-11-16
Branch: claude/m4-01-urdu-46c4ef - Status: review

### What was done
- `src/core/i18n/ur.ts`: every `TODO(ur)` string and the whole `claim` block translated (simple, kind Urdu; `{params}` untouched; OTP-style/brand terms and `DELETE`/`YYYY-MM-DD` kept Latin). Header comment points at the allow-list rule.
- `i18n.test.ts`: new tests - `{param}`s of every `en` string appear in `ur`; no `// TODO(ur)` marker left (allow-list `UR_TODO_ALLOW_LIST` is empty). **New keys after M4-01:** add to `en.ts` AND give `ur.ts` real Urdu in the same change; only if it truly can't be translated yet, copy the English, mark `// TODO(ur)` and add the dotted key to the allow-list (the test fails otherwise).
- Font: `src/core/i18n/urdu-font.ts` - `useUrduFont()` / `loadUrduFont()` load `NotoNastaliqUrdu_400Regular` / `_700Bold` through `expo-font` from an OPTIONAL `require('@expo-google-fonts/noto-nastaliq-urdu')`; when the package is missing it stays on the system font. `src/core/ui/text.tsx` (the one Text wrapper) applies the family (bold for `font-semibold|bold|extrabold|black`) and `leading-loose` only when locale is `ur` and the font is ready. `urdu-font.test.ts` covers the fallback.
- Layout check: patient screens use `min-h-*` everywhere (no fixed text heights); `small` Text variant's `leading-none` is overridden by `leading-loose` for Urdu. No string concatenation around `t()` in `src/patient|shell|core`.

### Install commands for the user
```
npx expo install @expo-google-fonts/noto-nastaliq-urdu expo-font
```
(expo-font is already a dependency; the command pins the font package.) No other code change needed after installing.

### Device check needed (gate M0-D)
- Install the package, switch to Urdu on a real Android + iPhone: verify the font loads, `leading-loose` (2x) is enough/not too much, bold weights look right.
- `numberOfLines={1}` places: `ClinicLinkCard` (clinic name), `ClinicChip`, `ActionSheet` subtitle - check Nastaliq descenders are not clipped.
- Buttons with `min-h-11` + long Urdu labels wrap OK; tab bar labels; the OTP/code inputs (digits stay Latin).
- RTL stays OFF in the pilot (O-06): check mixed-direction lines (email, dates) read sensibly.
- Native-speaker review of the translations is still advised before release.

### Verification
eslint 0 errors (4 old warnings) · lint:fences ok · tsc: only the known `@/global.css` message (expo-env.d.ts not generated; I did not run expo start) · jest result below.
