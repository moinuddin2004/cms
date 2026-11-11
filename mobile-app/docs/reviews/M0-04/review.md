# Review M0-04 — Space store, welcome screen, two-level guards
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **code done — device check pending (gate M0-D)**
Branch: `mobile/M0-04-spaces` @ 649d323 (+ 6e416fc docs)
Commands run by reviewer: code read in full; typecheck/lint/tests re-run on `mobile/develop` after merging M0-06 (see HANDOFF)

## Findings

| # | Severity | File | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Major (open) | — | Device acceptance not run: no emulator / SDK on the implementer's machine | Tracked as **M0-D Device smoke** in PROGRESS; must pass before M1-02 starts |
| 2 | Minor | `staff/navigation/StaffLayout.tsx` | Restore runs on every mount: switching back to an already signed-in staff space sets `restoring` → login screen flashes | M2-06 (when switching becomes real): skip restore when `status === 'signedIn'` (card updated) |
| 3 | Minor | `patient/index.ts` | Barrel exports `PatientLayout` "for the shell", but only the route file uses it | Fine; the barrel grows in M2-06 |

Design calls accepted: `claim/[token]` not declared yet; placeholder split into layout + page; `removePref` for `null`;
no language toggle until i18n exists; `mustSelectLocation` + `clinicBlocked` as two inputs.

## Answers
1. Keeping typecheck red until M0-06 merges was right — merged in order, now green.
2. `/(patient)` vs root `/`: covered by the device smoke (M0-D).
3. Two flags are fine.
