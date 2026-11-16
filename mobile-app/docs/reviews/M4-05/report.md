# M4-05 — release hardening: report

Branch `claude/m4-05-release-hardening-d6067b` (on `mobile/develop`). No device here: everything below is code-level.

## 1. Error reporting (A-24)

- Decision written as DECISIONS **A-24**: no provider for the pilot (Play Console Android vitals covers native crashes); Sentry kept as the later option with hard PHI requirements (scrubbed payload only, `sendDefaultPii: false`, sample rate, opaque hashed user id).
- Built: `src/core/observability/{scrub,report,index}.ts` + `observability.test.ts`. `reportError(err, context)` scrubs (URLs, emails, uuids, tokens, bearer, phone/long digit runs; an error's body/headers/config are never read; context allow-list `route|code|status|source|screen|space`; routes templated `:id`), then calls the optional provider (`setErrorReporter`) or a dev-only `log.warn`; release without a provider is a no-op. Never throws.
- Wired: root `ErrorBoundary` (`src/shell/RootErrorBoundary.tsx`, exported from `app/_layout.tsx`; retry screen; new keys `common.crashTitle/crashBody` en+ur) and `createQueryClient` `QueryCache`/`MutationCache` `onError` (both spaces' clients). Before this there was no error boundary at all.
- No package needed for the shipped state. Only if option (1) is chosen later: `npx expo install @sentry/react-native` (+ its config plugin).

## 2. Performance

Budgets: docs/09 §5. Code audit:
- FlashList is used for every long list (7 lists); all have `keyExtractor`; `getItemType` where rows differ; v2 needs no `estimatedItemSize`. Patient lists are bounded (per account) or paged (`useInfiniteQuery`); staff lists are paged.
- Fixed: `ArrivalRow`, `ScheduleRow`, `NotificationRow`, `WaitingRow` are now `memo` (`PatientRow` already was). Memo only pays off once callers pass stable props; `ArrivalsPage` / `ScheduleTabPage` still create inline per-row closures (cheap; left alone to avoid behaviour changes — follow-up if the device shows jank).
- **Needs device measurement:** cold start, bundle size (`expo export`), install size, 500-row fling on Arrivals/Patients/Board, memory soak on the board with realtime, battery overnight with reminders.

## 3. Patient gate walk (docs/09 §6)

| Item | Result |
| --- | --- |
| loading / empty / error / no-results | All patient pages OK (Records via `RecordsList` incl. no-results; Clinics, Family, Profile, Today, details). Form-only pages n/a. |
| 44 pt / nested Pressables | OK: `DoseRow` buttons `min-h-11` and its summary is a separate accessible block; `RecordCard` has no inner buttons; `ClinicChip` is 44 pt when pressable and only pressable outside cards (detail page); confirm button sits outside the card pressable (M3-08). |
| a11y labels on icon-only | OK (`IconButton` requires one). |
| Strings via `useT`, ur present | **Fixed:** `WelcomePage` and `UpdateRequiredPage` (both shown to patients) were hard-coded English → keys `shell.welcome.*`, `shell.update.*` in en + ur. Remaining English: the `YYYY-MM-DD` DOB placeholder (format hint, intentional). |
| Time formatting | OK: record times via `formatInZone`; `new Date` in medications/today is phone wall-clock by design (A-10). |
| Sign-out wipes | OK: `signOutPatient` revokes, drops the token, wipes encrypted cache + key, reminders/dose queue, pending claim, analytics queue, query cache. Push-device unregister joins with M3-07. |
| PHI in logs / prefs / URLs / notifications | OK: no `console.*` in patient/shell; only `core/log.ts` and observability; prefs hold only allow-listed items. Push text is M3-07's. |

## 4. Needs device (M0-D)
Cold start / bundle / fling numbers above; TalkBack pass on Today, Records, claim; Urdu layout with Nastaliq on the new crash / welcome / update screens; error-boundary retry by forcing a render throw in a dev build; Play Console vitals enabled for the release track.

## 5. For other owners (not touched)
- M3-06/M3-07 area (`features/visit`, `features/devices`, `notification-router`, backend realtime/notifications): not audited; run docs/09 §6 on the live token card when it merges.
