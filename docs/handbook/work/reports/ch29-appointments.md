# Hand-back — Chapter 29 (Appointments)

- File: `src/part5-modules/ch29-appointments.md`; 14 features: 10 Implemented, 2 Partial (override booking rules, cancel with reason codes), 2 Not implemented (availability overrides/leave, reminders/recurring/online booking).
- Figures: 7 total — 4 placeholders (list, calendar, booking dialog, detail dialog), 3 diagrams (booking sequence, ERD, status map). No existing screenshot applies.
- Diagrams rendered: all OK (`ch29-booking-sequence`, `ch29-appointment-erd`, `ch29-appointment-status`); PNGs checked for readability.
- Could not verify: runtime behaviour (no app run); that convert-to-walk-in is practically unreachable from the UI is deduced from the 60 s no-show job and the UI's status filter, not observed.
- Could not verify: exact visual styling of screens (placeholders described from component code).
- Default `max_appointments_per_day` = 50 applies only once a `location_settings` row exists (row auto-creation not re-verified in this chapter).
- Conflicts recorded in `work/conflicts/ch29-appointments.md` (doc migration notes, validate vs create differences, overrides/leave not used); one Security item (licence compliance, category only).
