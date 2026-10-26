# Conflicts and oddities — ch17-patients.md

## Code comment vs schema
- **`PatientsService.remove` comment** says appointments, invoices, payments, prescriptions are removed by ON DELETE CASCADE. **Schema:** `invoices.patient_id`, `charges.patient_id`, `payments.patient_id`, `refunds.patient_id` (and lab_orders/lab_invoices/lab_payments/lab_refunds) are RESTRICT. A patient with billing history cannot be deleted, and no code catches the FK error. Evidence: `billing/entities/invoice.entity.ts:44`, `charge.entity.ts:60`, `payment.entity.ts:42`; `patients/patients.service.ts` remove().
- **`plan_templates` entity comment** says using a template copies procedures into the patient's own plan. **Code:** only `treatments.plan_template_id` is written; no screen creates `patient_treatment_plans`.

## Oddities
- `patient_visits`: read endpoint `GET /patients/:id/visits` exists, `useVisits` hook is unused, and no code writes rows.
- Patient treatment plans, recalls and insurance: backend endpoints exist, web hooks exist, but no component uses them. Referrals and feedback: read-only in the UI.
- `patients` has both `is_active` and `deleted_at`.
- `dentist_id` target (employees vs users) is not stated anywhere.
- `patient_consents` immutability is not enforced by the database.
