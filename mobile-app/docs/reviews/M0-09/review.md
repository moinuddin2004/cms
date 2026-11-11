# Review M0-09 — Backend: patient fence skeleton
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done** (int spec carry-over)
Branch: `mobile/M0-09-be-fence` @ 36630a2 (+ 1f7168d docs)
Commands run by reviewer (worktree C): jest patient-fence, patient-api-coverage, access-coverage, guard.acceptance, jwt.strategy, queue.gateway → 7 suites / 54 tests ✓

## Findings

| # | Severity | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Minor | `patient-fence.guard.ts` | Express matches routes case-insensitively; a mixed-case `/Patient-API/x` request would hit a `@PatientApi()` route with a non-matching path → 403. Fails closed, so acceptable | None |
| 2 | Carry-over | `test/patient/route-matrix.int-spec.ts` | Written and typechecked, never executed (no disposable DB; correctly refused the shared one) | Must run green in M2-03 against a local/disposable Postgres |
| 3 | Minor | `test/billing/db.config.ts` | Falls back to `DATABASE_URL` → an int run could hit the shared DB | M2-03 adds a guard that refuses a non-local URL for int specs (card updated) |

Skipping `@Public()` routes in the matrix and booting `AppModule` instead of the acceptance harness are both correct calls.

## Answers to the implementer's questions

1. Yes — M2-03 adds a "refuse non-local DB" guard and a `test:int:patient` script.
2. `PatientAppModule` creation belongs to M2-02 (noted).

## Acceptance
- [x] Unit + coverage green (re-run). [x] Dummy controller → 403 `PATIENT_FENCE`. [~] Int spec → carry-over to M2-03.
