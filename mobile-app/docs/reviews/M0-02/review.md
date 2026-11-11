# Review M0-02 — Import fences (lint) and lint hygiene
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done**
Branch: `mobile/M0-02-lint-fences` @ 7a3c4f8 (+ 0d9d3db docs)
Commands run by reviewer (worktree A): `tsc --noEmit` ✓ · ESLint `src` ✓ 0 errors / 3 old warnings · `lint:fences` ✓ both fixtures rejected

## Findings

| # | Severity | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Minor | `eslint.config.js` (`NO_DIRECTIONAL_CLASSNAME`, `NO_HEX_CLASSNAME`) | Only plain string `className` literals are checked; `cn('ml-2')`, template literals and `contentContainerClassName` escape the rule | Accepted as a backstop; reviewers still grep. Extend if a violation slips through |
| 2 | Minor | `eslint.config.js` | Root `src/app/*` files and the "route groups may not import `@/shell`" rows of 02 §1 are not enforced yet | Deferred to M0-04 (card updated) — enforcing now would fail on the current `_layout.tsx` |

No blockers, no majors.

## Answers to the implementer's questions

1. Root-app and route-group rows: intentionally deferred — added to M0-04's steps.
2. `no-console: off` for `src/core/log.ts` only: accepted. It is the single sink by design.
3. `src/staff/index.ts` barrel for the shell: correct per 02 §1.

## Acceptance
- [x] lint + lint:fences pass (re-run). [x] Deliberate violation output in handoff. [x] No suppressions.
