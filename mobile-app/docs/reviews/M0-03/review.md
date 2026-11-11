# Review M0-03 — Storage layer (prefs + encrypted cache)
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done** (one major fixed at merge)
Branch: `mobile/M0-03-storage` @ b235a1f (+ bc8184d docs)
Commands run by reviewer (worktree B): `tsc --noEmit` ✓ · ESLint `src` ✓ 0 errors · tests not runnable yet (M0-06)

## Findings

| # | Severity | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Major | `package.json` | `react-native-mmkv@4` is a Nitro module and needs `react-native-nitro-modules` as a **direct** dependency (it is only present as a hoisted peer); native autolinking may miss it | Architect adds it at merge: `npx expo install react-native-nitro-modules` |
| 2 | Major (process) | — | MMKV v4 is native code: **the app no longer runs in Expo Go**. Every device run from now on needs a development build (`npx expo run:android`, or the EAS dev profile from M0-07) | Docs updated (CLAUDE.md commands, M0-04 acceptance) |
| 3 | Minor | `secure-cache.ts` `toBase64` + `slice(0, 32)` | Hand-rolled base64 then truncation; works (192-bit key) but is more code than needed | Next touch: `getRandomBytes(24)` → base64 is exactly 32 chars, or hex of 16 bytes. Not required now |
| 4 | Minor | `*.test.ts` | Jest globals read through a `globalThis` cast because `@types/jest` is missing | M0-06 removes the shims (card updated) |

## Answers to the implementer's questions

1. 32-character key: accepted (192 bits, MMKV v4 limit). See finding 3 for the cleaner form later.
2. M0-06's MMKV mock must export `createMMKV` and `deleteMMKV` (v4) — added to the M0-06 card.
3. Persister factory stays in `core/storage/query-persister.ts`; 02 §1 updated to say so.

## Acceptance
- [x] Prefs round-trip, unknown key type error, key reuse, wipe — tests written; they run once M0-06 lands.
- [x] No PHI stored.
