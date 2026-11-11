# Review M0-06 — Mobile test runner
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done**
Branch: `mobile/M0-06-tests` @ e881b03 (+ a24839a docs)
Commands run by reviewer (worktree B): `jest` → 5 suites / 16 tests ✓ · `tsc --noEmit` ✓

## Findings

| # | Severity | File | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Minor | `package-lock.json` | ~17k lines of churn (dev flags from `expo install`, not just the moved root lists) | Architect normalises with `npm install` at merge |
| 2 | Minor | `jest.setup.ts` | `expo-notifications` mock is `virtual: true` | Drop `virtual` once M0-07 installs the package (M0-07 card) |
| 3 | Minor | `tsconfig.json` | `"types": ["jest"]` limits auto-included global types to jest | Fine today (typecheck green); revisit only if a global type goes missing |

## Answers
1. The `__mocks__/react-native-mmkv.ts` wrapper around the library's own `createMockMMKV` is the right call.
2. Yes — each remaining row of 09 §2's test table belongs to the card that creates the module.

## Acceptance
- [x] `npm test` green (re-run). [x] Storage shims removed, files pass. [x] First tests added. [x] README updated.
