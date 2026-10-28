# Chapter 64 — Feature Status Matrix

This chapter lists every feature described in the module chapters (28 to 45), the workflow chapters (46 to 55) and the cross-cutting chapters (56 to 63), one row each, with its status label. It is for the owner who needs to know what is really built before promising anything to a clinic. The status of each row was merged from the notes of the chapters and checked against the chapter text; where a chapter and its notes differed, the chapter wins.

## 64.1 How to read the matrix

Each row has four columns: the chapter number, the feature as a user would name it, the status label and a one-line note. The four labels mean the following.

- **[Implemented]**: built end to end. The backend and logic exist and a web screen uses them, or it is a backend-only job by design.
- **[Partial]**: some of it exists. The note says what is missing, for example "backend only, no screen calls it".
- **[Not implemented]**: planned, seeded, commented out or only mentioned. It must not be described as working.
- **[Unverified]**: the code could not confirm it. The note says what could not be confirmed.

The workflow chapters (46 to 55) follow one business process across several modules, so many of their rows restate a feature that already has a row in a module chapter. They are listed separately so that each workflow can be judged on its own, and the totals in Section 64.5 report modules, workflows and cross-cutting chapters separately to avoid counting the same feature twice. No application was run while the handbook was written, so every label comes from reading the code.

## 64.2 Module chapters

### 64.2.1 Chapter 28 — Patients

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 28 | Register a patient | [Implemented] | Two-step dialog, phone unique per org, P-number, optional first appointment |
| 28 | Check a phone number before saving | [Partial] | Endpoint and hook exist; no component calls them |
| 28 | Browse, search and filter the patient list | [Implemented] | Card + table; UI offers only search, gender, status |
| 28 | Open the patient detail page | [Implemented] | Tabs gated by permission and feature; out-of-scope = 404 |
| 28 | Edit patient details | [Implemented] | Audited diff |
| 28 | Activate or deactivate a patient | [Implemented] | status_history row; does not block booking |
| 28 | Blacklist a patient | [Partial] | API only (PUT); displayed on Overview; blocks nothing |
| 28 | Delete a patient permanently | [Partial] | Fails (500) when billing/lab rows exist (ON DELETE RESTRICT) |
| 28 | Import patients from a spreadsheet | [Implemented] | parse → dry run → batches of 500; error report CSV |
| 28 | Export the patient list | [Implemented] | 10,000-row cap, X-Export-Truncated, audit row |
| 28 | Appointments tab | [Implemented] | Appointments + walk-in queue visits |
| 28 | Visits and clinical history | [Implemented] | GET history; prices stripped without patients.price.view |
| 28 | Per-location visit statistics | [Not implemented] | patient_visits never written; endpoint always empty |
| 28 | Patient change history | [Implemented] | admin.audit.view; values redacted per permission |
| 28 | Dental info | [Implemented] | One row per patient, upsert |
| 28 | Vitals | [Implemented] | Append-only, BMI computed |
| 28 | Teeth chart (FDI) | [Implemented] | Append-only snapshots; feature off by default |
| 28 | Record a treatment from the patient page | [Implemented] | Needs clinical.edit + price.view to see button |
| 28 | Patient treatment plans | [Partial] | Backend only (see ch33) |
| 28 | Prescriptions tab and legacy quick-Rx | [Implemented] | Legacy patient_prescriptions table still writable |
| 28 | Signed consents | [Implemented] | Signature pad, PNG data URL stored in record |
| 28 | Documents (Files tab) | [Implemented] | Upload via storage provider, then record |
| 28 | Communications log | [Partial] | CrmTab component exists but not mounted |
| 28 | Recalls | [Partial] | Backend only; no reminder job |
| 28 | Referrals | [Partial] | Backend create/list only; CrmTab unmounted |
| 28 | Feedback | [Partial] | Backend create/list only; CrmTab unmounted |
| 28 | Insurance | [Partial] | Backend only; feature off by default |
| 28 | Billing tab | [Implemented] | Embedded billing module (ch34) |
| 28 | Patient portal / CRM feature keys | [Not implemented] | Retired feature keys |
| 28 | Patient scope (own/location/org) | [Implemented] | patientScope + PatientScopeGuard |

30 rows: 19 Implemented, 9 Partial, 2 Not implemented, 0 Unverified. Patients is the largest module. The core record is built end to end: registration, list, detail tabs, edit, import, export, audit history, dental info, vitals, teeth chart, signed consents and documents. The Partial rows share one pattern: the backend exists but no screen reaches it (phone pre-check, blacklist, recalls, referrals, feedback, insurance, communications log, patient treatment plans). Permanent delete is Partial because it fails with a generic error once billing or lab rows exist. The two Not implemented rows are the per-location visit statistics, which nothing ever writes, and the retired patient portal and CRM feature keys.

### 64.2.2 Chapter 29 — Appointments

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

14 rows: 10 Implemented, 2 Partial, 2 Not implemented, 0 Unverified. Booking is solid: the list, calendar, live slot check, double-booking constraint and no-show job all work. The gaps are rules the booking engine does not consult (availability overrides and leave), the override-booking flag that no screen sends, and cancel reasons that the API supports but the screen never sends. Reminders, recurring and online booking are not built.

### 64.2.3 Chapter 30 — Queue

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

31 rows: 28 Implemented, 2 Partial, 1 Not implemented, 0 Unverified. The queue is the most complete module in the Platform: 28 of 31 rows are Implemented. Check-in, walk-ins, smart or first-come calling, tests, transfers, urgent priority, completion with automatic billing, live updates, safe retries and the background jobs all work. The Partial rows are two backend reads with no screen (next-patient preview and queue history). The one Not implemented row is managing the TV display, whose permission is defined but never checked.

### 64.2.4 Chapter 31 — Consultation

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 31 | Start a consultation (encounter created) | [Implemented] | ensureForQueueEntry inside the start-consultation transaction; idempotent per queue entry |
| 31 | Re-open a running consultation | [Implemented] | GET /encounters/by-queue-entry/:id; conduct scope own = session doctor |
| 31 | See the patient at a glance | [Implemented] | Vitals, 4 previous visits, 3 signed prescriptions with reuse |
| 31 | Allergy and medical alerts | [Partial] | Client-side chips from free-text allergies/medical history and latest vitals flags; no structured allergy list or drug check |
| 31 | Write the visit notes (auto-saved) | [Implemented] | PATCH /encounters/:id, 800 ms debounce, 4000-char fields; not locked after completion |
| 31 | Record the treatments done today | [Implemented] | POST /encounters/:id/treatments; catalog procedure or typed name; no edit/delete |
| 31 | Patient record slide-over | [Implemented] | Reuses patient tabs; amounts hidden |
| 31 | Prescription inside the consultation | [Implemented] | Draft on first complete line, autosave 1 s, Sign & print; panel not gated by permission/feature |
| 31 | Order lab work from the consultation | [Not implemented] | No lab entry point; lab orders have no encounter link |
| 31 | Complete the visit | [Implemented] | Flush saves, PATCH complete; appointment completed; charges in same transaction |
| 31 | Automatic charges on completion | [Implemented] | ChargeSourcesService.syncForEncounter; only when billing.invoices enabled; needsPricing fallback |
| 31 | Void charge of a removed treatment | [Partial] | handleRemoved exists but unreachable: no treatment delete, sync runs once at completion |
| 31 | Keep prices away from doctors | [Implemented] | HideTreatmentPricesInterceptor plus VisibleIf on patients.price.view |
| 31 | Encounter and treatment records outside the consultation | [Implemented] | GET /encounters/:id, GET/POST /treatments with patient scope |
| 31 | SOAP notes and note templates | [Not implemented] | Only encounter text fields; phrase chips fixed in code |

15 rows: 11 Implemented, 2 Partial, 2 Not implemented, 0 Unverified. The consultation workspace covers notes with autosave, treatments, the patient slide-over, prescribing, completion and automatic charges. Allergy alerts are Partial because they are only text chips with no structured list or drug check. Voiding the charge of a removed treatment is Partial because no screen can remove a treatment. Ordering lab work from the consultation and structured SOAP notes are not built.

### 64.2.5 Chapter 32 — Prescriptions

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 32 | Browse and filter prescriptions | [Implemented] | GET /prescriptions and /stats, location + patient scope; "this month" uses server clock |
| 32 | Write a prescription and save as draft | [Implemented] | POST /prescriptions; RX-{year}-{5 digits} per org, unique platform-wide |
| 32 | Fill from a preset | [Implemented] | Builder replaces list; workspace appends and offers advice |
| 32 | Sign (finalize) a prescription | [Implemented] | DRAFT/AMENDED only, needs a medicine; best-effort PDF upload |
| 32 | Amend a signed prescription | [Implemented] | PATCH on FINALIZED gives AMENDED, version+1, snapshot in history |
| 32 | Add/edit/remove one medicine line | [Partial] | Backend only; screens send the full list |
| 32 | Duplicate a prescription | [Partial] | Backend only; stores user id as doctor_id (FK to employees), unverified |
| 32 | Change history | [Partial] | Rows written; no viewer; read requests undeclared relation changedByEmployee |
| 32 | PDF with Urdu (Nastaliq) | [Implemented] | pdf-lib + fontkit-shaped Noto Nastaliq outlines; single page; drafts printable |
| 32 | Print layouts (prescription templates) | [Implemented] | Default per location/org; UI creates org-wide only; orientation/logo/reg no. not printed |
| 32 | Doctor signatures | [Implemented] | Keyed by user id; delete and by-doctor read have no screen |
| 32 | Medicine directory incl. search and seed | [Implemented] | Soft deactivate; seed adds 10 medicines only when empty |
| 32 | Prescription presets (treatment-plan-templates) | [Implemented] | About 40 PresetCategory values; not clinical plan templates |
| 32 | Prescriptions by patient / visit / appointment | [Partial] | By-appointment lookup has no screen |
| 32 | Legacy quick prescriptions (patient_prescriptions) | [Implemented] | Still readable/writable from patient tab; separate numbering, no link to new table |

15 rows: 11 Implemented, 4 Partial, 0 Not implemented, 0 Unverified. Prescriptions are largely built, including the Urdu PDF, presets, print layouts, signatures and the medicine directory. The Partial rows are backend-only operations (single-line edits, duplicate, change history, lookup by appointment). Two of them have likely defects that were read from code but not run: the history read and the duplicate action.

### 64.2.6 Chapter 33 — Treatment plans

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 33 | Browse and filter plan templates | [Implemented] | Card grid, search + category; fees stripped without price.view |
| 33 | Create a plan template | [Implemented] | Up to 50 procedures in jsonb; not audited |
| 33 | Edit a plan template | [Implemented] | Replaces procedure list |
| 33 | Hide or show a plan template | [Implemented] | is_active switch |
| 33 | Delete a plan template | [Implemented] | Hard delete; treatments.plan_template_id SET NULL |
| 33 | Starter templates for a new clinic | [Implemented] | 12 defaults seeded when org has zero templates (re-seeds if all deleted) |
| 33 | Use a template when recording a treatment | [Implemented] | Prefills name/cost, tags treatment; button needs price.view |
| 33 | Create a patient treatment plan | [Partial] | Backend only; web hooks unused |
| 33 | Update a plan (status, acceptance, costs) | [Partial] | Backend only; free status changes |
| 33 | Add items to a plan | [Partial] | Backend only |
| 33 | Track progress of plan items | [Partial] | Backend only; nothing automatic |
| 33 | Start a patient plan from a template | [Not implemented] | Only UI text/comment claim it |
| 33 | Turn plan items into charges | [Partial] | Backend only; no web caller |
| 33 | Plan billing summary | [Partial] | Endpoint + API fn + hook; no component renders it |

14 rows: 7 Implemented, 6 Partial, 1 Not implemented, 0 Unverified. Plan templates are fully built. Patient treatment plans are the weak half: creating, updating and tracking a patient plan, turning its items into charges and the plan billing summary all exist only in the backend. Starting a patient plan from a template is not built, although some screen text says it is.

### 64.2.7 Chapter 34 — Billing

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 34 | Keep a service catalog | [Implemented] | Org-level services, audited, never deleted |
| 34 | Set location and doctor price overrides | [Implemented] | PATCH override and resolved-price endpoints unused by UI |
| 34 | Automatic charges from a completed consultation | [Implemented] | syncForEncounter in queue completion tx; removed treatment → VOID or Review |
| 34 | Add a manual charge | [Implemented] | Catalog or Other; price policy enforced |
| 34 | Create charges from a treatment plan | [Partial] | Backend only, no web call |
| 34 | Edit an unbilled charge (price policy) | [Implemented] | Catalog price needs billing.price.override |
| 34 | Void an unbilled charge | [Implemented] | Reason 5–300 chars |
| 34 | Manage discount types | [Implemented] | Code field not on screen |
| 34 | Discount one / many / custom | [Implemented] | Range via AccessContext.decide; custom needs note |
| 34 | Ready-to-bill list and billing desk | [Implemented] | Outstanding omits partly paid invoices |
| 34 | Collect a payment | [Implemented] | One tx, lock order, idempotent clientRequestId |
| 34 | Choose an allocation strategy | [Implemented] | Oldest first (FIFO) and Manual |
| 34 | Hold and apply advance | [Implemented] | Advance = amount − allocated − refunded |
| 34 | Unapply a payment | [Partial] | Backend only |
| 34 | Payment accounts and methods | [Implemented] | Auto Cash default; default/last account cannot be deactivated |
| 34 | Number invoices, receipts and refunds | [Implemented] | CODE-INV/REC/RFD-YYYY-NNNNN, gapless |
| 34 | Issue an invoice | [Implemented] | At collection/advance apply or manual; due days default 7 |
| 34 | Exclusive sales tax | [Implemented] | Snapshot of location_settings.tax_rate |
| 34 | Browse invoices and payment status | [Implemented] | Stored ISSUED/CANCELLED; computed payment status |
| 34 | Edit an issued invoice | [Implemented] | Preview in rolled-back tx; revision conflict check |
| 34 | Cancel an invoice | [Implemented] | Only when nothing paid; unapply has no UI |
| 34 | Refunds | [Implemented] | Always from advance; invoice refund may carry an edit |
| 34 | Patient billing summary and statement | [Implemented] | Ledger-based statement |
| 34 | Show dues at check-in | [Implemented] | Setting enforced only in web app |
| 34 | Daily collection | [Implemented] | Payments page |
| 34 | Cash close | [Implemented] | Advisory lock; immutable; variance flag |
| 34 | Printing | [Implemented] | Browser print A4/80 mm; English labels, Urdu typed text |
| 34 | Billing settings | [Implemented] | Document code locks after first number |
| 34 | Expenses | [Implemented] | Edit API-only; no delete confirm; hard delete |
| 34 | Credit packages and patient credits | [Partial] | Backend only; expiry cron 01:00 server date |
| 34 | Billing activity / audit log | [Implemented] | User/action filters not on screen |
| 34 | Nightly invariant check | [Implemented] | 02:30 server time, I1–I10, log only |
| 34 | Doctor revenue and financial summary | [Implemented] | Daily summary unused; details in Ch 36 |
| 34 | Commission snapshot on charges | [Implemented] | Cross-reference to Ch 35 |

34 rows: 31 Implemented, 3 Partial, 0 Not implemented, 0 Unverified. Billing is the deepest module and is almost entirely Implemented: catalog, automatic and manual charges, discounts, collection, advance, invoices, tax, edits, cancellation, refunds, cash close, printing, expenses and the nightly checks. Three Partial rows are backend-only: unapplying a payment, credit packages and plan-based charges. Because unapply has no screen, an invoice that has any payment cannot be cancelled from the web app.

### 64.2.8 Chapter 35 — Commissions

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 35 | Set up or change a compensation plan | [Implemented] | Versioned per assignment, GiST no-overlap, compensation.manage |
| 35 | See the current plan and version history | [Implemented] | Compensation tab in employee detail |
| 35 | Edit service-wise overrides (commission rules) | [Implemented] | Replace rules of current version; service > category > default |
| 35 | Snapshot the rate on each visit charge | [Implemented] | CONSULTATION and TREATMENT charges only; backend by design |
| 35 | Earn commission when patient money is applied | [Implemented] | Cumulative target, NET/GROSS, tax pro-rating, fixed amount; backend by design |
| 35 | Earn commission on lab work | [Implemented] | Lab-line commissions, net of lab cost; backend by design |
| 35 | Preview the doctor share while collecting payment | [Implemented] | doctorShare gated by earnings.all.view and billing.commissions |
| 35 | See every doctor's earnings | [Implemented] | /billing/doctor-earnings; GET /commissions has no screen |
| 35 | See my own earnings | [Implemented] | /my-earnings, filtered by signed-in user |
| 35 | See doctor revenue | [Implemented] | /billing/doctor-revenue, reports.financial.view, not commission |
| 35 | Settle commission through payroll | [Implemented] | lockUnsettled, create, markPaid, release |
| 35 | Protect the ledger (append-only trigger, I10) | [Implemented] | Trigger in migration; nightly I10 covers charges only |
| 35 | Choose a commission plan when adding an employee | [Implemented] | compensation object on POST /employees |
| 35 | Manual commission adjustments | [Not implemented] | MANUAL source type reserved, never written |

14 rows: 13 Implemented, 0 Partial, 1 Not implemented, 0 Unverified. Commissions work end to end in the backend, which is by design: rates are snapshotted on charges, commission is earned as patient money is applied, lab lines are included and the ledger is protected by a trigger. Screens exist for plans, earnings and the doctor-share preview. Manual commission adjustments are the only gap: the source type is reserved and never written.

### 64.2.9 Chapter 36 — Dashboard and reports

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 36 | See the home dashboard | [Partial] | Real data; money tiles also need billing.financial_summary; mock dashboard.api.ts and ~10 widgets unused |
| 36 | Read the finance overview | [Implemented] | /reports/finance/overview, gated finance.overview.view, 12-month trend, warnings |
| 36 | Read the profit and loss statement | [Implemented] | Collected vs billed basis; costs by own period; payroll base salary only |
| 36 | Read the clinic overview | [Partial] | Default Doctor role (own scope) sees sidebar item but API refuses |
| 36 | Browse the report library | [Implemented] | 37 reports, filtered by permission and own-scope doctor filter |
| 36 | Run a report on screen | [Implemented] | 5,000 row cap, scope resolution, rupees |
| 36 | Download a report as Excel or PDF | [Implemented] | 50,000 rows, PDF max 5,000, audit EXPORT row |
| 36 | The 37 reports | [Implemented] | 15 financial, 22 clinical; 9 categories |
| 36 | Daily financial summary | [Partial] | Backend only; /financial-summary redirects to /dashboard |

9 rows: 6 Implemented, 3 Partial, 0 Not implemented, 0 Unverified. The finance overview, profit and loss, the 37-report library and Excel and PDF export are Implemented. The home dashboard is Partial because roughly ten unused widgets still read mock data and the money tiles need an extra feature. The clinic overview is Partial because the default Doctor role sees it in the sidebar but the API refuses that scope. The daily financial summary has no screen.

### 64.2.10 Chapter 37 — Employees

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 37 | Browse and filter the employee list | [Implemented] | Assignments at active location, server paging |
| 37 | Add an employee | [Implemented] | Platform-unique phone checked; CNIC only by DB index |
| 37 | View an employee | [Implemented] | Scoped to active location |
| 37 | Edit an employee | [Implemented] | Duplicate phone/CNIC on edit gives generic 500 |
| 37 | Activate or deactivate an employee | [Implemented] | Assignment is_active; employees.is_active never written |
| 37 | Delete an employee permanently | [Implemented] | Refused if other locations or referenced rows |
| 37 | Give an employee a staff login | [Implemented] | Employee form and User Admin; PATCH portal-access has no screen |
| 37 | Set or update the salary | [Implemented] | Adds compensation plan version from today |
| 37 | Set the weekly schedule | [Implemented] | 7 days, slot 15/30/45/60; cross-location check never called |
| 37 | Record availability overrides | [Partial] | CRUD works; booking ignores them |
| 37 | Manage leave requests | [Partial] | Manager-only; approved leave ignored by booking and payroll |
| 37 | See the leave summary | [Partial] | Usage tally, no entitlements |
| 37 | List employment roles | [Implemented] | GET /employment-roles, employees.view |
| 37 | Assign an existing employee to another location | [Not implemented] | DTOs exist, no endpoint |
| 37 | Attendance | [Not implemented] | Only in hr.leave description |

15 rows: 10 Implemented, 3 Partial, 2 Not implemented, 0 Unverified. Employee records, schedules, salary, staff logins and deletion are built. Availability overrides, leave requests and the leave summary are Partial because they can be recorded but are never read by booking or payroll. Assigning an existing employee to another location and attendance tracking are not built.

### 64.2.11 Chapter 38 — Payroll

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 38 | Generate payroll for a month | [Implemented] | Base + commission, settlement lock, future months refused |
| 38 | Month-end automatic generation | [Implemented] | Cron 0 5 1 * * server time; comment says 00:05 |
| 38 | Create a payroll record by hand | [Implemented] | No assignment or future-month check; commission 0 |
| 38 | View payroll for a month or employee | [Implemented] | month/year validation 400 |
| 38 | Mark a record as paid | [Implemented] | Also pays settlement; records payout only |
| 38 | Put a record on hold | [Partial] | Endpoint exists; no button, edit dialog status works |
| 38 | Edit a payroll record | [Implemented] | Amount is total; floor at commission |
| 38 | Delete a payroll record | [Implemented] | Releases pending settlement; refused if commission paid |
| 38 | Export a month as CSV | [Partial] | Endpoint only, no button |
| 38 | Payslip PDF | [Partial] | Endpoint only, no button |
| 38 | Deductions, tax and bank files | [Not implemented] | Deductions fixed at 0 |

11 rows: 7 Implemented, 3 Partial, 1 Not implemented, 0 Unverified. Payroll generation, month-end automation, editing, deleting and marking paid all work. Putting a record on hold, the CSV export and the payslip PDF are Partial: the endpoints exist but no button calls them. Deductions, tax and bank files are not built, so net pay always equals gross pay.

### 64.2.12 Chapter 39 — Inventory

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 39 | Browse stock and see stock health | [Partial] | Works; no sidebar entry |
| 39 | Add, edit and deactivate an item | [Partial] | Initial stock uses movement path (FK risk) |
| 39 | Manage categories | [Partial] | API only; no screen creates; seedDefaults never called |
| 39 | Adjust stock and keep the movement history | [Unverified] | performedBy gets user id but FK is to employees |
| 39 | Manage suppliers | [Partial] | Works; no sidebar entry |
| 39 | Raise and track a purchase order | [Unverified] | createdBy FK risk; poNumber global unique vs per-org sequence |
| 39 | Receive goods into stock | [Unverified] | Same FK risk via applyMovement |
| 39 | Define consumption templates | [Partial] | CRUD works; nothing uses templates |
| 39 | Record materials used on a patient | [Not implemented] | ConsumptionRecorder not placed on any screen |
| 39 | Daily low-stock and expiry alerts | [Partial] | 08:00 server-time cron only logs |

10 rows: 0 Implemented, 6 Partial, 1 Not implemented, 3 Unverified. Inventory has no Implemented row. Stock, suppliers, purchase orders and receiving work through the API and have screens, but the module has no sidebar entry. Three rows are Unverified because the code passes a login id into columns that are foreign keys to employees, and this was never run to see whether the writes fail. Recording materials used on a patient has no screen, and the daily alert job only writes to the log.

### 64.2.13 Chapter 40 — Dental lab (clinic side)

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 40 | Keep the platform lab directory | [Implemented] | Super admin; external and in-house labs; in-house lab auto-creates its active link |
| 40 | Manage the staff of a lab | [Implemented] | Super admin adds lab members by account email; deactivate, never delete |
| 40 | Manage a lab's services, options and prices | [Implemented] | Super admin only; price windows, void, history; lab cannot edit its own catalog |
| 40 | Service categories | [Partial] | Create/update endpoints exist, no screen; six dental categories seeded |
| 40 | Add a lab to the clinic's lab list | [Implemented] | Invited link; directory shows active external and own in-house labs |
| 40 | Set payment terms and patient data level | [Implemented] | full_name or code_only per link; 0-365 days |
| 40 | Activate, suspend and reactivate a lab link | [Implemented] | Reason to suspend; only suspending side reactivates |
| 40 | Read the lab price list | [Implemented] | Negotiated else list price; margin; AnyMember reads |
| 40 | Get a price quote | [Implemented] | LabPriceResolver; quote default day is Asia/Karachi |
| 40 | Map a lab service to a clinic treatment | [Implemented] | One default per treatment; needs lab.catalog.manage |
| 40 | Save and reuse order templates | [Implemented] | Private or shared; /use endpoint not called by web |
| 40 | Create a lab order draft | [Implemented] | Optional idempotency key; pins form and workflow versions |
| 40 | Start from a template or repeat a past order | [Implemented] | from-template and repeat endpoints |
| 40 | Submit an order to the lab | [Implemented] | One transaction; Idempotency-Key required; price snapshot; revision 1; magic link |
| 40 | List and search lab orders | [Implemented] | Scoped by lab.orders.view own/location/org |
| 40 | Open an order and print the work order | [Implemented] | QR /o/:orderId; no prices on work order |
| 40 | Cancel, hold, resume or reopen an order | [Implemented] | Workflow driven; cancel from draft/submitted/accepted only |
| 40 | Revise a submitted order | [Implemented] | New revision, re-priced on original day |
| 40 | Talk to the lab: messages and clarifications | [Implemented] | Clinic replies; only lab asks |
| 40 | Decide the lab's extra charge requests | [Implemented] | Approved item charge adds to lab cost |
| 40 | Attach and download files | [Implemented] | 50 MB; 10-minute signed URL; patient_shared not surfaced |
| 40 | Send, copy and revoke magic links | [Implemented] | Hash only in DB; 24 h default TTL |
| 40 | Update on behalf of a lab that does not answer | [Implemented] | Needs lab.orders.create and lab.links.manage; via proxy |
| 40 | Follow production and try-in rounds | [Implemented] | Stages from template; rounds; record try-in; decide |
| 40 | Approve, reject or deliver finished work | [Implemented] | Delivery starts 12-month warranty |
| 40 | Cancel one item | [Partial] | Endpoint only, no screen |
| 40 | Ask for a remake and decide who pays | [Implemented] | Warranty claim auto; charges by responsible party |
| 40 | Receive a shipment and report a lost one | [Implemented] | QR token; only lab.orders.view needed |
| 40 | Send impressions and models to the lab | [Partial] | Endpoint and unused web API function |
| 40 | Notifications about lab work | [Partial] | 4 seeded events never emitted; patient/lab-contact channels dev-log only |

30 rows: 26 Implemented, 4 Partial, 0 Not implemented, 0 Unverified. The clinic side of lab work is broad and mostly Implemented: directory, links, price lists, orders, revisions, messages, files, magic links, production rounds, delivery, warranties, remakes and shipments. The Partial rows are cancel-one-item, sending impressions to the lab, service categories and lab notifications (four seeded events are never emitted).

### 64.2.14 Chapter 41 — Lab portal

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 41 | Sign in as a lab member | [Implemented] | labMemberships in login response; lab-only users land on /lab-portal |
| 41 | Work in one lab or switch between labs | [Implemented] | x-lab-id header; LabPortalGuard |
| 41 | See the lab dashboard | [Implemented] | Three counters |
| 41 | Read the order inbox | [Implemented] | Drafts hidden; patient ref by data level |
| 41 | Open an order | [Implemented] | Lab mapper: no patient price |
| 41 | Accept an order with an expected date | [Implemented] | Lab admin; creates stages and vendor bill draft |
| 41 | Reject an order | [Implemented] | Order-level reject with reason |
| 41 | Ask the clinic a question | [Implemented] | Moves order to clarification_needed |
| 41 | Change the expected date | [Implemented] | Lab admin; reason; accepted/in progress/partially ready/on hold |
| 41 | Write a note to the clinic | [Implemented] | Notes only; no status change |
| 41 | Acknowledge a revision | [Implemented] | Idempotent |
| 41 | Ask for an extra charge | [Partial] | Backend only; no portal form |
| 41 | Upload files to an order | [Partial] | Backend only; no portal control |
| 41 | Download files the clinic shared | [Implemented] | lab_shared only; 10-minute URL |
| 41 | Run the work queue: start, QC pass, QC fail | [Implemented] | Lab admin and technician |
| 41 | Assign a technician | [Implemented] | Lab admin; unassign endpoint has no button |
| 41 | Ship a try-in or finished work to the clinic | [Implemented] | SHP number, QR slip |
| 41 | Receive what the clinic sent | [Implemented] | Portal always records full qty, condition ok |
| 41 | Report a shipment lost | [Implemented] | Open lines become missing |
| 41 | Dispute a remake request | [Implemented] | Lab admin; only requested status |
| 41 | Accept, suspend or reactivate a clinic | [Implemented] | Lab admin; shared transition code |
| 41 | Manage the lab's team | [Implemented] | Lab admin; no self change |
| 41 | View and edit the lab profile | [Implemented] | Contact fields only |
| 41 | See bills, payments and statements | [Implemented] | Read only; drafts hidden |
| 41 | Answer an order from a magic link, without logging in | [Implemented] | Accept, reject, ask; public routes; throttled |
| 41 | Open an order from the printed QR code | [Implemented] | /o/:orderId resolves lab or clinic |
| 41 | Be told about new work | [Partial] | In-app rows exist; no inbox in portal layout found |

27 rows: 24 Implemented, 3 Partial, 0 Not implemented, 0 Unverified. The lab portal covers sign-in, order inbox, accept, reject, clarify, production queue, shipping, team and profile, and no-login magic-link answers. Partial rows are charge requests and file upload (backend only) and the new-work notification (rows exist but the portal has no inbox).

### 64.2.15 Chapter 42 — Lab finance

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 42 | Estimate and invoice lab work | [Implemented] | draft to issued, LINV numbers, frozen patient prices |
| 42 | Browse lab invoices and see one | [Implemented] | overdue computed in location timezone |
| 42 | Void estimate or unpaid invoice | [Implemented] | needs billing.invoice.void too |
| 42 | Collect lab payment | [Implemented] | Idempotency-Key required, FIFO auto-allocation |
| 42 | Use patient advance | [Implemented] | also automatic at issue |
| 42 | Reverse lab payment | [Implemented] | needs billing.refund.issue; refused after refund |
| 42 | Credit note | [Implemented] | releases newest allocations to advance |
| 42 | Refund advance | [Implemented] | needs billing.refund.issue |
| 42 | Payment reminder | [Partial] | queued to outbox, patient audience off by default, nothing delivered |
| 42 | Order and patient billing summaries | [Implemented] | read panels |
| 42 | Lab billing settings | [Implemented] | tax bp and due days; needs admin.settings.manage |
| 42 | Doctor commission on lab work | [Implemented] | collected basis net of lab cost; skipped when billing.commissions off |
| 42 | Receivables journals (GL) | [Partial] | written for all lab money, no screen or report reads them |
| 42 | Vendor bill drafts at lab accept | [Implemented] | effect create_vendor_bill_draft plus item listener |
| 42 | Review, approve, void vendor bill | [Partial] | PATCH bill and add line exist in API only |
| 42 | Pay a lab | [Implemented] | allocations over approved bills, journals |
| 42 | Use lab advance on bills | [Partial] | endpoint and api client exist, no UI button |
| 42 | Reverse a payment to a lab | [Implemented] | mirrors journals |
| 42 | Lab statements and reconciliation | [Implemented] | manual line entry, no upload |
| 42 | Payables reports | [Implemented] | aging, monthly cost, case profit |
| 42 | Lab portal payables (read) | [Implemented] | drafts excluded |

21 rows: 17 Implemented, 4 Partial, 0 Not implemented, 0 Unverified. Lab finance has full estimate-to-invoice, collection, advance, credit note, refund, vendor bill, payment and statement flows. Partial rows are backend-only vendor bill editing and lab advance use, payment reminders that are queued but never delivered, and journals that are written but never read by any screen.

### 64.2.16 Chapter 43 — Workflow engine (Config Studio)

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 43 | Manage form schemas | [Implemented] | super admin only |
| 43 | Edit form version and preview | [Implemented] | issues do not block saving |
| 43 | Publish and retire form version | [Implemented] | service-enforced immutability |
| 43 | Clinics read current forms | [Implemented] | AnyMember endpoints |
| 43 | Manage workflow templates | [Implemented] |  |
| 43 | Edit workflow draft and test run | [Implemented] | 60 states, 300 transitions |
| 43 | Publish and retire workflow version | [Implemented] | rows materialised at publish |
| 43 | Manage stage templates | [Implemented] | not versioned, no delete |
| 43 | Order state machine from pinned version | [Implemented] | pinWorkflowVersion, transition referee |
| 43 | Compare versions and activity | [Implemented] | activity tab on forms only |
| 43 | Specialties and organization enablement | [Partial] | endpoints exist, Studio only lists |
| 43 | Dental seed | [Implemented] | insert-if-missing at boot |

12 rows: 11 Implemented, 1 Partial, 0 Not implemented, 0 Unverified. Config Studio is a super admin tool for form schemas, workflows and stage templates. Everything is Implemented except specialties and organization enablement, where endpoints exist but the Studio only lists.

### 64.2.17 Chapter 44 — Notifications

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 44 | See notifications in the header bell | [Implemented] | 30 s polled badge, 20 newest items, own inbox only |
| 44 | Mark notifications as read | [Implemented] | one or all; no mark-unread or delete |
| 44 | Raise a notification event | [Implemented] | enqueue in caller transaction; 6-step decision order |
| 44 | Deliver messages in the background | [Implemented] | LISTEN + 2 s poll, skip-locked claim, 5 attempts; in-app only |
| 44 | Choose who is notified (switches and rules) | [Implemented] | audited; mandatory rules locked |
| 44 | Set quiet hours | [Partial] | saved but never holds in-app messages |
| 44 | Edit message wording in several languages | [Implemented] | en / ur / roman_ur; placeholder validation |
| 44 | Review the message log | [Implemented] | filters by status, channel, text |
| 44 | Patient messaging opt-outs and language | [Partial] | backend works; UI card commented out |
| 44 | Notify through a workflow transition | [Partial] | notify effect exists; no shipped transition found using it |
| 44 | Send to patients by WhatsApp, SMS or email | [Not implemented] | no patient channel; dev-log stand-in only |
| 44 | Appointment reminders | [Not implemented] | no event, no job |

12 rows: 7 Implemented, 3 Partial, 2 Not implemented, 0 Unverified. The in-app bell, message rules, templates and the delivery pipeline work. Quiet hours, patient opt-outs and workflow-driven notification are Partial. Sending to patients by WhatsApp, SMS or email and appointment reminders are not built.

### 64.2.18 Chapter 45 — Subscriptions and onboarding

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 45 | Sign up and create a clinic | [Implemented] | one transaction; 14-day Professional trial |
| 45 | Verify email and resend link | [Partial] | works, but nothing is gated by verification |
| 45 | Complete the setup wizard | [Implemented] | 3 steps; owner only; finish does not check the other steps |
| 45 | Trial, plans and plan limits | [Implemented] | plans in code; PLAN_LIMIT on locations and logins |
| 45 | Read-only mode after expiry | [Implemented] | 402 SUBSCRIPTION_EXPIRED; 30 s cache |
| 45 | See subscription status and warnings | [Implemented] | derived status; AccountBanner |
| 45 | Record a manual payment | [Implemented] | super admin; sets plan to paid plan |
| 45 | Change plan, dates or limits | [Implemented] | super admin; audited |
| 45 | Edit the payment instructions | [Implemented] | platform setting, 2000 chars |
| 45 | Create a clinic from the Organizations screen | [Partial] | plan selector sends values the DTO rejects |

10 rows: 8 Implemented, 2 Partial, 0 Not implemented, 0 Unverified. Self-signup with a 14-day trial, plan limits, read-only mode after expiry, warnings and manual payments work. Email verification is Partial because nothing is gated by it. Creating a clinic from the Organizations screen is Partial because the plan selector sends values the API rejects.

## 64.3 Workflow chapters

### 64.3.1 Chapter 46 — Clinic onboarding

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 46 | Self-signup and clinic creation | [Implemented] | POST /auth/register creates user, clinic, MAIN location, trial |
| 46 | Email verification | [Partial] | Informational; nothing gated by email_verified_at |
| 46 | Setup wizard | [Implemented] | finish does not check the other steps |
| 46 | Super admin creates organization | [Partial] | Endpoint works; screen form sends values the API rejects; no owner/location created |
| 46 | Create owner login for a super-admin-created clinic | [Partial] | Only through User Admin after selecting the org; sequence deduced, not run |
| 46 | Entitle features | [Implemented] | Several key features are off by default |
| 46 | Owner enables features | [Implemented] | Locked when not entitled |
| 46 | Roles | [Implemented] | Five system roles seeded |
| 46 | Locations | [Implemented] | Edit screen sends fields the API refuses |
| 46 | Theme and navigation | [Implemented] | Nav save bumps access_version; theme save does not |

10 rows: 7 Implemented, 3 Partial, 0 Not implemented, 0 Unverified. The two ways to start a clinic are both traced. The self-signup path is built. The super admin path is Partial because the form sends rejected values and no owner login or location is created with the organization.

### 64.3.2 Chapter 47 — Staff onboarding

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 47 | Employee record, assignment and role | [Implemented] | POST /employees, phone unique platform-wide |
| 47 | Staff login (employee form route) | [Implemented] | Does not check plan login limit |
| 47 | Staff login (User Admin route) | [Implemented] | Checks login limit; links all active assignments |
| 47 | Weekly schedule | [Implemented] | Overlap helper across locations never called |
| 47 | Compensation plan | [Implemented] | Commission needs billing.commissions and consulting role |
| 47 | Assign an existing employee to a second location | [Not implemented] | No endpoint; Add Employee fails on duplicate phone |
| 47 | First sign-in and access | [Implemented] | Home page from role |

7 rows: 6 Implemented, 0 Partial, 1 Not implemented, 0 Unverified. Adding staff works, with one gap: an existing employee cannot be assigned to a second location, because the only creation path refuses an existing phone number. The employee-form login route does not check the plan login limit, unlike User Admin.

### 64.3.3 Chapter 48 — Patient journey

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 48 | Patient registration | [Implemented] | Phone unique per organization |
| 48 | Appointment booking | [Implemented] | Validate then insert; DB blocks overlap |
| 48 | Check-in and token | [Implemented] | Same-day, within max lateness |
| 48 | Queue and call next | [Implemented] | Smart or first-come |
| 48 | Consultation and encounter | [Implemented] | Encounter at start-consultation |
| 48 | Treatments in the workspace | [Implemented] | Doctor sees no prices |
| 48 | Prescription in the workspace | [Implemented] | Optional |
| 48 | Lab order from the consultation workspace | [Not implemented] | Created from Lab orders page instead |
| 48 | Automatic charges on completion | [Implemented] | Only with billing.invoices enabled (default off) |
| 48 | Payment and invoice issue | [Implemented] | Invoice issued at collection |
| 48 | Receipt printing | [Implemented] | Browser print layouts; no server PDF |

11 rows: 10 Implemented, 0 Partial, 1 Not implemented, 0 Unverified. The patient journey from registration to receipt is built. The only break is that no lab order can be started from the consultation workspace. Automatic charges depend on the billing.invoices feature, which is off by default.

### 64.3.4 Chapter 49 — Dental lab case

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 49 | Create and submit lab order | [Implemented] | Prices frozen at submit |
| 49 | Send magic link by message | [Partial] | Provider for contact channels is a logger |
| 49 | Copy magic link | [Implemented] | Link shown once |
| 49 | Lab accepts via link or portal | [Implemented] | Creates stages and vendor bill draft |
| 49 | Production stages (lab side) | [Implemented] | Portal login required |
| 49 | Try-in rounds | [Implemented] | No appointment automation |
| 49 | Shipment receive and lost | [Implemented] | QR token |
| 49 | Approve and deliver | [Implemented] | 12-month warranty |
| 49 | Patient lab invoice | [Implemented] | Separate tables and LINV numbers |
| 49 | Vendor bill review and pay | [Partial] | Header edit and manual lines API only |
| 49 | Lab-line commission | [Implemented] | Backend only; lab cost netted |

11 rows: 9 Implemented, 2 Partial, 0 Not implemented, 0 Unverified. The lab case workflow is built from order to vendor payment. Sending the magic link by message is Partial because the contact channel is a log stand-in, and vendor bill header edits are backend only.

### 64.3.5 Chapter 50 — Daily clinic closing

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 50 | Queue close day | [Implemented] | Decisions required for remaining patients |
| 50 | Automatic day-end close | [Implemented] | Only empty sessions; others alert only |
| 50 | No-show marking | [Implemented] | Manual or 60 s job; job writes no event |
| 50 | Daily collection | [Implemented] | Per payment account |
| 50 | Cash close | [Implemented] | Immutable record |
| 50 | Credit expiry job 01:00 | [Implemented] | Server date |
| 50 | Invariant check 02:30 | [Implemented] | Log only |
| 50 | Queue cleanup 03:15 | [Implemented] |  |
| 50 | Inventory alerts 08:00 | [Partial] | Log only |

9 rows: 8 Implemented, 1 Partial, 0 Not implemented, 0 Unverified. Closing the day is built: queue close, automatic day-end close, no-show marking, daily collection, cash close and the nightly jobs. The inventory alert job is Partial because it only logs.

### 64.3.6 Chapter 51 — Month-end payroll

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 51 | Month-end automatic generation | [Implemented] | 05:00 on the 1st, server time |
| 51 | Base plus commission | [Implemented] | Negative commission carried forward |
| 51 | Settlement lock | [Implemented] |  |
| 51 | Manual generation | [Implemented] | Whole location |
| 51 | Edit and delete records | [Implemented] | Paid-out commission blocks delete |
| 51 | Put on hold | [Partial] | No button |
| 51 | Mark paid | [Implemented] | No money moves |
| 51 | Payslip PDF and CSV export | [Partial] | No buttons |
| 51 | Deductions and tax | [Not implemented] |  |

9 rows: 6 Implemented, 2 Partial, 1 Not implemented, 0 Unverified. Month-end payroll is built from automatic generation to mark-paid. On hold, payslip PDF and CSV export have no buttons, and deductions and tax are not built.

### 64.3.7 Chapter 52 — Invoice correction and refund

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 52 | Edit preview | [Implemented] |  |
| 52 | Edit and revision | [Implemented] | Optimistic revision check |
| 52 | Commission adjustment on edit | [Implemented] | Backend only by design |
| 52 | Cancel unpaid invoice | [Implemented] |  |
| 52 | Unapply payment | [Partial] | Backend only; needed to cancel a paid invoice |
| 52 | Refund from advance or invoice | [Implemented] | Cannot be undone |

6 rows: 5 Implemented, 1 Partial, 0 Not implemented, 0 Unverified. Invoice correction and refund work. Unapplying a payment is Partial because it has no screen.

### 64.3.8 Chapter 53 — Subscription expiry and recovery

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 53 | Trial and banners | [Implemented] | 14 days |
| 53 | Grace period | [Implemented] | 3 days |
| 53 | Read-only mode 402 | [Implemented] | Cached 30 s per process |
| 53 | Super admin records payment | [Implemented] | Overwrites plan |
| 53 | Return to active | [Implemented] |  |
| 53 | Renewal reminder email | [Not implemented] | None sent |
| 53 | Worker jobs while read-only | [Unverified] | Deduced: guard is HTTP only |

7 rows: 5 Implemented, 0 Partial, 1 Not implemented, 1 Unverified. The subscription lifecycle (trial, grace, read-only, recovery) is built. Renewal reminder emails are not sent. Whether background jobs keep running while a clinic is read-only is Unverified, deduced from the guard being HTTP only.

### 64.3.9 Chapter 54 — Access change propagation

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 54 | Owner edit of role, feature or nav | [Implemented] |  |
| 54 | access_version bump | [Implemented] | Subscriber plus explicit bumps |
| 54 | Redis bus to all processes | [Implemented] | 15 s fallback |
| 54 | access.changed realtime event | [Implemented] | Room org:id |
| 54 | Web app refetch | [Implemented] | Focus fallback, 30 s stale |
| 54 | Theme save triggers propagation | [Not implemented] | No bump found |

6 rows: 5 Implemented, 0 Partial, 1 Not implemented, 0 Unverified. Access changes propagate through the version counter, the Redis bus, the realtime event and the web refetch. Saving a theme does not trigger propagation.

### 64.3.10 Chapter 55 — Purchase to consumption

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 55 | Reach the inventory page | [Partial] | No sidebar entry |
| 55 | Create purchase order | [Unverified] | createdBy FK to employees receives a user id |
| 55 | Receive goods | [Unverified] | performedBy FK to employees receives a user id |
| 55 | Stock movement and adjustment | [Unverified] | Same FK risk |
| 55 | Patient consumption | [Not implemented] | API only, no screen |
| 55 | Low-stock alert | [Partial] | Server log only |

6 rows: 0 Implemented, 2 Partial, 1 Not implemented, 3 Unverified. The purchase-to-consumption chain is the weakest workflow: the page has no sidebar entry, three steps are Unverified because of the login-id versus employee-id foreign keys, consumption has no screen and the alert only logs.

## 64.4 Cross-cutting chapters

### 64.4.1 Chapter 56 — Authentication

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 56 | Register a clinic (self-signup) | [Implemented] | Creates user, organization, main location and 14-day trial |
| 56 | Verify an email address | [Implemented] | Informational only; nothing is gated by it (Chapter 45 labels the same feature Partial) |
| 56 | Sign in | [Implemented] | Session of 1 or 30 days; at most 5 sessions per user |
| 56 | Choose and switch organization and location | [Implemented] |  |
| 56 | Access token, refresh cookie and silent refresh | [Implemented] | Refresh secret rotates on every use; expiry fixed |
| 56 | Sign out, list and revoke sessions | [Implemented] | A revoked session's access token lives until it expires |
| 56 | Change, forgot and reset password | [Implemented] | Six-character minimum on these paths |
| 56 | Add a password to an account without one | [Partial] | Endpoint only; no screen calls it |
| 56 | Rate limiting | [Implemented] | In memory of one API process; five endpoints |
| 56 | Security log | [Partial] | Write-only; some event types never written; no reader |
| 56 | User administration and staff logins | [Implemented] | Eight-character minimum on this path |
| 56 | Sign-in with Google or GitHub | [Not implemented] | Disabled; strategies not registered |
| 56 | The first super admin | [Partial] | Created by a manual database step |

13 rows: 9 Implemented, 3 Partial, 1 Not implemented, 0 Unverified. Sign-in, sessions, refresh and rate limiting work. The gaps are the add-password screen, a write-only security log, a manual first super admin and disabled Google and GitHub sign-in.

### 64.4.2 Chapter 57 — Access control

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 57 | Five global guards | [Implemented] | JWT, TenantContext, FeatureFlag, Access, Subscription |
| 57 | Decorators and the coverage test | [Implemented] | Only a unit test enforces that every handler carries a marker |
| 57 | AccessContext, applyScope, decide and VisibleIf | [Implemented] |  |
| 57 | GET /me/access | [Implemented] |  |
| 57 | Frontend can(), route gate, sidebar filter and No access page | [Implemented] |  |
| 57 | access_version, caches and the access.changed event | [Implemented] | 5 min context cache, 15 s version cache |
| 57 | Lab portal guard | [Implemented] | Separate guard for lab members |
| 57 | Row-level security in the database | [Not implemented] | Isolation is application-level only |

8 rows: 7 Implemented, 0 Partial, 1 Not implemented, 0 Unverified. The guard chain, decorators, scopes, the frontend gate and propagation are built. Row-level security in the database is not built.

### 64.4.3 Chapter 58 — Customization

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 58 | Features screen and impact preview | [Implemented] |  |
| 58 | Roles builder | [Implemented] | Detail in Chapter 11 |
| 58 | Per-role and clinic home page | [Implemented] |  |
| 58 | Sidebar builder | [Implemented] | Clinic default layout only; per-role layouts are never written |
| 58 | Registry flags for sidebar items | [Implemented] | The ownerOrSuperAdmin flag is unused |
| 58 | Theme and branding (7 keys, per location) | [Implemented] |  |
| 58 | Public login theme | [Implemented] |  |
| 58 | Settings registry beyond theme | [Partial] | Only theme keys are defined |

8 rows: 7 Implemented, 1 Partial, 0 Not implemented, 0 Unverified. Features, roles, home pages, sidebar and theme customization are built. The settings registry only holds theme keys.

### 64.4.4 Chapter 59 — Notification mechanics

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 59 | Pipeline from event to in-app inbox | [Implemented] |  |
| 59 | Delivery by WhatsApp, SMS and email | [Not implemented] | Dev-log stand-in provider only |
| 59 | Recipient resolvers | [Partial] | Only the lab order workflow registers one |
| 59 | Decision order and quiet hours | [Implemented] | Quiet hours never hold in-app messages |
| 59 | Message templates | [Implemented] |  |
| 59 | Outbox, relay and retries | [Implemented] | Status delivered is never set |

6 rows: 4 Implemented, 1 Partial, 1 Not implemented, 0 Unverified. The in-app pipeline is built; external channels are not. Only the lab workflow registers a recipient resolver.

### 64.4.5 Chapter 60 — Audit logging

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 60 | History tables (audit_logs, status_history) | [Implemented] | Trigger-protected against update and delete |
| 60 | Patients audit | [Implemented] | 13 record kinds plus export and import |
| 60 | Appointments audit | [Not implemented] |  |
| 60 | Employees audit | [Not implemented] | Only role definitions are audited |
| 60 | Payroll audit | [Not implemented] |  |
| 60 | Organizations and locations audit | [Not implemented] | Features, theme and subscriptions are audited |
| 60 | Patient audit trail reader | [Implemented] | Needs admin.audit.view |
| 60 | Organization-wide audit viewer | [Not implemented] |  |
| 60 | Retention policy | [Not implemented] | No purge or archive anywhere |

9 rows: 3 Implemented, 0 Partial, 6 Not implemented, 0 Unverified. Audit coverage is the clearest cross-cutting gap. Patients are audited and a reader exists. Appointments, employees, payroll and organizations and locations are not audited, there is no organization-wide viewer and no retention policy.

### 64.4.6 Chapter 61 — Error handling

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 61 | Response envelope and global exception filter | [Implemented] | Developer message carries raw text for unexpected errors |
| 61 | Validation (whitelist, forbid non-whitelisted) | [Implemented] |  |
| 61 | Error code families | [Implemented] | Two parallel version-conflict codes |
| 61 | Idempotency keys and If-Match | [Implemented] |  |
| 61 | Database constraint mapping | [Partial] | Per service; no global mapping, so some errors are generic |
| 61 | Frontend toasts, states and code maps | [Implemented] | Code maps exist only for some modules |

6 rows: 5 Implemented, 1 Partial, 0 Not implemented, 0 Unverified. The envelope, validation, error codes, idempotency and frontend states are built. Database constraint errors are mapped per service, so some surface as generic errors.

### 64.4.7 Chapter 62 — Time, money and numbering

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 62 | ClockService and location timezone | [Implemented] |  |
| 62 | Server-clock leftovers | [Partial] | Jobs, credit expiry, daily summary, purchase order and prescription year, leave year, lab catalog day |
| 62 | Money storage and half-up rounding | [Implemented] | Paisa integers or numeric columns |
| 62 | Exclusive tax | [Implemented] |  |
| 62 | Currency label | [Implemented] | Label only; no conversion |
| 62 | document_sequences and number_sequences | [Implemented] | Safe for billing and lab documents |
| 62 | Count-plus-one and last-plus-one numbers | [Partial] | Collision risk; purchase order and prescription numbers unique across organizations |

7 rows: 5 Implemented, 2 Partial, 0 Not implemented, 0 Unverified. The location clock, money rules and the two safe sequence mechanisms are built. Some jobs and older numbering still use the server clock or count-plus-one.

### 64.4.8 Chapter 63 — Real time and jobs

| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 63 | Process roles api, worker and all | [Implemented] | Exactly one worker |
| 63 | Socket.IO gateway and rooms | [Implemented] |  |
| 63 | Outbox relay, Redis bus, heartbeat and watchdog | [Implemented] |  |
| 63 | Scheduled jobs (seven of eight) | [Implemented] |  |
| 63 | Inventory alert job | [Partial] | Logs only; sends nothing |

5 rows: 4 Implemented, 1 Partial, 0 Not implemented, 0 Unverified. Process roles, sockets, the relay and seven of the eight jobs are Implemented. The inventory alert job is the eighth.

## 64.5 Totals

The counts in this table were computed by counting the rows of the tables in this chapter with a script, not estimated.

| Chapter | Subject | Implemented | Partial | Not implemented | Unverified | Total |
|---|---|---|---|---|---|---|
| 28 | Patients | 19 | 9 | 2 | 0 | 30 |
| 29 | Appointments | 10 | 2 | 2 | 0 | 14 |
| 30 | Queue | 28 | 2 | 1 | 0 | 31 |
| 31 | Consultation | 11 | 2 | 2 | 0 | 15 |
| 32 | Prescriptions | 11 | 4 | 0 | 0 | 15 |
| 33 | Treatment plans | 7 | 6 | 1 | 0 | 14 |
| 34 | Billing | 31 | 3 | 0 | 0 | 34 |
| 35 | Commissions | 13 | 0 | 1 | 0 | 14 |
| 36 | Dashboard and reports | 6 | 3 | 0 | 0 | 9 |
| 37 | Employees | 10 | 3 | 2 | 0 | 15 |
| 38 | Payroll | 7 | 3 | 1 | 0 | 11 |
| 39 | Inventory | 0 | 6 | 1 | 3 | 10 |
| 40 | Dental lab (clinic side) | 26 | 4 | 0 | 0 | 30 |
| 41 | Lab portal | 24 | 3 | 0 | 0 | 27 |
| 42 | Lab finance | 17 | 4 | 0 | 0 | 21 |
| 43 | Workflow engine (Config Studio) | 11 | 1 | 0 | 0 | 12 |
| 44 | Notifications | 7 | 3 | 2 | 0 | 12 |
| 45 | Subscriptions and onboarding | 8 | 2 | 0 | 0 | 10 |
| **Modules (28 to 45)** | | **246** | **60** | **15** | **3** | **324** |
| 46 | Clinic onboarding | 7 | 3 | 0 | 0 | 10 |
| 47 | Staff onboarding | 6 | 0 | 1 | 0 | 7 |
| 48 | Patient journey | 10 | 0 | 1 | 0 | 11 |
| 49 | Dental lab case | 9 | 2 | 0 | 0 | 11 |
| 50 | Daily clinic closing | 8 | 1 | 0 | 0 | 9 |
| 51 | Month-end payroll | 6 | 2 | 1 | 0 | 9 |
| 52 | Invoice correction and refund | 5 | 1 | 0 | 0 | 6 |
| 53 | Subscription expiry and recovery | 5 | 0 | 1 | 1 | 7 |
| 54 | Access change propagation | 5 | 0 | 1 | 0 | 6 |
| 55 | Purchase to consumption | 0 | 2 | 1 | 3 | 6 |
| **Workflows (46 to 55)** | | **61** | **11** | **6** | **4** | **82** |
| 56 | Authentication | 9 | 3 | 1 | 0 | 13 |
| 57 | Access control | 7 | 0 | 1 | 0 | 8 |
| 58 | Customization | 7 | 1 | 0 | 0 | 8 |
| 59 | Notification mechanics | 4 | 1 | 1 | 0 | 6 |
| 60 | Audit logging | 3 | 0 | 6 | 0 | 9 |
| 61 | Error handling | 5 | 1 | 0 | 0 | 6 |
| 62 | Time, money and numbering | 5 | 2 | 0 | 0 | 7 |
| 63 | Real time and jobs | 4 | 1 | 0 | 0 | 5 |
| **Cross-cutting (56 to 63)** | | **44** | **9** | **9** | **0** | **62** |
| **All rows** | | **351** | **80** | **30** | **7** | **468** |

The module chapters hold 324 rows: 246 Implemented (76 percent), 60 Partial, 15 Not implemented and 3 Unverified. The workflow chapters hold 82 rows and the cross-cutting chapters 62. Adding modules and cross-cutting rows, which do not overlap, gives 386 distinct rows with 290 Implemented, 69 Partial, 24 Not implemented and 3 Unverified. The grand total of 468 includes the workflow rows, which repeat module features.

The pattern behind the numbers is consistent. The Partial label is almost always "the backend exists but no screen reaches it" or "the data is recorded but no rule reads it", so a Partial row is usually a small piece of web work or a decision, not a missing engine. The Not implemented rows are mostly features a clinic would expect from a mature product (patient messaging, reminders, attendance, deductions, audit coverage). The Unverified rows are concentrated in inventory, where a foreign-key mismatch could make writes fail at run time, and in one job-behaviour question during read-only mode. Chapter 65 lists each gap with its severity, and Chapter 67 lists the questions that decide what to build next.
