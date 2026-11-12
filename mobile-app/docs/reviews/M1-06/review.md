# Review M1-06 — Offline cache (persistence, banner, wipe)
Date: 2026-11-13 · Reviewer: architect (Claude Opus) with an independent reviewer agent; findings 1–2 verified in code · Verdict: **changes-requested** (two Majors)
Branch: `mobile/M1-06-offline` @ 69b3fce · Commands (worktree B): tsc ✓ · jest 295 ✓ · ESLint 0 errors · lint:fences ✓

Verified correct: key shapes match the factories exactly (access, my-session/board for today, patient detail; list/check-phone/theme
excluded); success-only; buster `ver:user:org:loc` and idle persister while identity is incomplete; maxAge 24 h; cache-open failure
degrades to online-only with no unencrypted fallback; splash waits for the cache; location switch cannot restore old-location data;
banner time on the clinic clock; offline buttons; nothing written to prefs.

## Findings (fix #1, #2, #4, #5, #6, #7; #3 and #8 as noted)

| # | Sev | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | **Major** | staff/lib/persist-cache.ts:13–25 | `sealed` is checked when TanStack **calls** `persistClient`, but the inner sync persister throttles (trailing, 1 s) and writes later — after `wipeSecureCache` has deleted the MMKV instance (verified in `query-sync-storage-persister`). The mock hides it | Check the seal **at write time** inside the storage `setItem` you pass to `createSecureQueryPersister` (and `removeItem`), and make the seal per persister instance (not a module global reset in render). Test: `persistClient` → wipe → advance timers → no `set` on the old instance |
| 2 | **Major** | core/query/create-query-client.ts:12 vs PERSIST_MAX_AGE | `gcTime` 10 min < maxAge 24 h → inactive/restored queries are dropped and the next write removes them from disk; the "24 h cache" is ~10 min | Staff client `gcTime` = 24 h (`createQueryClient({ gcTime })` option, staff passes 24 h) — 02 §9 updated |
| 3 | Minor | staff/lib/persist.ts:31 | Every patient detail persists; 02 §9 says last 20 | Keep the 20 newest by `dataUpdatedAt` in `shouldDehydrateQuery` |
| 4 | Minor → fix | staff/lib/persist.ts:27–29 | Appointments rule persists any key containing today's date | Match the exact shape (`['appointments','list', …, ymd]` positions); add the key factory if missing |
| 5 | Minor → fix | persist.test.ts | "Never written" proven only on the predicate | Real `persistQueryClientSave` + `staffDehydrateOptions` + persister over mock MMKV; seed forbidden keys; assert the stored JSON contains only allowed keys |
| 6 | Minor → fix | staff/lib/api.ts:89 | Forced sign-out (refresh 401/403 → `dropSession`) does not wipe the encrypted cache | Wipe there too (same `wipeStaffPersistedCache`) |
| 7 | Minor → fix | useSignOut.test.tsx:37–41 | Test does not prove wipe runs before `queryClient.clear()` | Assert call order |
| 8 | Minor | StaffLayout.tsx `key={persistKey}` | Remount resets navigation on location switch / login | Accepted for MVP; note it |

## Answers
1. Cached board on an offline cold start: separate follow-up card **M1-06b** (read the identity hint from the encrypted staff cache, never prefs; restore read-only only after a network-error refresh, never after 401).
2. Stack remount on location switch: acceptable for now.
