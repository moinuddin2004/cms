# Review M1-03 rework #1
Date: 2026-11-13 · Reviewer: architect (Claude Opus) · Verdict: **done**
Commits: 4afcbc7 + e8a2939 · Commands (worktree): tsc ✓ · jest 289 ✓ · ESLint 0 errors · lint:fences ✓

- #1 fixed the reversible way: `connect()` resets `disposed`, so a second effect run (StrictMode / Fast Refresh) reconnects; `realtime-provider.strict.test.tsx` renders under `<StrictMode>` and proves one live socket.
- #2 fixed: staleness per cached key (`behind(own seq, e.seq)` for session, each board lane, my-session).
- #3 token-driven reconnect removed; #4 `live` only after the org-room ack; #6 other-clinic toasts tagged + deduped by id; #5/#7 handled.
- Note for later: `dispose()` clears the room set; rooms come back because their owners' effects re-run too. If a room owner ever subscribes outside an effect, revisit.
