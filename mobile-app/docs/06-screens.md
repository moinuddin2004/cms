# 06 — Screen specifications

> Each screen: route, gate, data, layout (wireframe), states, actions, edge cases.
> Endpoints and payloads are in [07-backend-contracts.md](07-backend-contracts.md); visual rules in
> [05-ui-ux-design-system.md](05-ui-ux-design-system.md). Wireframes show structure, not pixels.
> IDs (S-xx staff, P-xx patient, X-xx shell) are referenced by task cards.

---

## Shell

### X-01 Welcome (space picker) — `src/app/welcome.tsx`

Shown when `activeSpace == null` (first launch, or after signing out of the last space).

```
┌──────────────────────────────┐
│        [neutral mark]        │
│   Your health, your clinic   │   ← no product name (F-05)
│                              │
│ ┌──────────────────────────┐ │
│ │ 👪  I'm a patient         │ │   card button → activeSpace=patient
│ │ Records, medicines, token │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 🩺  I work at a clinic    │ │   card button → activeSpace=staff
│ │ Queue, patients, schedule │ │
│ └──────────────────────────┘ │
│  Privacy · Terms             │
└──────────────────────────────┘
```

- Never auto-detect the space from an email (enumeration risk).
- Language toggle (English / اردو) at top-end — affects patient space only.

### X-02 Offline — `(staff)/offline.tsx`, `(patient)/offline.tsx`

Active space has a saved session but the API is unreachable at start. Shows `ErrorState`-like
content: "Can't reach the server", [Try again] (re-runs restore), [Switch space] if the other space is
signed in. Patient space: if a persisted cache exists, offer [Open saved data] which enters the
patient space in read-only offline mode (M3).

### X-03 Update required

Shown when `GET /app/min-version` says this build is too old: message + [Update] (opens store).

### Space switch (in both "More" tabs)

Row "Switch to patient space" / "Switch to clinic space". If the target space is signed in → switch
immediately (no logout). If not → that space's sign-in. Toast: "Switched to patient space".

---

## Staff space

### S-00 Staff sign-in — `(staff)/login.tsx`

Existing `LoginPage` (email + password + keep me signed in). Additions: [Back] to welcome, link
"Use the patient app instead". Google button (M1-17) when `/auth/google/config.enabled`.
Clinic gate codes (pending approval, Google required…) show the existing messages.

### S-00b Select location — `(staff)/select-location.tsx`

Existing page. Grouped by organization, location rows with timezone shown small. Blocked clinics
show their `signInBlock` message and are not selectable.

### S-01 Today (owner snapshot) — `(staff)/(main)/(tabs)/today.tsx`

Gate: any of `appointments.view`, `billing.invoice.view`, `finance.overview.view`.

```
┌──────────────────────────────┐
│ Today            [loc ▾] [🔔3]│  header: location switcher + bell with unread count
│ Tue, Nov 11 · Main branch    │
│ ┌──────┐┌──────┐┌──────┐     │
│ │ 34   ││ 6    ││ 18m  │     │  StatTiles (appointments.view): booked, waiting now, avg wait
│ │Appts ││Wait  ││Avg   │     │
│ └──────┘└──────┘└──────┘     │
│ ┌──────┐┌──────┐             │
│ │PKR 84k││ 3   │             │  billing.invoice.view: collected today, unpaid invoices
│ └──────┘└──────┘             │
│ Doctors now                  │  queue.board.view: one row per lane: doctor, now serving, waiting count
│  Dr. Sana   A-012 · 4 waiting│
│  Dr. Imran  — paused         │
│ Next appointments        All>│  appointments.view: next 5 from now
│  10:30  Ali Raza  Scheduled  │
└──────────────────────────────┘
```

- Each block renders only if its permission allows; each block has its own skeleton/error.
- Pull to refresh refreshes all. Tapping a doctor row → Queue tab (board, that lane).

### S-02 Queue tab — `(staff)/(main)/(tabs)/queue.tsx`

Gate: `queue.doctor.own` OR `queue.board.view`.
- Only `queue.doctor.own` → Doctor view (S-02a).
- Only `queue.board.view` → Board view (S-02b).
- Both → `SegmentedControl` at top: "My queue" | "Board" (remember last choice in prefs).

#### S-02a Doctor view

```
┌──────────────────────────────┐
│ My queue        ● Live  [⋮]  │  ⋮ → Pause / Resume / Smart order on-off* / Close session
│ Session open · 7 waiting     │  *only with queue.entry.reprioritize
│ ┌──────────────────────────┐ │
│ │ NOW   A-007  With doctor │ │  current card (status called or in_consultation)
│ │ Ali Raza · 34y · M       │ │
│ │ Reason: Toothache        │ │
│ │ [Patient file]           │ │  → S-05
│ │ [Send for test] [Done ✓] │ │  in_consultation actions
│ └──────────────────────────┘ │
│  Next suggested: A-008       │  suggestion line + reason chip ("Appointment due")
│ Waiting (7)                  │
│  A-008 Sara K.  10:30 appt ⋯ │  rows in waitingOrder; trailing ⋯ → Call this patient (select)
│  A-009 Umar     walk-in 12m ⋯│
│  …                           │
│ On hold / Skipped (2)        │  collapsible
│                              │
│ [      Call next      ]      │  sticky bottom primary button (when no current patient)
└──────────────────────────────┘
```

Session states:
- `waiting_for_doctor`: card "Your session hasn't started" + [Start session].
- `open`: as above.
- `paused`: banner "Paused — <reason>" + [Resume]; Call next disabled.
- `closed`: "Session closed for today" + summary counts.

Current-card actions by entry status:

| Status | Primary | Secondary |
| --- | --- | --- |
| `called` | Start (→ in_consultation) | Recall (announce again), Undo call, Skip |
| `in_consultation` | Done (complete) | Send for test (reason optional), Abort (reason, confirm) |

- Call next: `POST /queue/sessions/:id/call-next`. If result `reason === 'NO_ELIGIBLE_PATIENT'` →
  toast "No one is waiting".
- Select a specific waiting patient (`PATCH entries/:id/select`) asks for an optional reason when
  it jumps the suggested order.
- Close session (M1-10): if entries are still waiting/skipped/on hold, a sheet lists them with a
  choice per entry: Cancel / Transfer to [doctor]. Submit sends `decisions[]`.
- Realtime: subscribe `session:<id>`; ignore stale `seq`. While disconnected, poll every 10 s.
- After Start: show a small "Patient file" button; the consultation workspace stays on web/tablet.

#### S-02b Board view (reception)

```
┌──────────────────────────────┐
│ Queue board      ● Live      │
│ [Dr Sana 4][Dr Imran 2][+]   │  horizontal doctor chips (waiting count); [+] = open a lane for a doctor without session
│ Arrivals (5) ▸               │  today's scheduled appointments not yet checked in → S-03
│ Now: A-012 Bilal · With doc  │
│ Waiting                      │
│  A-013 Hina   walk-in 15m [⋯]│  ⋯ → ActionSheet (below)
│  A-014 Asad 🔴Urgent      [⋯]│
│ On hold / Skipped            │
│  A-010 Zara  Sent for test   │  [Back from test] inline button
│                     [＋ Walk-in]│  FAB (queue.checkin)
└──────────────────────────────┘
```

Row ActionSheet (each item shown only if permitted and valid for the status):

| Action | Endpoint | Permission | Valid when |
| --- | --- | --- | --- |
| Mark urgent (reason required) | `PATCH entries/:id/priority` | `queue.entry.reprioritize` | waiting, and not already `authorized_urgent` |
| Transfer to doctor | `PATCH entries/:id/transfer` | `queue.entry.manage` | waiting |
| Skip | `PATCH entries/:id/skip` | `queue.entry.manage` | called |
| Rejoin queue | `PATCH entries/:id/rejoin` | `queue.entry.manage` | skipped |
| Back from test | `PATCH entries/:id/return-from-test` | `queue.checkin` | on_hold |
| Cancel visit (confirm) | `PATCH entries/:id/cancel` | `queue.entry.manage` | waiting, skipped, on_hold |
| Patient file | navigate S-05 | `patients.view` | always |
| Show ticket | `GET entries/:id/ticket` → sheet with token + people ahead | — | always |

Valid statuses follow the backend transition map `backend/src/queue/queue-transitions.ts` (`ENTRY_TRANSITIONS`) —
that file wins over this table. There is no free reorder — do not build drag-to-reorder.

#### S-02c Walk-in sheet — `(staff)/(main)/queue/walk-in.tsx` (modal)

Fields: Doctor (picker; defaults to the selected lane), Patient: search existing (debounced
`/patients?search=`) **or** "New patient" (name*, phone*), Reason (optional), Urgent toggle → reason*.
Submit `POST /queue/walk-ins` (Idem). Errors: `ACTIVE_WITH_OTHER_DOCTOR` → dialog "Already in Dr X's
queue. Add anyway?" → resend with `force: true` (same intent, **new** idempotency key because the
body changed). Success → sheet closes, toast "Token A-015 for Hina", board scrolls to the entry,
[Show ticket] action in the toast.

### S-03 Arrivals / check-in

List of today's appointments for the location with status `scheduled|confirmed` and no queue entry
(`GET /appointments?startDate&endDate&includeWalkIns=false` with clinic-day bounds).
Row: time, patient, doctor, [Check in]. Check in → `PATCH /appointments/:id/check-in` (Idem), optional
urgent reason. `LATE_LIMIT_EXCEEDED` → dialog "Too late for this appointment. Add as walk-in?" →
`POST /appointments/:id/convert-to-walk-in`.

### S-04 Patients tab — `(staff)/(main)/(tabs)/patients.tsx`

Gate `patients.view`.

```
┌──────────────────────────────┐
│ Patients                 [＋] │  ＋ = quick register (patients.create)
│ [🔍 Name, phone or MR no.  ] │
│ [Active ✓] [Minors] [Filters 1]│
│  (AR) Ali Raza          ›    │  ListRow: name, MR no · phone (masked middle digits), age·gender
│       P-00034 · 0300•••4567  │
│  …                           │
└──────────────────────────────┘
```

- Default list: most recent (`sortBy=createdAt`), 20 per page, infinite scroll.
- Search 300 ms debounce, min 2 characters. Recently opened patients (last 10, ids only in memory
  for the session) shown above results when search is empty.
- Quick register sheet (S-04b): full name*, phone* (check `GET /patients/check-phone/:phone` on blur
  → "A patient with this phone exists: <name>" with [Open]), gender, DOB (date picker) or age,
  is minor → guardian name/phone/relation. `POST /patients`. Success → open S-05.

### S-05 Patient summary — `(staff)/(main)/patients/[patientId].tsx`

Gate `patients.view`; clinical blocks need `patients.clinical.view`.

```
┌──────────────────────────────┐
│ ←  Ali Raza             [⋯]  │  ⋯ → Call (tel:), WhatsApp (wa.me), Link app (M2-15), Copy MR no.
│ P-00034 · 34y · Male · O+    │
│ ⚠ Allergies: Penicillin      │  alert strip: allergies, blacklisted, minor+guardian
│ [Overview][Visits][Rx][Chart]│  segments (only those permitted)
│ Overview: phone, guardian,   │
│  medical history text, last vitals, today's queue status (if any)
│ Visits: GET /queue/patients/:id/visits (+ /patients/:id/history for clinical)
│ Rx: GET /prescriptions/patient/:id (finalized first) → tap → read-only sheet
│ Chart: latest teeth chart read-only summary list (no drawing in MVP; feature-gated)
└──────────────────────────────┘
```

- Read-only. No editing on mobile in MVP except quick register.
- Phone shown in full here (staff need to call), masked in lists.

### S-06 Schedule tab — `(staff)/(main)/(tabs)/schedule.tsx`

Gate `appointments.view`. Day picker strip (yesterday … +6 days), doctor filter chips, status filter.
List grouped by hour: time, patient, doctor, type, status badge, queue token if any. Tap → read-only
appointment sheet with [Check in] when allowed (S-03 action). Own-scope doctors only see their own
(server does this).

### S-07 Notifications — `(staff)/(main)/notifications.tsx`

Bell in headers shows unread count (`GET /me/notifications/unread-count`, realtime invalidated).
List paged (`GET /me/notifications`), unread bold with dot, [Mark all read]. Tap → mark read →
navigate by `link` using a link map (`/queue/doctor` → Queue tab doctor view, `/patients/:id` → S-05,
unknown → stay). Inbox spans all clinics: rows show the clinic name when `organizationId` ≠ active
org; tapping such a row asks to switch clinic.

### S-08 More — `(staff)/(main)/(tabs)/more.tsx`

Profile card (name, email, clinic, location) · Switch location · Notifications settings (sound toggle
via `/me/notifications/prefs`) · Switch to patient space · App version + "Check for updates" ·
Sign out (confirm). Help link.

### S-09 Link app QR — `(staff)/(main)/app-link/[patientId].tsx` (M2-15)

Gate `patients.app_link.manage`. Shows existing link status (masked email, since when) with
[Revoke link] (confirm). [Generate QR] → big QR + 15:00 countdown + "Ask the patient to scan with
their phone camera" + [Share via WhatsApp] (wa.me with the landing URL, not data). Auto-refreshes
status every 5 s while open; when claimed → "Linked ✓ to a•••@gmail.com".

---

## Patient space

All strings via `t()`. Body text uses the patient text scale.

### P-00 Patient sign-in — `(patient)/sign-in.tsx`, `(patient)/verify-code.tsx`

```
┌──────────────────────────────┐
│ ←                            │
│ Sign in                      │
│ Keep your family's records   │
│ and medicines in one place.  │
│ [ G  Continue with Google ]  │
│ ───────── or ─────────       │
│ Email [                    ] │
│ [   Send me a code   ]       │
│ By continuing you agree to   │
│ the Terms and Privacy Policy │
└──────────────────────────────┘
```

- Code screen: 6 boxes (one `TextInput` with `textContentType="oneTimeCode"`), resend after 60 s,
  generic errors. New account → name field after verify ("What should we call you?").
- First sign-in records consent (`terms`, `privacy` versions).
- If a claim is pending (P-01), the header says "Sign in to link your record at <clinic>".

### P-01 Claim flow — `claim/[token].tsx` → `(patient)/(main)/claim/confirm.tsx`

1. Deep link opens → token format check → store in `usePendingClaimStore` → `activeSpace = patient`.
2. Not signed in → P-00, then continue. Signed in → confirm screen.
3. Confirm screen loads `GET /patient-api/claims/:token` (clinic name, location, masked record name
   "A•• R•••", age band).

```
┌──────────────────────────────┐
│ Link your record             │
│ [logo] City Dental, Main Br. │
│ Record: A•• R•••, 30–39      │
│ Whose record is this?        │
│ (•) Me                       │   hidden if record is a minor
│ ( ) My child                 │
│ ( ) My parent                │
│ ( ) Someone else I care for  │
│ Name of this person [      ] │   prefilled for dependents? no — typed (not revealed by server)
│ [ ] I confirm I may view     │
│     this person's records    │
│ [      Link record      ]    │
└──────────────────────────────┘
```

- Choosing a dependent creates/uses a profile (existing profiles listed first).
- Success → celebration-free confirmation "Linked. You'll now see visits and medicines from
  City Dental." → Today.
- `CLAIM_INVALID` → "This code has expired or was already used. Ask the reception for a new one."

### P-02 Today — `(patient)/(main)/(tabs)/today.tsx` (primary hook)

```
┌──────────────────────────────┐
│ Today · Tue 11 Nov      [👤▾]│  profile filter: Everyone / Me / Ayaan / Ammi
│ ┌ LIVE TOKEN ─────────────┐  │  pinned when any linked entry is active today → P-06
│ │ City Dental · A-014     │  │
│ │ 3 people ahead · ~20 min│  │
│ └─────────────────────────┘  │
│ Morning                       │  groups: Morning / Afternoon / Evening / Night (by time)
│  08:00  Amoxicillin 500mg    │  dose row: time, medicine, dose text, profile avatar, meal hint
│   (A) After meal  [Taken][⋯] │  ⋯ → Skip today / Change time / Stop reminders
│  08:00  Calpol syrup 5ml (Ay)│
│ Afternoon                     │
│  14:00 …                      │
│ Appointments today            │
│  16:30 City Dental · Dr Sana │  [Confirm] when unconfirmed
│ Coming up                     │  next 3 days: appointments, course ending
└──────────────────────────────┘
```

- Built **on-device** from cached medications + dose events + appointments (works offline).
- Taken/Skip writes locally first (dose event queue) and syncs via
  `POST /patient-api/medications/dose-events` (batch, idempotent per `(scheduleId, dueAt)`).
  This is the one allowed offline write (it is the patient's own data, conflict-free).
- Empty (no links yet): illustration-free card "Link your first clinic" → explains the QR at
  reception + [How it works].
- Empty (links but nothing today): "Nothing due today 🎉" is not allowed (no emoji in UI copy);
  use "Nothing due today."
- First time a schedule appears: sheet "Turn on reminders?" → notification permission → schedule.
- "Course ends in 2 days" chip on the last days.
- Unparseable duration: row shows "How many days? [Set]" (patient sets end date).

### P-03 Records — `(patient)/(main)/(tabs)/records.tsx`

Segments: **Visits** · **Prescriptions** · **Appointments** · **Bills** (bills hidden when no
clinic has `show_billing`). Profile filter chip row at top. Each row shows clinic chip (colour
stripe + name). Search within prescriptions by medicine name (client-side).
- Prescription detail `(patient)/prescriptions/[id].tsx`: clinic, doctor, date (record tz),
  medicines (name, Urdu name if present, dose, timing, meal relation, duration, instructions incl. Urdu),
  [Reminders: on/off per medicine], [Share PDF] when `pdfUrl` is present.
- Appointment detail: time (record tz), clinic, doctor, status; [Confirm] if `scheduled`;
  [Call clinic] [Directions] (maps link from location address, if provided).
- Bills: invoice list (number, date, total, paid, balance) → detail read-only.

### P-04 Family — `(patient)/(main)/(tabs)/family.tsx`

Profile cards: avatar, name, relation, linked clinics count, today's doses count. Tap → profile
detail (`profiles/[profileId].tsx`): edit display name/DOB/gender (own profile data only, never the
clinic record), linked records per clinic, reminders privacy toggle. "Add a family member" explains:
"Ask the reception at their clinic to show a link code, then choose *My child* or *My parent*." (No
self-service dependent creation in MVP — F-03 via clinic attestation.)

### P-05 More — `(patient)/(main)/(tabs)/more.tsx`

Account (name, email) · Linked clinics (→ P-08) · Reminders settings (private reminders, quiet
hours, battery-optimisation guide) · Language · Switch to clinic space · Privacy policy / Terms ·
Delete account (→ P-09) · Sign out.

### P-06 Live token — `(patient)/(main)/visit/[entryId].tsx`

```
┌──────────────────────────────┐
│ ←  City Dental · Main Branch │
│          A-014               │  TokenBadge h1
│     Waiting · Dr Sana        │
│   3 people ahead of you      │
│   Now serving: A-011         │
│  ● Live · updated 10:42      │
│ We'll notify you when your   │
│ turn is near.                │
│ [Call clinic] [WhatsApp]     │
└──────────────────────────────┘
```

- Status `called` → full-width highlight "It's your turn — please go to Dr Sana" + haptic.
- Completed/cancelled → summary and back to Today.
- Data from `GET /patient-api/queue/active` + `/patient-realtime` `entry:<id>` events.

### P-07 Emergency / contact sheet

From any clinic chip or appointment: sheet with [Call] (`tel:`), [WhatsApp] (`https://wa.me/<number>`),
location address. Numbers come from the location record. No API writes.

### P-08 Linked clinics — `(patient)/(main)/clinics/index.tsx`

List of links: clinic, location, profile, since date, linked by ("Reception at City Dental").
Actions: [Unlink] (confirm: "City Dental's records will disappear from your app. The clinic keeps
its records.") → `DELETE /patient-api/links/:id`. "Link history" shows access log summary.

### P-09 Delete account — `(patient)/(main)/account/delete.tsx`

Explains what is deleted (account, profiles, reminders, dose history, links) and what is not (clinic
records). Type DELETE to confirm → `DELETE /patient-api/me` → local wipe → welcome screen.
