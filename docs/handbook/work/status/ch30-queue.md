| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 30 | Open a doctor's queue for the day | [Implemented] | Automatic on arrival or on opening My queue; POST /queue/sessions has no web caller |
| 30 | Start, pause and resume the queue | [Implemented] | Pause needs a reason |
| 30 | Close the day | [Implemented] | Every remaining patient needs a cancel/transfer decision |
| 30 | Switch between smart queue and first come, first served for today | [Implemented] | queue.entry.reprioritize; Admin only by default |
| 30 | Doctor-wise tokens | [Implemented] | Counter on the session row, gap-free; prefix from assignment or name |
| 30 | Check in a booked patient | [Implemented] | NOT_TODAY, LATE_LIMIT_EXCEEDED, ALREADY_CHECKED_IN guards |
| 30 | Register a walk-in | [Implemented] | Quick-creates patient P-xxxxx; ACTIVE_WITH_OTHER_DOCTOR needs force |
| 30 | Call the next patient (smart and first-come rules) | [Implemented] | Pure selection engine; 14-scenario spec in both modes |
| 30 | Select a specific patient | [Implemented] | Engine suggestion recorded; optional required reason |
| 30 | Call again (recall) | [Implemented] | Event only, no state change |
| 30 | Undo a call | [Implemented] | Back to waiting, same place in line |
| 30 | Skip a patient who did not come | [Implemented] | Reception or the session's doctor; also the call-timeout job |
| 30 | Rejoin a skipped patient | [Implemented] | end / original_position / manual policy |
| 30 | Send for a test and return from the test | [Implemented] | on_hold keeps the token; returns ahead of walk-ins in smart mode |
| 30 | Transfer a patient to another doctor | [Implemented] | New token, keeps arrival place; from waiting or in consultation |
| 30 | Give urgent priority | [Implemented] | Reason required; no way to remove it |
| 30 | Start the consultation | [Implemented] | Creates the patient_encounters row and opens the workspace |
| 30 | Complete the visit (and bill it automatically) | [Implemented] | ChargeSourcesService.syncForEncounter in the same transaction (needs billing.invoices) |
| 30 | Stop a consultation (abort) | [Implemented] | Appointment cancelled with code other |
| 30 | Remove a patient from the queue (cancel) | [Implemented] | Appointment cancelled with code patient_left |
| 30 | Force-complete a visit for the doctor | [Implemented] | queue.doctor.any; FORCE_COMPLETED event |
| 30 | Print a token ticket | [Implemented] | Pop-up print with a people-ahead estimate |
| 30 | Reception board, doctor screen and TV display (reads) | [Implemented] | TV public, no patient names; GET /queue/me unused by the web app |
| 30 | Live updates on every screen | [Implemented] | Outbox, relay, Redis, Socket.IO rooms; 10 s polling fallback |
| 30 | Safe retries and stale screens (Idempotency-Key and If-Match) | [Implemented] | Keys kept 24 h; VERSION_CONFLICT on a stale version |
| 30 | Background jobs | [Implemented] | No-show 60 s, call timeout 15 s, day-end 5 min, clean-up 03:15 server time |
| 30 | Queue settings (organization default and location override) | [Implemented] | Only smart mode is fixed per session; other values apply within about 60 s |
| 30 | Patient visit history | [Implemented] | Organization-wide, up to 200 rows, patients.view without scope |
| 30 | Next-patient preview | [Partial] | Backend only, no screen |
| 30 | Queue history (events log) | [Partial] | Backend only (admin.audit.view), no screen |
| 30 | Manage the TV display | [Not implemented] | queue.display.manage defined but never checked |
