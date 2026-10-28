# Appendix B — Entity Index

This appendix lists all 153 database tables of the Platform, with the entity class, the owning backend module, the business purpose and the chapters that explain each table. It is for engineers and owners who meet a table name and need to find out what it is. The list was built from the generated entity catalog and checked against the data-model chapters (Chapters 12 to 27).

## B.1 How to read the index

The owning module is the backend folder whose entities directory defines the class. The chapter columns give the data-model chapter that describes the table's structure (Part 4) and the module or cross-cutting chapter that explains its behaviour. Some class names differ from the table name; for example the class `CatalogService` is the table `services`. Table names are shown exactly as in the database.

| # | Table | Entity class | Owning module | Business purpose | Data-model chapter | Behaviour chapter |
|---|---|---|---|---|---|---|
| 1 | `users` | `User` | user | One login account for the whole Platform (staff, owner, super admin, lab member). | 13 | 56 |
| 2 | `oauth_providers` | `OAuthProvider` | auth | Linked external sign-in identity; unused because OAuth is disabled. | 13 | 56 |
| 3 | `security_logs` | `SecurityLog` | auth | Write-only log of login, logout, password and session events. | 13 | 56 |
| 4 | `user_sessions` | `UserSession` | session | One signed-in device with its hashed refresh token. | 13 | 56 |
| 5 | `organization_ownership` | `OrganizationOwnership` | organizations | Links a user to an organization as its owner. | 14 | 9 |
| 6 | `organization_settings` | `OrganizationSettings` | organizations | Legacy organization-wide booking defaults and feature switches that no backend rule reads. | 14 | 9 |
| 7 | `organizations` | `Organization` | organizations | The tenant: one clinic business, with plan, trial and paid-until dates. | 14 | 9 |
| 8 | `location_settings` | `LocationSettings` | locations | Per-location booking, tax, reminder and branding settings. | 14 | 9 |
| 9 | `locations` | `Location` | locations | One branch of an organization, with time zone and currency. | 14 | 9 |
| 10 | `nav_layouts` | `NavLayout` | access | A clinic's arrangement of sidebar items. | 15 | 58 |
| 11 | `feature_catalog` | `FeatureCatalog` | feature-flags | Every feature key the Platform offers, with defaults. | 15 | 10 |
| 12 | `location_feature_overrides` | `LocationFeatureOverride` | feature-flags | Switches an enabled feature off at one location. | 15 | 10 |
| 13 | `org_feature_flags` | `OrgFeatureFlag` | feature-flags | Per-organization entitled and enabled state of each feature. | 15 | 10 |
| 14 | `config_values` | `ConfigValue` | settings-registry | Cascading settings store (platform, organization, location) with locks; holds theme values. | 14 | 58 |
| 15 | `subscription_payments` | `SubscriptionPayment` | subscriptions | Manual subscription payments recorded by a super admin. | 14 | 45 |
| 16 | `doctor_availability_overrides` | `DoctorAvailabilityOverride` | employees | One-date exceptions to a doctor's weekly schedule (not read by booking). | 16 | 37 |
| 17 | `employee_leaves` | `EmployeeLeave` | employees | Leave requests of employees (not read by booking or payroll). | 16 | 37 |
| 18 | `employee_org_location_assignments` | `EmployeeOrgLocationAssignment` | employees | An employee's job at one organization and location, with role, code and staff login. | 16 | 37 |
| 19 | `employee_schedules` | `EmployeeSchedule` | employees | Weekly working hours of an employee at a location. | 16 | 37 |
| 20 | `employees` | `Employee` | employees | The person record of a staff member, shared across organizations. | 16 | 37 |
| 21 | `employment_roles` | `EmploymentRole` | employees | System and custom roles with their permissions and home page. | 15 | 11 |
| 22 | `payroll_records` | `PayrollRecord` | payroll | One employee's pay for one month at one location. | 16 | 38 |
| 23 | `patient_communications` | `PatientCommunication` | patients | Manual log of calls and messages with a patient. | 17 | 28 |
| 24 | `patient_consents` | `PatientConsent` | patients | Signed consent forms with the signature image. | 17 | 28 |
| 25 | `patient_dental_info` | `PatientDentalInfo` | patients | One dental health and habits sheet per patient. | 17 | 28 |
| 26 | `patient_documents` | `PatientDocument` | patients | Uploaded files attached to a patient. | 17 | 28 |
| 27 | `patient_feedback` | `PatientFeedback` | patients | Patient rating and staff response (backend only). | 17 | 28 |
| 28 | `patient_insurance` | `PatientInsurance` | patients | Insurance policy details of a patient (backend only). | 17 | 28 |
| 29 | `patient_prescriptions` | `PatientPrescription` | patients | Legacy quick prescriptions kept beside the newer prescriptions module. | 17 | 32 |
| 30 | `patient_recalls` | `PatientRecall` | patients | Planned future check-ups (backend only). | 17 | 28 |
| 31 | `patient_referrals` | `PatientReferral` | patients | One patient referring another (backend only). | 17 | 28 |
| 32 | `patient_teeth_chart` | `PatientTeethChart` | patients | Append-only teeth chart snapshots in FDI notation. | 17 | 28 |
| 33 | `patient_treatment_plans` | `PatientTreatmentPlan` | patients | Planned treatment for a patient (backend only). | 17 | 33 |
| 34 | `patient_visits` | `PatientVisit` | patients | Per-location visit summary; nothing writes it. | 17 | 27 |
| 35 | `patient_vitals` | `PatientVitals` | patients | Append-only vital sign readings. | 17 | 28 |
| 36 | `patients` | `Patient` | patients | The patient record, one per patient per organization. | 17 | 28 |
| 37 | `treatment_plan_items` | `TreatmentPlanItem` | patients | One planned procedure inside a patient treatment plan. | 17 | 33 |
| 38 | `appointments` | `Appointment` | appointments | A booking: one patient, one doctor, one start time and duration. | 18 | 29 |
| 39 | `idempotency_keys` | `IdempotencyKey` | queue | Saved results of retried requests, kept 24 hours. | 18 | 61 |
| 40 | `outbox` | `OutboxMessage` | queue | Realtime messages written with a queue change and published to socket rooms. | 18 | 63 |
| 41 | `queue_entries` | `QueueEntry` | queue | A patient's place in a doctor's queue for a day. | 18 | 30 |
| 42 | `queue_events` | `QueueEvent` | queue | Audit record of every queue change. | 18 | 30 |
| 43 | `queue_policies` | `QueuePolicy` | queue | Queue settings at organization level with location overrides. | 18 | 30 |
| 44 | `queue_sessions` | `QueueSession` | queue | One doctor's queue for one clinic day at one location. | 18 | 30 |
| 45 | `patient_encounters` | `PatientEncounter` | encounters | The clinical record of one consultation, with visit notes. | 18 | 31 |
| 46 | `treatments` | `Treatment` | treatments | Work actually performed on a patient. | 18 | 31 |
| 47 | `plan_templates` | `PlanTemplate` | plan-templates | Predefined treatment plans offered when recording treatment. | 19 | 33 |
| 48 | `doctor_signatures` | `DoctorSignature` | prescriptions | A saved signature image per login, placed on prescriptions. | 19 | 32 |
| 49 | `medicine_directory` | `MedicineDirectory` | prescriptions | The clinic's list of medicines used for prescribing. | 19 | 32 |
| 50 | `prescription_history` | `PrescriptionHistory` | prescriptions | Change history with before-snapshots for prescriptions. | 19 | 32 |
| 51 | `prescription_medicines` | `PrescriptionMedicine` | prescriptions | One medicine line on a prescription. | 19 | 32 |
| 52 | `prescription_templates` | `PrescriptionTemplate` | prescriptions | Print layouts for prescriptions. | 19 | 32 |
| 53 | `prescriptions` | `Prescription` | prescriptions | A prescription with status, version and signing details. | 19 | 32 |
| 54 | `treatment_plan_template_medicines` | `TreatmentPlanTemplateMedicine` | prescriptions | One medicine line inside a prescription preset. | 19 | 32 |
| 55 | `treatment_plan_templates` | `TreatmentPlanTemplate` | prescriptions | Prescription presets (ready-made medicine sets); not treatment plans. | 19 | 32 |
| 56 | `form_schema_versions` | `FormSchemaVersion` | engine | Versioned content of a lab order form. | 26 | 43 |
| 57 | `form_schemas` | `FormSchema` | engine | Stable identity of a lab order form. | 26 | 43 |
| 58 | `organization_specialties` | `OrganizationSpecialty` | engine | Whether an organization works in a given specialty. | 26 | 43 |
| 59 | `specialties` | `Specialty` | engine | Clinical specialties the engine is configured for. | 26 | 43 |
| 60 | `stage_template_steps` | `StageTemplateStep` | engine | One try-in round inside a stage template. | 26 | 43 |
| 61 | `stage_templates` | `StageTemplate` | engine | The rounds a kind of lab work goes through. | 26 | 43 |
| 62 | `transition_effects` | `TransitionEffect` | engine | Which effects a workflow transition runs, in order. | 26 | 43 |
| 63 | `workflow_effects` | `WorkflowEffect` | engine | Registry of code handlers a transition may run. | 26 | 43 |
| 64 | `workflow_states` | `WorkflowState` | engine | States of a published workflow version. | 26 | 43 |
| 65 | `workflow_template_versions` | `WorkflowTemplateVersion` | engine | Draft, published or retired versions of a workflow. | 26 | 43 |
| 66 | `workflow_templates` | `WorkflowTemplate` | engine | State machines for lab orders, items and stages. | 26 | 43 |
| 67 | `workflow_transitions` | `WorkflowTransition` | engine | Allowed moves between workflow states. | 26 | 43 |
| 68 | `billing_audit_logs` | `BillingAuditLog` | billing | Billing's own audit trail with before and after snapshots. | 21 | 34 |
| 69 | `cash_close_lines` | `CashCloseLine` | billing | Expected, counted and variance figures per payment account in a cash close. | 21 | 34 |
| 70 | `cash_closes` | `CashClose` | billing | Immutable end-of-period count of a location's counter. | 21 | 34 |
| 71 | `charges` | `Charge` | billing | One billable line for a patient; the atomic unit of billing. | 20 | 34 |
| 72 | `commission_entries` | `CommissionEntry` | billing | Append-only signed commission earned per charge or lab invoice line. | 22 | 35 |
| 73 | `commission_rules` | `CommissionRule` | billing | Per-service or per-category overrides of a compensation plan. | 22 | 35 |
| 74 | `commission_settlements` | `CommissionSettlement` | billing | A batch of commission entries paid through one payroll record. | 22 | 35 |
| 75 | `compensation_plans` | `CompensationPlan` | billing | Dated versions of how an assignment is paid: salary, commission or both. | 22 | 35 |
| 76 | `credit_packages` | `CreditPackage` | billing | Prepaid credit offers (backend only). | 21 | 34 |
| 77 | `discount_types` | `DiscountType` | billing | Owner-defined discount presets. | 20 | 34 |
| 78 | `document_sequences` | `DocumentSequence` | billing | Per-location, per-type, per-year counters behind invoice, receipt and refund numbers. | 21 | 34 |
| 79 | `expenses` | `Expense` | billing | A clinic running cost at a location. | 21 | 34 |
| 80 | `invoices` | `Invoice` | billing | An issued document grouping a patient's charges. | 20 | 34 |
| 81 | `ledger_entries` | `LedgerEntry` | billing | One-sided per-patient statement rows. | 21 | 34 |
| 82 | `ledger_journal_lines` | `LedgerJournalLine` | billing | Debit or credit sides of general ledger journals. | 21 | 42 |
| 83 | `ledger_journals` | `LedgerJournal` | billing | Balanced double-entry postings (lab money only). | 21 | 42 |
| 84 | `location_billing_settings` | `LocationBillingSettings` | billing | Per-location billing settings, including the document code. | 20 | 34 |
| 85 | `patient_credits` | `PatientCredit` | billing | A patient's purchase of a credit package. | 21 | 34 |
| 86 | `payment_accounts` | `PaymentAccount` | billing | Ways a location receives money: cash, bank, wallet. | 20 | 34 |
| 87 | `payment_allocations` | `PaymentAllocation` | billing | Signed records of how a payment was applied to charges. | 20 | 34 |
| 88 | `payments` | `Payment` | billing | Money received from a patient. | 20 | 34 |
| 89 | `refund_sources` | `RefundSource` | billing | Which payment funded which refund. | 20 | 34 |
| 90 | `refunds` | `Refund` | billing | Money returned to a patient. | 20 | 34 |
| 91 | `service_prices` | `ServicePrice` | billing | Location or doctor price overrides for a service. | 20 | 34 |
| 92 | `services` | `CatalogService` | billing | The clinic's billable service catalog (class CatalogService). | 20 | 34 |
| 93 | `consumption_template_items` | `ConsumptionTemplateItem` | inventory | One item and default quantity in a consumption kit. | 23 | 39 |
| 94 | `consumption_templates` | `ConsumptionTemplate` | inventory | Standard kits of materials for a procedure. | 23 | 39 |
| 95 | `inventory` | `Inventory` | inventory | Legacy single-table item list; not registered by any module. | 23 | 39 |
| 96 | `inventory_categories` | `InventoryCategory` | inventory | Groupings of stock items. | 23 | 39 |
| 97 | `inventory_items` | `InventoryItem` | inventory | A stocked item at a location with current stock. | 23 | 39 |
| 98 | `patient_consumption_items` | `PatientConsumptionItem` | inventory | One item used on a patient, with price snapshot. | 23 | 39 |
| 99 | `patient_consumptions` | `PatientConsumption` | inventory | Materials used on one patient. | 23 | 39 |
| 100 | `purchase_order_items` | `PurchaseOrderItem` | inventory | One item line on a purchase order. | 23 | 39 |
| 101 | `purchase_orders` | `PurchaseOrder` | inventory | An order to one supplier for one location. | 23 | 39 |
| 102 | `stock_movements` | `StockMovement` | inventory | Signed change to an item's stock with before and after. | 23 | 39 |
| 103 | `suppliers` | `Supplier` | inventory | Vendors of stock. | 23 | 39 |
| 104 | `chairs` | `Chair` | chairs | Treatment chairs of a location; entity only. | 12 | 65 |
| 105 | `notification_audience_settings` | `NotificationAudienceSetting` | notifications | A clinic's master switch and quiet hours per audience. | 24 | 44 |
| 106 | `notification_events` | `NotificationEvent` | notifications | Platform-defined kinds of notification event. | 24 | 44 |
| 107 | `notification_outbox` | `NotificationOutbox` | notifications | One message to one recipient on one channel. | 24 | 59 |
| 108 | `notification_rules` | `NotificationRule` | notifications | A clinic's on/off switch per event, audience and channel. | 24 | 44 |
| 109 | `notification_templates` | `NotificationTemplate` | notifications | Message wording per event, channel and language. | 24 | 44 |
| 110 | `patient_comm_prefs` | `PatientCommPref` | notifications | A patient's channel opt-outs and language. | 24 | 44 |
| 111 | `user_notifications` | `UserNotification` | notifications | A user's in-app inbox rows behind the bell. | 24 | 44 |
| 112 | `lab_clinic_links` | `LabClinicLink` | labs | A clinic's connection to a lab, with status and terms. | 25 | 40 |
| 113 | `lab_members` | `LabMember` | labs | Users who work at a lab as lab admin or technician. | 25 | 41 |
| 114 | `labs` | `Lab` | labs | A dental laboratory, external or in-house. | 25 | 40 |
| 115 | `magic_links` | `MagicLink` | lab-access | No-login links for a lab to one order; token hash only. | 25 | 40 |
| 116 | `lab_service_options` | `LabServiceOption` | lab-catalog | Materials or variants of a lab service with extra cost. | 25 | 40 |
| 117 | `lab_service_prices` | `LabServicePrice` | lab-catalog | List or negotiated price windows of a lab service. | 25 | 40 |
| 118 | `lab_services` | `LabService` | lab-catalog | Products a lab makes. | 25 | 40 |
| 119 | `order_templates` | `OrderTemplate` | lab-catalog | Saved starting points for lab orders. | 25 | 40 |
| 120 | `service_categories` | `ServiceCategory` | lab-catalog | Platform-level grouping of lab services. | 25 | 40 |
| 121 | `service_mappings` | `ServiceMapping` | lab-catalog | Which lab service fulfils which clinic billing service. | 25 | 40 |
| 122 | `attachments` | `Attachment` | lab-orders | Files on a lab order or item. | 25 | 40 |
| 123 | `dental_item_details` | `DentalItemDetails` | lab-orders | Typed dental columns promoted from form answers. | 25 | 40 |
| 124 | `item_form_responses` | `ItemFormResponse` | lab-orders | An item's form answers against its pinned form version. | 25 | 40 |
| 125 | `item_teeth` | `ItemTooth` | lab-orders | The teeth an order item applies to. | 25 | 40 |
| 126 | `lab_order_items` | `LabOrderItem` | lab-orders | One piece of lab work with frozen price snapshots. | 25 | 40 |
| 127 | `lab_orders` | `LabOrder` | lab-orders | A lab case for one patient, doctor and lab. | 25 | 40 |
| 128 | `order_charge_requests` | `OrderChargeRequest` | lab-orders | Extra charges a lab asks for after submit. | 25 | 40 |
| 129 | `order_messages` | `OrderMessage` | lab-orders | Conversation between clinic and lab on an order. | 25 | 40 |
| 130 | `order_revisions` | `OrderRevision` | lab-orders | Full snapshots of what the lab was asked to make, per revision. | 25 | 40 |
| 131 | `item_assignments` | `ItemAssignment` | lab-production | Which lab technician works on an item. | 25 | 40 |
| 132 | `item_warranties` | `ItemWarranty` | lab-production | Warranty that starts at delivery. | 25 | 40 |
| 133 | `order_item_stages` | `OrderItemStage` | lab-production | One try-in round of one item stage. | 25 | 40 |
| 134 | `remake_requests` | `RemakeRequest` | lab-production | Requests to redo an item, with the responsible party. | 25 | 40 |
| 135 | `shipment_items` | `ShipmentItem` | lab-production | One item inside a shipment. | 25 | 40 |
| 136 | `shipments` | `Shipment` | lab-production | A parcel between clinic and lab with a QR token. | 25 | 40 |
| 137 | `lab_billing_settings` | `LabBillingSettings` | lab-billing | Per-organization lab tax rate and due days. | 25 | 42 |
| 138 | `lab_credit_notes` | `LabCreditNote` | lab-billing | Downward corrections of issued patient lab invoices. | 25 | 42 |
| 139 | `lab_invoice_lines` | `LabInvoiceLine` | lab-billing | Lines of a patient lab invoice with frozen prices. | 25 | 42 |
| 140 | `lab_invoices` | `LabInvoice` | lab-billing | Patient invoices for lab work; drafts are estimates. | 25 | 42 |
| 141 | `lab_payment_allocations` | `LabPaymentAllocation` | lab-billing | How lab payments were applied to lab invoices. | 25 | 42 |
| 142 | `lab_payments` | `LabPayment` | lab-billing | Money from a patient for lab work. | 25 | 42 |
| 143 | `lab_refund_sources` | `LabRefundSource` | lab-billing | Which lab payment funded which lab refund. | 25 | 42 |
| 144 | `lab_refunds` | `LabRefund` | lab-billing | Money paid back to a patient for lab work. | 25 | 42 |
| 145 | `lab_statement_lines` | `LabStatementLine` | lab-payables | Lines of a lab's monthly statement. | 25 | 42 |
| 146 | `lab_statements` | `LabStatement` | lab-payables | A lab's monthly statement reconciled against bills. | 25 | 42 |
| 147 | `vendor_bill_lines` | `VendorBillLine` | lab-payables | Lines of a bill from a lab. | 25 | 42 |
| 148 | `vendor_bills` | `VendorBill` | lab-payables | What the clinic owes a lab for an order. | 25 | 42 |
| 149 | `vendor_payment_allocations` | `VendorPaymentAllocation` | lab-payables | How payments to a lab were applied to bills. | 25 | 42 |
| 150 | `vendor_payments` | `VendorPayment` | lab-payables | Money the clinic paid a lab. | 25 | 42 |
| 151 | `audit_logs` | `AuditLog` | common | Generic append-only change history. | 26 | 60 |
| 152 | `number_sequences` | `NumberSequence` | common | Per-organization counters such as LAB-0001. | 26 | 62 |
| 153 | `status_history` | `StatusHistory` | common | Append-only log of status changes. | 26 | 60 |

The index holds 153 rows, one per table, matching the count in the entity catalog. Two tables are not registered by any Nest module (`chairs` and the legacy `inventory` table), so a development database built by the running application does not contain them, while a database built from the command-line data source does. Chapter 65 lists the tables that are never written or never read by any screen.
