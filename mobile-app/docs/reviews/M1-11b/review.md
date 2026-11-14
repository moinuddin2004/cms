# Review M1-11b
Date: 2026-11-15 · Reviewer: architect (Claude Opus) + independent reviewer agent · Verdict: **done** (after rework #1)
Commits: a406f6b + 44b44d2 · Commands re-run by the architect: tsc ✓ · jest 360 ✓ · ESLint 0 errors

Reviewer agent: changes-requested (a paging test really failed; `excludeId` missing from the check-phone key). Rework verified: `waitFor` fix (suite green), `excludeId` in `patientKeys.checkPhone`, gated hooks return `{ access: 'loading' | 'denied' } | { access: 'allowed', query }` (A-18), fire-and-forget invalidate, recent store clears only when non-empty, schema/input parity test. Check-phone UI per A-17.
