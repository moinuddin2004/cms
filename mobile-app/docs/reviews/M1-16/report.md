# M1-16 — Staff hardening pass (code half) + M1-06b

Date: 2026-11-15 · Author: Sonnet session · Scope: code only, no device. Gate M0-D (device) is still open.

## 1. Carried-over nits

| Nit | Result |
| --- | --- |
| M1-12 patient detail pull-to-refresh | Fixed. Pull now refetches the patient, invalidates every cached `patients/*` child key that carries this patient id (history, vitals, Rx, chart; never list / check-phone) and `queueKeys.patientVisits(id)`. The spinner is tied to the whole batch. Test added. |
| M1-12 Rx "latest 20" footer | Fixed: "Showing latest N of TOTAL" under the list when `total > rows`. |
| M1-12 WhatsApp country code | Fixed: `whatsappUrl(phone, countryCode)`. A `+`/`00` number is untouched; a national `03…` number gets the clinic code in place of the `0`. The app has no clinic country field, so the code comes from the clinic currency (`dialCodeForCurrency`: PKR 92, INR 91, BDT 880, AED 971, SAR 966, GBP 44, USD 1). Unknown currency = unchanged (old behaviour). **Follow-up:** a real country / dial code on the organization from the backend would be cleaner. |
| Read-only sheet instead of FormSheet-with-dummy-discard | `core/components/overlays/ReadOnlySheet.tsx` (same chrome, optional sticky `submit`, no discard strings). RxSegment, TicketSheet and AppointmentSheet switched; the dummy discard constants are gone. It wraps `FormSheet`, so no new gesture/reanimated code. |
| M1-13 QueueTabPage `?segment=board` vs saved `doctor` | New `QueueTabPage.test.tsx` (param wins both ways, saved choice, board-only user, doctorId param). |
| M1-13 Mark-all disabled | Disabled only when the count is known to be 0 (or, with no count, the loaded rows are all read). A loading/failed count no longer locks it. |
| M1-08 waiting minutes freeze | `useTickingNow` moved to `queue/hooks`; the doctor list already used it, the **board lane list now uses it too** (`extraData` so FlashList rows re-render). |
| Jest open-handle warning | See section 4. |
| core `formatMoney` fraction digits | Whole amounts: 0 decimals; fractional: always exactly 2 (`PKR 84,000.50`). Test added. |
| M1-15 Today doctor row → lane | Done cheaply: the Queue tab reads a UUID-validated `doctorId` param and selects that lane (`useBoardUiStore.selectDoctor`); the Today row sends `{ segment: 'board', doctorId }` when the user has `queue.board.view`, plain `/queue` otherwise. |

## 2. M1-06b — Cached staff data on an offline cold start

- `staff/lib/offline-hint.ts`: `parseOfflineHint` reads identity (`userId / orgId / locationId`, ids only) from the **persisted client's buster** in the **encrypted** staff cache (`openSecureCache('staff')`). It rejects: unreadable JSON, another app version, older than `PERSIST_MAX_AGE`, an empty cache, an incomplete identity. Prefs are never read or written for this.
- `useRestoreStaffSession`: the hint is loaded **only** when the refresh failed with a network error (axios error with no response). 401/403 → `refreshSession` already wipes the cache and signs out (no hint). 5xx (server answered) → offline screen, no offer. A new restore clears a stale hint.
- `OfflinePage`: a second button **Open saved data** when a hint exists. It calls `openSavedData(hint)`: the store goes `signedIn` with `offlineSnapshot = true`, no access token, the saved org/location ids (user uuid = hint so the persist buster matches and the cache restores).
- Read-only: the staff axios request interceptor refuses every non-GET locally while `offlineSnapshot` (ERR_NETWORK, never sent). GETs still go out; a 401 triggers the normal refresh, and a successful `setSession` clears the snapshot flag (it recovers by itself when the network returns). `clearAuth` clears it too.
- Tests: `offline-hint.test.ts` (parse cases), `useRestoreStaffSession.test.tsx` (network → hint; 401/403 → none and the cache is never read; 5xx → none; stale hint cleared; `openSavedData` state), `api.test.ts` (writes refused, reads pass).
- Known limit: the cached org/location **objects** (name, currency, timezone) are not in the encrypted cache, so in snapshot mode clinic times use the phone timezone and money uses the PKR default until the next successful login. Worth a follow-up card if clinic phones can differ from clinic time.
- Needs device (M0-D): airplane-mode cold start → Open saved data → cached Today/board/patient visible; turn the network on → it recovers to a normal session.

## 3. Staff gate checklist walked in code (docs/09 §4 + Definition of Done items)

| Item | Result |
| --- | --- |
| States on every list/detail (loading / empty / error+retry / no-results) | Walked Arrivals, Schedule, Notifications, Patients (list + detail), Board lane, Doctor queue, Today blocks. All have loading, error with retry and empty. No-results exists on the two filtered lists (Patients, Schedule). OK. |
| 44 pt targets | All `IconButton`s are 44×44 (core). Rows/chips/buttons use `min-h-11` / `min-h-14`. **Fixed:** `FormInput` was `h-10` (40 pt, fixed) → `min-h-11`; `SearchBar` `h-11` → `min-h-11`. |
| accessibilityLabel on icon-only controls | 20/20 `IconButton` call sites pass a label (required by its type); the raw `Pressable`s all carry role + label (DayStrip, rows, chips, switch, hold toggle, FAB). OK. |
| Theme tokens, no hex | grep: no hex / rgb(a) / palette classes in staff, shell or core/components. The one `backgroundColor` is the tab bar, from theme tokens. OK. |
| Logical classes only | grep for `ml- mr- pl- pr- left- right- text-left/right border-l/r rounded-l/r`: none. OK. |
| Dark-mode token coverage | No fixed light colours anywhere (all via tokens). Visual check needs a device. |
| Font scaling at 1.3× (no fixed heights that clip) | **Fixed:** `FormInput` `h-10`, `SearchBar` `h-11`, `SelectLocationPage` `h-12` → `min-h-*`; the reason-sheet textarea `h-24` → `min-h-24`. Remaining fixed sizes are icons / skeletons / avatars only. Real 1.3× screenshots: device. |
| PHI rules | No `console.*` outside `core/log` (dev-only); prefs hold only allow-listed keys (queue segment, theme cache, space); toasts never include numbers/diagnoses (the Call/WhatsApp failure toast has no number); the persist allow-list excludes lists/search/check-phone (unchanged). Noted, not changed: the walk-in success toast shows the patient name (local UI, not a log) and error toasts show server messages via `apiErrorMessage`. |
| Permission gating | No role-name or `isSuperAdmin` checks in feature code (only the access provider). Segments/blocks/actions use `can()` / `hasFeature()`; denied blocks are hidden, not errors. OK. |
| Fences | `lint:fences`: all 3 forbidden directions fail lint as expected. |

## 4. Jest "worker failed to exit gracefully"

**NOT fixed.** `jest --detectOpenHandles` over the whole suite did not finish in 10+ minutes here (runs in band), so no handle was named. What was established: the warning appears with the full run and with each of `src/core`, `queue`, `patients`, `appointments`, `notifications` run alone, but not with `src/staff/lib`, `today`, `shell`, `src/patient`, so the leak is in a shared piece (not one feature). Tried and rejected: unref-ing every timer of 60 s or more in `jest.setup.ts` (TanStack gc timers) — warning stayed, change reverted. Next step for whoever picks it up: run `npx jest <one dir> --detectOpenHandles` per directory (core first) or bisect with `--maxWorkers=2` file lists. All 730 tests pass; the warning is cosmetic.

## 5. Needs device (M0-D) — not done here

- Cold start time and APK size (preview build) numbers.
- TalkBack pass over Today / Queue / Board / Patients / Notifications.
- Real 1.3× font screenshots and a dark-mode visual pass.
- Gate checklist rows of docs/09 §4: full doctor session, reception on a second phone, Wi-Fi kill mid-action, background push → opens queue, location switch, `queue.board.view` hiding the board segment.
- M1-06b airplane-mode cold start flow (section 2).

## 6. Known issues / not fixed

- Dial code derived from currency (see nits). Severity low.
- Snapshot mode uses the phone timezone / default currency (see M1-06b). Severity low; offline cold start only.
- `lint` prints 5 pre-existing warnings (axios named-export hints in `core/http/api-error.ts` and `staff/lib/api.ts`, `core/ui/skeleton.tsx`, one test). 0 errors.
