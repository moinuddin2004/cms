# Review M1-07a — Queue types, API, keys, pure logic
Date: 2026-11-11 · Reviewer: architect (Claude Opus) with an independent reviewer agent; findings 1–2 verified in `backend/src/queue/queue-transitions.ts` · Verdict: **changes-requested** (two cells came from a wrong architect spec)
Branch: `mobile/M1-07a-queue-api` @ 6ac0c68 · Commands (worktree E): tsc ✓ · jest 120 tests ✓ · ESLint 0 errors

Verified correct: all 25 endpoints (method, path, body names), `If-Match: "<n>"` format, `res.data.data` unwrapping, every view type
(nullability included), all 15 queue error codes read from `body.error.code`, `shouldRefetch`, doctor-side action cells, no React imports.

## Findings (fix #1–#5; #6–#7 fix if cheap)

| # | Sev | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | **High** | lib/entry-actions.ts:57 | Board `skip` offered for `waiting`; backend `WAITING → [called, cancelled, transferred]` → always 422. **06 S-02b was wrong** (fixed now) | `skip` valid only for `called` |
| 2 | **High** | lib/entry-actions.ts:56 | Board `transfer` offered for `skipped`; backend `SKIPPED → [waiting, cancelled]` → always 422 (06 was wrong) | `transfer` valid only for `waiting` (board). `in_consultation` transfer stays doctor-only and is not on mobile |
| 3 | Medium | lib/entry-actions.ts:56 | Board `transfer` has `perm: null`; the server needs `queue.entry.manage` (or the session's doctor) | Board: gate on `queue.entry.manage` |
| 4 | Medium | types/queue.types.ts:166–167; api:163 | `SelectResult = EntryResult` is wrong: select returns `{ entry, reason: 'MANUAL_SELECT', suggestedEntryId: string \| null, eventSeq }` | Define it and use it for `selectEntry` |
| 5 | Low → fix | api/queue.api.ts:157 | `openSession` sends `Idempotency-Key`, but the endpoint is not Idem | `openSession(vars)` with no options |
| 6 | Low | types/queue.types.ts:238–243 | `ifMatch` accepted by functions whose endpoint ignores it | Separate `IdemOptions` (no `ifMatch`) for non-IfM endpoints |
| 7 | Low | api/queue.keys.ts | `fetchNextPreview` has no key | Add `nextPreview(sessionId)` |

Update the test oracle for #1–#3 (the tests currently encode the wrong cells).

## Answers
1. Skip `called` only; transfer `waiting` only (board). 06 S-02b corrected on mobile/develop — read it from there.
2. Mark urgent: `waiting` only on mobile; hide it when the entry is already `authorized_urgent` and add that rule to the table.
3. `my-session?doctorId=`: leave out until a screen needs `queue.doctor.any`.
