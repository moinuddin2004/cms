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
