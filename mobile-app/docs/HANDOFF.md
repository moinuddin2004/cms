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
