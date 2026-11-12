# Review M1-03 — Staff realtime client
Date: 2026-11-13 · Reviewer: architect (Claude Opus) with an independent reviewer agent; findings 1–2 verified in code · Verdict: **changes-requested** (two Majors)
Branch: `mobile/M1-03-staff-realtime` @ f37c3b9 · Commands (worktree A): tsc ✓ · jest 285 ✓ · ESLint 0 errors · lint:fences ✓

Verified correct: `auth` callback (fresh token on reconnect); `auth_error` → one refresh, no loop; background disconnect after 30 s and
reconnect + invalidate on foreground; rooms re-joined after reconnect, org room always, old rooms left on org/location change; 300 ms
coalescing; realtime never writes cache data (A-07); toast gated on foreground and route; no token logging; fences.

## Findings (fix #1–#4, #6; #5, #7 if cheap)

| # | Sev | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | **Major** | staff/lib/realtime-provider.tsx:63–77; realtime.ts:52, 81, 210 | The controller is created once (`useState`) but the effect cleanup calls `dispose()`, which sets `disposed = true` for good. A second effect run (StrictMode double-invoke, Fast Refresh) → `connect()` returns early → realtime silently dead | Create the controller + invalidator inside the effect (keep them in a ref/state for the context), or make dispose/connect reversible. Test: mount → unmount → mount (or StrictMode) leaves exactly one live socket |
| 2 | **Major** | staff/lib/realtime-invalidation.ts:47–79, 115 | Stale check uses the **max** `eventSeq` across session/board/my-session caches, then skips every key — a cache that is behind never refreshes (relay lags HTTP) | Compare per key: invalidate each key whose own cached seq is missing or `< e.seq` (web does this per snapshot). Test: board ahead, session behind |
| 3 | Minor → fix | realtime.ts:133–145; realtime-provider.tsx:68–70 | `auth_error` refresh + the token subscription each reconnect → two cycles | **Remove the token-driven reconnect entirely** (the gateway checks the JWT only at handshake and the `auth` callback already supplies the fresh token). 02 §7 updated |
| 4 | Minor → fix | realtime.ts:92 | Status turns `live` on `connect`, before the token is accepted → pill flickers | `live` only after the org-room subscribe ack is `ok` |
| 5 | Minor | realtime.ts:166–176 | Subscribe ack `ok:false` ignored | `log.warn` (room name only) and retry on next connect |
| 6 | Minor → fix | realtime-provider.tsx:55–59 | Toast for another clinic's notification looks the same; no dedupe | Tag other-clinic toasts (or skip them) by `e.organizationId`; toast id `notification-${e.id}` |
| 7 | Minor | realtime-invalidation.ts:29–30, 64–66 | `'board'` / `'my-session'` prefixes hard-coded | Add `queueKeys.boardAll()` / `mySessionAll()` and use them |

## Answers
1. Token refresh → reconnect: drop it (finding 3); 02 §7 says so now.
2. Invalidate-all on foreground after ≥ 30 s even if the socket survived: keep.

Live checks (web role change → phone in 2 s; server log of the 60 s background disconnect) join gate M0-D.
