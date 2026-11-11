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
