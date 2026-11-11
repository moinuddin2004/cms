# Review M0-08 — Backend: staff token `aud` + min-version endpoint
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done** (with a carry-over)
Branch: `mobile/M0-08-be-aud` @ a2cf96d (+ 0ab5230 docs)
Commands run by reviewer: `jest` on jwt.strategy, queue.gateway, app-version, access-coverage, guard.acceptance → 7 suites, 46 tests ✓

## Findings

| # | Severity | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Minor | `backend/src/auth/jwt.service.ts:34` | Confirmed the only access-token signer (all `auth.service.ts` paths go through it), so `aud` reaches web, mobile, Google and desktop sessions alike | None |
| 2 | Minor | backend lint | `npm run lint` unusable on this machine: `core.autocrlf=true` makes Prettier flag every file | Out of scope; a repo `.gitattributes` (`* text=auto eol=lf`) would fix it — separate task if the user wants |
| 3 | Process | handoff header | Header says branch `mobile/M0-01-folder-split`; the work now lives on `mobile/M0-08-be-aud` | None (PROGRESS has the right branch) |

No blockers. No majors. The added `MOBILE_MIN_VERSION_MESSAGE` env and the 60/min rate limit are sensible and accepted.

## Acceptance

- [x] Tests green, access-coverage green (re-run by reviewer).
- [~] Web + mobile login still work end-to-end — not run (no DB). Unit tests prove both token shapes validate.
      **Carry-over:** the user signs in once on the web after merging; M0-04's device smoke covers mobile.

## Notes for the next card

- M0-09 builds on this: `PatientFenceGuard` first in the guard list; the staff strategy already rejects `aud: 'patient'`.
- `TODO(M4-06)` markers are in `staff-audience.ts` and `jwt.strategy.ts`.
