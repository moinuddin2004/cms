# M4-05 — release hardening: report

Branch `claude/m4-05-release-hardening-d6067b` (on `mobile/develop`). No device here: everything below is code-level.

## 1. Error reporting (A-24)

- Decision written as DECISIONS **A-24**: no provider for the pilot (Play Console Android vitals covers native crashes); Sentry kept as the later option with hard PHI requirements (scrubbed payload only, `sendDefaultPii: false`, sample rate, opaque hashed user id).
- Built: `src/core/observability/{scrub,report,index}.ts` + `observability.test.ts`. `reportError(err, context)` forwards only: error `name` (plain identifier), API `code`, HTTP `status`, and a `message` only if it is a known generic transport message (free text can contain a name and regexes cannot find names, so anything else is dropped). An error's body/headers/config are never read; context allow-list `route|code|status|source|screen|space`; routes are templated (ids of any length after known path nouns, other segments string-scrubbed). `scrubString` (for context strings) also redacts JWTs, URLs, emails, uuids, token-like runs, phone numbers and `token|password|code|...=value` pairs. Then it calls the optional provider (`setErrorReporter`) or a dev-only `log.warn` (skipped for expected failures: API code / HTTP status / offline); release without a provider is a no-op. Never throws.
- Wired: root `ErrorBoundary` (`src/shell/RootErrorBoundary.tsx`, exported from `app/_layout.tsx`; retry screen; keys `common.crashTitle/crashBody` en+ur; Urdu + Nastaliq (`UrduFontScope`) only when the active space is `patient`, English otherwise) and `createQueryClient` `QueryCache`/`MutationCache` `onError` (both spaces' clients). Before this there was no error boundary at all.
- No package needed for the shipped state. Only if option (1) is chosen later: `npx expo install @sentry/react-native` (+ its config plugin).

## 2. Performance

Budgets: docs/09 §5. Code audit:
- FlashList is used for every long list (7 lists); all have `keyExtractor`; `getItemType` where rows differ; v2 needs no `estimatedItemSize`. Patient lists are bounded (per account) or paged (`useInfiniteQuery`); staff lists are paged.
- Fixed: `ArrivalRow`, `ScheduleRow`, `NotificationRow`, `WaitingRow` are `memo` (`PatientRow` already was) and call sites now pass stable props: `useStableCallback` (new `core/hooks`) for Arrivals check-in and Notifications open, `useCallback` for the schedule sheet, notification row models built once in a `useMemo`. `ScheduleRow.onPress` / `NotificationRow.onPress` now receive the row / id. `WaitingRow` gets `setRowMenu` (a state setter, stable); it re-renders with `now` by design.
- **Needs device measurement:** cold start, bundle size (`expo export`), install size, 500-row fling on Arrivals/Patients/Board, memory soak on the board with realtime, battery overnight with reminders.

## 3. Patient gate walk (docs/09 §6)

| Item | Result |
| --- | --- |
| loading / empty / error / no-results | All patient pages OK (Records via `RecordsList` incl. no-results; Clinics, Family, Profile, Today, details). Form-only pages n/a. |
| 44 pt / nested Pressables | OK: `DoseRow` buttons `min-h-11` and its summary is a separate accessible block; `RecordCard` has no inner buttons; `ClinicChip` is 44 pt when pressable and only pressable outside cards (detail page); confirm button sits outside the card pressable (M3-08). |
| a11y labels on icon-only | OK (`IconButton` requires one). |
| Strings via `useT`, ur present | **Fixed:** `WelcomePage` and `UpdateRequiredPage` were hard-coded English → keys `shell.welcome.*`, `shell.update.*` in en + ur. Both screens render before a space is chosen (and to staff) and outside `UrduFontScope`, so they deliberately show English only (`translate(key, undefined, 'en')`); the ur values are ready for when a patient-only variant exists. Remaining English: the `YYYY-MM-DD` DOB placeholder (format hint, intentional). |
| Time formatting | OK: record times via `formatInZone`; `new Date` in medications/today is phone wall-clock by design (A-10). |
| Sign-out wipes | OK: `signOutPatient` revokes, drops the token, wipes encrypted cache + key, reminders/dose queue, pending claim, analytics queue, query cache. Push-device unregister joins with M3-07. |
| PHI in logs / prefs / URLs / notifications | OK: no `console.*` in patient/shell; only `core/log.ts` and observability; prefs hold only allow-listed items. Push text is M3-07's. |

## 4. Needs device (M0-D)
Cold start / bundle / fling numbers above; TalkBack pass on Today, Records, claim; Urdu layout with Nastaliq on the new crash / welcome / update screens; error-boundary retry by forcing a render throw in a dev build; Play Console vitals enabled for the release track.

## 5. For other owners (not touched)
- M3-06/M3-07 area (`features/visit`, `features/devices`, `notification-router`, backend realtime/notifications): not audited; run docs/09 §6 on the live token card when it merges.
