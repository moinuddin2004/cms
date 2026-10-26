# Glossary — ch27-overlaps-and-ambiguities

- **Legacy prescription** — a prescription in the old `patient_prescriptions` table, shown as "Legacy quick-Rx history" on the patient's Clinical tab.
- **Patient visit summary** — the per-location summary row in `patient_visits`; read by the code but never written.
- **Prescription protocol template** — the handbook's name for `treatment_plan_templates`, to avoid confusion with plan templates (`plan_templates`).
- **Logical reference** — an id column with no foreign key; the database accepts ids that do not exist.
- **Polymorphic reference** — a type + id pair whose target table depends on the type column.
- **Append-only (database-enforced)** — protected by a trigger: `commission_entries`, `audit_logs`, `status_history`.
- **Append-only (application-enforced)** — promised by code comments only, e.g. `ledger_entries`, `payment_allocations`, `notification_outbox`.
