# Conflicts and oddities — ch19-prescriptions-and-plans.md

## Code comment vs schema
- **`prescription.service.ts` generatePrescriptionNumber** is "sequential per-org" (`RX-{YYYY}-{5-digit}`), but `prescriptions.prescription_number` has a Platform-wide unique constraint (entity line 44/50). The second organization to reach a number already used elsewhere would violate the unique key. Not tested.
- The generator also reads the org's latest row by `created_at` without a lock; concurrent creates could compute the same number (inferred, not tested).
- **`plan_templates` comment** vs actual use (see ch17 conflicts).

## Oddities
- `doctor_signatures.employee_id` stores `req.user.uuid` (a user id). Unique on that column alone, so one row per user across all organizations; `getByEmployee` does not filter by organization.
- Misleading names: `treatment_plan_templates` = prescription presets; `prescription_templates` = print layouts.
- Two prescription tables with separate numbering.

## Security
- Category: tenant isolation of a user-owned asset. A saved signature row is keyed by user only and read without an organization filter, so it is shared across the organizations a user works for.
