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
