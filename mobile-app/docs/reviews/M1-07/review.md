# Review M1-07
Date: 2026-11-15 · Reviewer: architect (Claude Opus) + independent reviewer agent · Verdict: **done** (after rework #1)
Commits: 801157b + 27a7e8a · Commands re-run by the architect: tsc ✓ · jest 372 ✓ · ESLint 0 errors

Reviewer agent: changes-requested (dialog codes toasted; board stuck on yesterday after clinic midnight; `openSession` still took an idempotency key — an M1-07a fix the architect wrongly signed off). Rework verified in code: `DIALOG_ERROR_CODES` / `isDialogError` skip the toast; `useClinicToday` (timer to next clinic midnight + AppState) used by `useBoard` / `useMySession`; `openSession(vars)` plain; timer-leak cleanup; new tests (location room switch, LOCK_TIMEOUT after retries, day rollover).
