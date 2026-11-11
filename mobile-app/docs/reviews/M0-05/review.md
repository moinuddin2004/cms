# Review M0-05 — Design tokens, text scale and brand theming
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done** (visual check joins gate M0-D)
Branch: `mobile/M0-05-theme` @ 9512648
Commands run by reviewer (worktree A): `tsc` ✓ (with generated route types) · `jest` 10 suites / 53 tests ✓ · ESLint 0 errors · `lint:fences` ✓ · no hex outside `global.css` / `core/theme`

## Findings

| # | Severity | File | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Minor | `staff/features/theme/lib/apply-cached-brand.ts` | Cached brand is painted without checking `orgId`; after a clinic switch the previous clinic's colour shows until `GET /theme` answers | Accepted (cold start is almost always the same clinic). Revisit only if users notice |
| 2 | Minor | `core/theme/platform-tokens.ts` | Hex values duplicated from `global.css` (cannot import CSS) | Accepted — the sync test guards it |
| 3 | Process | commit | Code and docs in one commit | Fine; keep them split next time (A-15 template) |
| 4 | Open | — | Light/dark screenshots and the no-flash cold start need a device | Added to M0-D |

## Answers
1. Variant → class mapping (h1→4xl … small/muted→sm): accepted; recorded in 05 §3.
2. `theme.default_mode`: M1-02 applies it with `Uniwind.setTheme` on the staff space and restores `'system'` on leave (card updated).
3. Cold-start `orgId` filter: no — keep the no-flash paint (finding 1).

Excellent spike work: proving from the compiled bundle that `text-*` resolves through `--text-*` saved a patch to generated code.
