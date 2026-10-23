# Appointments & Queue — end-to-end guide

How a patient visit works in DentalFlow, from booking to completion: what each
module owns, every rule, every endpoint, the data model, and where the code
lives. Read this before changing anything under `backend/src/appointments/`,
`backend/src/queue/` or `web-app/src/features/{appointments,queue}/`.

> Specs this was built from (Claude Docs): **"Clinic Queue System — Production
> Architecture"** and **"Queue Revamp — Current Appointment System se Naye
> Design tak"**. Where this file and the code disagree, the code wins — fix
> this file.

---

## 1. The big picture

Two modules with a hard boundary:

| Module | Owns | Never does |
|---|---|---|
| **Appointments** (`appointments/`) | *Booking*: calendar, validate, booking rules, reschedule, confirm, cancel/no-show **before arrival** | Issue tokens, track waiting/in-room, create encounters |
| **Queue** (`queue/`) | *Everything after arrival*: token, waiting order, Call Next, consultation, test/hold, skip, transfer, completion, TV display | Create or move bookings |

**Check-in is the hand-over.** `PATCH /appointments/:id/check-in` is routed to
`QueueOrchestrator`, which creates a queue entry (a token). Walk-ins skip
booking entirely and go straight to `POST /queue/walk-ins`.

```
 BOOKING (appointments)                    AFTER ARRIVAL (queue)
 ─────────────────────                     ─────────────────────────────────────────
 book ─► scheduled ─► confirmed ─┐         check-in / walk-in
            │            │       ├────────►  WAITING ─► CALLED ─► IN_CONSULTATION ─► COMPLETED
            ▼            ▼       │              ▲          │            │  ▲
        cancelled     no_show    │              │ undo     ▼            ▼  │
                                 │           SKIPPED ◄─────┘         ON_HOLD (test)
   (cancel / no-show only        │              │ rejoin                  │ return
    BEFORE check-in)             └──► appointment.status = checked_in … completed | cancelled
```

Principles that hold everywhere:

1. **PostgreSQL is the source of truth.** Redis down → no data loss, only
   realtime stops and clients fall back to polling.
2. **Every queue change is one transaction**: entry status + audit event +
   outbox message commit together or not at all.
3. **One lock per doctor-day**: the `queue_sessions` row is locked
   (`FOR UPDATE`) first in every mutation, so one doctor's queue is strictly
   serialized while different doctors never block each other.
4. **Invariants live in the database** (partial unique indexes, exclusion
   constraint), not just in code.
5. **Time is the location's, not the server's** (`ClockService`).
6. **A token is issued only when the patient actually arrives.** Booking never
   gives a token.

---

## 2. Roles & access

Global guard chain (`app.module.ts`, order matters):
`JwtAuthGuard → TenantContextGuard → FeatureFlagGuard → AccessGuard`.
Access is permission-based (`@Can(...)`), never by role name — see
[access-control/README.md](access-control/README.md) for the whole system.

- Feature: every permission below belongs to `appointments.core`, so turning
  that feature off removes them (backend, routes and sidebar).
- Tenant: `x-organization-id` + `x-location-id` headers (set by the web
  Axios client). Every queue row carries `organization_id`; sessions carry
  `location_id`.
- What a user may do comes from the permissions of their role at the active
  location (owners and super admins hold all of them).

| Action | Permission |
|---|---|
| List / read appointments, doctors, availability, stats | `appointments.view` (scoped: `own` = the doctor's own) |
| Book, validate, confirm | `appointments.book` |
| Edit / reschedule | `appointments.reschedule` |
| Cancel, no-show | `appointments.cancel` |
| Check-in, convert-to-walk-in, walk-in, return-from-test | `queue.checkin` |
| Cancel entry, rejoin | `queue.entry.manage` |
| Reception board (`GET /queue/sessions`) | `queue.board.view` |
| Doctor screen: my session, start/pause/resume/close, call next, select, recall, undo-call, start/complete/abort consultation, send-for-test | `queue.doctor.own` — and the session must be the caller's own unless they hold `queue.doctor.any` |
| Run another doctor's queue (`GET /queue/my-session?doctorId=`), force-complete | `queue.doctor.any` |
| Urgent priority, per-session mode switch | `queue.entry.reprioritize` |
| Skip, transfer, session snapshot, next preview, ticket, policies (read) | any member of the location (`@AnyMember`); skip/transfer rules are checked in `QueueOrchestrator` |
| Queue settings (policies write / reset) | `admin.settings.manage` |
| Audit history (`/queue/sessions/:id/events`) | `admin.audit.view` |
| Patient visit history | `patients.view` |
| TV display state | **public** (no login) — tokens + doctor names only |

Doctor actions also check that the session's `doctor_id` is the caller's
employee id (`QueueOrchestrator.assertSessionDoctor`) unless the caller holds
`queue.doctor.any`; the web "My Queue" page shows a doctor picker to them.

The UI hides what the user can't do with `useAccess().can(...)` (from
`GET /me/access`) — the server still enforces everything. `GET /queue/me`
remains for the caller's `employeeId` (its `roles` are derived from
permissions and are legacy).

---

## 3. Booking (appointments module)

### 3.1 Statuses (`AppointmentStatus`)

`scheduled`, `confirmed`, `checked_in`, `completed`, `cancelled`, `no_show`.

After check-in the **queue entry** drives progress; the appointment stays
`checked_in` until the entry completes (→ `completed`) or is
cancelled/aborted (→ `cancelled`). There is **no** `in_progress` or
`rescheduled` status: a reschedule edits the same row and keeps its status.

Allowed transitions are one constant map:
`appointments/appointment-transitions.ts`. Anything else → **422
`INVALID_TRANSITION`**. Only `scheduled`/`confirmed` bookings may be edited
(`APPOINTMENT_LOCKED` otherwise).

### 3.2 Booking rules (run in order on create; `validate` runs the same set without throwing)

1. Duration 5–480 min, valid start (DTO).
2. Start not in the past.
3. Patient exists in the same organization.
4. Doctor exists and is active.
5. Doctor has an active assignment to the current location.
6. Doctor works that **location-local weekday** and the whole slot fits inside
   one working-hours block (error lists the available ranges).
7. No overlap with the doctor's other live appointments at **any** location
   (cancelled/no-show ignored) → 409.
8. Location's daily limit (`location_settings.max_appointments_per_day`) → 409
   `DAILY_LIMIT_REACHED`.

Rule 7 is *also* enforced by the database: exclusion constraint
`no_doctor_overlap` on `appointments` (needs `btree_gist`, created before
schema sync in `common/database/ensure-extensions.ts`). Two concurrent bookings
can both pass the read check; the loser gets Postgres `23P01`, mapped to 409
`DOCTOR_DOUBLE_BOOKED`.

`POST /appointments/validate` powers the live "valid / conflict + suggested
slot" hint in the booking form (debounced 500 ms). The suggestion walks forward
through the doctor's day, jumping past each clash, up to 50 tries, staying
inside working hours.

**Edit/reschedule (`PUT /appointments/:id`)** re-runs schedule, conflict and
daily-limit checks only if the time/duration/doctor *actually changed*. The web
form sends `startTime`/`duration` only when changed.

### 3.3 Form default duration

`location_settings.appointment_slot_duration` is the booking form's default
duration (`useLocationSlotDuration`).

### 3.4 Timezone handling

`common/clock/`:

- `tz.util.ts` — pure Intl-based helpers (`localParts`, `localDate`,
  `zonedTimeToUtc`, `localDayRange`, DST-safe).
- `ClockService` — `now()`, `timezoneFor(locationId)` (cached 60 s),
  `today()`, `wallClock()`, `dayRange()`, `at()`.

**Never** use server-local `new Date()` + `setHours()`/`getDay()` for clinic
days or times. Frontend datetime-local values use
`toDateTimeLocalValue()` (local wall time), never `toISOString().slice(0,16)`.

---

## 4. The queue (queue module)

### 4.1 Concepts

- **Session** (`queue_sessions`): one doctor × location × service date. Created
  automatically at the first check-in (no "open queue" step). Holds the token
  counter, status, `smart_queue_enabled` (copied from policy at creation),
  `event_seq`.
- **Entry** (`queue_entries`): one patient's place in one session. Type
  `appointment` (linked to a booking) or `walk_in`.
- **Token**: `{doctor prefix}-{number}` e.g. `A-007`. Number comes from the
  session's own counter column (no SQL SEQUENCE: a rollback rolls the counter
  back → no gaps; a number is never reused, even if the entry is cancelled).
  Prefix = `employee_org_location_assignments.token_prefix`, else the first
  letter of the doctor's name; copied onto the session.
- **Service date**: location-local date of `(now − service_day_cutoff)`, so a
  night clinic with cutoff `04:00` keeps 01:30 on the previous service day.

### 4.2 Entry lifecycle (`ENTRY_TRANSITIONS`, `queue-transitions.ts`)

| From → To | Trigger | Who |
|---|---|---|
| `waiting → called` | Call Next / Select | doctor |
| `called → waiting` | undo-call (position unchanged) | doctor |
| `called → in_consultation` | start-consultation (**creates the encounter**) | doctor |
| `called → skipped` | skip, or call-timeout job | doctor / reception / system |
| `skipped → waiting` | rejoin (per policy) | reception |
| `in_consultation → on_hold` | send-for-test | doctor |
| `on_hold → waiting` | return-from-test (same token, ahead of walk-ins in smart mode) | reception |
| `in_consultation → completed` | complete / force-complete | doctor / admin |
| `in_consultation → aborted` | abort (appointment → cancelled) | doctor |
| `waiting/in_consultation → transferred` | transfer (new token in other doctor's session) | reception / doctor |
| `waiting/skipped/on_hold → cancelled` | cancel (appointment → cancelled, reason `patient_left`) | reception |

Anything else → **422 `INVALID_TRANSITION`**. Terminal: completed, cancelled,
transferred, aborted.

Session lifecycle: `waiting_for_doctor → open ⇄ paused → closed`.
Check-in allowed in all but `closed`; Call Next / Select only when `open`.
Closing requires nobody called/in consultation and a **decision (cancel or
transfer) for every waiting/skipped/on-hold entry** in the request.

### 4.3 Check-in & walk-in

`PATCH /appointments/:id/check-in` (booked patient):
1. Appointment locked; duplicate check-in → 409 `ALREADY_CHECKED_IN` (returns
   the existing entry).
2. Must be for **today's service date** (`NOT_TODAY`) and not later than
   `max_late_min` (`LATE_LIMIT_EXCEEDED` 422 → receptionist uses
   **convert-to-walk-in** or reschedules).
3. Session ensured + locked, token issued, entry `waiting`, appointment
   `checked_in`.
4. Optional `urgentReason` → emergency priority at check-in. A booking flagged
   *emergency* does **not** jump the queue by itself; reception must confirm
   "urgent priority?".

`POST /queue/walk-ins`: **doctor is required.** Existing `patientId`, or
`patientName` + `patientPhone` to create the patient (number allocated under an
advisory lock). Same doctor's queue already has the patient → 409
`ALREADY_CHECKED_IN` with their token (nothing added). Active in another
doctor's queue today → 409 `ACTIVE_WITH_OTHER_DOCTOR` unless `force: true`.

`POST /appointments/:id/convert-to-walk-in`: late beyond max → appointment
becomes `no_show`, a new walk-in entry (new token) is linked via
`converted_from_appt_id`.

### 4.4 Selection engine — who is called next

`queue/engines/selection-engine.ts` is a **pure function** (no DB, no clock):
`selectNext(candidates, now, policy, lastReason)`. Priority is *never stored*;
it is recomputed on every Call Next. Tests: `selection-engine.spec.ts` (the 14
doc scenarios, run in both modes).

**Smart OFF (default) — FIFO:** emergency first, then strictly by
`sort_anchor_at` (arrival), ties → lower token.

**Smart ON order:**
1. Emergency (`authorized_urgent`).
2. **Starvation guard** — oldest FIFO-pool patient waiting ≥
   `walkin_starvation_min` *and* an appointment patient would overtake; never
   twice in a row (`last_call_reason`).
3. **Appointments due** — `now ≥ start − early_window` **and**
   `checked_in_at ≤ start + late_grace`; ordered by scheduled start.
4. **Back from test** — by return time.
5. **FIFO pool** — walk-ins, early appointment patients, appointment patients
   later than grace; by `sort_anchor_at`.

`sort_anchor_at = checked_in_at`, except a skipped patient who rejoins under the
`end` policy (→ rejoin time).

Doctor's two buttons: **Call Next** (engine decides) and **Select** (doctor
picks any waiting patient; audit stores the engine's suggestion → clinic can
measure override rate; reason optional or required via policy).

The board/doctor screens show the waiting list *in engine order*
(`QueueQueryService.engineOrder` repeatedly asks the engine; it reserves
nothing).

### 4.5 Policies (`queue_policies`)

Effective policy = location override → organization default → built-in
defaults (cached 60 s; edit via `PATCH /queue/policies`, admin only). Timezone
is the location's own (`locations.timezone`), not in the policy.

| Setting | Default | Meaning |
|---|---|---|
| `smart_queue_enabled` | false | false = pure FIFO |
| `early_window_min` | 15 | priority starts this long before the appointment |
| `late_grace_min` | 10 | late but still priority |
| `max_late_min` | 45 | beyond this: no token (no-show / convert) |
| `walkin_starvation_min` | 45 | long-waiting walk-in gets next turn |
| `skipped_rejoin_policy` | end | `end` / `original_position` / `manual` |
| `call_timeout_sec` | off | auto-skip a CALLED patient who doesn't come (≥ 30) |
| `manual_select_reason_required` | false | Select needs a reason |
| `service_day_cutoff` | 00:00 | start of the service day |

Changes apply to **the next day's sessions** (session copies the flag when
created) so nobody's place moves mid-day. An admin can flip one session today:
`PATCH /queue/sessions/:id/mode` (audited `MODE_CHANGED`).

### 4.6 Concurrency, idempotency, stale screens

`QueueOrchestrator.mutate()` for every change:

```
BEGIN
  set_config(lock_timeout=3s, app.organization_id, app.location_id)  -- + DB now()
  claim Idempotency-Key  (replay → saved response; different body → 422)
  lock queue_sessions row FOR UPDATE   (always session first, then entries;
                                        two sessions → lock in id order)
  check transition map → run engines → UPDATE → audit event + outbox + NOTIFY
  save response under the key
COMMIT
```

- **`Idempotency-Key` header is required** on every queue mutation (web client
  generates one per user action and **retries 503 `LOCK_TIMEOUT` with the same
  key**).
- **`If-Match: <version>`** on entry actions → 409 `VERSION_CONFLICT` with the
  current state if the screen was stale.
- "Now" is the **transaction's** `now()`, never the API server's clock.
- DB last line of defence (`queue_entries` partial unique indexes):
  `one_active_entry_per_appt`, `one_active_entry_per_patient` (per session),
  `one_patient_with_doctor` (≤ 1 called/in-consultation per session).

Error codes: `NO_ELIGIBLE_PATIENT` (200, nothing changed), `FORBIDDEN`,
`NOT_FOUND`, `DOCTOR_BUSY`, `VERSION_CONFLICT`, `ALREADY_CHECKED_IN`,
`ACTIVE_WITH_OTHER_DOCTOR`, `INVALID_TRANSITION`, `SESSION_NOT_OPEN`,
`LATE_LIMIT_EXCEEDED`, `NOT_TODAY`, `LOCK_TIMEOUT` (503),
`IDEMPOTENCY_KEY_REQUIRED|REUSED`, `REQUEST_IN_FLIGHT`, `REASON_REQUIRED`.
They arrive as `error.code` in the standard `ResponseWrapper` error body.

### 4.7 Encounters

A `patient_encounters` row is created **when the doctor starts the
consultation** (`ensureForQueueEntry`, inside the same transaction), unique per
queue entry (`queue_entry_id`), `appointment_id` NULL for walk-ins. Sending a
patient for a test and resuming re-uses the same encounter. Because check-in
no longer creates an encounter, **waiting patients can be cancelled**.

---

## 5. Realtime & background work

**Transactional outbox.** Each change inserts `outbox` rows (rooms below) in the
same transaction and fires `pg_notify('queue_outbox')`. `OutboxRelayService`
(LISTEN + 1 s polling, `FOR UPDATE SKIP LOCKED`) publishes committed rows and
stamps `published_at` only after the publisher succeeded. Delivery is
**at-least-once**; clients drop duplicates by `seq`.

Socket.IO namespace `/realtime`; client sends `subscribe {room}`:

| Room | For | Auth |
|---|---|---|
| `session:<id>` | doctor screen | JWT + location access |
| `location:<id>:board` | reception board | JWT + location access |
| `location:<id>:display` | TV | none; payload has token/doctor/status, **never patient names** |

Client contract (`useQueueSocket` / `useQueueData`): load a snapshot
(`event_seq`), then on any event with `seq > eventSeq` refetch (coalesced,
120 ms); older/duplicate seqs are ignored; if the socket is down, poll every
10 s. UI shows "Live" / "Reconnecting".

**Process roles** (`bootstrap/`, `common/runtime/process-role.ts`):
`main.ts` runs everything in one process (dev); production runs `main.api`
(2+ instances: HTTP + gateway) and `main.worker` (1+: outbox relay + jobs),
fanned out through Redis (Socket.IO Redis adapter). Redis down → data safe,
screens poll.

**Jobs** (`queue/jobs/queue-jobs.service.ts`; each re-checks state under the
session lock, so running twice is harmless):

| Job | Cadence | What |
|---|---|---|
| no-show marker | 60 s | booked, not checked in, past `start + max_late_min` → `no_show` |
| call-timeout | 15 s | CALLED too long (if `call_timeout_sec` set) → `skipped` |
| session day-end | 5 min | close **empty** past sessions; ones with patients are only logged as an alert — never auto-cancelled |
| cleanup | nightly | idempotency keys > 24 h, published outbox > 7 d |

---

## 6. API reference

Response envelope: `{ data, message }` (`ResponseWrapper`); web unwraps
`res.data.data`.

### Appointments — `/appointments` (feature `appointments.core`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/appointments` | book |
| POST | `/appointments/validate` | live check + suggested slot |
| GET | `/appointments` | list (`startDate,endDate,doctorId,patientId,status,type,search,page,limit`) — each row includes `queueEntry {id, token, status, sessionId}` once arrived |
| GET | `/appointments/doctors` | doctors at this location |
| GET | `/appointments/stats` | counts + queue stats (walk-ins, waiting, avg wait) |
| GET | `/appointments/availability` | working-hour blocks (calendar background) |
| GET | `/appointments/:id` | one (with `queueEntry`) |
| PUT | `/appointments/:id` | edit / reschedule (before check-in) |
| PATCH | `/appointments/:id/confirm` · `/cancel` · `/no-show` | before check-in only |
| PATCH | `/appointments/:id/check-in` | → queue (needs `Idempotency-Key`) |
| POST | `/appointments/:id/convert-to-walk-in` | too-late patient → walk-in token |

Cancel reason codes: `patient_left`, `other` (a no-show is its own action).

### Queue — `/queue`

| Method | Path | Purpose |
|---|---|---|
| GET | `/queue/me` | my roles + employee id |
| GET | `/queue/sessions?date=` | reception board (all doctors' lanes) |
| GET | `/queue/sessions/:id` | snapshot (+ `waitingOrder`, `suggestion`, `eventSeq`) |
| GET | `/queue/sessions/:id/next-preview` | what Call Next would pick |
| GET | `/queue/sessions/:id/events?afterSeq=` | audit history (admin) |
| GET | `/queue/my-session[?doctorId=]` | doctor's own queue (admin may pass doctorId) |
| POST | `/queue/sessions` | ensure today's session |
| PATCH | `/queue/sessions/:id/start·pause·resume·close·mode` | session control |
| POST | `/queue/sessions/:id/call-next` | engine picks |
| POST | `/queue/walk-ins` | walk-in + token |
| PATCH | `/queue/entries/:id/select·recall·undo-call·skip` | calling |
| PATCH | `/queue/entries/:id/start-consultation·send-for-test·complete·abort` | consultation |
| PATCH | `/queue/entries/:id/cancel·rejoin·return-from-test·transfer` | reception |
| PATCH | `/queue/entries/:id/priority·force-complete` | admin |
| GET | `/queue/entries/:id/ticket` | printable ticket data |
| GET | `/queue/patients/:id/visits` | patient's queue visits (incl. walk-ins) |
| GET/PATCH/DELETE | `/queue/policies`, `/queue/policies/location` | settings |
| GET | `/queue/displays/:locationId/state` | **public** TV state |

---

## 7. Data model

```
appointments            booking only. status, start/end_time, doctor_id (NOT NULL, RESTRICT),
                        checked_in_at / completed_at / cancelled_at / no_show_at,
                        cancel_reason_code. EXCLUDE no_doctor_overlap.
queue_policies          org default (location_id NULL) + per-location override.
queue_sessions          doctor × location × service_date (UNIQUE). token counter, token_prefix,
                        status, smart_queue_enabled, last_call_reason, event_seq, version.
queue_entries           token_number (UNIQUE per session), queue_type, status, priority_class,
                        urgent_*, checked_in_at, sort_anchor_at, called/consultation/hold/
                        returned/skipped/finished timestamps, version.
                        CHECK(queue_type='appointment' ⇔ appointment_id NOT NULL).
queue_events            append-only audit, seq per session, actor, reason, suggested_entry_id.
outbox                  realtime messages (topic = socket room). Partial index on unpublished.
idempotency_keys        (organization_id, key) → saved response. 24 h.
patient_encounters      one per queue entry (queue_entry_id UNIQUE); appointment_id nullable.
employee_org_location_assignments.token_prefix   doctor's token letter at a location.
```

The old `appointment_token_counters` table and the appointment columns
`token_number / token_prefix / is_walk_in / in_room_at` no longer exist.

Dev schema comes from TypeORM `synchronize: true` (no migration files in the
dev phase; production must switch to real migrations — see "Gaps").

---

## 8. Frontend map

`web-app/src/features/appointments/` — booking: `AppointmentsPage`
(Queue | List | Calendar views + stats), `AppointmentModal` (form, live
validation), `AppointmentDetailModal`, `FullCalendarView` (drag/resize only for
`scheduled`/`confirmed`), `AppointmentsList` (DataTable), `StatsCards`.

`web-app/src/features/queue/`:

| Path | Role |
|---|---|
| `components/QueueBoard` | reception board, card + list views, filters, role-aware actions |
| `components/QueueLaneCard`, `QueueEntriesTable`, `QueueEntryActions` | lane / table / per-entry buttons |
| `components/WalkInSheet` (+ `hooks/useWalkInForm`) | walk-in form in a `FormSheet` |
| `components/CheckInDialog` | check-in (urgent prompt; late → convert to walk-in) |
| `components/ReasonDialog`, `TransferDialog`, `CloseSessionDialog` | action dialogs |
| `components/QueueSettingsSection` (+ `hooks/useQueueSettingsForm`) | settings card on the location settings page (admin only) |
| `pages/DoctorQueuePage` | doctor's screen: current patient, big **Call next**, waiting list with **Select**, pause/close |
| `pages/DisplayPage` | public TV screen (`/display/:locationId`) |
| `hooks/useQueueData`, `useQueueSocket` | snapshots + realtime + polling fallback |
| `hooks/useQueueAction` | mutation wrapper (refresh + error toasts, `VERSION_CONFLICT` handling) |
| `hooks/useQueuePermissions` | `useAccess()` permissions (+ own employee id) for hiding buttons |
| `services/queue.api.ts` | all axios calls; adds `Idempotency-Key`, retries `LOCK_TIMEOUT` |
| `schemas/queue.schema.ts` | Zod schemas (walk-in, queue settings) |
| `utils/printTicket.ts` | token ticket print window |

Routes: `/appointments`, `/queue/doctor`, `/display/$locationId` (open path in
`__root.tsx`, no redirects). Tickets print from the success toast and row menus.

---

## 9. Testing

| What | Where | Run |
|---|---|---|
| Selection engine (14 scenarios × smart/FIFO) | `backend/src/queue/engines/selection-engine.spec.ts` | `cd backend && npm test` |
| Status transition maps, timezone utils | `appointment-transitions.spec.ts`, `common/clock/tz.util.spec.ts` | same |
| Queue screens (board, doctor page, check-in, walk-in sheet, roles, list view) | `web-app/src/features/queue/queue-screens.test.tsx` | `cd web-app && npm test` |

Manually verified against a real DB: idempotent walk-ins, doctor-busy, stale
`If-Match`, late limit + convert, DB double-booking constraint, 15 parallel
walk-ins → gap-free tokens, 10 parallel Call Next → one CALLED, TV display
without names. **Not in the repo yet:** Testcontainers integration tests,
property-based tests (fast-check), Playwright full-day e2e.

---

## 10. Known gaps / next steps

- **Row-level security** (`USING organization_id = current_setting('app.organization_id')`)
  is **not enabled**. The orchestrator already sets the GUCs per transaction;
  other modules don't. Tenant isolation is application-level for now.
- **Production migrations**: dev relies on `synchronize`; before production
  generate real migrations (new tables, partial indexes, `no_doctor_overlap`,
  dropped appointment columns) and turn synchronize off.
- Doctor working hours are looked up by doctor + weekday, **not per location**
  (`EmployeeSchedule` has `location_id`; the lookup ignores it).
- `appointment_slot_duration` is only a form default; slot grid is not enforced.
- Dashboard widgets: the page uses real data; a few unused widgets still use
  mock data in `dashboard.api.ts`.
- v2 ideas from the spec: SMS/WhatsApp, wait-time estimates, family group call,
  elderly/pregnant priority, fee-before-token, doctor daily limit, offline
  reception app.

---

## 11. Rules of thumb for future changes

1. Queue state changes **only** through `QueueOrchestrator` — never write
   `queue_entries` from a controller or another service.
2. New transition? Add it to the map in `queue-transitions.ts` *and* a test.
3. New mutation endpoint? It needs `@Can(...)` (or `@AnyMember()` plus a
   check in the orchestrator), `@Idempotency()`, optional `@IfMatch()`, and
   must emit an audit event through `tx.emit`.
4. Never use `new Date()` for clinic days/times — use `ClockService` /
   `tz.util`.
5. Never put patient names in outbox/display payloads.
6. Keep the engine pure — pass it everything (`now`, policy, snapshot).
7. Frontend: cross-feature imports go through the feature `index.ts`; forms use
   TanStack Form + Zod + `FormSheet`/`FieldWrapper`; no axios outside
   `*.api.ts`.
