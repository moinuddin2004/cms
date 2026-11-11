# Review M1-06a — Idempotent mutation helper + online state
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done**
Branch: `mobile/M1-06a-idempotent` @ 47f271c · Commands (worktree G): tsc ✓ · jest 63 tests ✓ · ESLint 0 errors · lint:fences ✓

- `useIdempotentMutation`: one key per `mutate()` call, reused only by the internal retry loop; TanStack `retry: false` so
  nothing re-sends with a new key; retries only on network error (not cancel) or `503` + `error.code === 'LOCK_TIMEOUT'`;
  max 3 retries; 250 ms × (attempt + 1) + 0–100 ms jitter — same as the web loop.
- `useOnline` / `isOnlineNow` / `useCanMutate` in core, no space imports.
- Tests cover same key across retries, new key per call, 4xx stop, give-up after 3, fake timers.

Minor (no change needed now): `onSuccess` / `onError` take `(data, vars)` only — if a caller needs TanStack's context
or `onSettled`, widen the options then.
