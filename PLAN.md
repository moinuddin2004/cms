# MedTrackr — Feature Implementation Plan

## Claude ka Best Use kaise karein

### Golden Rules
1. **Ek module ek session** — ek baar mein ek pura module complete karo. Context mat toot-ne do.
2. **Backend pehle, Frontend baad mein** — pehle entity → DTO → service → controller, phir API service → hook → component → route.
3. **Chhota kaam batao** — "implement leave management" bolne ki bajaye "EmployeeLeave entity aur CRUD endpoints banao" kaho.
4. **File path dena** — "employees module update karo" ki bajaye exact file path dena takay Claude seedha kaam kare.
5. **Type-check har step pe** — backend: `npx tsc --noEmit`, frontend: `npx tsc --noEmit`. Merge se pehle zaroor check karo.
6. **Ek feature ek commit** — chhote commits raho takay rollback asaan ho.

### Recommended Session Structure (har feature ke liye)
```
Session 1: Backend — entities + DTOs + service + controller + module wiring
Session 2: Frontend — API service + TanStack Query hooks + components + route
Session 3: Integration test + bug fixes
```

---

## Module Priority Order

| Priority | Module | Effort | Dependencies |
|----------|--------|--------|--------------|
| 1 | **HR — Leave & Attendance** | Medium | Employees ✅ |
| 2 | **HR — Doctor Availability Overrides** | Small | Employees ✅, Appointments ✅ |
| 3 | **HR — Portal Access Control UI** | Small | Employees ✅ |
| 4 | **Appointments — Reminders** | Medium | Appointments ✅, Communications |
| 5 | **Appointments — Waiting Room Queue** | Medium | Appointments ✅ |
| 6 | **Appointments — Recurring** | Medium | Appointments ✅ |
| 7 | **Patients — Prescription Templates** | Small | Patients ✅ |
| 8 | **Patients — SOAP Clinical Notes** | Medium | Patients ✅ |
| 9 | **Patients — Clinical Note Templates** | Small | SOAP Notes |
| 10 | **Patients — Allergy & Medical Alerts** | Small | Patients ✅ |
| 11 | **Patients — Lab Orders** | Medium | Patients ✅ |
| 12 | **Patients — Insurance Claims Workflow** | Large | Insurance ✅ |
| 13 | **Patients — Digital Consent Signing** | Medium | Consents ✅ |
| 14 | **Patients — Recall System** (partial → full) | Small | Patients ✅ |
| 15 | **Patients — Feedback** (partial → full) | Small | Patients ✅ |
| 16 | **Patients — Referral Program** (partial → full) | Small | Patients ✅ |
| 17 | **Billing — Invoices** (entity only → full) | Large | Patients ✅, Appointments ✅ |
| 18 | **Inventory** (entity only → full) | Medium | Locations ✅ |
| 19 | **Dashboard — Real Data** | Medium | All modules |
| 20 | **Communications — SMS/WhatsApp** | Large | External API |
| 21 | **Reports & Exports** | Large | All modules |

---

## Detailed Feature Specs

---

### 1. HR — Leave & Attendance

**Kya banana hai:**
- `EmployeeLeave` entity (employee FK, leaveType enum, startDate, endDate, status, reason, approvedBy)
- `LeaveType` enum: ANNUAL, SICK, UNPAID, MATERNITY, PATERNITY, OTHER
- `LeaveStatus` enum: PENDING, APPROVED, REJECTED, CANCELLED
- Backend: full CRUD + approve/reject endpoints
- Frontend: Leave requests table + approve/reject actions + leave balance display

**Backend files:**
```
cms/backend/src/employees/entities/employee-leave.entity.ts  (NEW)
cms/backend/src/employees/dto/create-leave.dto.ts            (NEW)
cms/backend/src/employees/dto/update-leave.dto.ts            (NEW)
cms/backend/src/employees/leave.controller.ts                (NEW)
cms/backend/src/employees/leave.service.ts                   (NEW)
cms/backend/src/employees/employees.module.ts                (UPDATE — add entity + controllers)
```

**Frontend files:**
```
cms/web-app/src/features/employees/services/leave.api.ts         (NEW)
cms/web-app/src/features/employees/hooks/useLeave.ts             (NEW)
cms/web-app/src/features/employees/components/LeaveTable.tsx     (NEW)
cms/web-app/src/features/employees/components/LeaveFormDialog.tsx (NEW)
```

---

### 2. HR — Doctor Availability Overrides

**Kya banana hai:**
- `DoctorAvailabilityOverride` entity: employeeId, date, isAvailable, reason, overrideHours (jsonb — start/end time slots)
- Use case: doctor ka specific din band hai ya extra hours hain
- Backend: CRUD per employee
- Frontend: calendar-style UI ya simple table in employee detail page

**Backend files:**
```
cms/backend/src/employees/entities/doctor-availability-override.entity.ts (NEW)
cms/backend/src/employees/dto/availability-override.dto.ts                (NEW)
cms/backend/src/employees/availability-override.controller.ts             (NEW)
cms/backend/src/employees/availability-override.service.ts                (NEW)
```

**Frontend files:**
```
cms/web-app/src/features/employees/components/AvailabilityOverrideTab.tsx (NEW)
```

---

### 3. HR — Portal Access Control UI

**Kya banana hai:**
- Employee record pe `portalAccess: boolean` toggle
- When enabled: send invite email (or set temp password)
- Backend: `PATCH /employees/:id/portal-access` endpoint already likely exists — check `employees.entity.ts`
- Frontend: toggle switch in EmployeeForm or EmployeeTable actions

**Backend files:**
```
cms/backend/src/employees/employees.service.ts    (UPDATE — add togglePortalAccess method)
cms/backend/src/employees/employees.controller.ts (UPDATE — add PATCH endpoint)
```

**Frontend files:**
```
cms/web-app/src/features/employees/components/EmployeeTable.tsx (UPDATE — add toggle column)
```

---

### 4. Appointments — Waiting Room Queue

**Kya banana hai:**
- `WaitingRoom` entity: appointmentId FK, checkInTime, calledTime, status (WAITING/CALLED/IN_PROGRESS/DONE)
- Endpoints: check-in, call-next, complete
- Frontend: real-time queue view (polling every 30s or WebSocket later)

**Backend files:**
```
cms/backend/src/appointments/entities/waiting-room.entity.ts  (NEW)
cms/backend/src/appointments/dto/waiting-room.dto.ts          (NEW)
cms/backend/src/appointments/waiting-room.controller.ts       (NEW)
cms/backend/src/appointments/waiting-room.service.ts          (NEW)
```

**Frontend files:**
```
cms/web-app/src/features/appointments/components/WaitingRoomView.tsx (NEW)
cms/web-app/src/routes/appointments.waiting-room.tsx                 (NEW)
```

---

### 5. Appointments — Recurring Appointments

**Kya banana hai:**
- `recurrenceRule` field on Appointment entity: frequency (DAILY/WEEKLY/MONTHLY), interval, endDate, count
- `parentAppointmentId` FK (self-referential) for series grouping
- Endpoints: create series, edit single vs all, cancel series
- Frontend: recurrence UI in AppointmentModal

**Backend files:**
```
cms/backend/src/appointments/entities/appointment.entity.ts   (UPDATE — add recurrence fields)
cms/backend/src/appointments/dto/create-appointment.dto.ts    (UPDATE)
cms/backend/src/appointments/appointments.service.ts          (UPDATE — createSeries method)
```

**Frontend files:**
```
cms/web-app/src/features/appointments/components/RecurrenceForm.tsx (NEW)
cms/web-app/src/features/appointments/components/AppointmentModal.tsx (UPDATE)
```

---

### 6. Patients — Prescription Templates

**Kya banana hai:**
- `PrescriptionTemplate` entity: orgId, name, drugs (jsonb array), instructions
- Endpoints: CRUD under org context
- Frontend: template selector in PrescriptionFormDialog

**Backend files:**
```
cms/backend/src/patients/entities/prescription-template.entity.ts (NEW)
cms/backend/src/patients/dto/request/prescription-template.dto.ts (NEW)
cms/backend/src/patients/patients.service.ts                       (UPDATE — template methods)
cms/backend/src/patients/patients.controller.ts                    (UPDATE — template routes)
```

**Frontend files:**
```
cms/web-app/src/features/patients/components/tabs/PrescriptionFormDialog.tsx (UPDATE — add template picker)
```

---

### 7. Patients — SOAP Clinical Notes

**Kya banana hai:**
- `ClinicalNote` entity: patientId, visitId (nullable), authorId, noteType (SOAP/FREE), subjective, objective, assessment, plan, freeText, isDraft
- `ClinicalNoteTemplate` entity: orgId, name, noteType, defaultContent (jsonb)
- Endpoints: full CRUD, mark-final (locks editing)
- Frontend: rich text editor or structured SOAP form in patient detail

**Backend files:**
```
cms/backend/src/patients/entities/clinical-note.entity.ts          (NEW)
cms/backend/src/patients/entities/clinical-note-template.entity.ts (NEW)
cms/backend/src/patients/dto/request/clinical-note.dto.ts          (NEW)
cms/backend/src/patients/patients.service.ts                        (UPDATE)
cms/backend/src/patients/patients.controller.ts                     (UPDATE)
```

**Frontend files:**
```
cms/web-app/src/features/patients/components/tabs/ClinicalNotesTab.tsx (NEW)
cms/web-app/src/features/patients/components/tabs/ClinicalNoteFormDialog.tsx (NEW)
```

---

### 8. Patients — Allergy & Medical Alerts

**Kya banana hai:**
- `PatientAllergy` entity: patientId, allergen, allergyType (DRUG/FOOD/ENVIRONMENTAL/OTHER), severity (MILD/MODERATE/SEVERE), reaction, notes
- Banner/alert shown prominently on patient detail page
- Backend: CRUD per patient
- Frontend: alert banner in PatientDetailHeader + management tab

**Backend files:**
```
cms/backend/src/patients/entities/patient-allergy.entity.ts (NEW)
cms/backend/src/patients/dto/request/sub-entity.dto.ts      (UPDATE — add allergy DTOs)
cms/backend/src/patients/patients.service.ts                 (UPDATE)
cms/backend/src/patients/patients.controller.ts              (UPDATE)
```

**Frontend files:**
```
cms/web-app/src/features/patients/components/PatientDetailHeader.tsx (UPDATE — allergy alert banner)
cms/web-app/src/features/patients/components/tabs/AdminTab.tsx        (UPDATE — allergy management section)
```

---

### 9. Patients — Lab Orders

**Kya banana hai:**
- `LabOrder` entity: patientId, visitId (nullable), orderedBy (employeeId), labName, testName, status (ORDERED/SAMPLE_COLLECTED/IN_PROGRESS/COMPLETED/CANCELLED), orderedAt, resultAt, resultNotes, resultFileUrl
- Endpoints: CRUD + update-result endpoint
- Frontend: Lab Orders tab in patient detail

**Backend files:**
```
cms/backend/src/patients/entities/lab-order.entity.ts       (NEW)
cms/backend/src/patients/dto/request/lab-order.dto.ts       (NEW)
cms/backend/src/patients/patients.service.ts                  (UPDATE)
cms/backend/src/patients/patients.controller.ts               (UPDATE)
```

**Frontend files:**
```
cms/web-app/src/features/patients/components/tabs/LabOrdersTab.tsx        (NEW)
cms/web-app/src/features/patients/components/tabs/LabOrderFormDialog.tsx  (NEW)
```

---

### 10. Patients — Insurance Claims Workflow

**Kya banana hai:**
- `InsuranceClaim` entity: patientId, insuranceId FK, invoiceId (nullable FK), claimNumber, submittedAt, status (DRAFT/SUBMITTED/IN_REVIEW/APPROVED/REJECTED/PARTIALLY_PAID), approvedAmount, rejectionReason, notes
- Status lifecycle with audit trail
- Endpoints: CRUD + status-transition endpoint
- Frontend: Claims tab in patient detail + claims list view

**Backend files:**
```
cms/backend/src/patients/entities/insurance-claim.entity.ts     (NEW)
cms/backend/src/patients/dto/request/insurance-claim.dto.ts     (NEW)
cms/backend/src/patients/patients.service.ts                      (UPDATE)
cms/backend/src/patients/patients.controller.ts                   (UPDATE)
```

**Frontend files:**
```
cms/web-app/src/features/patients/components/tabs/InsuranceClaimsTab.tsx (NEW)
cms/web-app/src/features/patients/components/tabs/ClaimFormDialog.tsx    (NEW)
```

---

### 11. Patients — Recall System (partial → full)

**Entity exists.** Sirf backend service + controller + frontend tab banana hai.

**Backend files:**
```
cms/backend/src/patients/patients.service.ts   (UPDATE — recall CRUD methods)
cms/backend/src/patients/patients.controller.ts (UPDATE — recall routes)
```

**Frontend files:**
```
cms/web-app/src/features/patients/components/tabs/CrmTab.tsx (UPDATE — recall section already exists, wire API)
```

---

### 12. Patients — Feedback (partial → full)

**Entity exists.** Same pattern as recalls.

**Backend files:**
```
cms/backend/src/patients/patients.service.ts    (UPDATE)
cms/backend/src/patients/patients.controller.ts (UPDATE)
```

**Frontend files:**
```
cms/web-app/src/features/patients/components/tabs/CrmTab.tsx (UPDATE — feedback section wire karo)
```

---

### 13. Patients — Referral Program (partial → full)

**Entity exists.** Same pattern.

**Backend files:**
```
cms/backend/src/patients/patients.service.ts    (UPDATE)
cms/backend/src/patients/patients.controller.ts (UPDATE)
```

**Frontend files:**
```
cms/web-app/src/features/patients/components/tabs/CrmTab.tsx (UPDATE — referral section wire karo)
```

---

### 14. Billing — Full Invoices Module

**Kya banana hai:**
- Entity exists (`invoices/entities/invoice.entity.ts`) — check its fields first
- `InvoiceItem` entity (if not exists): invoiceId FK, description, quantity, unitPrice, discount, total
- `InvoicePayment` entity: invoiceId FK, amount, paymentMethod, paidAt, reference
- Endpoints: CRUD + add-payment + send-to-patient + generate-pdf (later)
- Frontend: full invoice management page + create/edit modal + payment modal

**Backend files:**
```
cms/backend/src/invoices/                           (entire module — controller + service + DTOs)
cms/backend/src/invoices/entities/invoice-item.entity.ts    (NEW if not exists)
cms/backend/src/invoices/entities/invoice-payment.entity.ts (NEW)
cms/backend/src/app.module.ts                       (UPDATE — add InvoicesModule)
```

**Frontend files:**
```
cms/web-app/src/features/billing/services/billing.api.ts    (NEW)
cms/web-app/src/features/billing/hooks/useBilling.ts        (NEW)
cms/web-app/src/features/billing/components/InvoiceTable.tsx (NEW)
cms/web-app/src/features/billing/components/InvoiceFormDialog.tsx (NEW)
cms/web-app/src/features/billing/components/PaymentDialog.tsx    (NEW)
cms/web-app/src/routes/billing.index.tsx                    (NEW)
```

---

### 15. Inventory — Full Module

**Kya banana hai:**
- Entity exists — check fields
- `InventoryTransaction` entity: itemId FK, type (IN/OUT/ADJUSTMENT), quantity, reason, performedBy, performedAt
- Endpoints: CRUD + add-transaction + low-stock-alert
- Frontend: inventory management page + transaction history

**Backend files:**
```
cms/backend/src/inventory/                            (entire module — controller + service + DTOs)
cms/backend/src/inventory/entities/inventory-transaction.entity.ts (NEW)
cms/backend/src/app.module.ts                         (UPDATE — add InventoryModule)
```

**Frontend files:**
```
cms/web-app/src/features/inventory/services/inventory.api.ts   (NEW)
cms/web-app/src/features/inventory/hooks/useInventory.ts       (NEW)
cms/web-app/src/features/inventory/components/InventoryTable.tsx (NEW)
cms/web-app/src/features/inventory/components/TransactionDialog.tsx (NEW)
cms/web-app/src/routes/inventory.index.tsx                     (NEW)
```

---

### 16. Dashboard — Real Data

**Replace mocked data with real API calls.**

**Backend files:**
```
cms/backend/src/dashboard/dashboard.controller.ts (NEW)
cms/backend/src/dashboard/dashboard.service.ts    (NEW — aggregate queries)
cms/backend/src/dashboard/dashboard.module.ts     (NEW)
```

**Frontend files:**
```
cms/web-app/src/features/dashboard/services/dashboard.api.ts (UPDATE — real endpoints)
cms/web-app/src/features/dashboard/hooks/useDashboard.ts     (UPDATE or create)
```

---

### 17. Communications — SMS/WhatsApp (appointment reminders)

**External dependency.** Twilio ya similar service chahiye.

**Backend files:**
```
cms/backend/src/communications/communications.module.ts  (NEW)
cms/backend/src/communications/communications.service.ts (NEW — Twilio/WhatsApp integration)
cms/backend/src/communications/dto/send-message.dto.ts   (NEW)
```

**Environment variables needed:**
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_NUMBER=
```

---

### 18. Reports & Exports

**PDF/Excel exports — heavy feature.**

**Backend files:**
```
cms/backend/src/reports/reports.module.ts     (NEW)
cms/backend/src/reports/reports.service.ts    (NEW — aggregate + format)
cms/backend/src/reports/reports.controller.ts (NEW — streaming PDF/CSV response)
```

**NPM packages needed:**
```
@nestjs/common (already installed)
pdfkit or puppeteer (PDF generation)
exceljs (Excel exports)
```

---

## Session Prompt Templates

### Backend Module Session:
```
Mujhe [MODULE_NAME] module ka backend banana hai NestJS mein.
Existing pattern follow karo (ResponseWrapper.success, organizationId tenant context, TypeORM).

Ye files banana/update karo:
[list specific files]

Entity fields:
[list fields with types]

Endpoints:
[list endpoints with method + path]

Already existing related files:
[list relevant existing files as context]
```

### Frontend Module Session:
```
[MODULE_NAME] module ka frontend banana hai React/TanStack mein.
Backend endpoints ready hain: [list endpoints]

Existing patterns follow karo:
- apiClient.get/post/patch/delete
- useQuery/useMutation with queryKey arrays
- ResponseWrapper unwrap: res.data.data
- shadcn/ui components only
- toast.success/toast.error for feedback

Ye files banana/update karo:
[list specific files]
```

---

## Implementation Checklist

### HR Module
- [x] Leave & Attendance (entity + backend + frontend) — 2026-06-10
- [x] Doctor Availability Overrides — 2026-06-10
- [x] Portal Access Control toggle UI — 2026-06-10

### Appointments Module
- [ ] Waiting Room Queue
- [ ] Recurring Appointments
- [ ] Appointment Reminders (after Communications ready)

### Patients Module
- [ ] Prescription Templates
- [ ] SOAP Clinical Notes + Templates
- [ ] Allergy & Medical Alerts
- [ ] Lab Orders
- [ ] Insurance Claims Workflow
- [ ] Recall System (complete wiring)
- [ ] Feedback (complete wiring)
- [ ] Referral Program (complete wiring)

### Billing Module
- [ ] Full Invoices module (backend + frontend)
- [ ] Payment recording
- [ ] Invoice PDF (phase 2)

### Inventory Module
- [ ] Full Inventory module (backend + frontend)
- [ ] Transaction history
- [ ] Low stock alerts

### Dashboard
- [ ] Replace mock data with real API calls

### Communications
- [ ] SMS/WhatsApp integration (Twilio)
- [ ] Appointment reminders
- [ ] Patient notification preferences

### Reports
- [ ] Appointment reports (CSV)
- [ ] Revenue reports (CSV/PDF)
- [ ] Patient reports (CSV)
- [ ] Payroll reports (CSV/PDF)

---

## Notes

- **Patients module bahut bada hai** — sub-entity routes sab `patients.controller.ts` mein hain. Isko split karne ki zaroorat nahi, bas `UPDATE` mark karo.
- **Billing aur Inventory** ke entities exist karte hain but poori module setup nahi — pehle entities padh ke confirm karo kya fields already hain.
- **Communications** module tabtak delay karo jab tak Twilio credentials available hon.
- **Reports** aakhir mein karo — sab data-modules ka depend karta hai.
- **`synchronize: true` hai** dev mein — TypeORM new entities automatically DB mein create karega. Production pe migrate karna hoga.


Read PLAN.md and add this Billing & Finance section. Then start implementing from Step 1.

## Phase 5 — Billing & Finance

### 5.1 Invoice System (Core)
ENTITIES: Extend existing invoice entity with new fields (invoiceNumber auto-gen, subtotal, discountAmount, discountType, taxRate, taxAmount, totalAmount, paidAmount, balanceDue, status enum DRAFT/PENDING/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED/REFUNDED, dueDate, issuedDate, paidDate). Create invoice_items (invoiceId FK, treatmentPlanItemId FK nullable, description, quantity, unitPrice, totalPrice, sortOrder).
SERVICE: InvoicesService — create invoice (manual or from treatment plan), add/remove items, recalculate totals on item change, update status, getByPatient, getByLocation with filters and pagination, auto-generate invoiceNumber (INV-2024-00001 format).
CONTROLLER: /invoices — full CRUD, GET with status/patient/dateRange filters, PATCH /:id/status for transitions. Use @RequireFeature('billing.invoices').
DTOs: CreateInvoiceDto, UpdateInvoiceDto, CreateInvoiceItemDto, InvoiceFilterDto (status, patientId, dateFrom, dateTo, page, limit).
FRONTEND: Invoice list page with status tabs (All/Draft/Pending/Paid/Overdue), patient filter, date range. Invoice detail page showing items table, totals, status badge, action buttons. Create invoice dialog with patient selector, add line items, auto-calc totals. 
ROUTE: /invoices (list) + /invoices/:id (detail)
ACCEPTANCE: Can create invoice manually with line items. Can view all invoices filtered by status. Totals calculate correctly.
- [ ] 5.1.1 Backend: entities + service + controller + DTOs
- [ ] 5.1.2 Frontend: API service + hooks
- [ ] 5.1.3 Frontend: Invoice list page with filters
- [ ] 5.1.4 Frontend: Invoice detail page
- [ ] 5.1.5 Frontend: Create/edit invoice dialog

### 5.2 Payment Recording
ENTITY: payments (invoiceId FK, patientId FK, organizationId FK, locationId FK, amount decimal, paymentMethod enum CASH/CARD/BANK_TRANSFER/ONLINE/INSURANCE/CHEQUE, referenceNumber nullable, paymentDate, receivedBy FK, notes nullable, createdAt).
SERVICE: PaymentsService — recordPayment (validate amount <= balanceDue, update invoice.paidAmount and invoice.balanceDue, auto-transition status: if paidAmount >= totalAmount → PAID, else → PARTIALLY_PAID, set paidDate when fully paid). getPaymentsByInvoice, getPaymentsByPatient.
CONTROLLER: POST /invoices/:id/payments — record payment. GET /invoices/:id/payments — list payments for invoice. Use @RequireFeature('billing.invoices').
FRONTEND: "Record Payment" button on invoice detail. Payment dialog: amount (prefilled with balance), method dropdown, reference number, date, notes. Payment history table on invoice detail page. 
ACCEPTANCE: Can record partial payment. Invoice status auto-updates. Balance recalculates. Multiple payments per invoice work.
- [ ] 5.2.1 Backend: payment entity + service + controller
- [ ] 5.2.2 Frontend: payment dialog + payment history on invoice detail

### 5.3 Invoice Status Lifecycle + Auto-Overdue
SERVICE: Add to InvoicesService — validateStatusTransition (DRAFT→PENDING, PENDING→PAID etc, prevent invalid transitions like PAID→DRAFT). Add cron job: every day at midnight, find PENDING invoices where dueDate < today → mark OVERDUE.
BACKEND: Use existing BullMQ or @Cron() from @nestjs/schedule for auto-overdue.
FRONTEND: Status badge with colors (Draft=gray, Pending=yellow, Paid=green, Overdue=red, Cancelled=gray strikethrough). Action buttons change per status (Draft→"Send to Patient", Pending→"Record Payment", Overdue→"Send Reminder").
ACCEPTANCE: Cannot make invalid status transition. Overdue auto-detected daily.
- [ ] 5.3.1 Backend: status transition validation + cron job
- [ ] 5.3.2 Frontend: status-aware action buttons

### 5.4 Treatment Plan → Invoice Generation
SERVICE: Add generateInvoiceFromTreatmentPlan(treatmentPlanId) — reads all TreatmentPlanItems, creates Invoice with InvoiceItems mapped from plan items (description=procedure name, unitPrice=cost, quantity=1). Link invoiceId back to treatment plan.
CONTROLLER: POST /treatment-plans/:id/generate-invoice
FRONTEND: "Generate Invoice" button on treatment plan detail. Shows preview before creating. After creation, navigate to invoice detail page.
ACCEPTANCE: Click button on treatment plan → invoice created with all items → navigate to invoice.
- [ ] 5.4.1 Backend: generation logic
- [ ] 5.4.2 Frontend: button + preview + navigation

### 5.5 Receipt PDF Generation
SERVICE: ReceiptPdfService — generateReceipt(paymentId). Uses pdf-lib or @react-pdf/renderer on backend. Template: org logo + name (from org settings), patient info, invoice number, items table, payment details, total/paid/balance, "Thank you" footer. Returns PDF buffer.
CONTROLLER: GET /invoices/:id/receipt-pdf — generate and stream PDF. GET /payments/:id/receipt-pdf.
FRONTEND: "Download Receipt" and "Print Receipt" buttons on invoice detail after payment. "Share via WhatsApp" button (future — just UI placeholder for now).
GUARD: @RequireFeature('billing.pdf_receipts')
ACCEPTANCE: PDF downloads with correct data. Org branding shows. Print works.
- [ ] 5.5.1 Backend: PDF generation service
- [ ] 5.5.2 Frontend: download/print buttons

### 5.6 Discount & Coupon System
ENTITY: coupons (organizationId FK, code unique per org, name, discountType percentage/fixed, discountValue, maxDiscountAmount nullable, minInvoiceAmount nullable, validFrom, validUntil, maxUses nullable, usedCount default 0, isActive, createdAt updatedAt).
SERVICE: CouponsService — CRUD, validateCoupon(code, orgId, invoiceAmount) — checks active, date range, usage limit, min amount. applyCoupon(invoiceId, couponCode) — calculates discount, updates invoice discountAmount/discountType/couponId, recalculates total.
CONTROLLER: /coupons — CRUD for org admin. POST /invoices/:id/apply-coupon.
FRONTEND: Coupons management page (list, create, edit, deactivate). On invoice creation, "Apply Coupon" input field — type code → validate → show discount applied. Manual discount option too (percentage or fixed without coupon).
GUARD: @RequireFeature('billing.discounts')
ACCEPTANCE: Create coupon with code. Apply to invoice. Discount calculated correctly. Expired/overused coupons rejected.
- [ ] 5.6.1 Backend: coupon entity + service + controller
- [ ] 5.6.2 Frontend: coupon management page
- [ ] 5.6.3 Frontend: apply coupon on invoice creation

### 5.7 Expense Tracking
ENTITY: expenses (organizationId, locationId, category enum RENT/UTILITIES/SUPPLIES/SALARY/EQUIPMENT/MARKETING/OTHER, description, amount decimal, expenseDate, paymentMethod, referenceNumber nullable, receiptUrl nullable, recordedBy FK, notes nullable, createdAt updatedAt).
SERVICE: ExpensesService — CRUD with filters (category, dateRange, location). getMonthlySummary(orgId, locationId, month, year) — grouped by category.
CONTROLLER: /expenses — full CRUD with filters. GET /expenses/summary?month&year.
FRONTEND: Expenses list page with category filter tabs, date range picker. Create/edit expense dialog. Monthly summary card showing total by category (pie chart or bar).
GUARD: @RequireFeature('billing.expenses')
ACCEPTANCE: Can log expenses with categories. Filter by category and date. Monthly summary shows totals.
- [ ] 5.7.1 Backend: expense entity + service + controller
- [ ] 5.7.2 Frontend: expense list + create dialog
- [ ] 5.7.3 Frontend: monthly summary with chart

### 5.8 Daily/Monthly Financial Summary
SERVICE: FinancialSummaryService — getDailySummary(locationId, date): total collections today, total invoices generated, outstanding amount, payment method breakdown. getMonthlySummary(locationId, month, year): revenue, expenses, profit, top procedures by revenue, payment method distribution, invoice status distribution.
CONTROLLER: GET /financial-summary/daily?date, GET /financial-summary/monthly?month&year. Use @RequireFeature('billing.financial_summary').
FRONTEND: Financial dashboard page — today's collection stat cards, revenue vs expense trend chart (Recharts), payment method pie chart, top 5 procedures table, outstanding invoices alert.
ACCEPTANCE: Shows real data. Filters by location and date range.
- [ ] 5.8.1 Backend: summary service + controller
- [ ] 5.8.2 Frontend: financial dashboard page with charts

### 5.9 Credit / Package System
ENTITIES: credit_packages (organizationId, name, description, totalCredits decimal, price decimal, validityDays nullable, isActive). patient_credits (patientId, organizationId, creditPackageId FK, totalAmount, usedAmount default 0, remainingAmount, purchaseDate, expiryDate nullable, status ACTIVE/EXPIRED/EXHAUSTED).
SERVICE: CreditPackagesService — CRUD packages. PatientCreditsService — purchasePackage(patientId, packageId) creates patient_credit record. useCredit(patientCreditId, amount) — deducts from remaining, updates status if exhausted. Can be applied as payment method on invoice.
CONTROLLER: /credit-packages — CRUD. /patients/:id/credits — list, purchase, use.
FRONTEND: Credit packages management (admin). Patient detail → Credits tab showing active packages with balance bar. On payment recording, "Use Credit" option alongside cash/card.
GUARD: @RequireFeature('billing.credit_packages')
ACCEPTANCE: Create package. Patient buys package. Credit deducted on payment. Balance shows correctly.
- [ ] 5.9.1 Backend: entities + services
- [ ] 5.9.2 Frontend: package management + patient credit tab
- [ ] 5.9.3 Frontend: use credit as payment method

### 5.10 Payroll Export (CSV/PDF)
SERVICE: PayrollExportService — generatePayslipPdf(payrollRecordId) — individual payslip with employee info, salary breakdown, deductions, net pay. generatePayrollSummaryCsv(locationId, month, year) — all employees CSV.
CONTROLLER: GET /payroll/:id/payslip-pdf. GET /payroll/export?month&year&format=csv|pdf.
FRONTEND: "Download Payslip" button per employee in payroll table. "Export All" button with format selector (CSV/PDF) on payroll page.
ACCEPTANCE: PDF shows correct salary info. CSV downloadable with all fields.
- [ ] 5.10.1 Backend: PDF + CSV generation
- [ ] 5.10.2 Frontend: download buttons

### 5.11 Online Payment Gateway
SERVICE: PaymentGatewayService — abstract interface with implementations for JazzCash, Easypaisa, Stripe. createPaymentLink(invoiceId) → returns URL. handleWebhook(payload) → verify signature, record payment, update invoice. Config stored in LocationSettings (gateway name, API keys encrypted).
CONTROLLER: POST /invoices/:id/payment-link. POST /webhooks/payment (public endpoint).
FRONTEND: "Send Payment Link" button on invoice. Patient receives link via SMS/WhatsApp → pays → webhook confirms → invoice marked paid.
GUARD: @RequireFeature('billing.online_payments')
NOTE: Start with one gateway (JazzCash or Stripe). Others add later.
ACCEPTANCE: Payment link generated. After payment, invoice auto-updates.
- [ ] 5.11.1 Backend: gateway service (start with Stripe)
- [ ] 5.11.2 Backend: webhook handler
- [ ] 5.11.3 Frontend: send payment link button