# Review M1-06 rework #1
Date: 2026-11-13 · Reviewer: architect (Claude Opus) · Verdict: **done**
Commits: e7f677a + ea06e83 · Commands (worktree): tsc ✓ · jest 305 ✓ · ESLint 0 errors · lint:fences ✓

- #1 fixed: the seal is checked inside the storage `setItem`/`removeItem` (write time), one seal per persister instance, sign-out seals all live persisters before removing the client and wiping.
- #2 fixed: `createQueryClient({ gcTime })`; staff passes 24 h (= persist maxAge).
- #4 exact appointments key, #5 end-to-end allow-list test over the real save path, #6 forced sign-out wipes, #7 call-order assertion; #3 patient details trimmed (`trimPersistedClient`); #8 noted.
- Device check (airplane mode) joins gate M0-D.
