# Review M1-04 — Backend: devices + Expo push provider
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done** (carry-overs)
Branch: `mobile/M1-04-be-push` @ 6491789 (+ 5f25c4f docs)
Commands run by reviewer (worktree C): jest notifications, devices, access-coverage, guard.acceptance, patient-api-coverage → 11 suites / 95 tests ✓.
Also confirmed `expo-server-sdk` v8 (ESM-only) loads through CommonJS `require` on Node 22.16.

## Findings

| # | Severity | File | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Major (deploy) | `expo-push.provider.ts` | ESM-only SDK works only because Node ≥ 22.12 can `require()` ESM | Production must run Node ≥ 22.12 — add `"engines": { "node": ">=22.12" }` in M1-04a |
| 2 | Carry-over | `changes/2026-11-11_push_devices.sql` | Not executed (no disposable DB) | Run on a local/disposable Postgres before any shared DB; then on dev DB by the user |
| 3 | Carry-over | — | Real device push in 5 s | M1-05 |
| 4 | Minor | quiet hours | Push is held by quiet hours like email; a "patient checked in" push delivered next morning is useless | M1-04a: push follows in-app rules (not held) |
| 5 | Minor | web | `/settings/notifications` now receives a `push` channel without a label/toggle | M1-04a (web part) |

## Answers
1. `pushDefault` as a seed-only marker (runtime reads `notification_events.channels`): accepted.
2. `@ContextFree()` only for `/me/devices`: accepted — the card was wrong; 07 §4.2 corrected.
3. `appVersion` required: accepted; M1-05 sends it (`expo-application`).
4. Quiet hours: treat push like in-app (M1-04a).
