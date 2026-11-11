# Review M2-01 — Patient identity tables + entities
Date: 2026-11-11 · Reviewer: architect (Claude Opus) with an independent reviewer agent · Verdict: **done**
Branch: `mobile/M2-01-patient-identity` @ 971dcfb · Commands (worktree C): full backend jest 91 suites / 968 tests ✓ · metadata spec 44 ✓

The change file and the nine `02_tables.sql` blocks match 08 §1–3 exactly (mechanical diff); idempotent; the access log
has no FK; entities match SQL (types, nullability, CHECK and index names, partial `where`); modules are entity-only;
`patients.user_id` untouched. The metadata spec parses both SQL files and compares both ways — a real check.

## Findings (all Minor, carried into later cards)

| # | File | Finding | Where it goes |
| --- | --- | --- | --- |
| 1 | entities with FKs; `uq_patient_accounts_email` | Int-test harnesses build DBs with `synchronize`, so expression/partial indexes and FKs/cascades are missing there | 08 §7 note added: patient int specs run the change file after synchronize (M2-02/M2-03) |
| 2 | patient-entities.spec.ts:66–75 | Compares column names only | Optional; extend when touched |
| 3 | patient-access-log.entity.ts:33, 37 | `action` / `resourceType` typed `string` | M2-08 adds TS unions (no CHECK — the log must never fail a read) |
| 4 | docs/08 heading | File name mismatch | Fixed in this review |
| 5 | backend/database/README.md | Table count stale | Doc touch-up later |

Open (not a defect): the change file has not been executed anywhere — run it twice on a disposable Postgres before any shared DB.
Answer: no CHECKs on access-log `action` / `resource_type` (the contract has none; high-volume append-only log).
