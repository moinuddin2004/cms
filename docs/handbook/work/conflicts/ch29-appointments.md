# Conflicts and oddities — Chapter 29 (Appointments)

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| `docs/appointments-and-queue.md` §7, §10 | No migration files; production must still switch from synchronize to migrations | 3 migration files exist (none specific to appointments); production runs with synchronize off plus a reviewed schema sync | `backend/src/migrations/` (3 files); INVENTORY.md §2 |
| `docs/appointments-and-queue.md` §3.2 | `validate` runs "the same set" of rules as create | `validate` does not check "start in the past" and ignores `overrideRules` | `AppointmentsService.validate` |
| `docs/appointments-and-queue.md` §3.2 rule 7 | Overlap → 409 (implied with a code) | The read-check overlap returns 409 with message only, no code; only the DB constraint path returns `DOCTOR_DOUBLE_BOOKED` | `checkGlobalConflict` vs `saveBooking` |
| Task brief / OUTLINE | Availability uses "doctor schedules, availability overrides, leave" | Booking, validation, suggestion and calendar read only `employee_schedules`; `doctor_availability_overrides` and `employee_leaves` are never read by appointments or queue | grep of `backend/src/appointments`, `backend/src/queue` |
| OUTLINE | "booking sheet" | The booking form is a centred Dialog (`AppointmentModal`), not a Sheet | `features/appointments/components/AppointmentModal.tsx` |

## Oddities

- Cancel reason options (`CANCEL_REASON_OPTIONS`) and the API's reason fields are unused by every screen; cancel has no confirm dialog (project rules require one for destructive actions).
- `overrideRules` has no UI.
- `isEmergency` is loaded into the edit form but `UpdateAppointmentDto` has no such field, so changes are silently dropped.
- No field for `reasonForVisit` in the booking dialog, although the API stores it and the queue shows it.
- Working hours ignore `employee_schedules.location_id`; the conflict check spans all organizations, not only the active one.
- `GET /appointments/doctors` returns every active staff member assigned at the location (no role filter); the calendar, booking dropdown and queue lanes therefore list non-doctors too.
- Convert-to-walk-in is effectively unreachable from the web app once the 60 s no-show job has run (Check in is shown only for scheduled/confirmed). Deduced from code, not tested.
- The web app computes ranges and displays times in the browser timezone (`setHours`, `toLocaleTimeString` without `timeZone`), while the server uses the location timezone.
- The booking form uses a native `datetime-local` input; project rules prescribe the shared DatePicker/DateTimePicker.
- `MonthlyGrid.tsx`, `WeeklyGrid.tsx`, `TimelineGrid.tsx` (and through them `AppointmentCard.tsx`) are not imported by any page (dead code).
- Booking writes no general audit-log entry (only `created_by`/`updated_by`).

## Security

- Third-party licensing: the calendar uses FullCalendar premium resource plugins; INVENTORY.md §5 flags the licence type used for a commercial product. Category: licence compliance. Not mentioned in chapter text beyond the neutral fact.
