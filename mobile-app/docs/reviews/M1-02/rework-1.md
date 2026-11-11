# Review M1-02 rework #1
Date: 2026-11-12 · Reviewer: architect (Claude Opus) · Verdict: **done**
Commits: 158e273 + 2efd319 · Commands: tsc ✓ · jest 112 ✓ · ESLint 0 errors

- #1 fixed: `AccessErrorBanner` above the tabs + `AccessErrorNotice` with retry (`access.refetch`) on More; tested.
- #2/#3 fixed: non-access queries removed → `setLocationContext` → new access key fetches; hook test covers success order and the error path (store and cache untouched).
- #4 fixed (current location labelled, no-op tap), #5 fixed (bell disabled without `onPress`), #6 documented, #7 accepted (04 §4 exception).
