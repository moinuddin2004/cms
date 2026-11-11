# 05 — UI / UX design system

> Visual and interaction rules for both spaces. Screen-by-screen specs are in
> [06-screens.md](06-screens.md). Implementation rules (classes, components) are in
> [04-coding-standards.md](04-coding-standards.md).

## 1. Design principles

### Staff space — "a tool used between patients"

1. **One thumb, one glance.** The primary action of a screen sits in the bottom third, reachable
   with the thumb. Status is readable at arm's length.
2. **Speed over completeness.** Show the 3–5 facts staff need now; details are one tap away.
   The web app is for setup, reports and long forms.
3. **Never lose the queue.** Realtime state, a visible "live / reconnecting / offline" indicator,
   and safe retries. A double tap must never create two actions.
4. **Clinic-branded.** Primary colour = the clinic's brand colour (`/theme`). Everything else neutral.
5. **Dense but calm.** 14–15 pt body, compact rows (56–64 pt), no decorative illustrations.

### Patient space — "a calm family helper"

1. **Today first.** The home screen answers "what do we need to do today?" for the whole family.
2. **Big, plain, kind.** 16–17 pt body, large tap targets, short sentences, no medical jargon,
   Urdu-ready. Assume low literacy and older eyes.
3. **Trust is visible.** Every record shows which clinic it came from (name + colour chip). Privacy
   actions (unlink, delete, who linked) are easy to find.
4. **Works without internet.** Today list and reminders work from cache; network status is shown
   gently, never as an error wall.
5. **Neutral platform look** (A-11): platform palette; clinic colours only as accents.

## 2. Colour tokens

All colours are CSS variables in `src/global.css`, used through Uniwind classes. **No hex in code.**

| Token (class root) | Use | Staff | Patient |
| --- | --- | --- | --- |
| `background` / `foreground` | Screen background / main text | neutral | warm neutral |
| `card` / `card-foreground` | Cards, rows, sheets | | |
| `muted` / `muted-foreground` | Secondary surfaces / secondary text | | |
| `primary` / `primary-foreground` | Primary buttons, active tab, links, focus | **clinic brand** (runtime) | platform teal-blue |
| `secondary`, `accent` | Secondary buttons, pressed rows | | |
| `destructive` | Delete, cancel visit, errors | red | red |
| `success` *(new)* | Completed, taken, connected | green | green |
| `warning` *(new)* | Late, waiting long, due soon | amber | amber |
| `info` *(new)* | Called, informational | blue | blue |
| `border`, `input`, `ring` | Lines, inputs, focus ring | | |

Each new token has a `-foreground` pair and light + dark values (M0-05 defines them; contrast ≥ 4.5:1
for text on its background, ≥ 3:1 for large text and icons).

### Queue status → colour (single source: `core/components/data-display/status-tones.ts`)

| Entry status | Label | Tone |
| --- | --- | --- |
| `waiting` | Waiting | neutral (muted) |
| `called` | Called | info |
| `in_consultation` | With doctor | primary |
| `on_hold` | Sent for test | warning |
| `skipped` | Skipped | warning (outline) |
| `completed` | Done | success |
| `cancelled`, `aborted` | Cancelled | destructive (outline) |
| `transferred` | Transferred | neutral (outline) |
| Urgent priority (any status) | "Urgent" extra badge | destructive (solid) |

Appointment status tones: `scheduled` neutral, `confirmed` info, `checked_in` primary,
`completed` success, `cancelled` destructive outline, `no_show` warning.

Dose status tones: due = primary, taken = success, skipped = muted, missed (past + no action) = warning.

## 3. Typography

Use `<Text variant=…>` from `@/core/ui/text`. Do not set font sizes with arbitrary values.

| Variant | Staff size / weight | Patient size / weight | Use |
| --- | --- | --- | --- |
| `h1` | 28 / 700 | 30 / 700 | Rare: big token number |
| `h2` | 22 / 600 | 24 / 600 | Screen title (large header) |
| `h3` | 18 / 600 | 20 / 600 | Section title, card title |
| `large` | 17 / 600 | 18 / 600 | Row primary line (patient name) |
| `p` (default) | 15 / 400 | 17 / 400 | Body |
| `small` | 13 / 500 | 15 / 500 | Labels, meta |
| `muted` | 13 / 400, muted | 15 / 400, muted | Secondary lines |
| `mono` | 15 tabular | 17 tabular | Token numbers, times |

Implementation (M0-05): the variants map to Tailwind classes h1→`text-4xl`, h2→`text-3xl`, h3→`text-2xl`,
large→`text-lg`, p→`text-base`, small/muted→`text-sm`, and `core/theme/apply-text-scale.ts` overrides those
`--text-*` variables per space. The patient sizes come from a `patient` text scale applied by `PatientProviders`
(`TextScaleContext`), so core components render larger in the patient space without separate
components. Token numbers and times always use tabular numerals (`font-variant-numeric: tabular-nums`
equivalent: `tabular-nums` class).

Urdu: font **Noto Nastaliq Urdu** (bundled with `expo-font` in M4), line-height ×1.6 for Urdu text.
Mixed text (Urdu with English medicine names) stays in one `Text` with the Urdu font.

## 4. Spacing, radius, elevation

- Base unit 4. Screen horizontal padding `px-4` (staff), `px-5` (patient). Section gap `gap-6`.
  Row inner padding `py-3 px-4`. Card padding `p-4`. Form field gap `gap-4`.
- Radius: inputs/buttons `rounded-md`, cards `rounded-xl`, sheets `rounded-t-2xl`, chips `rounded-full`.
- Elevation: cards are flat with `border border-border`; only floating elements (FAB, sheets,
  toasts) get `shadow-sm`. No heavy shadows.

## 5. Iconography and imagery

- `lucide-react-native` via `<Icon as={…}>`. Sizes: 16 (inline), 20 (row/button), 24 (tab bar,
  header), 32+ (empty states only).
- No tooth/dental-only icons (F-05). Neutral marks: `Stethoscope`, `HeartPulse`, `Pill`,
  `CalendarClock`, `Users`, `ClipboardList`, `Ticket`, `Bell`, `Building2`.
- Clinic logos from `theme.logo_url` via `expo-image`, fallback = initials avatar on clinic colour.
- Patient avatars: initials on a deterministic colour from a fixed palette of 8 token-based tints
  (never random per render).

## 6. Core components (build in M1-01; live in `src/core/components`)

| Component | Purpose | Key props / behaviour |
| --- | --- | --- |
| `Screen` | Wraps every page | `scroll?`, `refreshing/onRefresh`, `header`, safe-area, background, `OfflineBanner` slot, keyboard aware when `scroll` |
| `ScreenHeader` | Large title + subtitle + right actions | `title`, `subtitle`, `back?` (auto from router), `actions` (IconButtons) |
| `IconButton` | Icon-only pressable | `icon`, `accessibilityLabel` (**required**), `variant`, `size`, 44 pt min |
| `ListRow` | Standard tappable row | `leading` (avatar/icon), `title`, `subtitle`, `meta`, `trailing`, `onPress`, `onLongPress` |
| `SectionHeader` | List section title + optional action | `title`, `count?`, `action?` |
| `StatusBadge` | Status pill | `tone` from status-tones, `label`, `variant: solid|soft|outline` |
| `TokenBadge` | Big tabular token "A-007" | `token`, `size` |
| `Avatar` (wrap of ui/avatar) | Person or clinic | `name`, `imageUrl?`, `tint?` |
| `SearchBar` | Debounced search (300 ms) | `value`, `onChange`, `placeholder`, clear button |
| `FilterChips` | Horizontal single/multi select chips | `options`, `value`, `onChange`, active count |
| `SegmentedControl` | 2–4 segment switch | `segments`, `value`, `onChange` |
| `FormSheet` | Bottom sheet with a form | `title`, `open`, `onClose`, dirty-guard, sticky submit area, keyboard handling |
| `ActionSheet` | List of actions for a row (long-press / "…") | `actions: {label, icon, destructive?, onPress}[]` |
| `ConfirmDialog` | Wraps ui/alert-dialog | `title`, `description`, `confirmLabel`, `destructive`, `onConfirm` (async, shows loading) |
| `StatTile` | Number + label (+ trend text) | `label`, `value`, `hint?`, `tone?` |
| `ConnectionPill` | Live / Reconnecting / Offline | reads realtime + network state |
| `OfflineBanner` | Thin banner at top when offline | "Offline — showing saved data from 10:42" |
| `LoadingSkeleton`, `EmptyState`, `ErrorState`, `NoResultsState` | Existing feedback components (move to core) | as today |
| `FAB` | Floating primary action (only where specified in 06) | `icon`, `label`, bottom-end, above tab bar |
| `QrCode` | Render a QR from a string | `value`, `size` — library chosen in M2-15 (`react-native-qrcode-svg`, uses existing react-native-svg) |

## 7. Interaction patterns

### Navigation

- **Staff tabs** (bottom, max 5, filtered by permission): `Today` · `Queue` · `Patients` ·
  `Schedule` · `More`. A user with no permission for a tab never sees it. If only `More` remains,
  show a "No mobile features for your role" empty state on it.
- **Patient tabs**: `Today` · `Records` · `Family` · `More`.
- Detail screens push on the tab's stack with a back arrow. Tab press on the active tab scrolls to
  top / pops to root.
- Modal flows (walk-in, claim confirm, sign-in code) use modal presentation.

### Lists

- Pull to refresh on every list. Infinite scroll for paged lists ("Loading more…" footer).
- Search at the top (sticky), filter chips under it, active filter count on a "Filters" chip,
  "Clear" chip when any filter is active.
- Distinct "no results for your search/filters" (`NoResultsState` + Clear button) vs empty
  (`EmptyState` + CTA).
- Row tap = open detail. Row actions: up to 2 inline buttons (only on queue rows), otherwise
  long-press or trailing "…" → `ActionSheet`. **No swipe-to-delete or swipe actions** (accidental
  triggers on a moving clinic floor).

### Forms

- Bottom sheet (`FormSheet`) with a sticky submit button; keyboard never covers the focused field
  or the submit button. Labels above fields. Required marker `*`.
- Validation messages under the field after touch/submit. Server errors as a banner at the top of
  the sheet.

### Feedback

- Toasts (sonner-native) for completed background actions ("Patient checked in · Token A-012").
  Bottom position, 3 s. Errors 5 s with the message from the API.
- Haptics (`expo-haptics`): `selection` on tab/segment change, `success` notification on queue
  actions that succeed, `warning` on a refused action. Never on scroll.
- Destructive actions (cancel visit, abort, unlink clinic, delete account) → `ConfirmDialog`, with
  the consequence in the description. Account deletion additionally requires typing "DELETE".
- Loading: skeletons for first load; pull-to-refresh spinner for refresh; button spinners for actions.
  Never a blank screen.

### Realtime and offline cues

- `ConnectionPill` in the header of realtime screens (queue): green dot "Live", amber "Reconnecting…",
  grey "Offline".
- When offline: banner at top, action buttons show "Offline" and are disabled, data shows
  "Updated 10:42" time.

## 8. Accessibility

- WCAG 2.1 AA contrast for all text. Touch targets ≥ 44×44 pt.
- Screen reader: every icon-only button labelled; list rows read as one sentence
  ("Ali Raza, token A 7, waiting, 12 minutes"); status changes on queue announced with
  `AccessibilityInfo.announceForAccessibility` for the doctor's "next patient".
- Dynamic type: layouts must survive 1.3× (patient: 1.5×) font scale — wrap, don't clip.
- Reduce motion: respect `useReducedMotion()` for animations.
- Never rely on colour alone: badges carry text; required fields carry `*` and text.

## 9. Writing (UX copy)

- Plain words. Staff: "Call next", "Start", "Done", "Skip", "Send for test", "Check in", "Walk-in".
  Patient: "Take now", "Taken", "Skip today", "Your turn is near", "Link a clinic".
- Buttons are verbs. Titles are nouns. Sentence case everywhere.
- Errors say what happened and what to do: "Couldn't call the next patient. Check your connection
  and try again." Never show raw codes; map them ([07 §2.3](07-backend-contracts.md#23-queue)).
- Empty states: one sentence + one action. E.g. Patients tab with no results: "No patients match
  'Ahm'." [Clear search].
- Numbers: times `h:mm a` on the clinic clock (staff) / record clock (patient appointments);
  durations "12 min"; money via `formatMoney`.
- Patient copy is reviewed for Urdu translation: avoid idioms, keep sentences short, no text baked
  into images.

## 10. Motion

- Default durations: 150 ms (press feedback), 220 ms (sheet/screen), spring for sheets.
- New queue entries fade/slide in (Reanimated `entering`/`exiting` layout animations) — max one
  animation per list change, disabled with reduced motion.
- No looping animations except the "Reconnecting" pulse and the live token "Your turn" highlight.

## 11. Dark mode

- Both spaces support light and dark from tokens. Test every screen in both before handoff.
- Staff orgs with `theme.default_mode` = light/dark override the system on staff screens only.

## 12. Visual QA checklist (implementer runs before handoff on every UI task)

- [ ] Light + dark screenshots attached (Android emulator, small phone ~360×640 dp and a large one).
- [ ] 1.3× font scale screenshot of the densest screen in the task.
- [ ] Loading, empty, error, no-results states triggered and screenshotted.
- [ ] Offline state checked (airplane mode).
- [ ] TalkBack pass on the main flow (labels read correctly).
- [ ] No hex colours, no `ml-/mr-` classes (grep), no inline styles except allowed cases.
