# Appendix A — Glossary

This glossary defines every entity, role, feature, status label and key term used in the handbook, once, in alphabetical order. It is for anyone reading a single chapter on its own, including readers who start in the middle. Where the code uses a different name from the screen, the code name follows in parentheses. Terms that exist only in the database are shown with their table name.

## A

**Access context** — the resolved permissions of one user at one organization and location, which answers "can", "scope" and "decide" for a request (`AccessContext`).

**Access marker** — one of `@Can`, `@AnyMember`, `@Public`, `@RequireSuperAdmin` or `@ContextFree`; every endpoint handler must carry one, and a unit test fails when one is missing.

**Access token** — the 15-minute token kept in the browser's memory and sent with every request.

**Access version** — a counter on the organization (`access_version`) raised whenever roles, features or navigation change, so every process and screen knows to reload access.

**Active feature** — a feature that is in the active catalog, entitled, enabled and not switched off at the current location.

**Active queue entry** — a queue entry in status waiting, called, in consultation, on hold or skipped.

**Advance** — patient money received and not yet allocated or refunded; it is calculated (amount minus allocated minus refunded) and has no table of its own. A lab advance is the same idea for lab payments.

**Allocation** — a signed record of how much of a payment was applied to a charge or released back (`payment_allocations`).

**Amended prescription** — a signed prescription that was edited and not signed again (status `AMENDED`, version increased).

**Append-only** — a table whose rows are never changed or deleted. Only `commission_entries`, `audit_logs` and `status_history` are protected by a database trigger; others are append-only by convention.

**Appointment** — a booking: one patient, one doctor, one location, a start time and a duration (`appointments`). Also called a booking before arrival.

**Assignment** — an employee's link to an organization and a location with an employment role, a staff login and portal access (`employee_org_location_assignments`).

**Attachment** — a file on a lab order or item (`attachments`).

**Audience** — who a notification is for: patient, doctor, coordinator or lab.

**Audit log** — the generic append-only change history (`audit_logs`).

**Autosave** — saving shortly after the user stops typing, without a Save button.

**Availability override** — a one-date exception to a doctor's weekly schedule (`doctor_availability_overrides`); recorded but never read by booking.

## B

**Basis points (bps)** — a rate stored as an integer where 10,000 means 100 percent and 4000 means 40 percent.

**Bell** — the header icon that opens a user's in-app inbox (`user_notifications`).

**Billing audit log** — billing's own audit trail with before and after snapshots (`billing_audit_logs`).

**Billing v2** — the code's name for the current charge-based billing design.

**Blacklisted patient** — a patient flagged as not to be served; informational only, it blocks nothing.

**Booking** — see Appointment.

**Bundle** — a ready-made per-module level on the roles screen: None, Basic or Full.

## C

**Cancel reason code** — the structured reason stored when a booking is cancelled (`patient_left` or `other`).

**Case profit** — revenue minus lab cost, case expenses and doctor commission for one lab order.

**Cash close** — an immutable end-of-period count of a location's counter (`cash_closes`); each payment account has a line with expected, counted and variance.

**Chair** — a treatment chair of a location; the table exists but no module uses it (`chairs`).

**Change history** — the per-patient audit timeline merged from the audit log and the status history.

**Channel** — how a notification is delivered: in-app, WhatsApp, SMS or email. Only in-app is active.

**Charge** — one billable line for a patient; the atomic unit of billing (`charges`).

**Charge request** — an extra charge a lab asks for after an order is submitted (`order_charge_requests`).

**Clinic default layout** — a sidebar layout with no role, applied to every role of a clinic (`nav_layouts`).

**Clinic overview** — the dashboard of patients, appointments and waiting (`/clinic-overview`).

**Clinic time** — dates and times computed in the location's time zone through `ClockService`.

**Collected basis and billed basis** — whether profit-and-loss revenue is counted from money received or from invoices issued.

**Commission basis** — whether a commission rate applies to the net or gross charge amount.

**Commission entry** — one signed change in commission earned on one charge or lab invoice line; append-only (`commission_entries`).

**Commission rule** — an override of a compensation plan for one service or service category (`commission_rules`).

**Communications log** — a manual record of calls and messages with a patient (`patient_communications`).

**Compensation plan** — one dated version of how an assignment is paid: salary, commission or both (`compensation_plans`).

**Config Studio** — the super admin area for form schemas, workflows and stage templates (routes under `/studio`).

**Consent** — a signed patient consent with the signature image stored in the row (`patient_consents`).

**Consultation workspace** — the doctor's one-screen visit page where notes, treatments and prescriptions are recorded.

**Consumption template** — a standard kit of materials for a procedure (`consumption_templates`).

**Convert to walk-in** — closing a too-late booking as a no-show and adding the patient to the same queue as a linked walk-in.

**Credit note (lab)** — a reduction of an issued lab invoice; money already paid above the new total returns to advance (`lab_credit_notes`).

**Credit package** — a prepaid credit offer of an organization (`credit_packages`); backend only.

**Custom discount** — a discount not taken from a discount type; it needs a permission and a note.

**Custom role** — a role created by a clinic, in contrast to the five system roles.

## D

**Daily booking limit** — the most live bookings a location accepts on one local day (default 50).

**Dental info** — the single dental health and habits sheet of a patient.

**Dev-log provider** — the stand-in delivery provider that writes patient-channel messages to the application log instead of sending them.

**Direct costs** — lab bills plus doctor commissions in the profit-and-loss statement.

**Discount type** — an owner-defined discount preset (`discount_types`).

**Doctor screen** — the My queue page where a doctor runs their own queue.

**Doctor share** — the commission a payment would record, shown to authorised users while collecting payment.

**Doctor signature** — one saved signature image per login, placed on prescriptions (`doctor_signatures`).

**Document code** — the two- to six-character location code at the start of invoice, receipt and refund numbers.

**Document sequence** — the per-location, per-type, per-year counter behind billing numbers (`document_sequences`).

**Double-booking constraint** — the database rule that refuses overlapping live bookings of one doctor (`no_doctor_overlap`).

**Dry run** — an import request that checks rows without saving them.

## E

**Early window** — minutes before the booked time from which a checked-in patient counts as due (default 15).

**Effect** — a code handler that a workflow transition may run (`workflow_effects`).

**Employee** — the person record of a staff member, shared across organizations (`employees`).

**Employee code** — a per-organization code such as EMP-001 on an assignment.

**Employment role** — see Role.

**Encounter** — the clinical record of one consultation (`patient_encounters`).

**Entitled** — a feature the super admin has granted to an organization, with an optional trial end date.

**Entity catalog** — the generated field-level reference of every table.

**Envelope** — the JSON shape every endpoint returns (`ResponseWrapper`): data, message, success flag, status code, error and developer message.

**Escalation protection** — the rule that a non-owner cannot grant a permission or scope they do not hold.

**Estimate** — a lab invoice in draft: editable, unnumbered, nothing owed.

**Exclusive tax** — tax added on top of the price at issue, using the location's rate.

**Expense** — one clinic running cost at a location (`expenses`).

**External lab** — a lab serving many clinics.

## F

**Feature** — a feature key such as `billing.invoices` that an organization may be entitled to and enable.

**Feature impact** — the permissions and roles that stop working when a feature is turned off.

**Finance overview** — the owner's profit-and-loss dashboard (`/finance`).

**First come, first served** — the queue mode that calls patients in arrival order; the alternative is the smart queue.

**Force complete** — completing a consultation on the doctor's behalf.

**Form schema** — the stable identity of an order form (`form_schemas`); its versions are `form_schema_versions`.

## G

**General ledger** — double-entry bookkeeping in paisa, written only for lab money (`ledger_journals`, `ledger_journal_lines`).

**Global guard** — a guard run on every request; there are five: JWT, tenant context, feature flag, access and subscription.

**Global role** — a user-level role; its only value is super admin.

**Grace period** — three days after a subscription ends during which the clinic still works, with warnings.

## H

**Heartbeat** — a Redis message the worker sends every five seconds; API instances refuse sockets after fifteen seconds without one.

**High-risk permission** — one of 13 permissions marked high risk; granting it needs a reason.

**Home page** — the page a role's members open after sign-in.

## I

**Idempotency key** — a request header that makes a retried action run once (`idempotency_keys`).

**If-Match version** — the entry version a screen sends so that a stale action is refused.

**Impact preview** — the dialog that lists what stops working when a feature is turned off.

**Implemented** — status label: built end to end, with a screen or by design a backend job.

**Implies** — permissions granted automatically with another (for example create implies view).

**In-house lab** — a lab owned by one clinic and serving only it.

**Inactive patient** — a patient hidden by the active filter with all records kept.

**Inbox** — a user's own notification rows shown behind the bell.

**Invoice** — an issued document grouping a patient's charges; there are no drafts (`invoices`).

**Item stage** — one try-in round of one stage of a lab item (`order_item_stages`).

## J

**Journal** — one balanced double-entry posting; a journal line is one debit or credit side.

## K

**KPI strip** — the six summary tiles at the top of the Appointments page.

## L

**Lab** — a dental laboratory, external or in-house (`labs`).

**Lab admin** — a lab member with full portal rights for one lab.

**Lab billing settings** — per-organization lab tax rate and due days.

**Lab coordinator** — a clinic user holding both permissions needed to act for a lab that does not answer.

**Lab directory** — the platform list of labs kept by the super admin.

**Lab link** — a clinic's connection to a lab, with status, payment terms and patient data level (`lab_clinic_links`).

**Lab member** — a user who works at a lab as lab admin or lab technician (`lab_members`).

**Lab order** — a lab case: items for one patient, doctor and lab (`lab_orders`).

**Lab order item** — one piece of work with frozen price snapshots (`lab_order_items`).

**Lab-only user** — a user with lab memberships and no clinic access, kept inside the lab portal.

**Lab payable** — what the clinic owes a lab.

**Lab portal** — the area where lab members work on orders, production, billing and their team.

**Lab service** — one product a lab makes, such as a crown (`lab_services`).

**Lab statement** — a lab's monthly statement reconciled against bills (`lab_statements`).

**Lab technician** — a lab member who works the queue but cannot answer orders or manage the team.

**Lane** — one doctor's column on the reception board for a date.

**Last accessed context** — the organization and location saved on the user and pre-selected at next sign-in.

**Late grace** — minutes after the booked time within which an arriving patient keeps appointment priority (default 10).

**Legacy baseline** — the first migration, recorded as applied and never executed.

**Legacy organization settings** — the `organization_settings` table, editable but read by no backend rule.

**Legacy quick prescription** — a prescription in the older `patient_prescriptions` table.

**Live slot check** — the debounced server check the booking dialog runs while open.

**Location** — a branch of an organization (`locations`).

**Location override** — a switch that turns an enabled feature off at one location.

**Lock (setting)** — a flag freezing a setting's value for lower scopes.

**Locked feature** — a feature the owner cannot switch on because it is not entitled or the trial ended.

**Logical reference** — an id column that points to another row without a foreign key.

## M

**Magic link** — a no-login link for a lab to one order; only a hash of the token is stored (`magic_links`).

**Main branch** — a location flagged as the clinic's main one; the flag is not exclusive.

**Mandatory event** — an event whose in-app message to internal audiences cannot be switched off.

**Manual payment** — a subscription payment recorded by a super admin.

**Maximum late** — minutes after the booked time after which check-in is refused and the booking becomes a no-show (default 45).

**Medicine directory** — the clinic's list of medicines (screen label "Medicines").

**Modular monolith** — one backend application split into domain modules.

**Money invariants** — ten rules checked every night by the billing job.

**Monorepo** — one repository holding both the backend and the web app.

## N

**Needs pricing** — a flag on a charge created without a resolvable price; it blocks invoicing until priced.

**Nightly job** — a scheduled task such as the money invariant check.

**No-show marker** — the background job that marks unattended bookings as no-shows.

**Not implemented** — status label: planned, seeded, commented out or only mentioned.

**Notification event** — a platform-defined kind of event that can notify someone (`notification_events`).

**Notification outbox** — one message to one recipient on one channel, written in the same transaction as its cause (`notification_outbox`).

**Notification rule** — a clinic's on/off switch for one event, audience and channel.

**Notification template** — wording of one event on one channel in one language.

**Number sequence** — a per-organization counter for numbers such as LAB-0001.

## O

**Onboarding pending** — a flag on the organization that is true from signup until the setup wizard is finished.

**Order template** — a saved starting point for a lab order.

**Organization** — one clinic business; the tenant (`organizations`).

**Outbox (realtime)** — table of realtime messages written in the same transaction as a queue change (`outbox`).

**Outbox relay** — the worker loop that publishes unpublished outbox rows.

**Override booking rules** — the permission to book outside weekly hours or past the daily limit; it never bypasses the double-booking check.

**Owner** — the user who owns an organization and has all permissions in it.

## P

**Minor** — the integer minor unit of the rupee; 100 paisa is one rupee.

**Partial** — status label: some of it exists; the note says what is missing.

**Patient** — the patient record, one per patient per organization (`patients`).

**Patient data level** — per lab link, whether the lab sees the full name or only the patient code.

**Patient import** — bulk creation of patients from a spreadsheet through parse, dry run and batches.

**Patient lab invoice** — a patient invoice for lab work (`lab_invoices`).

**Patient ledger** — one-sided statement rows per patient (`ledger_entries`).

**Patient number** — the per-organization patient identifier, P- plus five digits.

**Patient scope** — the reach of the patient view permission: own, location or org.

**Payment** — money received from a patient; it belongs to the patient, not to an invoice (`payments`).

**Payment account** — one way a location receives money: cash, bank or wallet.

**Payment status** — the computed invoice status unpaid, partially paid, paid or overdue; never stored.

**Payroll record** — one employee's pay for one month at one location (`payroll_records`).

**Permission** — a key such as `billing.invoice.void` granted to a role.

**Pinned version** — the workflow template version stored on a lab order or item when it is created.

**Plan template** — a predefined treatment plan offered when recording treatment (`plan_templates`).

**Platform default** — a form, stage or workflow template with no owner organization.

**Polymorphic reference** — a type plus id column pair that can point at different tables.

**Portal access** — the assignment flag that lets a linked staff login sign in at that location.

**Prescription** — the current prescription record (`prescriptions`).

**Prescription preset** — a reusable set of medicines for the builder; stored in `treatment_plan_templates` and unrelated to plan templates.

**Price override** — a location or doctor price for a catalog service (`service_prices`).

**Price policy** — the rule that only a holder of the price override permission may change a catalog charge's price; others give a discount.

**Print layout** — the look of a printed prescription (`prescription_templates`).

**Process role** — which half of the backend a process runs: all, api or worker.

**Proxy update** — clinic staff recording a lab's answer for a lab that does not respond.

**Purchase order** — an order to one supplier for one location (`purchase_orders`).

## Q

**QC** — the lab's own quality check between finishing and ready.

**Queue entry** — a patient's place in a queue session (`queue_entries`).

**Queue history** — the append-only log of queue changes (`queue_events`).

**Queue policy** — queue settings at organization level with location override (`queue_policies`).

**Queue session** — one doctor's queue for one clinic day at one location (`queue_sessions`).

**Quiet hours** — a daily window in which non-in-app messages are held.

## R

**Read-only mode** — the state of an expired clinic: reads work and writes are refused with a payment-required error.

**Ready to bill** — the desk list of patients with an unbilled charge on a chosen day.

**Recall** — a planned future check-up with a due date (`patient_recalls`).

**Reception board** — the Queue tab showing every doctor's lane.

**Refund** — money returned to a patient, always from advance (`refunds`).

**Refund source** — a previous payment from which a refund draws.

**Rejoin policy** — where a skipped patient goes when rejoined: end, original position or manual.

**Remake request** — a request to make an item again, with a responsible party.

**Report definition** — a registered report with key, columns, filters and one query.

**Resolved price** — the price a service gets: doctor override, then location override, then catalog default.

**Retired feature key** — a catalog key with no code behind it, deactivated at every start.

**Revision** — a numbered change of a submitted lab order, or the counter raised by each invoice edit.

**Role** — an employment role with permissions and a home page (`employment_roles`); "system role" for the five templates, "custom role" for clinic-made ones.

**Room** — a Socket.IO channel a screen subscribes to.

**Route file** — a thin web file declaring a URL, an optional permission and the page to render.

**Row scope** — the filter that limits rows to own, location or organization.

## S

**Scope** — how far a permission reaches: `own`, `location` or `org`.

**Selection engine** — the pure function that decides whom Call next picks.

**Service catalog** — the organization's list of billable services (`services`).

**Service day** — the clinic day a queue session belongs to, using the location time zone and a cutoff.

**Service mapping** — which lab service fulfils which clinic billing service.

**Session (login)** — one signed-in device with a hashed refresh token (`user_sessions`).

**Settings registry** — the cascading settings store (`config_values`).

**Settlement** — a batch of unsettled commission entries paid through one payroll record.

**Setup wizard** — the three-step owner onboarding at `/setup`.

**Shipment** — a parcel between clinic and lab with a QR token (`shipments`).

**Smart queue** — the calling order that weighs emergencies, due appointments, starvation and returns from tests.

**Snapshot (commission)** — the doctor, plan and rate stored on a charge when it is created.

**Specialty** — a clinical specialty the engine is configured for.

**Staff login** — a user account linked to an employee through assignments.

**Stage template** — the try-in rounds a kind of lab work goes through.

**Starter templates** — the twelve default plan templates inserted for a clinic with none.

**Starvation guard** — the rule that calls the longest-waiting ordinary patient after a limit.

**Status history** — the append-only log of status changes (`status_history`).

**Stock movement** — one signed change to an item's stock (`stock_movements`).

**Subscription status** — the derived state of a clinic's plan: trial, active, grace, expired or unmanaged.

**Super admin** — the Platform operator with a global role, exempt from tenant checks.

**Supplier** — a vendor of stock.

**synchronize** — the ORM setting that builds the schema from entities; on in development, off in production.

## T

**Teeth chart snapshot** — one append-only chart of a patient's teeth in FDI notation.

**Tenant context** — the active organization and location of a request.

**Tenant headers** — the two request headers that carry the active organization and location.

**The Platform** — the name used in this handbook for the whole multi-tenant clinic management product. Each clinic sets its own display name; the default is "Clinic Portal".

**Token (queue)** — the number a patient holds in a doctor's queue, with a letter prefix.

**Transactional outbox** — writing a message in the same transaction as the change and delivering it afterwards.

**Treatment** — work actually performed on a patient (`treatments`).

**Treatment plan** — planned work for a patient (`patient_treatment_plans`).

**Trial** — the 14-day Professional plan period given at self-signup.

**TV display** — the public waiting-room page showing tokens being served.

## U

**Unapply** — releasing a payment's allocations back to advance; backend only.

**Unbilled charge** — an active charge not yet on an invoice.

**Unmanaged clinic** — an organization with no trial and no paid date: no limits and no expiry.

**Unverified** — status label: could not be confirmed from the code; the note says what.

**Urgent priority** — an authorised emergency flag with a reason that puts a patient first.

**User** — a login account for the whole Platform (`users`).

## V

**Variance** — counted minus expected money for a payment account at cash close.

**Vendor bill** — what the clinic owes a lab for an order (`vendor_bills`).

**Vendor payment** — money the clinic paid a lab.

**Visit notes** — the doctor's free-text notes for an encounter.

## W

**Walk-in** — a patient who arrives without a booking and is added directly to a queue.

**Warranty** — a period after delivery, 12 months by default (`item_warranties`).

**Watchdog** — the API check that refuses sockets when no heartbeat arrives.

**Weekly working hours** — a doctor's recurring working block for one weekday.

**Work order** — the printable sheet with a QR code and instructions, without prices.

**Worker** — the process running the outbox relay, notification relay and scheduled jobs; exactly one may run.

**Workflow template** — a state machine for orders, items or stages; its versions are draft, published or retired.

## Z

**Zero-priced charge** — a charge created at zero because no price could be resolved; see Needs pricing.
