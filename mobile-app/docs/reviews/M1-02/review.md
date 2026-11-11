# Review M1-02 — Staff tabs shell, More tab, location switch, sign-out
Date: 2026-11-11 · Reviewer: architect (Claude Opus) with an independent reviewer agent; finding 1 verified in code · Verdict: **changes-requested** (one Major)
Branch: `mobile/M1-02-staff-shell` @ c1398eb · Commands (worktree A): tsc ✓ · jest 107 tests ✓ · ESLint 0 errors · lint:fences ✓

Verified correct: route files logic-free; tab layout in `staff/navigation`; gates exactly per 02 §4 with `href: null`; initial tab order;
no role-name gating; switch-location in `auth.api.ts`, access key includes org + location, theme and other queries removed, error
leaves store and cache unchanged; `Uniwind.setTheme` from the cached/live theme and reset to `'system'` on leave (no loop); old home
and dashboard removed cleanly; gallery row `__DEV__` only; sign-out via ConfirmDialog; version via expo-application.

## Findings (fix #1–#3, #5; others if cheap)

| # | Sev | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | **Major** | staff/navigation/StaffTabs.tsx:42–55; more/pages/MorePage.tsx:35 | When `/me/access` fails (offline cold start, 5xx) every `can()` is false: only More shows, and `noFeatures` is false because status is `error` — a stuck More-only app with no message or retry (05 §7) | On `access.status === 'error'` show `ErrorState` with retry (`access.refetch`) — on More and as a banner above the tabs; test it |
| 2 | Minor → fix | more/lib/clear-staff-cache.ts:15; useSwitchLocation.ts:28–29 | Awaits `invalidateQueries(accessKeys.all)` before `setLocationContext` → a wasted refetch of the old location's access | Remove non-access queries → `setLocationContext` → let the new access key fetch (do not await an invalidate of the old key) |
| 3 | Minor → fix | useSwitchLocation.ts | Order and failure path untested | Hook test: success moves the store after the clear; error changes neither store nor cache |
| 4 | Minor | more/components/SwitchLocationSheet.tsx:22–27 | Current location marked only by an icon; tapping it closes the sheet | "(current)" in the label / `accessibilityState.selected`, no action on tap |
| 5 | Minor → fix | notifications/components/NotificationBell.tsx:17–21 | Enabled button without `onPress` | `disabled={!onPress}` until M1-13 |
| 6 | Minor | StaffTabs.tsx:49–55 | The jump to the first allowed tab runs once; after a role change expo-router falls back to the first *visible* tab | Document it in the component comment |
| 7 | Minor | StaffTabs.tsx:63 | `tabBarStyle` inline object (navigator chrome; colours from tokens) | Accepted; 04 §4 now names navigator options as the allowed exception |

## Answers
1. Receptionist sees Today: correct per 02 §4 / 06 S-01 — the card's acceptance line was wrong and is fixed.
2. Notification settings, Check for updates, Help rows: correctly left for M1-13 / later.
3. Brand after a location switch: fine as built.

Note for M1-03 (added to its card): resubscribe rooms whenever `activeOrganizationId` or `activeLocationId` changes.
