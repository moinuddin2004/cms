# Review M1-01 — Core component kit
Date: 2026-11-11 · Reviewer: architect (Claude Opus) with an independent reviewer agent; every Blocker verified by the architect · Verdict: **changes-requested**
Branch: `mobile/M1-01-core-kit` @ bf55629 · Commands (worktree A): tsc ✓ · jest 17 suites / 69 tests ✓ · ESLint 0 errors · lint:fences ✓

Clean: tokens only, logical classes only (incl. `cn()` and template strings), no console/memo/`t()`, no core→space imports,
no `core/ui` edits, IconButton label required at type level, StatusBadge uses status-tones, gallery route logic-free and dev-only.

## Findings (fix #1–#4; #5–#11 fix if cheap, otherwise note why not)

| # | Sev | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | **Blocker** | overlays/FormSheet.tsx:23, 85–90 | gorhom ignores keyboard-shown until a focused `BottomSheetTextInput` sets `target` (`useAnimatedKeyboard.ts:66`, `BottomSheetTextInput.tsx:34–36` — verified). With plain `FormInput` the sheet never moves: the keyboard covers the fields and the sticky submit | Inside a FormSheet, inputs must render `BottomSheetTextInput`, e.g. a `SheetInputContext` that `FormInput` reads to swap the component. Remove the wrong doc comment. Add a render test that `FormInput` inside `FormSheet` renders the sheet input |
| 2 | Major | FormSheet.tsx:64–80, 90; ActionSheet.tsx:36 | `Footer` and `makeBackdrop()` create new component types every render → remount on every keystroke, footer re-measures, press state lost | Module-level components; pass `submit` / `onPress` via props or context |
| 3 | Major | layout/Screen.tsx:47–58; GalleryPage.tsx:248 | FAB rendered inside the scroll view, so it scrolls away | Add a `floating` slot rendered outside the scroll container; use it in the gallery |
| 4 | Minor → fix | FormSheet.tsx:71 | `accessibilityState.disabled` ignores `pending` | `disabled: !!(submit.disabled || submit.pending)` |
| 5 | Minor | FormSheet.tsx:59–61, 115 | Programmatic dismiss while dirty opens the confirm over a gone sheet; Android back with the confirm open re-opens it | Non-user dismiss → `onClose`; back closes the confirm first |
| 6 | Minor | IconButton.tsx:37; ConfirmDialog.tsx:72; FormSheet.tsx:74 | `ActivityIndicator` has no colour (hard to see on primary/destructive in dark) | Small `Spinner` that takes the button's foreground token colour |
| 7 | Minor | forms/FilterChips.tsx:59 | Active count only on the Clear chip; multi-select uses the button role | Count on a "Filters" chip per 05 §7 (or note); `checkbox` role when `multiple` |
| 8 | Minor | layout/SectionHeader.tsx:16–18 | `h4` + override instead of `h3`; count padded with spaces | Use `h3`; count in its own `Text` with a gap |
| 9 | Minor | ListRow.tsx:56; FilterChips; SegmentedControl | `numberOfLines={1}` clips at 1.3× (05 §8 "wrap, don't clip") | Titles and chips allow 2 lines |
| 10 | Minor | ScreenHeader.tsx:29; SearchBar.tsx:25; ErrorState.tsx:23 | English default strings would leak into the Urdu patient space | Keep defaults, but each prop doc says "staff default; patient callers must pass a translated string" |
| 11 | Minor | tests | No table test for status-tones (05 §2); no SearchBar echo-while-typing test | Add both |

## Answers to the handoff questions
1. `BottomSheetModalProvider` in RootProviders (before `PortalHost`) and the jest config change: accepted.
2. Pan-down disabled while dirty: accepted.
3. `Screen` default edges → `['top']`; full-screen/modal flows pass `['top', 'bottom']`.
4. Gallery entry point: M1-02 adds a dev-only "Component gallery" row in More (card updated).

## Acceptance
Components ✓ (except #1) · tests ✓ · labels ✓ · screenshots → gate M0-D.
