# Handbook Phase 2 — Proposed Outline

**Date:** 2026-10-26 · **Status:** awaiting your approval. Nothing in Phase 3 starts until you approve.

## How the outline was built

- **Decisions applied from the inventory review:**
  - The product is called **"the Platform"** throughout. Each clinic sets its own display name; the code default is "Clinic Portal".
  - Every screen without a usable screenshot gets a **placeholder figure**.
  - Module chapters are written from the code wherever no generated chapter exists.
- **Scope source:** the code as of HEAD `26a0303`. That is 593 API endpoints in 30 backend modules, 92 web routes, 153 entities, 70 permissions, 24 active feature keys and 8 scheduled jobs.
- **Status labels:** every feature in the handbook carries one of [Implemented], [Partial], [Not implemented], [Unverified]. Labels shown in this outline are provisional. Each is confirmed against the code while writing.

---

## Front matter
- Title page, "How to use this handbook", status-label legend, naming conventions ("the Platform", clinic, organization, location, …).

---

## Part 1 — Product overview → `01-Product-and-Architecture.pdf`

### Chapter 1. What the Platform is
- A multi-tenant SaaS that runs the daily operations of clinics with one or more locations.
- Specialties the code supports as organization tags: general, dental, skin, ortho, physio, eye.
  - Dental is the most developed: teeth chart, dental lab.
  - The workflow engine is specialty-driven.
- Market facts visible in code: PKR default, location timezones, Urdu prescription printing, exclusive tax. All labelled where they are defaults rather than limits.

### Chapter 2. Who uses it: every role
- **Platform roles**
  - Super admin: creates organizations, entitles features, records subscription payments, runs Config Studio, manages the lab directory.
  - Owner.
- **The 5 system role templates** seeded per clinic, with home pages:
  - Admin (`/dashboard`)
  - Doctor (`/queue/doctor`)
  - Receptionist (`/appointments`)
  - Assistant (`/appointments`)
  - Accountant (`/billing`)
- **Custom roles** built by the owner.
- **Lab-side users**
  - Lab admin and lab technician (lab portal logins).
  - Lab contacts acting through a magic link (no login).
- **Unauthenticated audiences**
  - The public TV display screen.
  - Patients, who have **no portal** [Not implemented].

### Chapter 3. A day in a clinic using the Platform
A narrative from opening to closing. It covers:
- Reception check-in and tokens.
- The doctor's queue and consultation.
- Prescriptions and printing.
- A lab case going out.
- Collecting payment and issuing an invoice.
- Cash close.
- Scheduled jobs overnight.

Each step names its module and status label.

---

## Part 2 — How the system is built → `01-Product-and-Architecture.pdf`

### Chapter 4. Repository and tech stack
- One monorepo with `backend/` (NestJS 11, TypeORM, PostgreSQL) and `web-app/` (React 19, TanStack Start/Router/Query/Form/Table, shadcn/ui, Tailwind 4, Zustand).
- Redis, Socket.IO, Bull, Cloudinary, ExcelJS, pdf-lib.
- The real frontend folder layout, with a note on where CLAUDE.md differs.

### Chapter 5. Request lifecycle: from a click to the database and back
- **New diagram:** a sequence diagram of the path.
  - Browser → axios instance (adds token and `x-organization-id` / `x-location-id`) → API.
  - Guards: JWT → Tenant → FeatureFlag → Access → Subscription.
  - Validation pipe → controller → service → TypeORM transaction → PostgreSQL.
  - `ResponseWrapper` → TanStack Query cache → re-render.
- A second diagram covers the realtime path: transaction → outbox → relay → Redis → Socket.IO room → UI.

### Chapter 6. Processes, deployment and environments
- Process roles: `api`, `worker` (exactly one), `all` (the dev default).
- Development uses schema synchronize. Production runs synchronize off, the reviewed `schema:sync:prod` and startup migrations.
- **No deployment configuration, CI pipeline or container files exist in the repository** [Not implemented].
- Environment variables are described **by name and purpose only, with no values**.

### Chapter 7. Running it locally
- Prerequisites, install, configure, run.
- The first super-admin step.
- Test suites (unit, web, DB integration, 166-case acceptance).

---

## Part 3 — Organizations, locations, roles and permissions → `01-Product-and-Architecture.pdf`

### Chapter 8. The multi-tenant model
- Organization → locations; ownership.
- The person record (`employees`) shared across clinics, and assignments per organization and location.
- Tenant context headers, location selection and switching.
- The location's timezone as "clinic time" (`ClockService`).
- **Diagram:** tenancy model.

### Chapter 9. Organizations and locations
Written from the generated chapter 01 plus the code.
- Organization fields and settings (including legacy settings no code reads).
- Locations and location settings (tax rate, caps, token prefix).
- Activation and deactivation.

### Chapter 10. Features: entitlement, enablement, location overrides
- The super admin entitles (optionally with a trial), the owner enables, and a location can only switch features off.
- The 24 active feature keys, plus the 12 that are commented out in the seed and so do not exist at runtime.

### Chapter 11. Roles and permissions
- 70 permissions, each tied to a feature, with scopes `own` / `location` / `org`.
- None / Basic / Full bundles and Advanced mode.
- The 5 templates; custom roles; escalation protection.
- The `AccessResolver` cache and `access_version`; fail-closed defaults.
- Field-level hiding (`@VisibleIf`).
- **Diagram:** how access is resolved.

---

## Part 4 — Data model → `02-Data-Model.pdf`

### Chapter 12. Data model overview
- How the schema is owned (entities + synchronize; 3 migrations; triggers).
- Naming and money conventions: paisa integers vs numeric columns, the inventory module's camelCase columns.
- Tenant scope rules.
- **Overview ERD:** one box per domain, with the key cross-domain links.

### Chapters 13–26. Module ERDs
Each chapter has one rendered ERD per domain and every relationship explained in words, from `ENTITY_CATALOG.md` §5–§7, with the inventory note defect corrected.

| # | Domain | Main tables |
|---|---|---|
| 13 | Identity and sessions | users, oauth_providers, security_logs, user_sessions |
| 14 | Organizations, locations, subscriptions, settings | organizations, organization_ownership, organization_settings, locations, location_settings, subscription_payments, config_values |
| 15 | Access and features | employment_roles, nav_layouts, feature_catalog, org_feature_flags, location_feature_overrides |
| 16 | Staff and payroll | employees, employee_org_location_assignments, employee_schedules, employee_leaves, doctor_availability_overrides, payroll_records |
| 17 | Patients | patients and 14 sub-record tables |
| 18 | Appointments, queue and encounters | appointments, queue_sessions, queue_entries, queue_events, queue_policies, outbox, idempotency_keys, patient_encounters, treatments |
| 19 | Prescriptions and plans | prescriptions (+ legacy patient_prescriptions), medicines, templates, history, signatures, medicine_directory, plan_templates, treatment_plan_templates |
| 20 | Billing core | services, service_prices, charges, invoices, payments, payment_allocations, refunds, refund_sources, discount_types, payment_accounts |
| 21 | Billing ledgers and closing | ledger_entries, ledger_journals, ledger_journal_lines, cash_closes, cash_close_lines, document_sequences, billing_audit_logs, expenses, patient_credits, credit_packages |
| 22 | Compensation | compensation_plans, commission_rules, commission_entries, commission_settlements |
| 23 | Inventory | 11 tables |
| 24 | Notifications | 7 tables |
| 25 | Labs | directory and catalog; orders; production; lab billing; payables (5 ERDs) |
| 26 | Workflow engine and common | 12 engine tables; audit_logs, status_history, number_sequences; chairs (unregistered) |

### Chapter 27. Overlaps and ambiguities
- Two prescription tables, four "visit" concepts, two outboxes, two sequence mechanisms.
- Logical references with uncertain targets.
- "Append-only" tables the database does not enforce.

---

## Part 5 — Module chapters → one `10-Module-<Name>.pdf` each

Every chapter follows your template in this order:
1. Purpose and users.
2. Screens with figures.
3. Features, each with: status · what it does · user steps · behind the scenes (simple, then technical) · rules · who may do it · data read and written · effects on other modules · errors · technical references.
4. Entities and ERD.
5. Lifecycles with state diagrams.
6. Connections to other modules.
7. Limitations.
8. Owner's FAQ (5–10 questions).

Below, for each chapter: the features to be covered, the planned state diagrams, and the figures. **(img)** marks a usable existing screenshot; **(placeholder)** marks a figure placeholder.

### 10-Module-Patients
- **Features**
  - Register a patient, with a phone-duplicate check.
  - Patient list (card and list views, filters).
  - Patient detail.
  - Edit; activate or deactivate; delete.
  - **Import from CSV/Excel** (parse → dry run → import, error report) and **export** (10,000-row cap).
  - Visits and history.
- **Sub-records**
  - Clinical: dental info, teeth chart (FDI), vitals, treatment plans and items.
  - Documents (uploads), consents, communications log.
  - CRM: recalls, referrals, feedback, insurance.
  - Patient audit trail.
- **State diagrams:** patient active / inactive / blacklisted; recall status; treatment-plan status.
- **Figures:** list, detail tabs, import wizard (placeholder).

### 10-Module-Appointments
- **Features**
  - Calendar and list views.
  - Book (with validate, availability, booking rules, doctor double-booking constraint).
  - Reschedule, confirm, cancel (reason codes), no-show.
  - Check-in hand-over to the queue; convert to walk-in.
  - Stats strip.
- **State diagram:** appointment status map.
- **Figures:** appointments list (placeholder; the old image is excluded), calendar (placeholder), booking sheet (placeholder).

### 10-Module-Queue
- **Features**
  - Queue sessions per doctor per day (start / pause / resume / close / mode).
  - Tokens; walk-ins; call next; smart vs manual selection (the 14-scenario selection engine); recall / undo call / skip / rejoin.
  - Send for test / return; transfer; priority; cancel / abort / force-complete.
  - Reception board; doctor screen; public TV display; ticket printing.
  - Queue policies (organization default + location override).
  - Idempotency keys and `If-Match`; realtime.
  - Background jobs: no-show marker, call timeout, day-end close, nightly cleanup.
- **State diagrams:** session lifecycle; queue-entry lifecycle.
- **Figures:** "My queue" picker (img), doctor screen (placeholder), TV display (placeholder).

### 10-Module-Consultation
- **Features**
  - Encounter created at start-consultation.
  - One-screen workspace (patient summary, allergies alert, complaint / examination / diagnosis / advice).
  - Record treatments performed.
  - Completion triggers automatic charges.
- **State diagram:** encounter lifecycle.
- **Figures:** workspace (placeholder).

### 10-Module-Prescriptions
- **Features**
  - Prescription builder; add / edit / remove medicines; finalize; duplicate.
  - Change history.
  - PDF with Urdu (Nastaliq) support; print layouts.
  - Doctor signatures.
  - Medicine directory (seed common medicines).
  - Prescription templates; prescription presets; treatment-plan (protocol) templates.
  - The legacy `patient_prescriptions` table.
- **State diagram:** prescription draft → finalized.
- **Figures:** builder, detail and print, library pages (placeholder).

### 10-Module-Treatment-Plans
- **Features**
  - Plan templates (`/plan-templates`).
  - Patient treatment plans and items.
  - Plan billing summary.
  - Plan → charges [Partial: backend only].
- **State diagrams:** plan and item status.
- **Figures:** placeholder.

### 10-Module-Billing
- **Features**
  - Service catalog and location prices; price overrides.
  - Charges: automatic from consultation, manual, from a plan; void; discounts (types, bulk, custom).
  - Ready-to-bill list; billing desk.
  - Collect payment with preview, allocation strategies and advance.
  - Invoices: issue on payment, revisions via edit-preview, cancel, refund.
  - Refunds; unapply; payment accounts; exclusive location tax.
  - Patient statement and outstanding.
  - Patient credits (nightly expiry job); credit packages [Partial: no UI].
  - Expenses.
  - Cash close (preview, close, history).
  - Document numbering.
  - Printing: A4 and 80 mm thermal; invoice, receipt, refund, statement, cash close.
  - Billing settings.
  - Billing activity; nightly invariant checks.
- **State diagrams:** charge status; invoice stored status (ISSUED / CANCELLED) and computed payment status; refund.
- **Figures:** billing desk (placeholder; the old image is excluded), invoice detail (placeholder), print layouts (placeholder).

### 10-Module-Commissions
- **Features**
  - Compensation plans per assignment (salary / commission / both), versioned without overlap.
  - Commission rules.
  - Rate snapshot on each charge.
  - Append-only commission ledger written on collection (tax pro-rating, lab-cost basis).
  - Lab-line commissions.
  - Doctor revenue, doctor earnings, "My earnings".
  - Settlement through payroll.
- **State diagram:** commission entry → settlement.
- **Figures:** placeholder.

### 10-Module-Dashboard-and-Reports
- **Features**
  - Main dashboard (redesigned 2026-10-23); clinic overview; finance overview (P&L dashboard).
  - The report catalog: 37 reports in 9 categories (finance, revenue, expenses, staff, lab, patients, appointments, operations, clinical), each with filters and Excel and PDF export.
  - Report feature flags: `reports.financial`, `reports.clinical`, `reports.exports`.
  - Mock dashboard widgets that still exist [Partial].
- **Figures:** P&L report (img), dashboard (placeholder; the old image is outdated), reports index (placeholder).

### 10-Module-Employees
- **Features**
  - Employee person record (platform-unique phone and CNIC).
  - Assignments to organization and location with an employment role.
  - Status; portal access (staff login); salary.
  - Weekly schedules; availability overrides.
  - Leave (apply / approve / reject / cancel, balance).
  - Attendance [Not implemented].
- **State diagram:** leave status.
- **Figures:** placeholder.

### 10-Module-Payroll
- **Features**
  - Month-end generation (cron on the 1st at 05:00) and manual generation.
  - Base salary + commission.
  - Mark paid / on hold; edit; delete.
  - CSV export; payslip PDF.
  - Commission settlement lock and release.
- **State diagram:** payroll record status.
- **Figures:** placeholder.

### 10-Module-Inventory
- **Features**
  - Categories; items; stock adjust and movements.
  - Low-stock, expiring and out-of-stock lists.
  - Suppliers.
  - Purchase orders (status, receive).
  - Consumption templates; patient consumption.
  - Daily alerts job (08:00).
  - **The page has no sidebar entry** [Partial].
- **State diagram:** purchase order status.
- **Figures:** placeholder.

### 10-Module-Dental-Lab (clinic side)
- **Features**
  - Labs list and clinic↔lab links.
  - Lab price list (catalog, options, prices, service mappings, price quote).
  - Order templates.
  - Lab orders: create, from template, submit, revise, repeat, messages, attachments, work order.
  - Magic links (send / copy / revoke, proxy actions).
  - Production view; try-ins and stage decisions.
  - Item approve / reject / deliver / cancel; remakes.
  - Shipments received or lost.
  - Receive by token.
- **State diagrams:** lab order states, workflow-template driven; item and stage; shipment; remake.
- **Figures:** lab order detail (img), list and others (placeholder).

### 10-Module-Lab-Portal (lab side)
- **Features**
  - Lab portal home; orders (accept / reject / clarification / expected date, acknowledge revisions, charge requests).
  - Production board (start / assign / finish / QC); shipments; remake disputes.
  - Billing view; clinics (link transitions); team (lab admin, technician); profile.
  - Magic-link order page without a login.
  - Patient data level (full name vs code only).
- **Figures:** placeholder.

### 10-Module-Lab-Finance
- **Features**
  - **Patient lab invoices:** draft estimate → issue, void, advance, credit notes, reminders, payments, reversals, refunds, settings.
  - **Vendor bills:** draft at lab accept → approve, void, sync.
  - **Vendor payments** and allocations.
  - **Lab statements** and reconciliation.
  - **Reports:** aging, monthly cost, case profit.
  - Lab receivables ledger; general-ledger journals (internal).
- **State diagrams:** lab invoice; vendor bill; statement.
- **Figures:** placeholder.

### 10-Module-Workflow-Engine (Config Studio)
- **Features**
  - Specialties and organization specialties.
  - Versioned workflow templates (states, transitions, effects): draft → publish → retire.
  - Versioned form schemas with validation.
  - Stage templates.
  - The runtime that lab orders use.
  - Super admin only.
- **State diagram:** template / schema version lifecycle.
- **Figures:** placeholder.

### 10-Module-Notifications
- **Features**
  - In-app inbox and unread count.
  - Notification events: 21 seeded, almost all lab and payment events.
  - Rules, audiences, quiet hours, multi-language templates, delivery log.
  - Patient communication preferences.
  - Notification outbox.
  - **SMS / WhatsApp / email channels to patients** [Not implemented]; the `comms.whatsapp` key is seeded but has no provider.
  - **Appointment reminders** [Not implemented].
- **Figures:** placeholder.

### 10-Module-Subscriptions-and-Onboarding
- **Features**
  - Self-signup → email verification → setup wizard (clinic, location, complete).
  - Plans and limits (in code); 14-day trial.
  - Derived status (unmanaged / trialing / active / grace / expired) and read-only mode.
  - Clinic subscription page.
  - Super-admin subscriptions: manual payment recording, payment instructions.
- **State diagram:** subscription status.
- **Figures:** placeholder.

**Covered in Part 3, with no module PDF:** organizations and locations.
**Covered in Part 7:** authentication, users and sessions, access control, customization.

---

## Part 6 — End-to-end workflows → `90-End-to-End-Workflows.pdf`

Each workflow gets a rendered sequence diagram, a narrative, the modules touched and a status per step.

1. **New clinic onboarding.** Two paths:
   - (a) Self-signup → verify email → setup wizard → trial.
   - (b) Super admin creates the organization.
   Both continue with: entitle features → owner enables features → roles → locations → theme.
2. **Staff onboarding.** Employee record → assignment and role → login (portal access) → schedule → compensation plan.
3. **Patient journey.** Registration → appointment → check-in → queue → consultation → treatment → prescription → lab case → automatic charges → payment and invoice → receipt.
   - The order is as the code does it: the invoice is issued when payment is collected.
4. **Dental lab case lifecycle.** Order → magic link or portal → accept → production stages → try-in → shipment → receive → deliver.
   - This produces a vendor bill, a patient lab invoice and a lab-line commission.
5. **Daily clinic closing.**
   - Queue day-end close.
   - No-show marking.
   - Daily collection and cash close.
   - Overnight jobs: credits 01:00, invariants 02:30, queue cleanup 03:15, inventory alerts 08:00.
6. **Month-end payroll.** Cron on the 1st → base + commission → settlement lock → mark paid → payslip and export.
7. **Invoice correction and refund.** Edit-preview → revision; cancel; refund to the same account.
8. **Subscription expiry and recovery.** Trial → grace → read-only → manual payment → active.
9. **Access change propagation.** The owner edits a role or feature → `access_version` bump → `access.changed` realtime → UI refresh.
10. **Purchase to consumption.** Purchase order → receive → stock movement → patient consumption → low-stock alert.

---

## Part 7 — Cross-cutting concerns

These chapters appear in the complete handbook. **Proposed addition:** also build them as `80-Cross-Cutting.pdf` (see question 3).

1. **Authentication.**
   - Register; verify email; login; organization and location selection; switch location.
   - Access and refresh tokens (refresh in an httpOnly cookie); sessions list and revoke; logout-all.
   - Change, add, forgot and reset password.
   - Rate limiting; security log.
   - **OAuth is disabled** [Not implemented at runtime].
   - User admin and staff candidates.
2. **Access control in depth.**
   - The 5-guard chain.
   - `@Can` / `@AnyMember` / `@Public` / `@ContextFree` / `@RequireSuperAdmin`.
   - Scopes and `applyScope`.
   - The coverage test.
   - Frontend `useAccess().can()`, route `staticData`, the no-access page (img) and the role-shaped sidebar (img).
3. **Customization.**
   - Features admin with an impact preview.
   - Roles builder (img) and the per-role home page.
   - Sidebar builder (nav layouts).
   - Theme: the settings cascade platform → organization → location with locks; login theming.
4. **Notifications (mechanics).** The outbox pipeline, rules evaluation, quiet hours. This cross-references the Notifications module chapter but restates the context it needs.
5. **Audit logging.**
   - `audit_logs` and `status_history` (append-only, enforced by triggers).
   - Billing audit log, queue events, prescription history.
   - The patient audit trail.
   - Rollout status: patients and clinical records done; staff, payroll and organizations [Unverified, to check].
6. **Error handling.**
   - The `ResponseWrapper` envelope; error-code families.
   - 402 read-only; 403 `NO_PERMISSION`, `NOT_ENTITLED`, `ESCALATION`; 409 conflicts.
   - Idempotency and optimistic concurrency.
   - Frontend loading / empty / error states.
7. **Time, money and numbering** (added). Location clock; paisa arithmetic; document and number sequences.
8. **Realtime and background processing** (added). Socket.IO rooms, the outbox relay and the full job schedule.

---

## Part 8 — Current status → `95-Status-and-Gaps.pdf`

1. **Feature status matrix.** Every feature from Part 5 and Part 7, one row each, with its status label and the chapter it lives in.
2. **Known gaps**, among them:
   - Chairs (entity only).
   - No patient portal or online booking.
   - No recurring appointments.
   - No SMS / WhatsApp / email to patients.
   - No insurance claims or payment gateway.
   - No server PDF receipts.
   - Credit packages without UI.
   - Plan → invoice without UI.
   - Attendance missing.
   - Inventory not in the sidebar.
   - Mock dashboard widgets.
   - Legacy organization settings no code reads.
   - Location-agnostic working hours in booking.
   - No deploy or CI configuration.
3. **Risks.**
   - Data-model risks: missing FKs, un-enforced append-only tables, duplicate concepts.
   - Operational risks: exactly-one worker, in-memory rate limiting, FullCalendar licence.
   - Security, described **at category level only** (see question 4).
4. **Open questions** carried over from the generated docs and this review.
5. **Documentation conflicts:** a summary of the conflicts table from `INVENTORY.md`.

---

## Appendix → in `00-Complete-Handbook.pdf` only

- **A. Glossary.** Every entity, role, feature and status name used in the handbook, defined once and spelled the same everywhere.
- **B. Entity index.** All 153 tables: entity class, table, module, one-line purpose, chapter reference.
- **C. API endpoint summary.** All 593 endpoints grouped by module: method, path, required permission (or Public / AnyMember / SuperAdmin), one-line purpose.
- **D. Permission catalog.** 70 keys with feature and scopes.
- **E. Scheduled jobs.** All 8 jobs with schedule and process role.

---

## Production plan for Phases 3 and 4 (for approval now; no commands run yet)

- **Source files:** `docs/handbook/src/`.
  - One Markdown file per chapter, named to match the PDF split: `01-…`, `02-…`, `10-module-*.md`, `90-…`, `95-…`, `99-appendix-*.md`.
  - Diagram sources in `docs/handbook/diagrams/*.mmd`; rendered PNGs and copied screenshots in `docs/handbook/assets/`.
- **Diagram estimate:**
  - About 18 module ERDs + 1 overview ERD.
  - About 2 architecture diagrams.
  - About 10 workflow sequence diagrams.
  - About 25 state diagrams.
- **Images used:**
  - Five usable screenshots: roles editor, no-access page, P&L report, lab order detail, "My queue".
  - The Hygienist sidebar view, which is borderline.
  - Everything else is a **placeholder figure**: a captioned grey box saying "Screenshot pending: <screen>". The caption paragraph still describes what the screen contains, taken from the code.
- **Rendering tool (needs your approval because it downloads packages):**
  - Mermaid → PNG with `npx -y @mermaid-js/mermaid-cli@11 -i <file>.mmd -o <file>.png -b white -s 3`, pointed at the Chrome already installed through `PUPPETEER_EXECUTABLE_PATH` so no Chromium download is needed.
  - The PDF tool for Phase 4 is proposed separately when we get there, as you asked.

---

## Questions for you

1. **Module split.** Is the 18-chapter split in Part 5 right?
   - Lab is split into three PDFs: clinic side, lab portal, lab finance.
   - Commissions is separate from Billing.
   - Organizations and locations are in Part 3 instead of their own module PDF.
2. **Appendix C size.** The full list of 593 endpoints will run to about 25–30 pages. Should I include every endpoint, or summarize to one line per controller (about 60 lines)?
3. **Extra PDF.** Should Part 7 also get its own `80-Cross-Cutting.pdf`? Your list has no PDF for it, so otherwise it exists only in the complete handbook.
4. **Security in Part 8.** Should the security findings appear only as categories (for example "one endpoint lacks an organization filter"), with no file paths or exploit detail? This is my recommendation, since the PDFs go to NotebookLM.
5. **Mermaid rendering.** Do you approve the `npx @mermaid-js/mermaid-cli` command above for Phase 3? It downloads the npm package but no browser.
