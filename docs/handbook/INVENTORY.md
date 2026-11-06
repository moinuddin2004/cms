# Handbook Phase 1 — Documentation and Image Inventory

**Date:** 2026-10-26. The inventory covers branch `master` at HEAD `26a0303`. The working tree is clean except `web-app/package.json`.
**Method:** Every document was read and its key claims were sample-checked against the code. Nothing was executed and no application file was changed. Every image was opened and looked at.
**Rule applied:** The code is the source of truth. Where a document disagrees with the code, the conflict is recorded below.

---

## 1. Summary

- **Documents.** The repository holds 16 project documentation files plus 2 generated data-model inputs. Only 3 of the 16 are current:
  - `docs/access-control/README.md` (one wrong endpoint path)
  - `docs/database-migrations.md`
  - the root `README.md`
  Five are historical and outdated. Two are untouched framework templates.
- **Generated inputs are incomplete.** They live in **`backend/docs/`**, not `docs/`:
  - The entity catalog is complete and reliable: 153 entities in 31 modules.
  - Only **one** module chapter exists, `01-organizations-locations`.
  - No ERD images have been rendered yet.
- **Images.** There are 22 image files but only **13 unique images**: the 9 files in `docs/images/` are byte-identical copies of access-control screenshots.
  - All 13 were captured on 2026-10-23 at a low 640×398 resolution.
  - All 13 show the old product name **"MedTrackr"**. The code's default app name is now **"Clinic Portal"**.
  - **5 images should be excluded** (section 4.3).
- **Screenshot coverage.** About 12 of roughly 95 screens have a screenshot. Most modules have none (section 5).
- **Security issues found while reading** are outside the handbook's scope. They are listed in section 7 so you can act on them.

---

## 2. Documentation files

The verdict scale is: Current · Mostly current · Partly outdated · Outdated · Template (not about this project).

### 2.1 Primary inputs (generated 2026-10-24, committed in `26a0303`)

| File | What it covers | Verdict | Notes |
|---|---|---|---|
| `backend/docs/data-model/ENTITY_CATALOG.md` (7,485 lines) | Every TypeORM entity: columns, keys, indexes, FKs, constraints, tenant scope, logical references, entity-vs-migration diffs, ambiguities. Built from TypeORM metadata, not by hand. | **Current, reliable.** 13 of 14 sample checks VERIFIED; 1 PARTLY. | **Defect 1:** the "Notes" column is shifted one row down for the 10 inventory entities (~37 notes). The generator attached trailing comments to the next column. **Defect 2:** it repeats an entity comment claiming a trigger protects `form_schema_versions`; no such trigger exists. **Defect 3:** notes quote internal design references ("lab ERD §6c", "Sprint 5 deviation") that a reader cannot follow. **No ERD images** exist. |
| `backend/docs/modules/01-organizations-locations.md` (378 lines) | Organizations, locations, subscriptions (plans, trial, grace, read-only), setup wizard, gaps, questions. | **Current, reliable.** 11 of 11 sample checks VERIFIED. | It references a missing ERD image (`../data-model/erd/01-organizations-users.png`, marked "pending"). It also points to chapters that don't exist yet: "module 02" (auth/user), "module 04" (queue), customization. Its gap findings are "by reading, not executed". It uses illustrative names ("Dr. Ahmed", "Smile Dental"), which should be swapped for obviously fictional ones in the handbook. |

**Modules with no generated chapter yet:**
- Core: access, auth, user, session, employees, payroll, feature-flags, settings-registry.
- Clinical: patients, encounters, treatments, plan-templates, prescriptions, engine, appointments, queue.
- Finance and operations: billing, reports, inventory, notifications, chairs.
- Lab: labs, lab-access, lab-catalog, lab-orders, lab-production, lab-billing, lab-payables, lab-finance.

For those modules the handbook will be written from the code directly.

### 2.2 Project documentation

| File | Last commit | What it covers | Verdict | Conflicts with code (code wins) |
|---|---|---|---|---|
| `README.md` (root) | 2026-10-23 | Product overview, feature list, screenshots, architecture diagrams (Mermaid), stack, setup, testing, structure. | **Mostly current** | Brand name "MedTrackr" vs the code default "Clinic Portal" (`settings-registry/theme/theme.settings.ts`). Claims checked and VERIFIED: 70 permissions, 5 system role templates, 37 reports, the `api`/`worker` process split, `src/routes` layout. It does not mention that OAuth is **disabled** in code (`auth/oauth.controller.ts`). The worker must run exactly once, which the README states correctly. |
| `CLAUDE.md` (root) | recent | Coding conventions and backend architecture. | **Partly outdated** | (1) The frontend tree `src/app/`, `src/shared/` and feature `api/` folders does not exist; real code uses `src/routes/`, `src/components/`, `src/lib/`, `src/store/` and feature `services/`. (2) The guard chain lists 4 guards; there are 5 (missing `SubscriptionGuard`, `app.module.ts:153-155`). (3) It says TenantContextGuard skips path prefixes; the code explicitly has none (`tenant-context.guard.ts:25-26`). (4) It says JwtAuthGuard skips `@Public()` (line 297), contradicting its own later note; it only checks `PUBLIC_ROUTES`. (5) It lists inventory, invoices, reports and notifications as stubs, but all are implemented. Only `chairs` is entity-only. (6) The backend module list omits billing, encounters, lab-*, reports, subscriptions, engine, notifications, treatments, prescriptions, plan-templates. (7) `npm run start:prod` points at `dist/main`, but the build emits `dist/src/main.js`. |
| `docs/access-control/README.md` | 2026-10-23 | The full access-control and customization guide: catalog, bundles, templates, resolver, entitlement, overrides, roles admin, sidebar, theme, API, data model. | **Current** | `GET /me/catalog` is really `GET /access/catalog` (`access/access.controller.ts:121-125`). `SubscriptionGuard` is not mentioned. The Assistant template summary omits its `lab.orders.view` grant. |
| `docs/access-control/test-cases.md` | 2026-10-22 | 166-case acceptance plan in 12 sections. | **Mostly current** (frozen plan) | FEAT-08 expects "refused", but the code returns 200 as a no-op. MOD-40 (CLINIC_ADMIN fallback) and SEC-05 (`@Roles` endpoints) are obsolete. Line 4 holds an internal claude.ai design-doc URL. **Exclude that URL from the handbook.** |
| `docs/access-control/test-results.md` | 2026-10-23 | Acceptance run: final **166/166 pass**; bugs B1-B8 and their fixes; suite counts (backend 709, web 325). | **Mostly current** (historical record; the fixes are in code) | It labels the sign-out theme bug B8 in one place and B7 in another. It points to a git-tracked test-fixture file containing a localhost test password (see section 7). |
| `docs/appointments-and-queue.md` | 2026-10-23 | Booking and the doctor-wise queue: states, rules, selection engine, policies, idempotency, outbox, realtime, jobs, API, data model. | **Mostly current** | §7/§10 say there are no migrations and production still has to switch from synchronize. Both are wrong: there are 3 migrations, and production already runs with synchronize off plus `schema:sync:prod`. The doc says the worker runs "1+" instances; the code says exactly one (`common/runtime/process-role.ts:5`). It omits `POST /queue/sessions` (`@AnyMember`). |
| `docs/database-migrations.md` | 2026-10-19 | Schema ownership, legacy baseline, startup order, commands, prod deploy. | **Current** | None. |
| `docs/commissions.md` | 2026-10-19 | Doctor compensation plans, commission rules, append-only ledger, payroll settlement, invariant I10. | **Mostly current** | (1) The doc gives the formula `min(allocations, net)`; the code pro-rates pre-tax when a charge has tax and also supports a lab-cost basis (`billing/commissions/commission-math.ts:107-154`). (2) The doc says `recordForCharges` is the only write path; `lab-finance/lab-commission.service.ts` also writes entries. (3) The doc describes access by role; the code uses the permissions `compensation.manage`, `earnings.all.view` and `earnings.own.view`. |
| `docs/billing-v2-test-cases.md` | 2026-10-17 | Manual click-through script for billing v2. | **Mostly current** | Setup 0.1 truncates a `coupons` table that no longer exists. The sidebar labels and grouping changed. The amounts assume no tax, but exclusive location tax now applies. In the code the doctor gets "My earnings". There are no commission cases. It uses real bank and wallet brand names as test data. |
| `docs/billing-feature-context.md` | 2026-10-17 body (banner 10-23) | Pre-v2 billing context pack: old entities, defects B1-B15, open decisions. | **Outdated** | Nearly every "what exists" statement describes replaced code. Invoice statuses are now stored `ISSUED`/`CANCELLED` with computed payment status. There are no invoice items, coupons, server receipt PDF or payment gateway, and the payment methods differ. The banner wrongly implies that only the access parts are stale. |
| `docs/archive/PROJECT_OVERVIEW-2026-10.md` | 2026-10-11 | Snapshot briefing: stack, modules, known issues, roadmap. | **Outdated** | It predates access control, billing v2, lab, reports and the test suites. It says 3 guards (now 5), path-prefix skips (removed), zero tests (now 67 backend spec files and 34 web test files), and "reports/lab not built" (both built). Some of its security items are **still open** (section 7). |
| `AUDIT.md` | 2026-06-23 (dated 06-10) | Production-readiness audit of every module. | **Outdated** | Of its 10 most serious findings, 7 are fixed. Two are partly fixed: rate limiting is still missing on reset-password and refresh, and OAuth redirect handling no longer matters because OAuth is disabled. One is still true: the FullCalendar non-commercial licence key is in a commercial product. |
| `docs/archive/PLAN-2026-06.md` | 2026-06-26 | Roadmap (partly Roman Urdu) and implementation checklist. | **Outdated** | Its checklist is stale. Section 2.3 below gives the real status of each item. Line 552 contains a stray instruction addressed to an AI. |
| `HANDOFF.md` | 2026-06-26 (titled "Dec 2026") | One-session hand-off note. | **Outdated** | Appointment `tokenNumber` no longer exists (queue tokens replaced it). Urdu PDF is fixed (Nastaliq via fontkit). Templates are now discoverable. Appointments use `@Can`, not `@RequireFeature`. It contains a local user-profile path and quotes the owner's personal communication style. **Exclude both from the handbook.** |
| `backend/README.md` | 2026-02-23 | Stock NestJS starter README. | **Template** | Nothing project-specific. Its `start:prod` path is wrong for this build. |
| `web-app/README.md` | 2026-04-23 | Stock TanStack Start starter README. | **Template** | It refers to `src/routes/demo/`, which does not exist. |

**Not documentation:**
- `docs/archive/design/MedTrackr-mockup.dc.html` (186 KB, moved from the root) is a design mock-up from an external design tool. It uses the old brand and is not a description of the current UI. It will not be used.
- `.agents/skills/**` and `.claude/**` are tooling for AI assistants.
- `.claude/worktrees/*` are 23 git worktree copies of the repository.

All of these are excluded from the inventory.

### 2.3 PLAN.md items: real status today

| Planned item | Status | Evidence |
|---|---|---|
| Leave management | [Implemented] | `employees/entities/employee-leave.entity.ts`, leave controller and UI |
| Attendance | [Not implemented] | Only mentioned in a feature description |
| Doctor availability overrides | [Implemented] | `employees/entities/doctor-availability-override.entity.ts` + tab |
| Portal access toggle | [Implemented] | `PATCH /employees/:id/portal-access` |
| Waiting-room queue | [Implemented] (different design) | `backend/src/queue/` doctor-wise queue |
| Recurring appointments | [Not implemented] | No recurrence fields |
| Appointment reminders / SMS / WhatsApp | [Not implemented] | Notifications are in-app only (`notifications/notifications.enums.ts`) |
| Prescription templates | [Implemented] | `prescriptions/` module and routes |
| SOAP clinical notes | [Partial] | Encounter has complaint, examination, diagnosis and advice fields; no note entity or templates |
| Allergy and medical alerts | [Partial] | Free-text `patients.allergies`, shown in consultation |
| Diagnostic lab tests | [Not implemented] | The `lab-*` modules are **dental-lab work orders**, a different concept |
| Insurance claims | [Not implemented] | Seed mention only |
| Recall / feedback / referral | [Implemented] | Patients controller and CRM tab |
| Invoices, payments, expenses, financial summary | [Implemented] (billing v2 redesign) | `backend/src/billing/` |
| Invoice and receipt PDF | [Partial] | Browser printing (A4 and 80 mm thermal); no server-side PDF |
| Coupons | [Not implemented] (replaced) | Replaced by discount types |
| Treatment plan → invoice | [Partial] | Backend endpoint only; no web caller found |
| Credit packages | [Partial] | Backend CRUD and hooks; no page; not a payment method |
| Online payment gateway | [Not implemented] | Flag commented out |
| Inventory, stock movements, low-stock alerts | [Implemented] | `backend/src/inventory/`; see the sidebar gap in section 6 |
| Dashboard real data | [Partial] | Main widgets use real APIs; `features/dashboard/services/dashboard.api.ts` is still a mock module for some unused widgets |
| Reports (appointments, revenue, patients, payroll) | [Implemented] | 37 report definitions with Excel and PDF export (`backend/src/reports/definitions/`) |
| Digital consent signing | [Unverified] | Entity has signature fields; signing UI not verified |

---

## 3. Conflicts between documents

- **Product name.**
  - README, the screenshots and `MedTrackr.dc.html` say **MedTrackr**.
  - CLAUDE.md says **DentalFlow**.
  - The code default is **"Clinic Portal"**, and each clinic sets its own name through the theme.
  - **Your decision is needed** (section 8, question 1).
- **Frontend layout.** CLAUDE.md describes `src/app/` and `src/shared/`; README and the real code use `src/routes/` and `src/components/`. The handbook will describe the real layout.
- **Migrations.** `appointments-and-queue.md` says there are none; `database-migrations.md` and the code have 3. The handbook will follow `database-migrations.md`.
- **Generated docs location.** You referred to `docs/data-model/` and `docs/modules/`. They are actually in `backend/docs/data-model/` and `backend/docs/modules/`.

---

## 4. Images

### 4.1 All image files

The 9 files in `docs/images/` are exact copies (same MD5) of 9 of the 13 access-control screenshots. They are listed once, under their original name.

All images share these properties:
- Captured 2026-10-23 with browser-test data (organization "OrgA …", user "OwnerA", test accounts on the reserved `.test` domain).
- Dark theme.
- Old brand "MedTrackr".
- **640×398 pixels** (login and select-location 560×348). This is too small for crisp PDF pages and video.

| # | Image (copy in `docs/images/`) | What it shows | Module | Matches current UI? | Sensitive content | Decision |
|---|---|---|---|---|---|---|
| 1 | `REG-01a-select-location.jpg` | Location picker after login: two branches ("A Main", "A Branch"), Continue button. The right panel shows marketing claims "99.9% Uptime SLA", "SOC 2 Type II Certified", "HIPAA Compliant" and "© 2025 MedTrackr". | Auth / multi-tenancy | **No.** The current auth layout has no uptime, SOC 2 or HIPAA badges, and the footer shows only the year (`features/auth/components/AuthLayout.tsx`). | **Unverified compliance claims.** Showing them would misstate the product. | **Exclude** |
| 2 | `REG-01b-owner-home-sidebar.jpg` (= `dashboard.jpg`) | Owner dashboard: KPI cards (patients, appointments today, revenue, outstanding), revenue-vs-expenses chart, appointment-status donut, today's schedule. Full owner sidebar. | Dashboard, Access (sidebar) | **No.** The dashboard was redesigned after capture (`697d599`, 2026-10-23 19:37) and the brand changed. | Test identifiers only; truncated test email | Usable for the sidebar only; **recapture recommended** |
| 3 | `REG-02a-patient-booked-checked-in.jpg` (= `appointments.jpg`) | Appointments list: KPI strip (total, upcoming, completed, walk-ins, no-show, average wait), date strip, filters, table with tokens A-001/A-002/B-001, walk-in and consultation types, "Checked in" and "Scheduled" statuses. Toast "Checked in — token A-002" with Print ticket. | Appointments, Queue | Mostly (brand outdated) | **Realistic-format Pakistani mobile numbers** under patient names | **Exclude** |
| 4 | `REG-02b-visit-completed.jpg` | "My queue" page with only a doctor-queue picker, plus a "Visit completed" toast. It does not show the queue itself. | Queue (doctor screen) | Partly; brand outdated | Test identifiers only | Usable but low value; **recapture with a running queue** |
| 5 | `REG-03-payment-received-receipt.jpg` (= `billing.jpg`) | Billing desk with the "Collect payment" sheet: "Received PKR 3,000", receipt and invoice numbers, still outstanding, advance held, Print receipt / Print invoice. | Billing | Mostly (brand outdated) | **Realistic-format mobile number** in the sheet header; a patient number below a name | **Exclude** |
| 6 | `REG-04-lab-order-sent.jpg` (= `lab-order.jpg`) | Lab order LAB-0001: status Submitted, doctor, due date, revision; item "Zirconia crown × 1", tooth 12, shade and material; lab price vs patient price; "Lab access" panel with Send link / Copy link; Work order, Revise, Repeat, Cancel order actions. | Lab orders | Mostly (brand outdated; link cards still loading) | Test identifiers only | Usable; recapture recommended |
| 7 | `REG-05a-report-open.jpg` (= `profit-loss.jpg`) | Profit & loss report: period presets, location scope, collected vs billed basis, summary tiles, revenue / direct costs / operating expenses breakdown, all PKR 0. | Reports / Finance | Mostly (brand outdated) | None | Usable; a recapture with non-zero data would explain more |
| 8 | `REG-05b-report-exported.jpg` | Same P&L page with an "Excel file downloaded" toast. | Reports | Same as #7 | None | Redundant with #7; skip |
| 9 | `REG-06a-custom-role.jpg` (= `roles.jpg`) | Role editor for a custom "Hygienist" role: tabs Permissions / Home page / Members; per-module None / Basic / Full selectors with an Advanced expander; Delete, Clone, Discard, Save. | Access control (roles) | Yes (brand outdated) | None | Usable |
| 10 | `REG-06b-hygienist-home.jpg` | Dashboard as the Hygienist user: the sidebar shows only Dashboard, Patients, Appointments. | Access control (role-shaped sidebar) | Dashboard outdated (redesign) | Display name "Hina Hygienist" (a real first name) and a truncated test email | Usable with care; **recapture recommended** (fictional-looking name) |
| 11 | `REG-07-theme-recolour.jpg` (= `theme-builder.jpg`) | Theme builder: clinic name, light and dark logos, browser-tab icon, brand colour swatches with a contrast check, sidebar style, default mode, live preview. | Customization (theme) | Mostly (brand outdated) | **Realistic full name "Ayesha Khan"** in the preview invoice. It comes from the code (`features/theme/components/ThemePreview.tsx:147`), so a recapture will show it again unless that sample text changes. | **Exclude** |
| 12 | `THEME-11-login-themed.jpg` (= `login.jpg`) | Login page with the clinic theme: email, password, keep me signed in, forgot password, sign up; the same uptime, SOC 2 and HIPAA badges. | Auth / Customization | **No** (badges removed from code) | **Unverified compliance claims** | **Exclude** |
| 13 | `UI-01-noaccess-payroll.jpg` (= `no-access.jpg`) | "No access" page reached by the Hygienist: Roman-Urdu headline (matches `features/access/components/NoAccess.tsx`), English explanation, "Go to my home page". | Access control (route guard) | Yes (brand outdated) | "Hina Hygienist" and a truncated test email | Usable |

### 4.2 Images used only by tooling

These are not part of any product module and will not be used:
- `web-app/public/logo192.png`, `logo512.png` and `favicon.svg`: app icons.
- `web-app/public/tanstack-*`: framework logos.
- `.agents/skills/shadcn/assets/*.png`.

### 4.3 Images to exclude, so you can replace them

1. `REG-01a-select-location.jpg`: shows the claims "SOC 2 Type II Certified", "HIPAA Compliant" and "99.9% Uptime SLA", which the code no longer shows and nothing verifies.
2. `THEME-11-login-themed.jpg` / `docs/images/login.jpg`: same claims.
3. `REG-02a-patient-booked-checked-in.jpg` / `docs/images/appointments.jpg`: realistic-format mobile numbers.
4. `REG-03-payment-received-receipt.jpg` / `docs/images/billing.jpg`: realistic-format mobile number.
5. `REG-07-theme-recolour.jpg` / `docs/images/theme-builder.jpg`: realistic full name "Ayesha Khan". It comes from the theme preview code.

**Borderline:** `REG-06b` and `UI-01` show the display name "Hina Hygienist". It is clearly a test persona, but it uses a real first name. They are usable as they are; recapture them if you want zero real-looking names.

No image shows credentials, internal URLs or IP addresses.

---

## 5. Modules and screens with no screenshot

Coverage was mapped from the 92 route files in `web-app/src/routes/` and the sidebar registry `features/access/nav/nav.registry.ts`.

- **Covered by a usable image:** sidebar, role editor, no-access page, lab order detail, P&L report, empty "My queue" picker.
- **Covered only by an excluded or outdated image:** dashboard, appointments list, billing desk, theme builder, login, select location.

| Module | Screens with **no** screenshot |
|---|---|
| **Patients** | Patient list (card and list views, filters), patient detail and all its tabs (vitals, dental info, teeth chart, documents, consents, recalls, referrals, insurance, CRM, billing tab), new patient, **patient import** (added 2026-10-24) |
| **Appointments** | Calendar views (FullCalendar), booking sheet, reschedule and cancel flows |
| **Queue** | Reception board, doctor screen with a live queue, **public TV display** (`/display/$locationId`), ticket print |
| **Consultation** | Consultation workspace (`/consultation/$encounterId`) |
| **Prescriptions** | List, builder (`/prescriptions/new`), detail and print, medicine directory, prescription templates, prescription presets |
| **Treatment plans** | Plan templates (`/plan-templates`), patient treatment plans |
| **Billing** | Invoices list and detail (revisions, cancel, refund), payments, expenses, billing activity, billing settings (`/settings/billing`), cash close, receipt and invoice print layouts (A4 and thermal) |
| **Finance and reports** | Finance overview (`/finance`), clinic overview, reports index (37 reports), doctor revenue, doctor earnings, my earnings |
| **Employees and payroll** | Employee list, create, detail (schedules, leave, availability overrides, compensation, portal access), payroll run and payslip |
| **Inventory** | Items, suppliers, purchase orders, consumption templates, stock adjust |
| **Notifications** | Bell and inbox, notification settings (`/settings/notifications`) |
| **Lab — clinic side** | Labs list, lab price list (`/lab-catalog`), order templates, lab orders list, receive order (`/lab-orders/receive/$token`), lab billing list and detail, lab payables (bills, payments, statements, reports) |
| **Lab — lab side** | Lab portal (home, orders, order detail, production, billing, clinics, team, profile), magic-link pages (`/lab-link/$token`, `/o/$orderId`) |
| **Organizations and locations** | Organizations (super admin), org features and settings, locations, location settings |
| **Subscriptions and onboarding** | Register (self-signup), verify email, setup wizard (`/setup`), clinic subscription page (`/settings/subscription`), super-admin subscriptions |
| **Users and sessions** | User admin (`/users`), sessions (`/sessions`), forgot and reset password |
| **Customization** | Features admin (`/admin/features`), sidebar builder (`/admin/navigation`), roles list (`/admin/roles`), role "Home page" and "Members" tabs |
| **Config Studio (super admin)** | Form schemas, workflows (versioned), stage templates |
| **Settings** | General settings page (`/settings`) |

**Recommendation.** Before Phase 3, recapture a fresh, consistent set of screenshots at a higher resolution with the current brand and obviously fictional data. I can capture them with the built-in browser if you start the app with seed data, and I would ask before running anything.

---

## 6. Facts found in code that the existing docs do not state

These go into the handbook with status labels:
- **OAuth sign-in is disabled.** The controller and strategies exist but are not registered (`auth/oauth.controller.ts`). This matches the launch decision "OAuth off".
- **The 5th global guard, `SubscriptionGuard`,** puts an expired clinic into read-only mode. Writes return 402 `SUBSCRIPTION_EXPIRED`.
- **The inventory page has no sidebar entry.** `/inventory` exists and is permission-gated (`inventory.view`), but it is not in `nav.registry.ts`, so users can reach it only by URL. Status: [Partial] for discoverability.
- **`/financial-summary` redirects to `/dashboard`** (it was consolidated).
- **Two outbox tables, two sequence mechanisms and two prescription tables** (`patient_prescriptions` legacy vs `prescriptions`) coexist, per the entity catalog §10.
- **`chairs` and the single `inventory` table** are entities that no module registers.
- **Notifications are in-app only.** There is no SMS, WhatsApp or email-to-patient provider.

---

## 7. Security observations (outside handbook scope; for you to act on)

These were noticed while sample-checking. **None of them will appear in the handbook.** No secret values were copied anywhere.

1. **A database connection string with credentials is committed** in `backend/test-db.ts`, and `backend/test-appts.js` has hardcoded credentials. Both files are git-tracked. PROJECT_OVERVIEW flagged this on 2026-10-11, and it is still open. Rotate the credentials and remove the files from history.
2. **A legacy socket gateway logs raw JWTs and allows any origin:** `backend/src/common/utils/socket-gateway.ts`, registered in `common.module.ts`.
3. **`GET /doctor-signatures/doctor/:employeeId` has no organization filter** (`prescriptions/services/doctor-signature.service.ts:55-60`), so one clinic can read another clinic's signature by id.
4. **No rate limit** on `PATCH /auth/reset-password` or `POST /auth/refresh`. The limiter store is in-memory.
5. **A FullCalendar non-commercial licence key** is used in a commercial product (`features/appointments/components/FullCalendarView.tsx`).
6. **A test-fixture file with a localhost-only test password is git-tracked:** `backend/test/access/acceptance/browser/browser-fixture.json`. This is low risk but worth knowing.

---

## 8. Questions before Phase 2

1. **Product name.** What should the handbook call the product: MedTrackr, DentalFlow, or a neutral "the platform"? Your saved preference says the product name is undecided and the UI should stay neutral. Unless you say otherwise, I will use a neutral name and mention that each clinic sets its own.
2. **Screenshots.** Do you want me to recapture a fresh screenshot set (current brand, fictional data, larger size) before Phase 3, or write Phase 3 with only the usable images listed above plus "screenshot pending" placeholders?
3. **Generated module chapters.** Only chapter 01 exists. Is another session still producing chapters 02 and onward and the ERD images? If so, should I wait for them, or write the module chapters from the code myself?
4. **Scope of "every user role".** The code has 5 system role templates (Admin, Doctor, Receptionist, Assistant, Accountant), plus Owner, Super admin and lab-side users (lab members via portal and magic links). Should Part 1 cover lab users as a role of the product?
