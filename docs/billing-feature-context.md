# Billing, Invoices & Payments — Context for Planning AI

**Snapshot:** 2026-10-17, branch `feat/doctor-wise-queue`. Everything below was read from the code (not assumed). Where something is *unverified* it says so.
**Purpose:** give a planning AI everything it needs to design the "Billing, Invoices & Payments" feature for DentalFlow **without having to explore the repo first**. The feature is NOT greenfield: a billing module already exists and covers part of the requirement. The job is to close the gaps and fix the foundation, not rebuild.

> **Outdated on access (2026-10-23):** this is a pre-billing-v2 snapshot. Roles (`clinic_admin` / `receptionist` / `doctor`), `RolesGuard`, `@Roles` and `@CurrentActor` no longer exist. Billing is gated by permissions — `billing.desk.use`, `billing.invoice.view` (scoped), `billing.invoice.void`, `billing.refund.issue`, `billing.price.override`, `billing.discount.apply` / `.custom`, `billing.cash_close`, … — via `@Can(...)` and `AccessContext.decide()` for discount limits. See [access-control/README.md](access-control/README.md).

---

## 1. The requirement (owner's words, translated)

Manage the clinic's financial transactions:

1. Invoice generation with a unique invoice number
2. Charges for consultation, procedures and medicines
3. Partial payments and advance deposits
4. Discounts and authorized adjustments
5. Statuses: paid, partially paid, unpaid, overdue
6. Remaining balance and a patient ledger
7. Payment methods: cash, bank transfer, card, etc.
8. Refunds and receipts
9. Printable / downloadable invoice and receipt

---

## 2. Product & stack (short)

Multi-tenant SaaS for dental/medical clinics, Pakistan-focused (currency PKR, timezone PKT, Roman-Urdu/English-speaking owner). Hierarchy: **Organization → Locations → patients/appointments/employees**. Every core row carries `organization_id` and usually `location_id`.

| | |
|---|---|
| Backend `backend/` | NestJS 11, TypeScript, TypeORM 0.3, PostgreSQL (Neon), `pdf-lib`, `@nestjs/schedule` (cron), Socket.IO |
| Frontend `web-app/` | React 19, TanStack Start/Router/Query/Form/Table, Zustand, shadcn/ui, Tailwind 4, Zod 4, axios, sonner, date-fns, Recharts |
| DB schema in dev | `synchronize: true` — schema changes go **in entities only**. Owner's standing rule: **no migration files** during dev. |

### Request pipeline (backend)
Global guards in order: `JwtAuthGuard` → `TenantContextGuard` (reads `x-organization-id` + `x-location-id` headers → `@ActiveTenant()` gives `{organizationId, locationId}`) → `FeatureFlagGuard` (`@RequireFeature('key')`) → `RolesGuard` (`@Roles(AppRole.CLINIC_ADMIN | RECEPTIONIST | DOCTOR)`, gives `@CurrentActor()`; routes without `@Roles()` are open to any member of the location). *(Historical — now `AccessGuard` + `@Can`; see the note at the top.)*
Controllers return `ResponseWrapper.success(data, message)`; frontend unwraps `res.data.data`. DTOs use class-validator with `whitelist + forbidNonWhitelisted`. UUID PKs, composite indexes for tenant queries.

### Clinic time
Use `ClockService` (`backend/src/common/clock/`) for "now"/"today" in the **location's timezone**. Never `new Date()` + `setHours()` for clinic days. (Existing billing code violates this — see §6.)

### Feature flags (per organization)
Billing keys already seeded in `feature-flags/feature-catalog.seed.ts`: `billing.invoices`, `billing.pdf_receipts`, `billing.insurance_claims`, `billing.online_payments`, `billing.discounts`, `billing.expenses`, `billing.financial_summary`, `billing.credit_packages`. Any new org-level capability must be gated in 3 layers: backend `@RequireFeature`, sidebar item `feature:` key, `<RequireFeaturePage>` on the route.

---

## 3. What already exists in billing

### 3.1 Backend `backend/src/billing/` (6 controllers, ~2,000 lines)

| Piece | File | What it does |
|---|---|---|
| Invoice entity | `entities/invoice.entity.ts` | number, org/location/patient, optional `treatmentPlanId`, `createdBy`, `subtotal`, `discountType`(`percentage`/`fixed`) + `discountValue` + `discountAmount`, `couponId`, `taxRate`/`taxAmount`, `totalAmount`, `paidAmount`, `balanceDue`, `status`, `issuedDate`/`dueDate`/`paidDate`, `notes`, items[], payments[] |
| Invoice item | `entities/invoice-item.entity.ts` | `description`, `quantity` (int), `unitPrice`, `totalPrice`, `sortOrder`, optional `treatmentPlanItemId`. **Free-text only: no item type, no link to a medicine/treatment/consultation.** |
| Payment | `entities/payment.entity.ts` | per invoice: `amount`, `paymentMethod`, `referenceNumber`, `paymentDate` (date), `receivedBy`, `notes`. **Immutable payments, no void/refund fields.** |
| Enums | `enums/billing.enums.ts` | `InvoiceStatus`: DRAFT, PENDING, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED, REFUNDED. `PaymentMethod`: CASH, CARD, BANK_TRANSFER, ONLINE, INSURANCE, CHEQUE, CREDIT_PACKAGE. `VALID_INVOICE_TRANSITIONS` map (CANCELLED/REFUNDED terminal; PAID→REFUNDED only). |
| Invoices service | `invoices.service.ts` | create (from manual items or a treatment plan), list (filters: status/patient/date, paginated), findOne, update (draft only), add/remove item (draft only), `recalculateTotals()` (subtotal → discount → tax → total → balance, round2), status transition w/ map, `generateFromTreatmentPlan`, `getStats`, cron `0 0 * * *` marks PENDING/PARTIALLY_PAID past due as OVERDUE |
| Payments service | `payments.service.ts` | `recordPayment` in a DB transaction (checks payable status, amount ≤ balance, updates `paidAmount`/`balanceDue`, flips to PARTIALLY_PAID/PAID), `getByInvoice`, `getByPatient`, `getDailyCollection` (by method) |
| Coupons | `coupons.*` | CRUD + apply/remove on a draft invoice; percentage/fixed, `maxDiscountAmount` |
| Credit packages | `credit-packages.*`, `patient-credits.service.ts` | prepaid packages sold to patients (`patient_credits`: total/used/remaining/expiry/status); `useCredit(amount)` just decrements balance; cron expires them. **Not connected to invoice payments** (the `CREDIT_PACKAGE` payment method exists but nothing deducts credit when it is used). |
| Expenses | `expenses.*` | clinic expense CRUD + summary |
| Financial summary | `financial-summary.*` | daily / monthly / trend |
| Receipt PDF | `receipt-pdf.service.ts` | A4 PDF via pdf-lib: org name/address/phone, "PAYMENT RECEIPT", `REC-<invoiceNo>-<n>`, items, totals, last payment details. **Plain Helvetica, no logo/branding, no Urdu glyph support (WinAnsi only), invoice itself has no printable PDF — only a receipt (and only enabled when a payment exists).** |
| Payment gateway | `payment-gateway.service.ts` | mock placeholder returning a fake URL |

Routes (all `@RequireFeature(...)`, **none have `@Roles`**): `POST/GET /invoices`, `GET /invoices/stats`, `GET/PATCH /invoices/:id`, `PATCH /invoices/:id/status`, `POST /invoices/:id/items`, `DELETE /invoices/:id/items/:itemId`, `POST /invoices/from-treatment-plan/:planId`, `POST/GET /invoices/:id/payments`, `POST /invoices/:id/apply-coupon`, `DELETE /invoices/:id/remove-coupon`, `GET /invoices/:id/receipt-pdf`, `POST /invoices/:id/payment-link`; `/coupons`, `/credit-packages`, `/patients/:patientId/credits`, `/expenses`, `/financial-summary/{daily,monthly,trend}`.

### 3.2 Frontend `web-app/src/features/billing/`

> NOTE: `CLAUDE.md` describes a `src/app` + `src/shared` layout that the code does **not** follow. Real layout: routes in `src/routes/`, shared UI in `src/components/{ui,shared,layout,forms}`, API clients in `features/<x>/services/<x>.api.ts`, hooks in `features/<x>/hooks/`. Follow the **real** layout and mimic the nearest existing feature (queue / consultation are the most recent and cleanest).

- Pages: `InvoicesPage` (4 stat cards, status filter buttons, plain table, create dialog), `ExpensesPage`.
- Dialogs: `CreateInvoiceDialog`, `RecordPaymentDialog`, `ExpenseFormDialog` (forms are **Dialogs**; CLAUDE.md wants Sheets).
- Route files with logic inside: `routes/invoices/$invoiceId.tsx` (306 lines — detail page: send, record payment, receipt download, apply/remove coupon, items table), `routes/invoices/index.tsx`, `routes/financial-summary.tsx`, `routes/expenses.tsx`.
- Hooks exist for coupons and credit packages (`useCoupons`, `useCreditPackages`) but **no pages/UI** use them.
- Sidebar: "Invoices" (`billing.invoices`), "Expenses" (`billing.expenses`).
- **No billing tab on the patient detail page; nothing in the consultation/queue flow creates or shows an invoice.**
- `formatCurrency` (`lib/formatters.ts`) hardcodes `PKR` and `en-PK`.

---

## 4. Requirement-by-requirement status

| # | Requirement | Status | Detail |
|---|---|---|---|
| 1 | Invoice generation + unique number | 🟡 | Works, but the numbering is buggy (§6 B1, B2). |
| 2 | Consultation / procedure / medicine charges | 🔴 mostly missing | Only manual free-text lines or copy from a treatment plan. No consultation fee concept anywhere. Performed `treatments.cost` is not linked to invoices. Prescriptions have no price. See §5. |
| 3 | Partial payments & advance deposits | 🟡 | Partial payments ✅. Advance deposit ❌ (can't pay a DRAFT / no invoice yet; `patient_credits` is a prepaid *package* with no payment/receipt behind it). |
| 4 | Discounts & authorized adjustments | 🟡 | Invoice-level discount (% or fixed) + coupons ✅, only while DRAFT. No line-level discount, no discount reason, no approver, no role limit ("authorized"), no post-issue adjustment/write-off. |
| 5 | Status paid / partial / unpaid / overdue | 🟡 | Enum + cron ✅. "Unpaid" = PENDING (fine). Overdue cron uses server-local time and never reverts. PAID→REFUNDED has no partial refund state. |
| 6 | Remaining balance & patient ledger | 🟡 | `balanceDue` per invoice ✅. **No patient ledger** (running statement of charges, payments, refunds, advances, credits), no patient-level outstanding total, no billing tab on patient. |
| 7 | Payment methods | ✅/🟡 | Enum has cash, card, bank transfer, online, insurance, cheque, credit package. Reference number required in UI for card/bank/cheque/online. No per-clinic enable/disable of methods, no bank-account/ POS-terminal field. |
| 8 | Refunds & receipts | 🔴/🟡 | **Refund does not exist**: only a status flip PAID→REFUNDED with no money record, no amount, no reason, no method. Receipts: a PDF of the invoice with the *last* payment — no per-payment receipt number stored. |
| 9 | Printable / downloadable invoice & receipt | 🟡 | Receipt PDF endpoint exists. No invoice PDF (unpaid invoices can't be printed — the Receipt button only shows once paid>0), no thermal/A5 option, no branding, no print-layout setting, no WhatsApp/email share (notifications are stubs). |

---

## 5. Where the charges should come from (integration points)

These are the existing data sources the new billing flow must connect to. **None of them is currently linked to invoices.**

| Charge type | Existing source | Key facts |
|---|---|---|
| **Consultation fee** | *None.* `appointments.type` has `CONSULTATION` etc. `employees` has no fee field. `locations`/`organizations` have no fee setting. | Needs a design: per-doctor fee? per-location default? per-appointment-type price list? A **service/price catalog** is the likely answer (also useful for procedures). |
| **Procedures (planned)** | `patient_treatment_plans` + `treatment_plan_items` (`procedureName`, `procedureCode`, `toothNumber`, `estimatedSessions`/`completedSessions`, `estimatedCost`, status) | Invoice creation can already copy items from a plan (`treatmentPlanItemId` on invoice item). Plans can be seeded from `plan_templates` (jsonb items with `estimatedCost`). |
| **Procedures (performed today)** | `treatments` (entity `Treatment`): `patientId`, `encounterId`, `treatmentName`, `cost` (nullable), `date`. Recorded by the doctor in the consultation workspace (`TreatmentsToday.tsx` — has a fee input, comment says "lands in billing data" but it doesn't). | Natural source for "bill this visit". |
| **Medicines** | `prescriptions` + `prescription_medicines` (name, dosage, frequency, duration — **no price/qty**). `medicine_directory` has no price. Inventory: `inventory_items` has `unitPrice` (cost) and `sellingPrice`; `patient_consumption` (+items) records stock used per patient/appointment; `stock_movements`. | Decide: are medicines *sold* by the clinic (pharmacy, needs stock deduction) or only *prescribed* (no charge)? Likely both — in-clinic dispensed items billed from inventory `sellingPrice`; prescribed-only items not billed. |
| **Visit trigger** | Queue: `queue_entries` (status … `IN_CONSULTATION` → `COMPLETED`, `finishedAt`); `patient_encounters` (one per queue entry, `appointmentId` null for walk-ins) with `treatments[]`. Prescription has `encounter_id`. Consultation `CompleteDialog.tsx` finishes the visit. | Best hook: when the doctor completes the encounter → reception sees a "ready to bill" item with consultation fee + today's treatments (+ dispensed items) prefilled. Billing must link to **encounterId** (walk-ins have no appointment) — `Invoice` currently has no `encounterId`/`appointmentId`. |
| **Reception** | Queue board / appointments list / check-in; patient search component already exists. Roles: `receptionist` is the one who collects money; `clinic_admin` authorizes; `doctor` should not touch billing. | No `@Roles` on billing today — must be added. |

---

## 6. Defects in the existing billing code (verified by reading)

Fix these as part of the work — the new design builds on them.

| ID | Defect | Where |
|---|---|---|
| B1 | **Invoice number collision across tenants**: unique index is on `invoiceNumber` alone (global) but the sequence is generated per-organization (`INV-<year>-00001` restarts in every org) → the second org's first invoice fails. | `invoice.entity.ts` `@Index(['invoiceNumber'], {unique:true})`, `invoices.service.ts:generateInvoiceNumber` |
| B2 | Number generation is read-last-then-+1 (race → duplicates under concurrency), ordered by `createdAt` not by seq, resets are not per-year. Needs a counter row / DB sequence per org(+location?)(+year) inside the transaction. Owner may want a location prefix. | same |
| B3 | **Cross-tenant read (IDOR)**: `GET /invoices/:id/payments` queries by `invoiceId` only, no org/location check. Same in `getByPatient`'s sibling usage. Already listed as S3 in `PROJECT_OVERVIEW.md`. | `payments.service.ts getByInvoice`, `invoices.controller.ts` |
| B4 | `create` is not transactional (invoice, items, totals saved in separate calls); `recalculateTotals` saves repeatedly. | `invoices.service.ts` |
| B5 | Dates use server-local time (`new Date()`, cron `0 0 * * *`, `setHours(0,0,0,0)`) — wrong for PKT clinics and breaks the repo's `ClockService` rule. `payment_date`/`issued_date`/`due_date` are `date` columns fed with `Date` objects. | invoices/payments/credits services |
| B6 | `updateStatus` lets a client PATCH any allowed status directly — including `PAID` without a payment, `PARTIALLY_PAID`, `OVERDUE`. Status should be **derived** from amounts/dates; only DRAFT→PENDING, CANCEL, (refund) should be user actions. | `invoices.service.ts updateStatus` |
| B7 | `PENDING` invoices are not editable at all (draft only) — "authorized adjustments after issue" is impossible; no credit-note/adjustment concept. | `assertDraft` |
| B8 | `recordPayment` validates `amount ≥ 1` (`@Min(1)`) and `amount ≤ balanceDue`; no overpayment → advance/credit handling; no idempotency (double-click = double payment); no payment `void`. | `payment.dto.ts`, `payments.service.ts` |
| B9 | `CREDIT_PACKAGE` payment method never deducts from `patient_credits`; credit sale itself creates no invoice/payment/receipt. | `patient-credits.service.ts` |
| B10 | Discount/coupon: percentage discount can't exceed subtotal but fixed discounts have no authority check; coupon usage/limits not re-validated on status change (*unverified*). Item `quantity` is `int` (no fractional qty). | `invoices.service.ts`, `coupons.service.ts` |
| B11 | Receipt: no stored receipt number (computed `REC-<inv>-<index>`), only the **last** payment shown, no org logo, no invoice PDF, Helvetica only (Urdu/Unicode unsupported). | `receipt-pdf.service.ts` |
| B12 | `getStats` "revenue" = sum of `paid_amount` on PAID/PARTIALLY_PAID invoices — ignores refunds and cancelled-after-payment; `financial-summary` likely shares this (*unverified*). | `invoices.service.ts getStats` |
| B13 | `PatientCreditsController`/`useCredit` has no org/patient ownership check beyond `organizationId` (patient/credit mismatch possible) (*unverified*). | `credit-packages.controller.ts` |
| B14 | Money stored as `decimal(10,2)` and read back as strings; each service redefines `num()`/`round2()`. Prefer one shared money util (or integer minor units). `Location.currency` default is USD while `Organization.currency` is PKR; `formatCurrency` hardcodes PKR. | many |
| B15 | Frontend: forms are Dialogs not Sheets; `$invoiceId.tsx` route contains all page logic (CLAUDE.md says routes are thin); InvoicesPage has no search, no card/list toggle, no pagination controls, no filters beyond status buttons, no error state. | `web-app` |

---

## 7. Conventions the implementation must follow (from CLAUDE.md + owner preferences)

- Forms: **TanStack Form + Zod only** (`react-hook-form` banned); submit disabled on `!canSubmit`/`isSubmitting`; field errors below fields; forms open in a **Sheet** (shared `FormSheet` exists in `components/forms/`).
- Every listing: card + list view toggle, filters row (300 ms debounced search, active-filter count, clear-all), pagination (size selector + prev/next + info), loading skeleton / empty state / error state / "no results for filters" state.
- Nested pages use a back button (`DashboardLayout backTo`/`backLabel`), **no breadcrumbs**.
- Icon-only buttons **must** use `TooltipButton` (`@/components/shared/TooltipButton`). Delete always via `ConfirmDialog`. Active/inactive via Switch, never reuse delete.
- Dates via `DatePicker`/`DateTimePicker` (`@/components/shared/`), never native date input. shadcn `Input`/`Button` only. Tailwind classes, no inline styles/hardcoded colors.
- No axios in components: calls live in `features/<x>/services/*.api.ts`, consumed by TanStack Query hooks.
- Backend: DTO validation, `ResponseWrapper`, tenant-scoped queries on **every** lookup (org + location), `@RequireFeature`, `@Roles` on all new/changed billing routes. Transaction for any multi-write money operation. Audit trail for financial mutations.
- **Dev DB: entity changes only, no migration files.** Run `npm run build` (backend) and `npx tsc --noEmit` + `npm run check` (web-app) before declaring done; Vitest exists in web-app, Jest in backend (add unit tests for the money math and status derivation — pure functions are easy to test, see `queue` specs for style).
- Owner prefers autonomous end-to-end execution and communicates in Roman Urdu/English.

---

## 8. Decisions the owner must make before/while planning

Planning AI should present these as options with a recommendation, not assume:

1. **Charge catalog.** Introduce a `service_catalog` (name, code, category: consultation / procedure / lab / other, default price, per-doctor override?) so consultation fee and procedure prices have a home? *(Recommended: yes — org-level catalog with optional per-doctor/location price override.)*
2. **Medicines.** Billed from inventory `sellingPrice` with stock deduction (pharmacy) vs. prescription-only (not billed) vs. both via a "dispensed" flag per prescription line.
3. **Invoice-per-visit vs. invoice-per-plan.** Auto-draft an invoice when the encounter completes (prefilled) and also allow plan-based/manual invoices — or manual only?
4. **Numbering format**: `INV-2026-00001` per org (current) vs. per location prefix (`ISL-INV-…`); reset yearly?; separate series for receipts (`RCT-…`) and refunds/credit notes (`CN-…`).
5. **Edit-after-issue policy**: lock issued invoices and correct via credit note / adjustment line (accounting-safe, recommended) vs. allow admin edit with audit log.
6. **Discount authority**: receptionist max % / amount without approval; above that requires clinic_admin (approval flow or PIN?). Mandatory reason?
7. **Advance deposit model**: patient wallet/ledger balance (deposit → auto-applied to next invoices) vs. deposit tied to a treatment plan. How does it relate to existing `credit_packages` (merge or keep separate)?
8. **Refund rules**: full/partial, against which payment, method (cash-back vs. to wallet), who authorizes, effect on invoice status and on revenue stats.
9. **Overdue**: due-date default (currently +30 days), late fee (`location_settings.late_fee_percentage` already exists, unused), reminders (notifications are stubs).
10. **Tax**: `location_settings.tax_rate` exists but invoices take `taxRate` per invoice — default from settings? (healthcare is often 0%).
11. **Insurance** (`INSURANCE` method, `billing.insurance_claims` flag, `patient_insurance` entity exists): in scope now or later?
12. **Print formats**: A4 invoice + A4/A5/80mm-thermal receipt? Urdu text needed (requires embedding a Unicode font in pdf-lib or switching to HTML→print)? Org logo/branding (`location_settings.logo_url` exists).
13. **Permissions matrix**: suggested — receptionist: create/collect/print; doctor: view only (or none); clinic_admin: discount override, refund, void, adjustments, reports.
14. **Currency/rounding**: PKR only? rounding to whole rupees?

---

## 9. Suggested shape of the work (for the planner to refine)

1. **Foundation fixes** (B1–B6, B8, B14): per-org atomic number counter, tenant-scoped payment reads, transactions, `ClockService`, derived status, shared `money` util, `@Roles`.
2. **Data model additions** (entities only): `service_catalog`; invoice item `type` + `sourceType/sourceId` (consultation / treatment / medicine / manual) + line discount; invoice `encounterId`/`appointmentId`, `discountReason`/`approvedBy`; **`patient_ledger_entries`** (append-only: charge, payment, refund, advance, advance-applied, adjustment, write-off; running balance); `payments` gets `receiptNumber`, `status` (posted/voided), `voidedBy/At/reason`; **`refunds`** (amount, method, reason, authorizedBy, against payment/invoice); `invoice_adjustments`/credit notes; `patient_wallet` or advance entries; billing settings per location (prefixes, due days, discount limit, late fee, enabled methods, print layout).
3. **Visit-to-bill flow**: completed encounter → "ready to bill" list for reception → prefilled draft (consultation fee + today's treatments + dispensed medicines) → review/discount → issue → collect (split payments, advance applied) → print receipt.
4. **Ledger & patient billing tab** on patient detail (statement, outstanding, advances, history, print statement).
5. **Refunds & adjustments** with authorization.
6. **Documents**: invoice PDF + receipt PDF (per payment) + refund voucher; branding; optional thermal size.
7. **Frontend**: rebuild Invoices listing to repo standard (filters, card/list, pagination, states), invoice detail with Sheets for payment/discount/refund, billing tab, billing settings page, reception "ready to bill" widget (queue board).
8. **Tests**: money math, status derivation, numbering concurrency, refund/advance edge cases, tenant isolation on every billing endpoint.

---

## 10. Key file index

Backend: `backend/src/billing/*` (see §3.1) · `backend/src/patients/entities/{patient-treatment-plan,treatment-plan-item}.entity.ts` · `backend/src/treatments/` · `backend/src/encounters/` · `backend/src/queue/` (`queue-orchestrator.service.ts`, completion transition ~L800) · `backend/src/prescriptions/entities/` · `backend/src/inventory/entities/{inventory-item,patient-consumption}.entity.ts` · `backend/src/plan-templates/` · `backend/src/locations/entities/location-settings.entity.ts` (tax, late fee, logo) · `backend/src/common/{clock,decorators,enums/app-role.enum.ts}` · `backend/src/feature-flags/feature-catalog.seed.ts` · `backend/src/app.module.ts` (entity registration, guards).

Frontend: `web-app/src/features/billing/` · `web-app/src/routes/invoices/` · `web-app/src/features/consultation/` (CompleteDialog, TreatmentsToday) · `web-app/src/features/queue/` (QueueBoard — reception screen) · `web-app/src/features/patients/components/{PatientDetailTabs,tabs/*}.tsx` · `web-app/src/components/{shared,forms,layout}/` · `web-app/src/components/layout/Sidebar.tsx`.

Docs: `CLAUDE.md` (conventions; folder layout section is outdated), `docs/appointments-and-queue.md` (visit lifecycle — read §1 and the encounter section), `PROJECT_OVERVIEW.md` (Oct-11 audit; its billing claims "✅ working" are optimistic — §6 here is the verified list).
