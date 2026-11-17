# UI/UX review — mobile app (UI-01, 2026-11-17)

Scope: every page under `src/staff/**/pages`, `src/patient/**/pages`, `src/shell/**`, the core kit
(`src/core/components/**`, `src/core/ui/**`, `src/global.css`, `src/core/theme/**`), compared with the web
app's design system (root `CLAUDE.md` "Design System", `web-app/src/styles.css`,
`web-app/src/components/{data-display,feedback}`) and the MedTrackr brand (DECISIONS A-25).

Method: code reading only (no device screenshots in this pass — the visual QA checklist in docs/05 §12 still
applies before release). Line numbers are as of `mobile/develop` @ `0546a54e`.

## Verdict

The app is **functionally consistent and clean** — no hex colours in components, no gradients, no emoji
(one exception), no physical-direction classes, every icon-only control is labelled, and the core kit
(`Screen`, `ScreenHeader`, `ListRow`, `StatusBadge`, `StatTile`, feedback states) is used almost everywhere.
What makes it look less finished than the web app is concentrated in a few places:

1. **Colour tokens don't match the web.** Mobile uses shadcn's pure-grey "neutral" ramp (`hsl(0 0% x%)`) and a
   teal platform primary (`#0e7490`); the web uses the **slate** ramp and the MedTrackr **blue** `#2563eb`.
   Dark mode is flatter than the web: `--card` = `--background`, so cards only exist as a 1px border.
2. **A first impression that looks unfinished:** the welcome screen is a bare picker with a generic heart icon
   and a "Privacy · Terms" line that isn't a link; the patient space opens on a placeholder "Home" tab
   ("… will live here", five stacked buttons incl. red Sign out / Delete account).
3. **Three kit defaults that every screen fights:** RNR `Text variant="h2"` draws a bottom border (all 9
   uses add `border-0 pb-0`), RNR `Button` is 40 pt high (< 44 pt; ~60 call sites add `min-h-11`),
   `text-xs` is not part of the patient text scale (12 pt on "older eyes" screens).
4. **Padding stacks up:** `Screen scroll` already pads `px-4`; several pages and `SectionHeader` add
   another `px-4`, so content sits 32 pt (titles 48 pt) from the edge on the two **Today** tabs, Walk-in and
   Reminders, while siblings use 16 pt (and some pages compensate with `-mx-4`).
5. **Feedback states look different from the web:** the web's empty/error state is a tinted `rounded-2xl`
   icon tile (`bg-primary-soft` / `bg-danger-soft`); mobile uses a grey circle.

## Design-system alignment (web → mobile)

| Web (`web-app`) | Mobile equivalent | Status |
| --- | --- | --- |
| `--brand` `#2563eb` / dark `#3b82f6` (primary) | `--color-primary` platform default | **Plan (UI-01):** `#2563eb` light, `#3f7dff` dark (= `deriveBrandPalette('#2563eb')`, the exact value a clinic with the default web brand gets in the staff space; black foreground keeps ≥ 4.5:1) |
| Slate text `#0f172a`, muted text `#64748b`, border `#e2e8f0`, muted/panel `#f8fafc`, secondary/accent `#f1f5f9` | `--color-foreground`, `-muted-foreground`, `-border`/`-input`, `-muted`, `-secondary`/`-accent` | **Plan (UI-01):** same values |
| Dark: background `#0e1219`, card/surface `#181c23`, secondary `#272b34`, accent `#20242c`, border `#2a2e36`, muted text `#a0a3a9`, text `#f0f4fa` | dark `@variant` | **Plan (UI-01):** same values — cards now lift off the background in dark mode |
| `--destructive` `#ef4444` (3.8:1 with white — web fails AA) | `--color-destructive` | **Plan (UI-01):** `#dc2626` light (4.8:1), `#f87171` + black text dark (7.6:1) |
| `--emerald` `#059669` (success) | `--color-success` | **Plan (UI-01):** `#047857` (emerald-700, same family as the brand gradient, 5.5:1 with white) |
| `--amber` `#d97706`, `--status-info` `#2563eb` | `--color-warning`, `--color-info` | Already equal |
| `--ring` = brand | `--color-ring` | **Plan (UI-01):** ring = primary (was a grey) |
| `--radius` 0.7rem; cards `rounded-xl` | `--radius-xl` 0.875rem; cards `rounded-xl` per docs/05 §4 | Equal in intent; drift to `rounded-lg`/`rounded-md` on 6 screens (see below) |
| `StatusBadge` soft chips (`bg-*-soft` + coloured text) | `StatusBadge` soft = `bg-<tone>/15` + dot + foreground text | Kept: the dot + foreground text is the accessible version of the same look |
| `StatCard` (label, big value, icon tile) | `StatTile` (label + tone dot, `h3` value) | Equivalent; mobile is denser on purpose (docs/05 §1) |
| `EmptyState` / `ErrorState` (tinted `rounded-2xl` tile, bold title, muted text) | same components in `core/components/feedback` | **Plan (UI-01):** tinted `rounded-2xl` tile (primary / destructive), `h3`-weight title |
| Page title `text-2xl font-semibold tracking-tight` | `ScreenHeader` → `Text variant="h2"` (22/24 pt) | Equal; **Plan (UI-01):** the RNR border on `h2` removed at the source |
| Section title `text-lg font-medium` | `SectionHeader` → `h3` | Equal |
| `Button` (shadcn) | `core/ui/button` (RNR) | **Plan (UI-01):** default/lg/icon sizes are now 44 pt |
| Brand mark (`favicon.svg`, white M on `#2563eb → #059669`) | `core/components/brand/BrandMark.tsx` (react-native-svg, same geometry) | **Planned (UI-01)** — used on the welcome page only (A-25) |
| `InitialsAvatar` | `Avatar` + `avatar-tint` | Equivalent |
| Toaster (sonner) | sonner-native | Equivalent |

Mobile-only tokens with no web twin, kept: `success/warning/info` + `-foreground` pairs (solid status
badges), text scales per space (`apply-text-scale.ts`).

## P1 — fix first

| # | Where | Problem | Fix | Status |
| --- | --- | --- | --- | --- |
| P1-1 | `src/global.css`, `core/theme/platform-tokens.ts` | Neutral grey + teal ≠ web slate + MedTrackr blue; dark cards = background; destructive fails AA; ring is grey | Token values in the table above | planned UI-01 |
| P1-2 | `src/shell/WelcomePage.tsx` | Bare picker: generic heart icon, English forced, "Privacy · Terms" not tappable, no brand | New welcome page: M mark + wordmark, value line, two choice cards, English/اردو toggle, real privacy/terms links, safe areas, 44 pt | planned UI-01 |
| P1-3 | `core/ui/text.tsx` `h2` | RNR default `border-b pb-2`; every caller adds `border-0 pb-0` | Patch removed it (`core/ui/PATCHES.md`) | planned UI-01 |
| P1-4 | `core/ui/button.tsx` sizes | 40 pt default (Login "Sign in" / "Continue with Google", Select-location "Sign out", many more) | Patch: `default`/`lg`/`icon` → `h-11` (44 pt) | planned UI-01 |
| P1-5 | `core/theme/apply-text-scale.ts` | `text-xs` (12 pt) not scaled: StatusBadge, DoseRow "Course ends"/"waiting to sync", LinkHistory, ProfileDetail helper, sign-in legal | `--text-xs` added: staff 12, patient 14 | planned UI-01 |
| P1-6 | `core/components/feedback/{EmptyState,ErrorState}.tsx` | Grey circle; differs from web's tinted tile | Tinted `rounded-2xl` tile, primary / destructive | planned UI-01 |
| P1-7 | `src/staff/features/today/pages/TodayPage.tsx:82` + `TodayBlocks.tsx`, `BlockShell.tsx` | Double gutter (32 pt) on the first tab staff see | `contentClassName` gets `px-0` (blocks own their `px-4`) | planned UI-01 |
| P1-8 | `src/patient/features/today/pages/TodayPage.tsx:107` | Inner `px-4` on top of Screen's `px-4` (content 32 pt, section titles 48 pt) | Drop the inner padding | planned UI-01 |
| P1-9 | `src/staff/features/patients/components/AlertStrip.tsx:26` | Literal "⚠" glyph (renders as emoji on some Androids) | `Icon as={TriangleAlert}` | planned UI-01 |
| P1-10 | `src/patient/navigation/PatientTabs.tsx` | `family` route has no `Tabs.Screen` → tab shows the raw route name and a fallback icon; icons 26 instead of 24 | Declare Family (`Users`, `t('family.title')`), icons 24 | planned UI-01 |
| P1-11 | `src/patient/navigation/PatientTabs.tsx` + `PatientPlaceholderPage.tsx` | First tab is a placeholder "Home" (copy "… will live here", 5 centred buttons, red Sign out / Delete account on the home screen); docs/05 §7 says Today · Records · Family · More | Make Today the first tab; turn the placeholder into a **More** screen of `ListRow`s (Family, Clinics, Reminders, Switch to staff; destructive actions grouped last, Sign out behind `ConfirmDialog`) | **open** — needs a small card (touches routing: where sign-in lands, `index` route); proposed as **UI-02** |
| P1-12 | `core/components/layout/Screen.tsx:57` | Offline banner text is hard-coded English on every patient screen | Add `offlineLabel`/`savedAtLabel` props (or a patient wrapper passing `t('common.offline…')`) | open (UI-02) |
| P1-13 | `src/staff/features/queue/pages/WalkInPage.tsx:68,267` | `ScreenHeader` rendered inside the scroll body: double padding and it scrolls away | Pass it via `Screen header={…}` | open (UI-02) |
| P1-14 | `src/patient/features/today/components/DoseRow.tsx:48` | Time in a fixed `w-14` box; "10:30 AM" at 18 pt / 1.5× / Urdu clips | `min-w-16 tabular-nums` or time on its own line | open — `medications/**` is being edited by an audit-fix session |
| P1-15 | `src/patient/features/medications/pages/RemindersSettingsPage.tsx:27,75`, `BatteryGuidePage.tsx:30` | Double `px-4`; `ChevronRight` not flipped in RTL | Drop inner padding; use the RTL-aware chevron | open — `medications/**` busy (audit fixes) |

## P2 — consistency polish

**Shared (fix once)**
- Add a core `Card` wrapper (`rounded-xl border border-border bg-card p-4`): radius drifts to `rounded-lg` in
  `AppLinkPage.tsx:99,118,135`, `DetailBlock.tsx:10`, `DayStrip.tsx:33`; `rounded-md` in `AlertStrip.tsx:25`,
  `ClaimConfirmPage.tsx:132`.
- `SectionHeader` padding option (`inset?: boolean`) so pages inside `Screen scroll` stop needing `-mx-4`
  (`ClinicsPage.tsx:77,93`, `ProfileDetailPage.tsx:102`).
- One compact **inline error banner** (`InlineAlert`): today a refresh failure is a full `ErrorState` block
  (Patients `:177`, Notifications `:175`), a muted line (Arrivals `:93`) or a hand-rolled
  `bg-destructive/10 rounded-md` box (Login, Sign-in, Verify, Name, Claim ×2).
- One **no-access state** (`NoAccessState`, `Lock` icon): Arrivals uses `EmptyState`, AppLink uses `ErrorState`.
- One **list footer** ("Loading more…" + spinner / "Couldn't load more [Retry]"): copied in Patients and
  Notifications, text-only in Schedule `:154`.
- One **RTL chevron** (`ChevronForward`): `RecordCard` flips by style, `ProfileCard` by `rotate-180`,
  Reminders not at all.
- Localised dates in the patient space: `'MMM d, yyyy'` / `EEEE d MMM` print English month/day names in Urdu
  (`ClinicLinkCard.tsx:26`, `LinkHistory.tsx:31`, `ProfileLinkRow.tsx:17`, Today `:67`). Add a date-fns `ur`
  locale to `formatInZone`.
- `label: value` strings built by concatenation (`RecordCards.tsx:145`, `PrescriptionDetailPage.tsx:32-40`) →
  one `t()` key with placeholders (Urdu word order).

**Staff screens**
- Schedule: hand-rolled `HourHeader` (`ScheduleTabPage.tsx:43-54`) → `SectionHeader`; separate "Clear all (n)"
  button `:186` → FilterChips' built-in clear chip like Patients.
- Patient detail: `DetailBlock.tsx:11` section titles are `small uppercase muted` → sentence-case `large`.
- Walk-in: "Urgent" label `:191` styled differently from FieldWrapper labels; no-doctor state `:263` shows an
  empty chip row → `EmptyState`.
- Notifications: `NotificationRow.tsx:34,46` `text-xs` / `font-bold` overrides → `small` / `muted`, unread =
  dot + `font-semibold`.
- Select location: locations as outline buttons `:46-53` → `ListRow`s in a card (with address); no state for
  zero organisations.
- AppLink: `gap-5` / `p-6` off-scale → `gap-6` / `p-4`.

**Patient screens**
- Today first-run empty state `:150` and Clinics empty state `:61,74` have no CTA → "Link a clinic".
- `AppointmentRow.tsx` not pressable, no clinic chip → `RecordCard` + `ClinicChip`.
- Appointment detail `:79-99` facts float on the background → one card (Prescription detail uses cards).
- Visit: title = `clinic · location` at h2 wraps to 3 lines `:49` → title "Your visit", clinic in subtitle;
  `'HH:mm'` `:89` → `h:mm a`; ad-hoc `text-lg/xl` `:112,120` → variants.
- Clinic avatar ignores the clinic colour (`ClinicLinkCard.tsx:37`) → `tint={clinicAccent}`; solid red "Unlink"
  `:71` on every card → outline destructive.
- Taken dose shown muted (`DoseRow.tsx:72`); docs say taken = success badge.
- Auth / claim pages use `px-6`; docs say `px-5` for patient.
- `PrescriptionDetailPage.tsx:28,43` Urdu medicine names render in the system font when UI is English → Nastaliq.
- Sign-in has no brand moment → small M mark above the title (allowed by A-25 as the brand moment, decide).

## P3 — nice to have

- `TabPlaceholderPage.tsx` ("Coming soon") is unreferenced → delete.
- Staff Offline page `:20` is a bare `View` → `Screen`.
- Patient detail segment "Rx" → "Prescriptions"; Today "Nothing due today." → no full stop in titles.
- `DoctorChips.tsx:53` `font-bold` → `font-semibold`; soft tint opacity `/10` vs `/15` → pick `/15`.
- Contact sheet: three full-width large buttons per clinic → Call primary, WhatsApp + Directions as a row.
- `VisitPage.tsx:97` `refreshing={false}` → `isRefetching`.
- Delete-account warning: add `border-destructive/40`, bullets as views, body size.
- Google buttons have no "G" mark (needs an SVG asset; keep the brand's own guidelines).

## Things that are already right (keep)

No hex colours / raw palette classes / `bg-white` / `text-black` in components; no gradients except the brand
mark; no physical-direction classes; status → tone mapping in one place (`status-tones.ts`); all icon-only
controls via `IconButton` with labels; `ListRow` reads as one sentence; every list has loading / empty /
error / no-results; FlashList for long lists; text variants used far more often than not.

## Files avoided (other sessions) — changes needed there

- `src/shell/**` other than the welcome page: none needed.
- `src/patient/features/medications/**`: P1-14, P1-15 above.
- `src/staff/navigation/StaffLayout.tsx`: none needed (staff tabs already use tokens).
- `eas.json` (not on the list, but release config): add `EXPO_PUBLIC_WEB_URL` (the web app origin, e.g.
  `https://app.<domain>`) to the `preview` / `production` env so the welcome page's Privacy / Terms links show
  in release builds (they're hidden when it is unset outside `__DEV__`).
