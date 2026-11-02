# Billing, Invoices, Expenses, Commissions & Finance — ERD

Generated from the live TypeORM entities (schema source of truth), cross-checked with
[`backend/docs/data-model/ENTITY_CATALOG.md`](../backend/docs/data-model/ENTITY_CATALOG.md),
[`billing-feature-context.md`](billing-feature-context.md) and [`commissions.md`](commissions.md).

**Legend**

- Solid line (`||--o{`) = **enforced foreign key**.
- Dotted line (`||..o{`) = **logical reference only** (no DB constraint).
- Billing v2 tables carry `organization_id` / `location_id` as **plain tenant columns (no FK)**.
  Those tenant links are drawn only where they aid reading; the same applies to every table unless
  the note says otherwise.
- Actor columns (`created_by`, `issued_by`, `received_by`, …) are logical references to `users`;
  they are not FK-constrained.
- Money: billing v2 uses `numeric(12,2)` **rupees**; commissions, payroll and the lab module use
  `bigint` **paisa** (100 paisa = 1 rupee).

---

## 1. Billing core — charges, invoices, payments, refunds

```mermaid
erDiagram
    patients ||--o{ invoices : "is billed"
    patients ||--o{ charges : "owes"
    patients ||--o{ payments : "pays"
    patients ||--o{ refunds : "is refunded"

    invoices |o--o{ charges : "groups (null = unbilled)"
    payments ||--o{ payment_allocations : "is applied by"
    charges ||--o{ payment_allocations : "receives"
    invoices ||..o{ payment_allocations : "invoice_id copy (logical)"

    payments ||--o{ refund_sources : "advance funds"
    refunds ||--o{ refund_sources : "is funded by"
    refunds |o..o{ invoices : "invoice refund (logical)"
    payment_accounts ||--o{ payments : "receives into"
    payment_accounts |o..o{ refunds : "pays out of (logical)"
    employees |o--o{ charges : "doctor"
    invoices ||..o{ billing_audit_logs : "entity_type + id (logical)"

    invoices {
        uuid id PK
        uuid patient_id FK
        varchar invoice_number UK
        enum status "ISSUED | CANCELLED"
        numeric total_amount
        numeric balance_due
        numeric refunded_amount
    }
    charges {
        uuid id PK
        uuid patient_id FK
        uuid invoice_id FK "nullable"
        uuid doctor_id FK "nullable"
        enum source "CONSULTATION | TREATMENT | TREATMENT_PLAN | MANUAL"
        numeric net_amount
        numeric allocated_amount
        enum status "ACTIVE | VOID"
    }
    payments {
        uuid id PK
        uuid patient_id FK
        uuid payment_account_id FK
        varchar receipt_number UK
        numeric amount
        numeric allocated_amount
        numeric refunded_amount
    }
    payment_allocations {
        uuid id PK
        uuid payment_id FK
        uuid charge_id FK
        uuid invoice_id "logical copy"
        numeric amount "signed"
        enum reason
    }
    refunds {
        uuid id PK
        uuid patient_id FK
        uuid invoice_id "logical, nullable"
        varchar refund_number UK
        numeric amount
        enum method
    }
    refund_sources {
        uuid id PK
        uuid refund_id FK
        uuid payment_id FK
        numeric amount
    }
    payment_accounts {
        uuid id PK
        varchar name
        enum method
        boolean counted_in_cash_close
    }
    billing_audit_logs {
        uuid id PK
        enum entity_type
        uuid entity_id
        enum action
        jsonb before
        jsonb after
    }
    patients {
        uuid id PK
        varchar full_name
    }
    employees {
        uuid id PK
        varchar full_name
    }
```

**Meaning**

- `charges` is the **atomic billable line**. `invoice_id = NULL` means it is still unbilled.
  Price, discount and service kind are snapshots, so catalog changes never rewrite past bills.
- `invoices` has **no draft**: it is created and issued together. Stored status is only
  `ISSUED` / `CANCELLED`; `UNPAID / PARTIALLY_PAID / PAID / OVERDUE` are **computed** from amounts
  and dates, never stored.
- `payments` belongs to the **patient**, not to an invoice. The part not allocated or refunded is
  the patient's **advance**: `amount − allocated_amount − refunded_amount`.
- `payment_allocations` is append-only and signed. A positive row applies money to a charge; a
  negative row releases it back to advance. `invoice_id` is a denormalized copy for fast queries,
  not an FK.
- `refunds` is always paid **out of advance**. `refund_sources` records which payments funded it,
  and `SUM(refund_sources.amount) = refunds.amount`.
- `billing_audit_logs` is the billing-specific append-only trail. `EDITED` invoice rows hold full
  before/after snapshots used for invoice revisions.

---

## 2. Service catalog, discounts, billing settings & numbering

```mermaid
erDiagram
    organizations ||..o{ services : "owns catalog"
    services ||--o{ service_prices : "priced by"
    locations ||..o{ service_prices : "override at"
    employees |o--o{ service_prices : "doctor override"

    organizations ||..o{ discount_types : "defines"
    organizations ||..o{ payment_accounts : "has"
    locations ||..o{ payment_accounts : "at"
    organizations ||..o{ location_billing_settings : "configures"
    locations ||..o| location_billing_settings : "has one"
    organizations ||..o{ document_sequences : "counters"
    locations ||..o{ document_sequences : "per location"
    location_billing_settings |o..o| services : "default consultation"
    location_billing_settings |o..o| payment_accounts : "default account"

    services {
        uuid id PK
        varchar name
        varchar code "unique per org"
        enum kind "CONSULTATION | PROCEDURE | OTHER"
        numeric default_price
    }
    service_prices {
        uuid id PK
        uuid service_id FK
        uuid doctor_id FK "nullable"
        numeric price
    }
    discount_types {
        uuid id PK
        varchar name
        enum kind "PERCENTAGE | FIXED"
        numeric value
        boolean reception_editable
    }
    payment_accounts {
        uuid id PK
        varchar name
        enum method
        varchar bank_name
        boolean requires_reference
        boolean counted_in_cash_close
    }
    location_billing_settings {
        uuid location_id PK
        varchar document_code
        int due_days
        enum invoice_print_format
        uuid default_consultation_service_id
        uuid default_payment_account_id
    }
    document_sequences {
        uuid organization_id PK
        uuid location_id PK
        enum doc_type "INVOICE | RECEIPT | REFUND"
        int year PK
        int last_value
    }
    organizations {
        uuid id PK
        varchar name
    }
    locations {
        uuid id PK
        uuid organization_id FK
        varchar name
    }
    employees {
        uuid id PK
        varchar full_name
    }
```

**Meaning**

- `services` is the **org-level price catalog** (`consultation`, `procedure`, `other`).
  `service_prices` overrides the price per location, optionally per doctor.
- `discount_types` are owner-defined presets (percentage/fixed, min/max, which services, who may
  edit, required note). The applied discount is **snapshotted onto the charge**, so editing a preset
  never rewrites history.
- `location_billing_settings` holds the printable format, due days, document code and defaults.
  `location_id` is the PK, so it is strictly one row per location.
- `document_sequences` is the **atomic counter** behind invoice/receipt/refund numbers. Composite PK
  `(organization_id, location_id, doc_type, year)`; only touched inside a transaction.

---

## 3. Patient statement, cash close & expenses

```mermaid
erDiagram
    patients ||..o{ ledger_entries : "statement (logical)"
    invoices |o..o{ ledger_entries : "invoice row (logical)"
    payments |o..o{ ledger_entries : "payment row (logical)"
    refunds |o..o{ ledger_entries : "refund row (logical)"

    cash_closes ||--o{ cash_close_lines : "counts"
    payment_accounts |o..o{ cash_close_lines : "counted account (logical)"
    locations ||..o{ cash_closes : "closes at (logical)"

    locations ||--o{ expenses : "spends at"
    employees |o--o{ expenses : "recorded by"

    ledger_entries {
        uuid id PK
        uuid patient_id "logical"
        enum type "INVOICE_ISSUED | ... | REFUND"
        date entry_date
        numeric debit
        numeric credit
        uuid invoice_id "logical"
        uuid payment_id "logical"
        uuid refund_id "logical"
    }
    cash_closes {
        uuid id PK
        uuid location_id "logical"
        timestamptz period_start
        timestamptz period_end
        date business_date
        numeric total_expected
        numeric total_counted
        numeric total_variance
    }
    cash_close_lines {
        uuid id PK
        uuid cash_close_id FK
        uuid payment_account_id "logical"
        numeric payments_total
        numeric refunds_total
        numeric expected
        numeric counted
        numeric variance
    }
    expenses {
        uuid id PK
        uuid organization_id FK
        uuid location_id FK
        enum category
        varchar description
        numeric amount
        date expense_date
        enum payment_method
        uuid recorded_by FK "nullable"
    }
    payment_accounts {
        uuid id PK
        varchar name
        boolean counted_in_cash_close
    }
    patients {
        uuid id PK
        varchar full_name
    }
    invoices {
        uuid id PK
        varchar invoice_number
    }
    payments {
        uuid id PK
        varchar receipt_number
    }
    refunds {
        uuid id PK
        varchar refund_number
    }
    locations {
        uuid id PK
        varchar name
    }
    employees {
        uuid id PK
        varchar full_name
    }
```

**Meaning**

- `ledger_entries` is the **patient statement** (one-sided): exactly one of `debit` / `credit` is
  positive. Sign convention: `+` patient owes, `−` clinic holds advance. It is **not** double-entry.
- `cash_closes` is an immutable count of the counter since the previous close; `cash_close_lines`
  snapshots each payment account (expected, counted, variance). A close cannot be edited.
- `expenses` is the clinic's own spending (rent, utilities, supplies, salary, …), separate from
  patient money. `paid_by`/`recorded_by` is the employee who entered it. Lab-related expenses can
  carry `lab_id` / `lab_order_id` (plain columns).

---

## 4. General ledger, compensation & payroll

```mermaid
erDiagram
    employees ||--o{ employee_org_location_assignments : "works at"
    employee_org_location_assignments ||--o{ compensation_plans : "is paid by"
    compensation_plans ||--o{ commission_rules : "overrides"
    compensation_plans |o--o{ charges : "snapshotted on"
    employee_org_location_assignments ||--o{ commission_entries : "earns"
    charges |o--o{ commission_entries : "earns on"
    commission_settlements |o--o{ commission_entries : "settles"
    employees ||--o{ payroll_records : "is paid"
    locations ||--o{ payroll_records : "at"
    payroll_records |o--o| commission_settlements : "pays"

    ledger_journals ||--o{ ledger_journal_lines : "has"

    compensation_plans {
        uuid id PK
        uuid assignment_id FK
        enum type "SALARY | COMMISSION | SALARY_PLUS_COMMISSION"
        bigint base_salary_minor "nullable"
        int default_rate_bps "nullable"
        enum commission_basis "NET | GROSS"
        date effective_from
        date effective_to "null = current"
    }
    commission_rules {
        uuid id PK
        uuid plan_id FK
        uuid service_id FK "nullable"
        enum service_category "nullable"
        int rate_bps "nullable"
        bigint fixed_amount_minor "nullable"
    }
    commission_entries {
        uuid id PK
        uuid assignment_id FK
        uuid charge_id FK "nullable"
        uuid lab_invoice_line_id FK "nullable"
        enum source_type "ALLOCATION | UNAPPLY | CHARGE_ADJUST | VOID"
        bigint amount_minor "signed"
        uuid settlement_id FK "nullable"
    }
    commission_settlements {
        uuid id PK
        uuid assignment_id FK
        date period_start
        date period_end
        bigint total_minor
        enum status "PENDING | PAID"
        uuid payroll_record_id FK "nullable"
    }
    payroll_records {
        uuid id PK
        uuid employee_id FK
        uuid location_id FK
        int month
        int year
        bigint base_salary_minor
        bigint commission_minor
        bigint total_minor
        enum status "pending | paid | on_hold"
    }
    ledger_journals {
        uuid id PK
        enum source_type "VENDOR_BILL | PAYMENT | REFUND | COMMISSION | ..."
        uuid source_id "polymorphic"
        uuid reversal_of_id "nullable"
        bigint total_minor
    }
    ledger_journal_lines {
        uuid id PK
        uuid journal_id FK
        varchar account_code
        bigint debit_minor
        bigint credit_minor
    }
    employees {
        uuid id PK
        varchar full_name
    }
    employee_org_location_assignments {
        uuid id PK
        uuid employee_id FK
        uuid location_id FK
    }
    charges {
        uuid id PK
        numeric net_amount
    }
    locations {
        uuid id PK
        varchar name
    }
```

**Meaning**

- `compensation_plans` is **versioned per assignment** (employee × location), valid for
  `[effective_from, effective_to]`; a GiST exclusion constraint forbids overlap.
- `commission_rules` override one plan for one service or one service category. Resolution order:
  service rule → category rule → plan default.
- `charges` stores a **snapshot** of the plan and rate at creation. Changing a plan never changes
  past commission.
- `commission_entries` is an **append-only signed ledger**. Every change inserts only the
  difference; a trigger blocks deletes and all updates except setting `settlement_id`. An entry
  earns on **either** a clinic `charge` **or** a `lab_invoice_line` (exactly one).
- `commission_settlements` batches one assignment's unsettled entries for one payroll period.
  `payroll_records` holds `base_salary_minor + commission_minor = total_minor` and is unique per
  employee × location × month.
- `ledger_journals` + `ledger_journal_lines` are the **double-entry general ledger** (balanced,
  paisa, chart of accounts in code). This is separate from the patient statement
  `ledger_entries` in diagram 3. Journals are append-only; corrections are mirror journals via
  `reversal_of_id`. `source_type` + `source_id` are polymorphic (no FK).

---

## 5. Lab receivables — what patients owe for lab work

```mermaid
erDiagram
    patients ||--o{ lab_invoices : "is billed"
    patients ||--o{ lab_payments : "pays"
    patients ||--o{ lab_refunds : "is refunded"

    lab_orders |o--o{ lab_invoices : "billed from"
    lab_invoices ||--o{ lab_invoice_lines : "has"
    lab_order_items |o--o{ lab_invoice_lines : "billed at most once"
    lab_invoices ||--o{ lab_payment_allocations : "settled by"
    lab_payments ||--o{ lab_payment_allocations : "settles"
    lab_invoices ||--o{ lab_credit_notes : "corrected by"
    lab_credit_notes |o--o{ lab_refunds : "paid out as"
    lab_refunds ||--o{ lab_refund_sources : "funded by"
    lab_payments ||--o{ lab_refund_sources : "advance funds"

    lab_invoices {
        uuid id PK
        uuid patient_id FK
        uuid order_id FK "nullable"
        varchar invoice_no "null while draft"
        enum status "draft | issued | partially_paid | paid | void"
        bigint total_minor
        bigint paid_minor
        bigint balance_minor
    }
    lab_invoice_lines {
        uuid id PK
        uuid invoice_id FK
        int line_no
        enum line_kind "lab_item | lab_charge | manual"
        uuid lab_order_item_id FK "nullable"
        uuid doctor_id "logical"
        bigint line_total_minor
        boolean is_void
    }
    lab_payments {
        uuid id PK
        uuid patient_id FK
        varchar receipt_no UK
        bigint amount_minor "negative on reversal"
        enum method
        enum status "posted | reversed"
        bigint allocated_minor
        bigint refunded_minor
    }
    lab_payment_allocations {
        uuid id PK
        uuid payment_id FK
        uuid invoice_id FK
        bigint amount_minor
        timestamptz reversed_at "nullable"
    }
    lab_credit_notes {
        uuid id PK
        uuid invoice_id FK
        varchar credit_note_no UK
        bigint amount_minor
        enum status "issued | applied | refunded"
        bigint released_minor
    }
    lab_refunds {
        uuid id PK
        uuid patient_id FK
        uuid credit_note_id FK "nullable"
        varchar refund_no UK
        bigint amount_minor
        enum method
    }
    lab_refund_sources {
        uuid id PK
        uuid refund_id FK
        uuid payment_id FK
        bigint amount_minor
    }
    lab_orders {
        uuid id PK
        uuid patient_id
    }
    lab_order_items {
        uuid id PK
        uuid order_id FK
    }
    patients {
        uuid id PK
        varchar full_name
    }
```

**Meaning**

- The lab module has its **own** invoice/payment/refund numbering and its own money columns, all in
  **paisa**. It is separate from the clinic `invoices` / `payments` / `refunds` in diagram 1.
- A `draft` lab invoice is only an estimate: no number, editable, owes nothing. Issuing freezes it.
- `lab_payments` belongs to the patient. Unallocated + unrefunded money is the patient's advance.
  A wrong payment is never deleted — it gets a mirror row (`amount_minor < 0`, `reversal_of_id`).
- `lab_payment_allocations` is never deleted; a reversal or credit note sets `reversed_at`.
- `lab_credit_notes` correct an issued invoice downwards. Money already paid above the new total is
  released back to advance (`released_minor`) and can then be refunded.
- A lab order item can sit on **at most one non-void line** (partial unique index), so it can never
  be billed twice.
- `lab_invoice_lines.doctor_id` / `performing_assignment_id` / `commission_plan_id` are the
  commission snapshot. `commission_entries.lab_invoice_line_id` links into this realm.

---

## 6. Lab payables — what the clinic owes labs

```mermaid
erDiagram
    labs ||--o{ vendor_bills : "bills"
    labs ||--o{ vendor_payments : "is paid"
    labs ||--o{ lab_statements : "sends"

    vendor_bills ||--o{ vendor_bill_lines : "has"
    vendor_bills ||--o{ vendor_payment_allocations : "settled by"
    vendor_payments ||--o{ vendor_payment_allocations : "settles"
    lab_statements ||--o{ lab_statement_lines : "has"

    lab_orders |o..o{ vendor_bills : "one draft per order (logical)"
    lab_statements |o..o{ vendor_bills : "statement_id (logical)"
    lab_statement_lines |o..o| vendor_bill_lines : "matched line (logical)"

    vendor_bills {
        uuid id PK
        uuid lab_id FK
        uuid lab_order_id "logical, nullable"
        varchar bill_no UK
        varchar vendor_invoice_no "nullable"
        enum status "draft | approved | partially_paid | paid | void"
        bigint total_minor
        bigint paid_minor
        bigint balance_minor
    }
    vendor_bill_lines {
        uuid id PK
        uuid vendor_bill_id FK
        enum line_kind "service | rush | shipping | material | remake | other"
        uuid order_item_id "logical"
        bigint line_total_minor
        boolean is_manual
    }
    vendor_payments {
        uuid id PK
        uuid lab_id FK
        varchar payment_no UK
        bigint amount_minor
        bigint allocated_minor
        enum status "posted | reversed"
    }
    vendor_payment_allocations {
        uuid id PK
        uuid vendor_payment_id FK
        uuid vendor_bill_id FK
        bigint amount_minor
        timestamptz reversed_at "nullable"
    }
    lab_statements {
        uuid id PK
        uuid lab_id FK
        date period_start
        date period_end
        bigint total_minor
        enum status "uploaded | reconciling | reconciled | disputed"
    }
    lab_statement_lines {
        uuid id PK
        uuid statement_id FK
        bigint amount_minor
        bigint system_amount_minor "nullable"
        enum match_status
    }
    labs {
        uuid id PK
        varchar name
    }
    lab_orders {
        uuid id PK
        uuid patient_id
    }
```

**Meaning**

- A `draft` vendor bill is generated from a lab order's frozen costs. Approving it posts the
  double-entry journal (Lab Cost / Lab Payable); the `journal_id` is on the bill.
- `vendor_payments` is money paid to a lab. The unallocated rest is an **advance to the lab**.
  Mistakes are reversed, never deleted.
- `lab_statements` + `lab_statement_lines` reconcile what the lab claims against the clinic's
  bills; `match_status` says whether a line matched, mismatched or was missing on either side.

---

## 7. Prepaid credit packages (legacy, separate from advances)

```mermaid
erDiagram
    organizations ||--o{ credit_packages : "offers"
    organizations ||--o{ patient_credits : "scopes"
    patients ||--o{ patient_credits : "buys"
    credit_packages |o--o{ patient_credits : "instantiates"
    employees |o--o{ patient_credits : "sold by"

    credit_packages {
        uuid id PK
        varchar name
        numeric total_credits
        numeric price
        int validity_days
        boolean is_active
    }
    patient_credits {
        uuid id PK
        uuid patient_id FK
        uuid organization_id FK
        uuid credit_package_id FK "nullable"
        numeric total_amount
        numeric used_amount
        numeric remaining_amount
        date expiry_date
        enum status "ACTIVE | EXPIRED | EXHAUSTED"
    }
    patients {
        uuid id PK
        varchar full_name
    }
    organizations {
        uuid id PK
        varchar name
    }
    employees {
        uuid id PK
        varchar full_name
    }
```

**Meaning**

- This is the **old prepaid package** model. `patient_credits` tracks total/used/remaining and
  expiry, but it is **not connected** to invoice payments or to the patient advance in diagram 1.
  Billing v2 advances (`payments − allocations − refunds`) are the live wallet.
- `purchased_by` is an employee; `credit_package_id` is nullable so deleting a package does not
  delete sold credits.

---

## 8. Platform subscription revenue

```mermaid
erDiagram
    organizations ||--o{ subscription_payments : "pays platform"

    subscription_payments {
        uuid id PK
        uuid organization_id FK
        enum plan
        int months
        numeric amount "PKR"
        varchar method
        timestamptz paid_at
        timestamptz period_start
        timestamptz period_end
    }
    organizations {
        uuid id PK
        varchar name
        timestamptz trial_ends_at
        timestamptz paid_until
    }
```

**Meaning**

- A super admin records a clinic's subscription payment **outside** the app. Each row extends
  `organizations.paid_until`. This is platform revenue, not clinic billing — it never appears in
  clinic invoices or reports.

---

## 9. Money rules that the diagrams encode

| Rule | Where it lives |
| --- | --- |
| A charge is the atomic billable unit; `invoice_id = NULL` = unbilled | `charges` |
| Invoice money is cached by a totals service, never incremented ad hoc | `invoices.*_amount` |
| Payment status (`UNPAID/PAID/OVERDUE`) and refund status are **computed** | not stored |
| A payment belongs to the patient; overpayment becomes advance | `payments` |
| Allocations are append-only and signed; negative = release | `payment_allocations` |
| Refunds come out of advance; sources name the funding payments | `refunds`, `refund_sources` |
| Numbering is an atomic counter per org + location + type + year | `document_sequences` |
| Cash close is an immutable period count per payment account | `cash_closes`, `cash_close_lines` |
| Patient statement ≠ general ledger | `ledger_entries` vs `ledger_journals` + lines |
| Commission snapshot is taken on the charge; entries are append-only and signed | `charges.commission_*`, `commission_entries` |
| Salary + commission are settled through one payroll record | `commission_settlements` → `payroll_records` |
| Lab billing is a separate realm with its own tables and paisa columns | `lab_*` tables |
| Two money units coexist: rupees in billing v2, paisa in commission/payroll/lab | `numeric(12,2)` vs `bigint` |

---

## 10. Source files

| Area | File |
| --- | --- |
| Invoice / charge / payment | `backend/src/billing/entities/{invoice,charge,payment,payment-allocation,refund,refund-source}.entity.ts` |
| Catalog / discounts / settings | `backend/src/billing/entities/{catalog-service,service-price,discount-type,payment-account,location-billing-settings,document-sequence}.entity.ts` |
| Statement / cash close / expenses | `backend/src/billing/entities/{ledger-entry,cash-close,expense,billing-audit-log}.entity.ts` |
| General ledger | `backend/src/billing/ledger/journal/ledger-journal.entity.ts` |
| Commissions | `backend/src/billing/commissions/entities/*.entity.ts` |
| Payroll | `backend/src/payroll/entities/payroll-record.entity.ts` |
| Lab receivables | `backend/src/lab-billing/entities/{lab-invoice,lab-payment,lab-credit}.entity.ts` |
| Lab payables | `backend/src/lab-payables/entities/{vendor-bill,vendor-payment,lab-statement}.entity.ts` |
| Prepaid credits | `backend/src/billing/entities/{credit-package,patient-credit}.entity.ts` |
| Subscriptions | `backend/src/subscriptions/entities/subscription-payment.entity.ts` |
| Rules | `docs/billing-feature-context.md`, `docs/commissions.md` |
