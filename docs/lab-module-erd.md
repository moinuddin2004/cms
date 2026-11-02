# Dental Lab Module — ERD & End-to-End Flows

Generated from the live TypeORM entities (schema source of truth), cross-checked with
[`backend/docs/data-model/ENTITY_CATALOG.md`](../backend/docs/data-model/ENTITY_CATALOG.md),
[`handbook/src/part4-data-model/ch25-labs.md`](handbook/src/part4-data-model/ch25-labs.md),
[`handbook/src/part5-modules/ch42-lab-finance.md`](handbook/src/part5-modules/ch42-lab-finance.md) and
[`handbook/src/part6-workflows/ch49-dental-lab-case.md`](handbook/src/part6-workflows/ch49-dental-lab-case.md).

**Legend**

- Solid line (`||--o{`) = **enforced foreign key** (a real DB constraint).
- Dotted line (`||..o{`) = **logical reference only** (plain `uuid` column, checked in the app).
- Directories (`labs`, `lab_members`) are **platform-level**: they carry no `organization_id`.
  Everything a clinic owns is tenant-scoped by `organization_id`; lab-side rows additionally carry
  `lab_id` so every lab query can filter on it.
- Actor columns (`created_by`, `assigned_by`, `decided_by`, `requested_by`, `issued_by`, …) point at
  `users` logically, never by FK.
- Money in this module is `bigint` **paisa** (100 paisa = 1 rupee), never `numeric` rupees.
  Tax is **basis points** (`10000 bp = 100%`).
- `status_code` columns are free text because order/item/stage states are **workflow data**
  (`workflow_template_versions`), not enums. Fixed enums are only the ones documented below.

**The three realms**

| Realm | Question it answers | Tables | Section |
| --- | --- | --- | --- |
| Directory, links, access | Who is the lab, who works there, how does it reach an order? | `labs`, `lab_clinic_links`, `lab_members`, `magic_links` | §1 |
| Catalog, orders, production | What is being made, from what price, and where is it now? | 21 tables | §2–§4 |
| Lab money | What does the patient owe the clinic, and what does the clinic owe the lab? | 14 tables + ledger hooks | §5–§7 |

**Contents**

1. [Directory, links, members & magic links](#1-directory-links-members--magic-links)
2. [Catalog & pricing](#2-catalog--pricing)
3. [Orders: header, lines, item parts, records](#3-orders-header-lines-item-parts-records)
4. [Production: stages, assignments, shipments, remakes, warranties](#4-production-stages-assignments-shipments-remakes-warranties)
5. [Lab receivables (patient side)](#5-lab-receivables-patient-side)
6. [Lab payables (lab side)](#6-lab-payables-lab-side)
7. [Finance hooks: history, events, commission, ledgers](#7-finance-hooks-history-events-commission-ledgers)
8. [End-to-end flows](#8-end-to-end-flows)
9. [State machines](#9-state-machines)
10. [Invariants](#10-invariants)
11. [Known gaps](#11-known-gaps)
12. [Source index](#12-source-index)

---

## 1. Directory, links, members & magic links

```mermaid
erDiagram
    organizations |o--o{ labs : "owns internal lab"
    organizations ||--o{ lab_clinic_links : "works with"
    labs ||--o{ lab_clinic_links : "is linked to"
    labs ||--o{ lab_members : "employs"
    users ||--o{ lab_members : "works as"
    labs ||--o{ magic_links : "issued for"
    organizations ||--o{ magic_links : "issued by"
    lab_orders ||--o{ magic_links : "opens"

    labs {
        uuid id PK
        enum lab_type "external | internal"
        uuid owner_organization_id FK "nullable, internal only"
        varchar name
        varchar phone
        varchar whatsapp_phone
        varchar email
        varchar city
        enum status "active | suspended"
        int version
    }
    lab_clinic_links {
        uuid id PK
        uuid lab_id FK
        uuid organization_id FK
        enum status "invited | active | suspended"
        int payment_terms_days
        enum patient_data_level "full_name | code_only"
        timestamptz activated_at "kept across suspend"
        text notes
    }
    lab_members {
        uuid id PK
        uuid lab_id FK
        uuid user_id FK
        enum role "lab_admin | lab_technician"
        boolean is_active
    }
    magic_links {
        uuid id PK
        uuid organization_id FK
        uuid lab_id FK
        uuid order_id FK
        uuid shipment_id "logical, unused"
        char token_hash UK "sha256 only"
        char nonce "never the token"
        enum purpose "lab_view_order | lab_update_order | receive_shipment"
        enum delivery "notification | copy"
        timestamptz expires_at
        int max_uses "null = unlimited"
        int used_count
        timestamptz revoked_at
        varchar revoked_reason
    }
    organizations {
        uuid id PK
    }
    users {
        uuid id PK
    }
    lab_orders {
        uuid id PK
    }
```

**Rules encoded here**

- `labs` is the **only** platform-level directory. `CHECK chk_labs_owner` enforces
  `(lab_type = 'internal') = (owner_organization_id IS NOT NULL)`: an external lab has no owner
  clinic, an internal lab belongs to exactly one clinic organization.
- `lab_clinic_links` is the contract between one clinic and one lab — unique per
  `(lab_id, organization_id)`. It carries the **payment terms** (default 30 days → vendor-bill due
  date) and the **patient data level** the lab may see (`full_name` or `code_only`).
- A lab user is a `lab_member` of a lab and **never** a clinic member. `LabPortalGuard` resolves
  lab access from *active membership of an active lab* only; every lab query starts from `lab_id`.
- Link lifecycle is `invited → active ⇄ suspended`, reason required to suspend. Reactivation is
  restricted to the side that suspended it (platform admin excepted), so one party cannot silently
  lift the other's block.
- Magic links are order-scoped and no-login. The token is **HMAC(server secret, nonce)**; only
  `token_hash` + `nonce` are stored, so the outbox never holds a usable token. Every action through
  a link writes `status_history` with `via = magic_link`; proxy entries write `via = proxy` and
  `on_behalf_of_lab_id`.
- A link is dead (`410`) when revoked, expired, used up, its order is `completed` / `cancelled` /
  `rejected_by_lab`, or its lab is suspended. An unknown or malformed token is `404`.
  Closing an order revokes all of its links (`order_closed`).

---

## 2. Catalog & pricing

```mermaid
erDiagram
    specialties ||--o{ service_categories : "groups"
    specialties ||--o{ lab_services : "classifies"
    service_categories ||--o{ lab_services : "contains"
    labs ||--o{ lab_services : "offers"
    lab_services ||--o{ lab_service_options : "has"
    lab_services ||--o{ lab_service_prices : "priced by"
    organizations |o--o{ lab_service_prices : "negotiates"
    lab_services ||--o{ service_mappings : "is mapped"
    services ||--o{ service_mappings : "clinic treatment"
    organizations ||--o{ service_mappings : "owns"
    organizations ||--o{ order_templates : "saves"
    specialties ||--o{ order_templates : "classifies"
    labs |o--o{ order_templates : "default lab"

    lab_services {
        uuid id PK
        uuid lab_id FK
        uuid specialty_id FK
        uuid category_id FK
        varchar code "unique per lab"
        varchar name
        enum unit_type "per_tooth | per_unit | per_arch | per_case"
        int default_turnaround_days
        uuid form_schema_id FK "nullable"
        uuid workflow_template_id FK "nullable"
        uuid stage_template_id FK "nullable"
        boolean is_active
    }
    lab_service_options {
        uuid id PK
        uuid lab_service_id FK
        enum option_type "material | variant"
        varchar code "unique per service"
        varchar name
        bigint extra_cost_minor
        boolean is_active
    }
    lab_service_prices {
        uuid id PK
        uuid lab_service_id FK
        uuid organization_id FK "null = list price"
        bigint unit_price_minor
        bigint rush_surcharge_minor
        date effective_from
        date effective_to "null = open"
        timestamptz voided_at "nullable"
    }
    service_mappings {
        uuid id PK
        uuid organization_id FK
        uuid clinic_treatment_id FK "billing services.id"
        uuid lab_service_id FK
        boolean is_default
        boolean is_active
    }
    order_templates {
        uuid id PK
        uuid organization_id FK
        uuid owner_user_id "null = clinic-wide"
        uuid specialty_id FK
        uuid lab_id FK "nullable"
        varchar name
        jsonb template_json
        int use_count
        boolean is_active
    }
    service_categories {
        uuid id PK
        uuid specialty_id FK
        varchar code "CROWN, BRIDGE, DENTURE …"
        varchar name
        int sort_order
    }
    specialties {
        uuid id PK
    }
    services {
        uuid id PK
        uuid organization_id
        numeric default_price
    }
    labs {
        uuid id PK
    }
    organizations {
        uuid id PK
    }
```

**Both prices of a line are resolved on one day, from different places**

| Price | Source | Notes |
| --- | --- | --- |
| **Lab cost** (what the clinic pays the lab) | `lab_service_prices` for the day | Negotiated row (`organization_id` set) beats the lab's list row (`organization_id` null). `unit price = base + Σ option extras + rush surcharge`. |
| **Patient price** (what the patient pays the clinic) | `service_mappings` → billing `services.default_price` (+ location/doctor `service_prices` overrides) | The lab price list never leaks into the patient price. No mapping → line error `patient_price_missing`. |

- `lab_service_prices` has an **exclusion constraint** (`excl_lab_service_prices_overlap`) that
  forbids overlapping date windows for the same `(lab_service_id, organization_id)` while not
  voided. A price entered by mistake is voided, never deleted.
- `service_mappings` keeps one active mapping per `(organization, lab_service)` and at most one
  active `is_default` per `(organization, clinic_treatment)`, so a lab service is billed as exactly
  one clinic treatment per clinic.
- A service pins its behaviour by reference: `form_schema_id` (answers), `workflow_template_id`
  (item lifecycle), `stage_template_id` (try-in rounds). Copies are pinned at submit/accept, so
  editing a template never changes work already in progress.
- `order_templates` stores a doctor's saved order body. `owner_user_id = null` means clinic-wide.
  The body is validated on save and **again at submit** against the form version current then.

---

## 3. Orders: header, lines, item parts, records

```mermaid
erDiagram
    organizations ||--o{ lab_orders : "owns"
    locations ||--o{ lab_orders : "at"
    patients ||--o{ lab_orders : "for"
    employees |o--o{ lab_orders : "ordered by"
    labs ||--o{ lab_orders : "made by"
    lab_clinic_links ||--o{ lab_orders : "under contract"
    workflow_template_versions ||--o{ lab_orders : "pins"
    lab_orders ||--o{ lab_order_items : "has"
    lab_services ||--o{ lab_order_items : "service"
    form_schema_versions |o--o{ lab_order_items : "pins"
    workflow_template_versions ||--o{ lab_order_items : "pins"
    lab_order_items ||--o{ item_teeth : "teeth"
    lab_order_items ||--o| dental_item_details : "typed columns"
    lab_order_items ||--o| item_form_responses : "answers"
    lab_orders ||--o{ order_revisions : "versioned by"
    lab_orders ||--o{ order_messages : "conversation"
    lab_order_items |o--o{ order_messages : "about a line"
    lab_orders ||--o{ order_charge_requests : "extra charges"
    lab_order_items |o--o{ order_charge_requests : "line charge"
    lab_orders ||..o{ attachments : "polymorphic files"
    lab_order_items ||..o{ attachments : "polymorphic files"

    lab_orders {
        uuid id PK
        uuid organization_id FK
        uuid location_id FK
        varchar order_no "LAB-0001, null while draft"
        uuid specialty_id FK
        uuid patient_id FK
        uuid doctor_id FK "nullable until submit"
        uuid lab_id FK
        uuid lab_clinic_link_id FK
        uuid workflow_template_version_id FK "pinned at create"
        varchar status_code
        enum priority "normal | urgent"
        date requested_on
        date lab_expected_on
        int current_revision_no "0 draft, 1 submit, +1 revision"
        timestamptz submitted_at
        varchar idempotency_key
    }
    lab_order_items {
        uuid id PK
        uuid order_id FK
        int line_no "unique per order"
        uuid lab_service_id FK
        uuid clinic_treatment_id "billing services.id"
        text option_ids "array of uuids"
        boolean rush
        int quantity
        varchar service_code_snap
        varchar service_name_snap
        enum unit_type
        jsonb options_snap
        uuid lab_price_id
        bigint lab_unit_cost_minor
        bigint lab_line_cost_minor
        bigint patient_unit_price_minor
        bigint patient_line_price_minor
        date priced_on
        uuid form_schema_version_id FK "pinned"
        uuid workflow_template_version_id FK "pinned"
        uuid stage_template_id "copied"
        varchar status_code "null while draft"
        int current_stage_seq
        uuid remake_of_item_id FK "self, nullable"
    }
    item_teeth {
        uuid id PK
        uuid item_id FK
        varchar numbering_system "FDI"
        varchar tooth_code
        varchar dentition
        varchar tooth_role "nullable"
        text surfaces "array"
    }
    dental_item_details {
        uuid item_id PK
        varchar shade_system
        varchar shade
        varchar material_code
        varchar implant_system
        varchar implant_platform
        numeric implant_diameter_mm
        varchar margin_type
    }
    item_form_responses {
        uuid item_id PK
        uuid form_schema_version_id FK "pinned"
        jsonb data
        timestamptz validated_at "null while draft"
    }
    order_revisions {
        uuid id PK
        uuid order_id FK
        int revision_no "unique per order"
        jsonb snapshot
        text reason
        timestamptz lab_acknowledged_at
        uuid lab_acknowledged_by
    }
    order_messages {
        uuid id PK
        uuid order_id FK
        uuid item_id FK "nullable"
        uuid author_user_id
        enum author_side "clinic | lab"
        enum kind "note | clarification_request | reply"
        text body
        timestamptz resolved_at
    }
    order_charge_requests {
        uuid id PK
        uuid order_id FK
        uuid item_id FK "nullable = order-level"
        enum kind "rush | material | shipping | other"
        bigint amount_minor
        text reason
        enum status "pending | approved | rejected"
        uuid decided_by
        text decision_note
    }
    attachments {
        uuid id PK
        varchar entity_type "lab_order | lab_order_item"
        uuid entity_id
        uuid order_id "scoping"
        text storage_key
        varchar file_name
        varchar mime_type
        bigint size_bytes
        char sha256
        enum visibility "internal | lab_shared | patient_shared"
        enum uploaded_side "clinic | lab"
    }
```

**What the columns mean**

- `lab_orders` is a **case container**: one patient, one doctor, one lab, one contract. A draft has
  no `order_no`, `current_revision_no = 0`, and items with `status_code = null`.
- `lab_order_items` is one piece of work. The `*_snap` and `*_minor` columns are **frozen at submit**
  and may only be changed by a revision or an approved charge request
  (`snapshot-freeze.ts` rejects every other update once `status_code` is set).
- `quantity` for a `per_tooth` service is **derived from the marked teeth** (`item_teeth` count),
  not typed. For every other unit type the entered quantity stands.
- `item_teeth` is one row per tooth per line (FDI code, dentition, role, surfaces). `dental_item_details`
  is a 1:1 promotion table: the form's `promotions` map copies typed answers into columns at submit,
  so reports read columns instead of JSON.
- `item_form_responses` stores the **normalised** answers against the pinned form version.
  `validated_at` is null while the order is a draft.
- `order_revisions` is the audit of *what the lab was asked to make*: rev 1 at submit, +1 per
  revision, each with a full `snapshot` JSON. Rows are never overwritten; the lab acknowledges each.
- `order_messages` carries the clinic ↔ lab conversation. A `clarification_request` is resolved by
  the clinic's `reply` (revision), which sets `resolved_at`.
- `order_charge_requests` is the **only** way a frozen price moves besides a revision:
  - item-level approved → added to `lab_line_cost_minor` (and to the vendor bill);
  - order-level approved → a separate charge row, billed to the patient and the lab.
- `attachments` is polymorphic (`lab_order` | `lab_order_item`) with the parent checked in the app.
  Files are never deleted; downloads are short-lived signed URLs. The lab only ever sees
  `lab_shared` (and later `patient_shared` on the patient portal).

---

## 4. Production: stages, assignments, shipments, remakes, warranties

```mermaid
erDiagram
    lab_orders ||--o{ order_item_stages : "has rounds"
    lab_order_items ||--o{ order_item_stages : "one active round"
    stage_template_steps |o--o{ order_item_stages : "from template"
    workflow_template_versions ||--o{ order_item_stages : "pins"
    lab_order_items ||--o{ item_assignments : "worked on"
    lab_members ||--o{ item_assignments : "technician"
    shipments ||--o{ shipment_items : "contains"
    lab_orders ||--o{ shipment_items : "for order"
    lab_order_items ||--o{ shipment_items : "for item"
    order_item_stages |o--o{ shipment_items : "try-in round"
    lab_orders ||--o{ remake_requests : "remake in"
    lab_order_items ||--o{ remake_requests : "original"
    remake_requests |o--o| lab_order_items : "new item"
    item_warranties |o--o{ remake_requests : "warranty claim"
    lab_order_items ||--o| item_warranties : "warranty"

    order_item_stages {
        uuid id PK
        uuid order_id FK
        uuid item_id FK
        uuid lab_id "portal filter"
        uuid stage_template_step_id FK "nullable"
        uuid workflow_template_version_id FK
        int seq
        int round_no "unique per item+seq"
        varchar code_snap
        varchar name_snap
        boolean is_final
        boolean requires_patient_visit
        varchar status_code
        boolean is_active "one per item"
        date lab_expected_on
        uuid appointment_id "logical"
        enum outcome "approved | correction | rejected"
        text tryin_notes
        text correction_notes
        timestamptz started_at
    }
    item_assignments {
        uuid id PK
        uuid item_id FK
        uuid lab_member_id FK
        uuid assigned_by
        timestamptz assigned_at
        timestamptz unassigned_at "null = open"
    }
    shipments {
        uuid id PK
        uuid organization_id
        uuid lab_id
        varchar shipment_no "SHP-0001 per clinic"
        enum direction "to_lab | to_clinic"
        enum status "dispatched | partially_received | received | lost"
        varchar courier_name
        varchar tracking_no
        timestamptz dispatched_at
        timestamptz received_at
        timestamptz lost_at
        text lost_reason
        varchar qr_token UK
    }
    shipment_items {
        uuid id PK
        uuid shipment_id FK
        uuid order_id FK
        uuid order_item_id FK
        uuid item_stage_id FK "nullable, try-in"
        enum contents "impression | model | framework | tryin | final | other"
        int quantity
        int received_qty "nullable"
        enum condition "ok | damaged | missing"
        enum qc_result "pass | fail"
        text qc_notes
        timestamptz received_at
    }
    remake_requests {
        uuid id PK
        uuid order_id FK
        uuid original_item_id FK
        uuid new_item_id FK "unique"
        enum reason_code "shade | fit | fracture | design | damaged | other"
        enum responsible_party "lab | clinic | patient | undetermined"
        boolean is_warranty_claim
        uuid warranty_id "logical"
        bigint lab_charge_minor
        bigint patient_charge_minor
        enum status "requested | agreed | disputed | closed"
        text decision_note
        text dispute_note
        timestamptz decided_at
    }
    item_warranties {
        uuid id PK
        uuid item_id FK "unique"
        date starts_on
        date ends_on
        text terms
        timestamptz voided_at
        text void_reason
    }
    stage_template_steps {
        uuid id PK
        uuid stage_template_id
        int seq
        varchar code
        varchar name
        boolean requires_patient_visit
        int default_lab_days
    }
    workflow_template_versions {
        uuid id PK
    }
    lab_orders {
        uuid id PK
    }
    lab_order_items {
        uuid id PK
    }
    lab_members {
        uuid id PK
    }
```

**Stage rows are rounds, not mutable steps**

- At lab accept, `init_stages` creates **round 1** of every step of the item's stage template
  (names/codes copied to `code_snap` / `name_snap`; expected dates cumulative from
  `default_lab_days`; the final step reuses `lab_orders.lab_expected_on`).
- `UNIQUE (item_id, seq, round_no)` means a correction never edits the old round — it closes it and
  inserts `round_no + 1` for the same `seq`.
- `is_active` is set from the workflow state category on every stage transition (`active` and
  `waiting` count as active). A **partial unique index** (`uq_order_item_stages_one_active`) makes
  "one active round per item" a database fact, not a convention.
- `item_assignments` is append-only history: reassigning closes the open row (`unassigned_at`) and
  inserts a new one. The partial unique index `uq_item_assignments_open` allows one open assignment
  per item.
- A shipment is a **parcel**, not an order: it may carry items of several orders of one clinic and
  one lab, in either direction. `qr_token` is printed on the slip and opens the receive screen.
  `shipment_items.item_stage_id` ties a `to_clinic` line to the try-in round it delivers.
- `remake_requests` allows only **one open request per original item**
  (`status IN ('requested','disputed')`, partial unique). Agreeing creates a **new item** in the same
  order (`lab_order_items.remake_of_item_id`), copying the original's snapshot, options, answers,
  teeth and pinned versions. The new item starts at the item workflow's initial state, so the lab
  accepts it like new work.
- `item_warranties` is 1:1 with a delivered item: starts on the delivery day, runs `N` months
  (default 12), and ends the day before the anniversary (`warrantyEndsOn`). One row per item, voided
  rather than deleted.

---

## 5. Lab receivables (patient side)

Full money rules live in [`finance-billing-erd.md`](finance-billing-erd.md) §5; this is the lab
module's view.

```mermaid
erDiagram
    patients ||--o{ lab_invoices : "billed"
    patients ||--o{ lab_payments : "pays"
    patients ||--o{ lab_credit_notes : "credited"
    patients ||--o{ lab_refunds : "refunded"
    lab_orders |o--o{ lab_invoices : "billed from"
    lab_invoices ||--o{ lab_invoice_lines : "has"
    lab_order_items |o--o{ lab_invoice_lines : "at most one live line"
    order_charge_requests |o--o{ lab_invoice_lines : "at most one live line"
    lab_invoices ||--o{ lab_payment_allocations : "settled by"
    lab_payments ||--o{ lab_payment_allocations : "settles"
    lab_invoices ||--o{ lab_credit_notes : "corrected by"
    lab_credit_notes |o--o{ lab_refunds : "paid out as"
    lab_refunds ||--o{ lab_refund_sources : "funded by"
    lab_payments ||--o{ lab_refund_sources : "advance funds"

    lab_invoices {
        uuid id PK
        uuid organization_id
        uuid location_id
        uuid patient_id FK
        uuid order_id FK "nullable"
        varchar invoice_no "null while draft"
        enum status "draft | issued | partially_paid | paid | void"
        date issued_on
        date due_on
        bigint subtotal_minor
        bigint discount_minor
        bigint tax_minor
        bigint total_minor
        bigint credited_minor
        bigint paid_minor
        bigint balance_minor
    }
    lab_invoice_lines {
        uuid id PK
        uuid invoice_id FK
        int line_no
        enum line_kind "lab_item | lab_charge | manual"
        uuid lab_order_item_id FK "nullable"
        uuid order_charge_request_id FK "nullable"
        uuid clinic_treatment_id
        uuid doctor_id "commission input"
        varchar description
        int quantity
        bigint unit_price_minor
        bigint discount_minor
        int tax_rate_bp
        bigint tax_minor
        bigint line_total_minor
        boolean is_void
    }
    lab_payments {
        uuid id PK
        uuid patient_id FK
        varchar receipt_no "LRC-0001"
        bigint amount_minor "negative on reversal"
        enum method "cash | card | bank_transfer | wallet"
        enum status "posted | reversed"
        uuid reversal_of_id FK "unique"
        bigint allocated_minor
        bigint refunded_minor
        varchar idempotency_key
    }
    lab_payment_allocations {
        uuid id PK
        uuid payment_id FK
        uuid invoice_id FK
        bigint amount_minor
        timestamptz reversed_at
        enum release_reason "payment_reversed | credit_note"
    }
    lab_credit_notes {
        uuid id PK
        uuid invoice_id FK
        uuid patient_id
        varchar credit_note_no "LCN-0001"
        bigint amount_minor
        text reason
        enum status "issued | applied | refunded"
        bigint released_minor
        bigint refunded_minor
    }
    lab_refunds {
        uuid id PK
        uuid patient_id FK
        uuid credit_note_id FK "nullable"
        varchar refund_no "LRF-0001"
        bigint amount_minor
        enum method
        text reason
        varchar idempotency_key
    }
    lab_refund_sources {
        uuid id PK
        uuid refund_id FK
        uuid payment_id FK
        bigint amount_minor
    }
```

**Rules encoded here**

- A `draft` invoice is an **estimate**: no number, editable, owes nothing. `issued` numbers it
  (`LINV-…`), sets `issued_on`/`due_on` from `lab_billing_settings.due_days`, and freezes the lines.
- Default lines at creation are **every unbilled, billable item of the order**; `cancelled` and
  `rejected` items are never billed. An invoice can also add approved charge requests and manual
  lines.
- An item or a charge request can sit on **at most one non-void line** (partial unique indexes), so
  nothing is billed twice; voiding the invoice frees it.
- `lab_payments` belongs to the **patient**, not an invoice. Unallocated + unrefunded money is the
  patient's advance. A wrong payment is never deleted — a mirror row (`amount < 0`,
  `reversal_of_id`) is created, at most one per payment.
- Allocations are never deleted: a reversal or credit note sets `reversed_at` and a
  `release_reason`. Advance application uses the **oldest payment first**.
- A credit note lowers an issued invoice; paid money above the new total is released from the
  newest allocations back to advance (`released_minor`) and can then be refunded. A refund is always
  paid **out of advance**, with `lab_refund_sources` naming the funding payments.
- Cached totals (`paid_minor`, `credited_minor`, `balance_minor`, `status`) are written **only** by
  `LabBillingTotals`, recomputed from source rows, never incremented by hand.

---

## 6. Lab payables (lab side)

```mermaid
erDiagram
    labs ||--o{ vendor_bills : "billed by"
    labs ||--o{ vendor_payments : "paid to"
    labs ||--o{ lab_statements : "statements from"
    vendor_bills ||--o{ vendor_bill_lines : "has"
    vendor_bills ||--o{ vendor_payment_allocations : "settled by"
    vendor_payments ||--o{ vendor_payment_allocations : "settles"
    lab_statements ||--o{ lab_statement_lines : "has"
    lab_statements |o--o{ vendor_bills : "reconciled against"

    vendor_bills {
        uuid id PK
        uuid organization_id
        uuid location_id
        uuid lab_id FK
        uuid lab_order_id "logical, nullable"
        varchar bill_no "VB-0001"
        varchar vendor_invoice_no "unique per lab"
        uuid statement_id "logical"
        enum status "draft | approved | partially_paid | paid | void"
        date bill_date
        date due_on
        bigint subtotal_minor
        int tax_bp
        bigint tax_minor
        bigint total_minor
        bigint paid_minor
        bigint balance_minor
        uuid journal_id
    }
    vendor_bill_lines {
        uuid id PK
        uuid vendor_bill_id FK
        enum line_kind "service | rush | shipping | material | remake | other"
        uuid lab_order_id
        uuid order_item_id
        uuid charge_request_id
        uuid remake_request_id
        varchar description
        int quantity
        bigint unit_cost_minor
        bigint line_total_minor
        boolean is_manual
    }
    vendor_payments {
        uuid id PK
        uuid organization_id
        uuid location_id
        uuid lab_id FK
        varchar payment_no "VP-0001"
        bigint amount_minor
        bigint allocated_minor
        enum method "cash | bank_transfer | cheque | other"
        date paid_on
        enum status "posted | reversed"
        timestamptz reversed_at
        text reversal_reason
    }
    vendor_payment_allocations {
        uuid id PK
        uuid vendor_payment_id FK
        uuid vendor_bill_id FK
        bigint amount_minor
        timestamptz reversed_at
    }
    lab_statements {
        uuid id PK
        uuid organization_id
        uuid lab_id FK
        date period_start
        date period_end
        varchar statement_ref
        bigint total_minor
        uuid attachment_id "unused, no upload yet"
        enum status "uploaded | reconciling | reconciled | disputed"
    }
    lab_statement_lines {
        uuid id PK
        uuid statement_id FK
        varchar lab_reference "bill no | lab invoice no | order no"
        date line_date
        varchar description
        bigint amount_minor "0 on system rows"
        bigint system_amount_minor
        uuid matched_bill_id
        uuid matched_bill_line_id
        enum match_status "matched | amount_mismatch | missing_in_system | missing_in_statement"
    }
    labs {
        uuid id PK
    }
```

**Rules encoded here**

- **One open draft per order** (`uq_vendor_bills_order_draft`). Every lab accept re-syncs it
  idempotently, and approval re-syncs once more in its own transaction. The draft holds every
  **accepted** item at its frozen `lab_line_cost_minor` (approved item charges included), plus
  approved **order-level** charges.
- Draft planning is incremental: `approved bills + draft = what the order says`. A cost that rose
  after approval (a later approved charge) lands on a **new draft as the difference**; a zero cost
  (lab-fault remake) is listed for the record but never opens a draft; a cost that fell is left to a
  manual credit note.
- Only accepted items are billed: acceptance is detected from `status_history` (`to_state =
  'accepted'`), which survives later state changes and pre-dates the effect.
- Line kinds mirror the cost: `service`, `rush`, `shipping`, `material`, `remake`, `other`.
  `is_manual` lines are preserved across re-syncs.
- `bill_date` is the draft day; `due_on` defaults to `bill_date + lab_clinic_links.payment_terms_days`
  (fallback 30). `tax_bp` is basis points of the subtotal, default 0.
- Approval freezes the lines and posts **Dr LAB_COST / Cr LAB_PAYABLE**. Voiding is refused once
  `paid_minor > 0`; an allowed void posts the mirror journal.
- A vendor payment settles approved / partially paid bills through allocations that never exceed
  the payment or a bill's balance. Journals: **Dr LAB_PAYABLE** (allocated) + **Dr LAB_ADVANCES**
  (unallocated rest) / **Cr CASH|BANK**. Reversal mirrors the journals, reverses the allocations and
  sets `reversed_at`; nothing is deleted.
- Statement reconciliation is reference + amount based: the reference (normalised upper-case) is
  matched against `vendor_invoice_no`, then `bill_no`, else an `order_no` whose bills are summed.
  Each bill is used once. Exact amount → `matched`; different → `amount_mismatch`; unknown reference
  → `missing_in_system`. Unclaimed period bills are added as `missing_in_statement` rows.
  The period is non-void bills with `bill_date` in range and `total_minor > 0`.

---

## 7. Finance hooks: history, events, commission, ledgers

```mermaid
erDiagram
    status_history }o..|| lab_orders : "entity_type = order"
    status_history }o..|| lab_order_items : "entity_type = item"
    status_history }o..|| order_item_stages : "entity_type = stage"
    lab_invoice_lines |o..o{ commission_entries : "source (lab_invoice_line_id)"
    commission_plans |o..o{ lab_invoice_lines : "snapshot at issue"
    employee_org_location_assignment |o..o{ lab_invoice_lines : "snapshot at issue"
    commission_entries }o..|| ledger_journals : "commission journal"
    lab_invoices |o..o{ ledger_journals : "source_type = lab invoice"
    lab_payments |o..o{ ledger_journals : "source_type = lab payment"
    lab_credit_notes |o..o{ ledger_journals : "source_type = credit note"
    lab_refunds |o..o{ ledger_journals : "source_type = refund"
    vendor_bills |o..o{ ledger_journals : "source_type = vendor bill"
    vendor_payments |o..o{ ledger_journals : "source_type = vendor payment"
    ledger_journals ||--o{ ledger_journal_lines : "balanced lines"

    status_history {
        uuid id PK
        uuid organization_id
        varchar entity_type "order | item | stage | lab_invoice …"
        uuid entity_id
        varchar from_state "null on create"
        varchar to_state
        varchar action_code
        text reason
        uuid actor_user_id
        enum actor_side "clinic | lab | system | platform"
        enum via "app | portal | magic_link | proxy | qr | system"
        uuid on_behalf_of_lab_id
        jsonb metadata
    }
    commission_entries {
        uuid id PK
        uuid organization_id
        uuid location_id
        uuid assignment_id
        uuid lab_invoice_line_id "instead of charge_id"
        enum source_type "ALLOCATION | UNAPPLY | CHARGE_ADJUST | VOID | MANUAL"
        uuid source_id
        bigint base_minor
        int rate_bps
        bigint amount_minor "signed"
    }
    ledger_journals {
        uuid id PK
        uuid organization_id
        uuid location_id
        date entry_on
        enum source_type
        uuid source_id
        text memo
        uuid reversed_by_id
    }
    ledger_journal_lines {
        uuid id PK
        uuid journal_id FK
        varchar account_code
        bigint debit_minor
        bigint credit_minor
        uuid patient_id
        uuid doctor_id
        uuid lab_order_id
    }
    lab_invoices {
        uuid id PK
    }
    lab_payments {
        uuid id PK
    }
    lab_credit_notes {
        uuid id PK
    }
    lab_refunds {
        uuid id PK
    }
    vendor_bills {
        uuid id PK
    }
    vendor_payments {
        uuid id PK
    }
    commission_plans {
        uuid id PK
    }
    employee_org_location_assignment {
        uuid id PK
    }
```

**How the glue behaves**

- `status_history` is **append-only** (UPDATE/DELETE rejected by trigger). States are free text
  because workflows are data. It is the source of truth for "was this item ever accepted?" and for
  every audit trail shown to either side.
- Lab billing emits domain events (`invoiceIssued`, `invoiceVoided`, `paymentCollected`,
  `advanceApplied`, `paymentReversed`, `creditNoteIssued`, `refundPaid`) inside the same
  transaction. `LabFinanceListeners` turns them into commission entries and journals, so money and
  books cannot diverge.

| Operation | Journal |
| --- | --- |
| Issue invoice | Dr PATIENT_RECEIVABLE (total) · Cr LAB_REVENUE (total − tax) · Cr TAX_PAYABLE (tax) |
| Collect payment | Dr CASH/BANK (amount) · Cr PATIENT_RECEIVABLE (allocated) · Cr PATIENT_ADVANCES (rest) |
| Apply advance | Dr PATIENT_ADVANCES · Cr PATIENT_RECEIVABLE (per funding payment) |
| Reverse payment | Dr PATIENT_RECEIVABLE (released) + Dr PATIENT_ADVANCES (rest) · Cr CASH/BANK |
| Credit note | Dr LAB_REVENUE (net) + Dr TAX_PAYABLE (tax) · Cr PATIENT_RECEIVABLE; released money: Dr PATIENT_RECEIVABLE / Cr PATIENT_ADVANCES |
| Refund | Dr PATIENT_ADVANCES · Cr CASH/BANK |
| Approve vendor bill | Dr LAB_COST · Cr LAB_PAYABLE |
| Pay vendor | Dr LAB_PAYABLE (allocated) + Dr LAB_ADVANCES (rest) · Cr CASH/BANK |
| Commission | Dr COMMISSION_EXPENSE / Cr COMMISSION_PAYABLE (negative delta mirrors) |

- Commission is snapshotted **at issue** per line: the doctor's assignment at the invoice's
  location, the compensation plan in force on the issue date, and the resolved rate or fixed amount.
  Nothing is snapshotted while the `billing.commissions` feature is off.
- Lab allocations are per invoice, not per line. A line's collected share is proportional to its
  pre-tax amount:
  `lineCollected = round(preTax × min(allocated, total − credited) / total)`.
  Entries are the **signed difference to a cumulative target**, so installments never drift and a
  reversal or credit note takes commission back automatically.
- `lab-finance` writes standard ledger journals (`source_type` + `source_id`), so months, trial
  balances and doctor settlements pick lab work up without a separate book.

---

## 8. End-to-end flows

### 8.0 The happy path at a glance

```mermaid
sequenceDiagram
    autonumber
    participant C as Clinic staff
    participant E as Workflow engine
    participant L as Lab (portal / magic link)
    participant P as Production
    participant B as Billing
    participant Pt as Patient

    C->>E: submit draft (one transaction)
    E->>E: snapshot prices, answers, teeth, revision 1
    E-->>L: outbox order.submitted + magic link
    L->>E: accept with lab_expected_on
    E->>P: init_stages (round 1)
    E->>B: vendor bill draft (accepted items)
    L->>P: start / assign technician
    P->>E: stage dispatch (try-in) → item send_tryin
    L->>C: shipment arrives (partial / missing / lost)
    C->>P: record try-in, approve or request correction
    P->>P: next stage, or round_no + 1
    L->>P: finish → QC → ready
    P->>E: dispatch final → item dispatched
    C->>P: receive → approve → deliver
    P->>P: warranty starts
    C->>B: issue lab invoice → collect / advance
    B-->>Pt: receipt, credit note, refund
    C->>B: approve vendor bill → pay lab
```

### 8.1 Draft → submit (clinic)

1. **Draft** (`POST` draft, `Idempotency-Key`): creates `lab_orders` in `draft` and its
   `lab_order_items`. The order's `workflow_template_version_id` is pinned now; items keep
   `status_code = null` and no prices. A repeated key returns the same draft
   (`uq_lab_orders_org_idempotency`).
2. **Line entry**: each line points at a `lab_services` row of the chosen lab, carries option ids,
   `rush`, quantity and the form answers. Teeth are charted in the form (`tooth_chart` answers).
3. **Submit** — one transaction:
   - validates the idempotency key, re-reads the locked draft;
   - validates every answer against the **pinned** `form_schema_version`;
   - derives `quantity` from teeth for `per_tooth` services (`teeth_required` otherwise);
   - resolves **both** prices on the submit day (lab cost from `lab_service_prices`, patient price
     from the mapped clinic treatment), and refuses a line whose service belongs to another lab;
   - writes the snapshot columns, `item_teeth`, `dental_item_details` (promotions) and
     `item_form_responses` (normalised answers, `validated_at`);
   - transitions `draft → submitted`, assigns `LAB-xxxx`, sets `current_revision_no = 1`,
     estimates `lab_expected_on` (requested day, else submit day + longest turnaround);
   - writes `order_revisions` rev 1 (full snapshot), item `status_history` rows, flips the template's
     `use_count`, and enqueues `order.submitted` (lab recipients only) in the outbox;
   - creates a magic link when the lab has a phone/WhatsApp/email;
   - completes the idempotency record. Any failure rolls all of it back.
4. **Warnings** do not block submit: `LAB_DUE_AFTER_NEXT_APPOINTMENT` when the estimated return is
   after the patient's next appointment.

### 8.2 Lab receives the order: accept / clarify / reject

| Action | Who | Effect |
| --- | --- | --- |
| **Accept** | `lab_admin` | Requires a future `lab_expected_on`. Writes it on the order, accepts every `pending_acceptance` line, derives the order to `accepted`, notifies the doctor. |
| **Clarify** | `lab_admin` | Optional `item_id`; writes an `order_messages` row (`clarification_request`) and transitions the order to `clarification_needed`. The clinic's reply is a revision. |
| **Reject** | `lab_admin` | Requires a reason; `submitted → rejected_by_lab`. The clinic can `reopen → draft` and fix it. |

Accept is the **fan-out point**: each accepted item triggers `init_stages` (round 1 of its stage
template) and the vendor-bill draft sync. Both run from the item-transition listener, so they also
happen for old workflow versions that never listed the effect; both are idempotent.

### 8.3 Revisions and charge requests

**Revision** (`revise`): allowed while the order is `submitted`, `accepted`, `in_progress`,
`partially_ready`, `ready`, `partially_received`, `under_review` or `clarification_needed`.

- Changes answers/options/rush/quantity per line, re-validates the form, re-derives teeth/quantity,
  and **re-prices on the original `priced_on` day** (not today) so a later price-list change cannot
  silently re-price existing work.
- Re-applies approved item charges on top of the re-priced line, bumps `current_revision_no`,
  writes a new `order_revisions` snapshot, and — if the order was `clarification_needed` — resolves
  the open clarifications and transitions `reply → submitted`.
- Never overwrites the previous revision.

**Charge request** (`requestCharge`, lab side): `kind` (rush/material/shipping/other), amount, reason,
optional `item_id`.

- Clinic `decideCharge` (needs `lab.orders.create`): approve or reject with a note. Approved
  **item-level** charge → `lab_line_cost_minor += amount` (a controlled snapshot write), so it flows
  into the vendor bill. Approved **order-level** charge stays a separate row and is billed to the
  patient as `lab_charge` and to the lab as a bill line.
- Charges are idempotent by state: a decided charge cannot be decided again.

### 8.4 Production: start → technician → stages → try-in loop → finish → QC → ready

1. **Start** (`lab` staff): `accepted → in_production`. Stages are created if missing and round 1
   starts (`ensureActiveStage`), with `started_at` set.
2. **Assign** a technician: closes the open `item_assignments` row (if any) and inserts a new one.
   One open assignment per item is a partial unique index.
3. **Try-in round** (only when the stage template has more than one step):
   - lab dispatches the round (`stage: at_lab → sent_to_clinic`, item `send_tryin`);
   - clinic receives (`stage: sent_to_clinic → received`, item `received`/`waiting`);
   - clinic records the visit (`record_tryin`) with an optional appointment;
   - doctor **approves** → stage `approved`; if it was not the final step, the item goes `resume`
     (`in_production`) and the listener starts the next stage; if it was the final step, the item is
     approved directly;
   - doctor **requests correction** → stage `correction` with `outcome = correction` and notes; a new
     round (`round_no + 1`) is inserted and the item goes back to production. Corrections are
     refused on the final stage — final work is approved or rejected (remake).
4. **Finish** (`finish`): `in_production → qc`. **QC fail** (reason required) → back to
   `in_production`; **QC pass** → `ready`. Final work must be `ready` before it can ship.
5. Item without stages (single-step service): no `order_item_stages` at all; it goes straight from
   `in_production` to `qc` to `ready`.

### 8.5 Shipments: dispatch → receive (partial / missing / lost)

**Dispatch** (`to_clinic` = lab ships, `to_lab` = clinic ships):

- Builds one `shipments` row (`SHP-xxxx`, `qr_token`) with lines across orders of one clinic + lab.
- `to_clinic` planning is driven by the **active stage**:
  - non-final round at the lab → contents `tryin`, item `send_tryin`, stage `dispatch`;
  - final round → item must be `ready` (QC passed) → item `dispatch`, stage `dispatch`;
  - item without stages → only `ready` may ship;
  - work whose earlier shipment was lost/missing may ship again without a status change.
- `to_lab` lines record impressions/models/work returning for a correction; they do not move item
  status.

**Receive** (only the receiving side; QR or app):

- Per line: `received_qty`, `condition`, `qc_result`, notes. `missing` closes the line with
  `received_qty = 0`; a received `to_clinic` line drives stage `receive` and item `receive`.
- Lines left out stay open → shipment becomes `partially_received`. All lines closed → `received`.
- **Lost** marks every open line `missing`, sets `lost_at`/`lost_reason`, status `lost`, and leaves
  the work owed: the item/stage is not advanced, so the lab can remake and ship again.

### 8.6 Approve → deliver → warranty

1. Doctor **approves** received work. With stages this is the final stage's `approve`; an item
   without stages is approved directly. `received → approved`.
2. **Deliver** (`approved → delivered`), the doctor confirms the fit. The item listener starts the
   warranty: `starts_on = delivery day`, `ends_on = day before the N-month anniversary`, default
   12 months, one row per item.
3. Order status derives to `completed` when **all** items are approved/delivered (a manual hold on
   the order wins while it is on).

### 8.7 Remake decision and responsibility pricing

- **Trigger**: doctor rejects received final work (`reject_work`, reason required) → item
  `remake_required`, final round closes as `rejected`, a `remake_requests` row opens. Or, after
  delivery, `requestRemake` (after-care: a fracture months later) leaves the item `delivered` but
  opens a request.
- **Warranty check**: an active warranty on the decision day sets `is_warranty_claim = true` and
  `warranty_id`. `disputed` is allowed (the lab disagrees) and still counts as open.
- **Decision** (`decideRemake`, one transaction, pessimistic lock + version):
  - `close` → status `closed`, no new item;
  - `agree` → status `agreed`, responsibility set, **new item** created with
    `remake_of_item_id`, copying the original's snapshot/answers/teeth/details, line number
    `max + 1`, at the workflow's initial state; the order is re-derived with `reopen` (a completed
    order reopens), and the lab is notified.

| `responsible_party` | Lab charge | Patient charge |
| --- | --- | --- |
| `lab` (lab's fault) | 0 | 0 |
| `clinic` | frozen lab cost | 0 |
| `patient` | frozen lab cost | frozen patient price |
| `undetermined` | not agreed yet | not agreed yet |

The new item is then accepted/billed like any other, and the vendor-bill draft includes it with the
responsibility's cost (a lab-fault remake is a 0 line, kept for the record).

### 8.8 Patient billing: draft → issue → pay/advance → credit → refund

1. **Create draft** from an order (or a patient): default lines = every unbilled billable item at
   its frozen patient price (teeth in the description); approved charge requests and manual lines
   can be added. Tax rate comes from `lab_billing_settings.tax_rate_bp` (or the request).
2. **Edit draft** freely (lines are replaced; the estimate is not a posted record). Only a draft can
   be edited.
3. **Issue** (`draft → issued`): requires ≥1 line; assigns `LINV-xxxx`, sets `issued_on`/`due_on`,
   recomputes totals, snapshots commission per line, and optionally **applies the patient's
   advance** (oldest payment first) — which may leave it `partially_paid` or `paid` immediately.
   Journal: Dr Patient Receivable / Cr Lab Revenue + Tax Payable.
4. **Collect** (`POST` payment with idempotency key): `LRC-xxxx`, method, optional allocations to
   invoices. Allocations ≤ payment and ≤ each invoice's balance; unallocated rest is advance.
   Journal: Dr Cash/Bank / Cr Receivable (allocated) + Cr Patient Advances (rest).
5. **Reverse a wrong payment**: mirror row (`LRV-xxxx`, negative amount, `reversal_of_id`), releases
   its allocations back to advance and mirrors the journal. Never deletes.
6. **Credit note** (`LCN-xxxx`): lowers an issued invoice (not `void`). Tax is apportioned from the
   invoice's tax. Paid money above the new total is released from the **newest** allocations to
   advance (`released_minor`), then the note is `issued`, `applied` or `refunded`.
7. **Refund** (`LRF-xxxx`): pays out of advance only, with `lab_refund_sources` naming each funding
   payment; optional `credit_note_id` makes it the note's payout.
8. **Void** an issued invoice only when it has **no payments and no credits**; its lines are marked
   `is_void`, which frees the items/charges for another invoice, and the issue journal is reversed.

### 8.9 Vendor bill: draft → approve → pay → reverse

1. **Draft** is created/synced at lab accept (and before approval) from accepted items' frozen lab
   costs + approved order-level charges. Repeated syncs only insert/update the delta; manual lines
   survive.
2. **Review** the draft: add/remove manual lines, set `vendor_invoice_no`, `tax_bp`, `due_on`
   (default `bill_date + payment_terms_days`). A 0-total bill cannot be approved — void it instead.
3. **Approve**: re-syncs once in its own transaction, recomputes totals, freezes the lines, sets
   `approved_by/at` and posts Dr LAB_COST / Cr LAB_PAYABLE. One journal per bill (`journal_id`).
4. **Pay**: `VP-xxxx` with method/date, allocations to approved/partially paid bills. Dr LAB_PAYABLE
   (allocated) + Dr LAB_ADVANCES (rest) / Cr Cash/Bank. Bill `paid_minor`/`balance_minor` and status
   (`partially_paid`/`paid`) are recomputed in the allocation's transaction.
5. **Reverse a payment**: mirrors the journals, reverses every allocation, sets `reversed_at`; bills
   return to their previous balance and an unallocated rest is no longer an advance.
6. **Void a bill**: refused if `paid_minor > 0`; otherwise posts the mirror of the approval journal
   and marks the bill `void` (never deleted).

### 8.10 Statement reconciliation

1. Accountant creates a statement for a lab and period (`uploaded` conceptually; no file upload yet).
2. Each statement line carries the lab's reference and amount. The reconciler normalises references
   and matches: `vendor_invoice_no` → `bill_no` → `order_no` (sum of that order's bills).
3. Each bill is claimed once. Result per line: `matched`, `amount_mismatch` (system amount differs),
   or `missing_in_system` (no such bill). Period bills no line claimed become
   `missing_in_statement` rows with `amount = 0` and `system_amount`.
4. Status: all lines matched and nothing missing → `reconciled`; otherwise `reconciling`.
   The accountant can set `reconciled` or `disputed` with a note (`setStatus`).
5. Matched bills get `statement_id`, so a later statement can see what was already reconciled.

### 8.11 Commission and ledger posting

- **At issue**: each non-void line with a doctor snapshots assignment, plan, rate (or fixed amount).
  A line with no doctor or no plan earns nothing.
- **On every money event** (`collect`, `applyAdvance`, `reverse`, `credit note`, `void`): the
  listener recomputes each line's collected share and writes `target − already` into
  `commission_entries` (signed). Cumulative target means partial payments, reversals and credit
  notes self-correct without manual adjustment.
- **Basis**: `net_of_lab_cost` uses the line's lab cost — an approved vendor-bill line's cost, else
  the item's frozen `lab_unit_cost_minor`; an order-level charge has no lab cost.
- **Journal**: positive delta Dr Commission Expense / Cr Commission Payable; negative mirrors.
  Settlement/payroll reads the same entries as billing v2.
- **Receivables ledger**: the seven lab billing events post the journals in §7, so lab revenue, tax,
  patient receivables/advances and cash all land in the standard `ledger_journals` /
  `ledger_journal_lines` pair with patient/doctor/order tags.

---

## 9. State machines

### 9.1 Order — manual transitions plus derivation from items

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> submitted : submit (clinic, doctor)
    submitted --> clarification_needed : request_clarification (lab_admin)
    clarification_needed --> submitted : reply / revision (clinic)
    submitted --> rejected_by_lab : reject (lab_admin)
    rejected_by_lab --> draft : reopen (clinic)
    draft --> cancelled : cancel
    submitted --> cancelled : cancel
    accepted --> cancelled : cancel
    submitted --> accepted : derive (all items accepted)
    accepted --> in_progress : derive (any item in work)
    in_progress --> partially_ready : derive (some ready)
    partially_ready --> ready : derive (all ready/dispatched)
    in_progress --> ready : derive
    ready --> partially_received : derive (some received)
    partially_received --> under_review : derive (all received or later)
    ready --> under_review : derive
    under_review --> in_progress : derive (correction / remake reopens work)
    under_review --> completed : derive (all approved/delivered)
    in_progress --> on_hold : hold (clinic)
    on_hold --> in_progress : resume (recompute)
    completed --> [*]
    cancelled --> [*]
```

`deriveOrderStatus` order of precedence: all items cancelled → `cancelled`; manual hold →
`on_hold`; all finished → `completed`; all received+ → `under_review`; any received+ →
`partially_received`; all ready/dispatched → `ready`; any ready → `partially_ready`; any in work →
`in_progress`; all accepted → `accepted`; else `submitted`. `draft`, `clarification_needed`,
`rejected_by_lab`, `cancelled` are **not** derivable — only manual transitions set them.

### 9.2 Item lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending_acceptance : submit
    pending_acceptance --> accepted : accept (lab_admin, expected date)
    pending_acceptance --> rejected : reject (lab_admin)
    accepted --> in_production : start (lab staff)
    in_production --> at_clinic_tryin : send_tryin (system, try-in shipment)
    at_clinic_tryin --> in_production : resume (system)
    in_production --> qc : finish (lab staff)
    qc --> in_production : qc_fail (reason)
    qc --> ready : qc_pass
    ready --> dispatched : dispatch (system, final shipment)
    dispatched --> received : receive (clinic)
    received --> approved : approve (doctor)
    received --> remake_required : reject_work (doctor, reason)
    approved --> delivered : deliver (doctor)
    accepted --> cancelled : cancel (doctor)
    in_production --> cancelled : cancel (doctor)
    delivered --> [*]
    remake_required --> [*]
    cancelled --> [*]
    rejected --> [*]
```

### 9.3 Stage round (one try-in step)

```mermaid
stateDiagram-v2
    [*] --> pending : init_stages (round 1)
    pending --> at_lab : start
    at_lab --> sent_to_clinic : dispatch (lab / system)
    sent_to_clinic --> received : receive (clinic)
    received --> tryin_done : record_tryin (doctor)
    tryin_done --> approved : approve (doctor)
    tryin_done --> correction : request_correction (doctor, notes)
    approved --> [*] : next stage starts
    correction --> [*] : round_no + 1 starts
```

A correction closes the round; the same `seq` reopens as `round_no + 1`. The final stage cannot be
"corrected" — it is approved or the item is rejected into a remake.

### 9.4 Shipment

```mermaid
stateDiagram-v2
    [*] --> dispatched : dispatch
    dispatched --> partially_received : receive some lines
    partially_received --> received : receive the rest
    dispatched --> received : receive all
    dispatched --> lost : mark lost
    partially_received --> lost : mark lost
    received --> [*]
    lost --> [*]
```

Open lines of a lost shipment become `condition = missing`; the work stays owed and can ship again.

### 9.5 Lab invoice

```mermaid
stateDiagram-v2
    [*] --> draft : create / estimate
    draft --> issued : issue (number, dates, advance)
    issued --> partially_paid : allocation
    issued --> paid : allocations cover total
    partially_paid --> paid : final allocation
    paid --> partially_paid : allocation reversed / credit note
    issued --> void : void (no money)
    draft --> [*] : discarded estimate
    paid --> [*]
    void --> [*]
```

Status is a cached projection written by `LabBillingTotals`; `void` requires no payments and no
credits.

### 9.6 Vendor bill

```mermaid
stateDiagram-v2
    [*] --> draft : accept / re-sync
    draft --> approved : approve (journal)
    approved --> partially_paid : allocation
    approved --> paid : allocation covers total
    partially_paid --> paid : final allocation
    paid --> partially_paid : payment reversed
    draft --> void : void 0-total draft
    approved --> void : void (paid = 0)
    paid --> [*]
    void --> [*]
```

### 9.7 Remake request

```mermaid
stateDiagram-v2
    [*] --> requested : reject work / after-care
    requested --> agreed : clinic agrees (new item)
    requested --> disputed : lab disputes
    disputed --> agreed : clinic agrees
    disputed --> closed : clinic closes
    requested --> closed : clinic closes
    agreed --> [*]
    closed --> [*]
```

One open request (`requested`/`disputed`) per original item. `agreed` creates the replacement item.

### 9.8 Lab link and magic link

```mermaid
stateDiagram-v2
    [*] --> invited : clinic adds lab
    invited --> active : activate
    invited --> suspended : suspend (reason)
    active --> suspended : suspend (reason)
    suspended --> active : reactivate by suspending side
    active --> [*]
```

```mermaid
stateDiagram-v2
    [*] --> active : issue
    active --> expired : expires_at passes
    active --> used_up : max_uses reached
    active --> revoked : clinic revokes
    active --> revoked : order closed / lab suspended
    expired --> [*]
    used_up --> [*]
    revoked --> [*]
```

---

## 10. Invariants

| # | Invariant | Enforced by |
| --- | --- | --- |
| 1 | An external lab has no owner; an internal lab has exactly one. | `chk_labs_owner` |
| 2 | One link per clinic + lab. | `uq_lab_clinic_links_lab_org` |
| 3 | A submitted item's snapshot/price columns only change through a revision or an approved charge. | `SnapshotFreezeSubscriber` (app-level; no triggers in this repo) |
| 4 | Revision numbers are unique per order and never overwritten. | `uq_order_revisions_no` |
| 5 | One active stage round per item. | Partial unique `uq_order_item_stages_one_active` |
| 6 | Stage rounds are unique per `(item, seq, round_no)`. | `uq_order_item_stages_round` |
| 7 | One open technician assignment per item. | Partial unique `uq_item_assignments_open` |
| 8 | One open remake request per original item. | Partial unique `uq_remake_requests_open` |
| 9 | One remake item per request. | `uq_remake_requests_new_item` |
| 10 | One warranty per item. | `uq_item_warranties_item` |
| 11 | An item/charge is on at most one non-void invoice line. | Partial uniques `uq_lab_invoice_lines_item` / `_charge` |
| 12 | The same payment key never creates a second payment. | `uq_lab_payments_org_idempotency` |
| 13 | Allocations ≤ payment; each ≤ invoice balance. | CHECK + locked allocation service |
| 14 | A payment has at most one reversal. | `uq_lab_payments_reversal_of` |
| 15 | One open draft vendor bill per order. | Partial unique `uq_vendor_bills_order_draft` |
| 16 | A bill total is `subtotal + tax`; balances never negative. | `chk_vendor_bills_minor` |
| 17 | Payment allocations ≤ payment and ≤ bill. | CHECK + `lockBills` |
| 18 | One active mapping per lab service, one default per treatment. | Partial uniques on `service_mappings` |
| 19 | Price windows never overlap for the same service + clinic. | `excl_lab_service_prices_overlap` |
| 20 | `status_history` is append-only. | DB trigger |
| 21 | Lab money is integer paisa; tax is basis points. | `MinorColumn`, CHECK constraints |
| 22 | Every status change goes through the workflow engine. | Services call `transitionIn`; state columns are not written directly |

---

## 11. Known gaps

- **No statement file upload.** `lab_statements.attachment_id` exists but nothing writes it;
  statements are entered line by line (`attachment_id` is unused).
- **`receive_shipment` magic-link purpose is unused.** The enum value and `magic_links.shipment_id`
  exist for a future shipment link; receiving today uses the QR token on the shipment slip.
- **Payables are partly API-only.** Manual bill edits and explicit `allocate` of an existing vendor
  payment have no admin UI yet (the services exist).
- **Overdue notifications are seeded but not emitted.** The notification catalogue has overdue-order
  entries; no scheduler reads `lab_expected_on` to send them.
- **Lab journals are not in reports.** `lab-finance` posts standard journals, but no report screen
  aggregates lab revenue/payables by lab yet.
- **Snapshot freeze is app-level.** There are no migration files/triggers for frozen item columns, so
  a direct SQL update can bypass it (unlike `status_history`, which has a trigger).
- **`vendor_bills.lab_order_id` and `statement_id` are plain uuids** (no FK), and `shipments` has no
  FK to `labs`/`organizations`; integrity is maintained by the services, not the database.
- **Lab commission depends on the `billing.commissions` feature flag**; with it off, lines are
  snapshotted as "no commission" and a later enable does not backfill them.

---

## 12. Source index

| Concern | Files |
| --- | --- |
| Lab directory, links, members, portal guard | `backend/src/labs/**` (`entities/lab.entity.ts`, `entities/lab-clinic-link.entity.ts`, `entities/lab-member.entity.ts`, `links/*`, `portal/*`, `members/*`) |
| Catalog & pricing | `backend/src/lab-catalog/**` (`entities/*`, `pricing/lab-price-resolver.service.ts`) |
| Orders, drafts, submit, revisions | `backend/src/lab-orders/**` (`entities/*`, `services/order-drafts.service.ts`, `services/order-submit.service.ts`, `services/lab-orders.service.ts`, `snapshot/snapshot-freeze.ts`, `submit/order-lines.ts`) |
| Order status derivation | `backend/src/engine/workflows/order-status.ts` |
| Workflow seeds (states/transitions/roles) | `backend/src/engine/seeds/dental-workflows.seed.ts` |
| Production, stages, assignments | `backend/src/lab-production/workflow/production-workflow.service.ts`, `services/lab-work.service.ts` |
| Try-in, approve, deliver, remake | `backend/src/lab-production/services/clinic-production.service.ts` |
| Shipments | `backend/src/lab-production/services/shipments.service.ts` |
| Access actions & magic links | `backend/src/lab-access/**` (`actions/lab-order-actions.service.ts`, `magic-links/*`, `controllers/*`) |
| Patient receivables | `backend/src/lab-billing/**` (`entities/*`, `services/*`, `events/lab-billing-events.ts`) |
| Lab payables & statements | `backend/src/lab-payables/**` (`entities/*`, `services/*`, `common/payables-math.ts`) |
| Commission & ledger | `backend/src/lab-finance/**` (`lab-commission.service.ts`, `lab-receivables-ledger.service.ts`, `lab-commission-math.ts`) |
| Handbooks | `docs/handbook/src/part4-data-model/ch25-labs.md`, `part5-modules/ch42-lab-finance.md`, `part6-workflows/ch49-dental-lab-case.md` |
| Field-level reference | `backend/docs/data-model/ENTITY_CATALOG.md` |
