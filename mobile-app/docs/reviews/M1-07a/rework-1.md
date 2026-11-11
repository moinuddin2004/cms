# Review M1-07a rework #1
Date: 2026-11-12 · Reviewer: architect (Claude Opus) · Verdict: **done**
Commits: 77c5195 + d19c54a · Commands: tsc ✓ · jest 122 ✓ · ESLint 0 errors

- #1/#2/#3 fixed per `queue-transitions.ts`: board skip only `called`; transfer only `waiting` with `queue.entry.manage`; mark urgent hidden when already `authorized_urgent`; test oracle updated.
- #4 fixed: `SelectResult { entry, reason: 'MANUAL_SELECT', suggestedEntryId, eventSeq }` used by `selectEntry`.
- #5 `openSession` without idempotency options, #6 `IdemOptions` without `ifMatch` for non-IfM endpoints, #7 `nextPreview` key — all fixed.
