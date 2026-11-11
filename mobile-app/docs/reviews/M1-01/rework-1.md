# Review M1-01 rework #1
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done** (screenshots → gate M0-D)
Commits: 2aec2bc + 23d54f3 · Commands (worktree A): tsc ✓ · jest 83 tests ✓ · ESLint 0 errors

- #1 fixed: `SheetInputContext` + `FormInput` renders `withUniwind(BottomSheetTextInput)` inside a `FormSheet`; render test added. Minor:
  `SHEET_INPUT_CLASS` duplicates the RNR input classes (cannot import them) — keep in sync if `core/ui/input` is regenerated.
- #2 fixed: `SubmitFooter` + `sheet-parts.tsx` are module-level; the footer is created once (`useState` initializer) and fed through a small store.
- #3 fixed: `Screen` has a `floating` slot outside the scroll container; gallery FAB moved.
- #4–#11 handled (Spinner helper, SectionHeader `h3`, two-line titles/chips, checkbox role, prop docs, status-tones table test, SearchBar echo test).
- Screen default edges `['top']` applied.

Device check of keyboard behaviour, Android back and TalkBack joins gate M0-D.
