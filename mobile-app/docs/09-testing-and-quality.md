# 09 — Testing and quality

## 1. Definition of Done (every task)

A task is **done** only when all of these are true. The reviewer checks each one.

1. Every acceptance criterion in the task card is met and demonstrated in the handoff note.
2. `mobile-app`: `npm run lint`, `npm run typecheck`, `npm test` pass (paste the summary lines).
   **Typed routes first:** if your card adds, moves or links routes, run `CI=1 npx expo start --offline`
   once (stop it when `.expo/types/router.d.ts` exists) so typecheck validates every `href`. Without that
   file typecheck accepts any route string — this hid a real error in M0-04.
3. `backend` (if touched): `npm run lint`, `npm run build`, `npm test` (unit) pass; e2e/integration
   tests named in the card pass; `access-coverage.spec.ts` passes.
4. No rule from [03-security.md](03-security.md) or [04-coding-standards.md](04-coding-standards.md) is broken.
5. UI tasks: the visual QA checklist in [05 §12](05-ui-ux-design-system.md#12-visual-qa-checklist-implementer-runs-before-handoff-on-every-ui-task)
   is done and screenshots are saved under `mobile-app/docs/reviews/<TASK-ID>/` (PNG, small).
6. Schema changes: entity + `schema/*.sql` + `changes/*.sql` together, and the change file was run
   once against a local DB (state the command and result).
7. `PROGRESS.md` row updated and a `HANDOFF.md` entry appended.
8. No new dependency outside the stack list unless the card allows it; install commands listed.

## 2. Mobile test setup (task M0-06)

Installed (M0-06; `npx expo install jest-expo jest @testing-library/react-native @types/jest`):

- `package.json`: `"test": "jest"`, `"jest": { "preset": "jest-expo" }` plus
  `transformIgnorePatterns` per jest-expo docs (SDK 58 docs — check, do not guess).
- `jest.setup.ts`: mock `expo-secure-store` (in-memory map), `react-native-mmkv` (in-memory),
  `expo-notifications` (scheduled list), NetInfo (online), `expo-crypto.randomUUID` (counter).
- Tests live next to code: `*.test.ts(x)`.
- `npm run lint:fences` runs `scripts/check-fences.mjs` (lint fixtures proving cross-space imports fail). Jest hangs after finishing on open handles in some folders (`src/shell`): run per folder in the foreground and add `--forceExit` / `--runInBand` if needed.

### What must have tests

| Area | Kind |
| --- | --- |
| `staff/navigation/resolve-staff-route.ts`, `patient/navigation/resolve-patient-route.ts` | unit — every row of the guard tables in 02 §4 |
| `core/datetime/*` | unit — zone conversions, day bounds across DST zones (e.g. `America/New_York`) and `Asia/Karachi` |
| `core/theme/brand.ts` | unit — palette from 5 sample colours; contrast ≥ 4.5 for primary-foreground |
| `core/http` idempotent mutation | unit — same key across retries, new key per intent, stops on 4xx |
| `staff/lib/realtime-invalidation.ts` | unit — event → keys; stale `seq` ignored |
| Queue row actions by status | component — action set per `EntryStatus` × permissions |
| `patient/features/medications/lib/*` (planner, scheduler, dose queue) | unit — exhaustive table tests (see M3-03) |
| Sign-out wipes only that space | unit (mocked storage) |

## 3. Backend tests

- Unit: `src/**/*.spec.ts` (jest). Integration: `test/**/*.int-spec.ts` with harnesses
  (`test/tenancy/tenancy-it.harness.ts` is the closest model for isolation tests).
- New test files:
  - `src/patient-app/patient-api-coverage.spec.ts` (decorator coverage, mirrors `src/access/access-coverage.spec.ts:36-87` reflection style).
  - `test/patient/route-matrix.int-spec.ts` — boots the app, enumerates every controller route by
    reflection (`PATH_METADATA`, `METHOD_METADATA`), calls each with a patient token (expects 401/403)
    and each `/patient-api` route with a staff token (expects 401). Parameterised paths get random uuids.
  - `test/patient/link-isolation.int-spec.ts` — two accounts, two orgs; every read endpoint.
  - `src/patient-auth/*.spec.ts` — code hashing, attempts, rotation + reuse detection, strategy `aud`.
  - `src/medications/lib/*.spec.ts` — duration / frequency parsers (table tests).

## 4. Manual QA (per phase gate, run by the user or reviewer)

### Staff gate (end of Phase 1)

- [ ] Doctor runs a full session on a phone: start → call next ×10 → start/complete → send for test →
      back from test → pause/resume → close with leftovers.
- [ ] Reception on a second phone: walk-in (new + existing patient), check-in, urgent, transfer,
      skip/rejoin, cancel. Doctor phone updates within 2 s.
- [ ] Kill Wi-Fi mid-action: no duplicate entries after reconnect; offline banner shows; cached
      board visible.
- [ ] Push "patient checked in" arrives on the doctor's phone (app in background) within 5 s and
      opens the queue.
- [ ] Switch location: board, theme colour and bell all change.
- [ ] A user without `queue.board.view` never sees the board segment.

### Patient gate (end of Phase 3)

- [ ] Claim from a web QR in < 2 minutes on a fresh install.
- [ ] Two orgs' records in one account; unlink one, it disappears.
- [ ] Prescription finalized on web → schedule appears on the phone; reminder rings in airplane mode.
- [ ] Live token updates and "turn near" push arrives.
- [ ] Delete account → can sign up again with the same email as a new account, old links gone.
- [ ] Route-matrix and isolation tests green in CI.

## 5. Performance budgets (M4-05)

Budgets are release criteria on a **mid-range Android** (about 4 GB RAM, Android 12+), release build, Hermes. Rows marked *measure* are targets until measured on a device (M0-D).

| Area | Budget | How to check |
| --- | --- | --- |
| Cold start to first interactive screen (signed in) | first meaningful paint <= 2.5 s, data shown <= 4 s; splash held until `markReady()` | `adb shell am start -W` + stopwatch to first list row - *measure* |
| JS bundle (Hermes bytecode, Android) | <= 8 MB; a card that adds > 10 % fails review | `npx expo export --platform android`, read the `.hbc` size - *measure* |
| Install size | <= 60 MB incl. fonts | Play Console / `bundletool` - *measure* |
| List scrolling | 60 fps target, no blank cells on a fling over 500 rows. **FlashList for every list that can exceed ~20 rows**; ScrollView only for fixed short content | RN perf monitor on a seeded 500-row clinic - *measure* |
| List item cost | Row components are `memo`-ed; callbacks passed to rows are stable; no per-row queries; `keyExtractor` always set; `getItemType` when rows differ; FlashList v2 needs no `estimatedItemSize` | code review (11) |
| Network lists | Always paged (`limit` + `page`, page size <= 50); `onEndReached` guarded by `hasNextPage && !isFetchingNextPage`; no fetch-all except bounded per-day / per-account sets | code review |
| Images | avatars/logos displayed <= 128 px; no image > 200 KB on a list row; QR is SVG | code review |
| Memory | no growth over 10 min idle on the queue board (realtime reconnect included) | Android Studio profiler - *measure* |
| Battery | reminders are local notifications; no foreground service; sockets closed in background | device - *measure* |

## 6. Patient gate checklist (code level, M4-05)

Run for every patient screen before the gate (section 4 stays the manual end-to-end list; the M4-05 walk is in `reviews/M4-05/report.md`):

- [ ] Every list/detail has **loading** (skeleton), **empty**, **error with retry** and, when filterable, **no results**.
- [ ] Touch targets >= 44 pt (`min-h-11` / `size="lg"` / `IconButton`); no nested accessible Pressables (a card's buttons sit outside the card's own pressable).
- [ ] Every icon-only control has a translated `accessibilityLabel`.
- [ ] All user-visible strings via `useT()`; `en` + `ur` keys added together; the `ur` completeness test stays green.
- [ ] Clinic-record times via `formatInZone(v, record.timezone)`; dose times are phone wall-clock (A-10); never `toLocale*String`.
- [ ] Patient sign-out wipes cache, cache key, refresh token, reminders, dose queue, pending claim, analytics queue; staff space untouched.
- [ ] No PHI in logs, prefs MMKV, URLs or notification text (A-14).
- [ ] Errors go through `reportError` only (scrubbed); never `console.*`.
