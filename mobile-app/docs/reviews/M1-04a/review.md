# Review M1-04a — Push follow-ups (quiet hours, Node engine, web toggle)
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done**
Branch: `mobile/M1-04a-push-followups` @ ecb5af8 (+ 05cc67d docs)
Commands run by reviewer (worktree C): backend decision spec 20 tests ✓ · web `notifications.test.tsx` 8 tests ✓

## Findings

| # | Severity | File | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Info | web-app tests | 5 web tests fail on the branch base too (THEME-15, notification-realtime ×2, roles escalation, flaky DataTable) — pre-existing, not caused by this card | Outside the mobile programme; tracked as a separate web clean-up (reported to the user) |
| 2 | Minor | wording sheet | A push title cannot be edited (`hasSubject` is in_app/email only) | Later, with patient push (M3-07) |

Adding `skipped_no_device` labels to the web message log was a good catch.

## Answers
1. Accepted on changed-file evidence; the base failures are not this card's.
2. Push title editing → M3-07.
3. "Phone (push)" for every audience: yes.
