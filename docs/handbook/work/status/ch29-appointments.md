| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 29 | See bookings and walk-ins in one list | [Implemented] | UNION of appointments and walk-in queue entries, server paging, scoped by appointments.view |
| 29 | Browse the calendar by doctor | [Implemented] | FullCalendar premium resource views; drag/resize only scheduled/confirmed; weekly hours shaded |
| 29 | See the KPI strip | [Implemented] | Month of selected date; walk-ins and avg wait come from the queue |
| 29 | Book an appointment | [Implemented] | Ordered checks plus DB exclusion constraint no_doctor_overlap → DOCTOR_DOUBLE_BOOKED; daily limit default 50 |
| 29 | Check a time slot live and get a suggested time | [Implemented] | POST /appointments/validate, 500 ms debounce, same-day suggestion, up to 50 tries |
| 29 | Override booking rules | [Partial] | API flag and appointments.override_rules exist; no screen sends it |
| 29 | Reschedule or edit a booking | [Implemented] | Only scheduled/confirmed (APPOINTMENT_LOCKED); emergency switch change on edit is not saved |
| 29 | Confirm a booking | [Implemented] | scheduled → confirmed |
| 29 | Cancel a booking (with reason codes) | [Partial] | API stores patient_left/other and text; UI sends neither and has no confirm dialog |
| 29 | Mark a no-show (by hand or automatically) | [Implemented] | Manual action plus 60 s job using max_late_min |
| 29 | Check a patient in (hand-over to the queue) | [Implemented] | QueueOrchestrator.checkInAppointment; detailed in Chapter 30 |
| 29 | Convert a late booking to a walk-in | [Implemented] | Works; UI rarely reaches it because the no-show job removes the Check in action |
| 29 | Respect availability overrides and leave when booking | [Not implemented] | Tables exist in Employees; booking, validation and calendar ignore them |
| 29 | Reminders, recurring bookings and online booking | [Not implemented] | Feature keys commented out; notifications are in-app only |
