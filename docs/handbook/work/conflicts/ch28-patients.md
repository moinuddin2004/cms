# Conflicts and oddities — ch28-patients.md

## Doc vs code

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| INVENTORY.md §2.3 | "Recall / feedback / referral — [Implemented] — Patients controller and CRM tab" | Backend endpoints exist, but `CrmTab` is not rendered anywhere (`PatientDetailTabs` has no CRM tab); recalls have no component at all | `web-app/src/features/patients/components/PatientDetailTabs.tsx`, `utils/patientTabs.ts`; grep for `CrmTab` finds only its own file |
| INVENTORY.md §4 (figure list) | Patient detail tabs include "recalls, referrals, insurance, CRM" | No such tabs exist | `utils/patientTabs.ts` |
| CLAUDE.md | "Soft deletes via isActive flag in most modules" | Patient DELETE is a hard delete with cascade; isActive is a separate switch | `patients.service.ts` `remove` |
| `PatientsService.remove` comment and web ConfirmDialog | "appointments, invoices, payments … are removed by the database via ON DELETE CASCADE" | `charges`, `invoices`, `payments`, `refunds`, lab orders/invoices/payments/credits reference patients with `ON DELETE RESTRICT`; the delete fails with a generic 500 | `billing/entities/*.entity.ts`, `lab-*/entities/*.entity.ts` |
| Visits tab text | "A visit is recorded when the patient checks in" | Encounters are created when the doctor starts the consultation | `encounters/entities/patient-encounter.entity.ts` header comment |
| OUTLINE.md (Patients) | "Register a patient, with a phone-duplicate check" | Server rejects duplicates at save (409); the live check endpoint and hook are unused by any component | `hooks/useCheckPhone.ts` |

## Oddities

- `generatePatientNumber`, `generatePlanNumber` and `generateRxNumber` use count + 1. Patients are hard-deleted (the `withDeleted` option only matters for soft deletes), so after a deletion the next number can equal an existing one, causing a unique-index violation (500). Concurrent creates can also collide.
- Import blocks parallel imports with an in-process Set; with several API instances two imports can run at once.
- Manual registration compares phones exactly; import compares normalised phones (`phoneKey`). Two forms of one number can both exist if entered by hand.
- `patient_visits` is never written; `GET /patients/:id/visits` always returns an empty list; `useVisits` is unused.
- The web app fills `dentistId` (teeth chart), `recordedBy` (vitals), `uploadedBy` (documents), `prescribedBy` (legacy Rx) and `witnessedBy` (consents) with the signed-in user's id, while some columns are named after employees or dentists. None have foreign keys.
- Consent `signedByType` is sent as `PATIENT`/`GUARDIAN`; the column default is lowercase `patient`.
- Export file name date and "Registered on" use UTC, not the location's timezone.
- `GET /patients/:id/documents` requires `patients.documents.manage` (no separate view permission).
- The Admin template excludes `prescriptions.create` (NOT_FOR_ADMIN), so a default Admin cannot use "New Rx" or "New Prescription".
- Card view on `/patients` has no pagination controls (current page only).
- Blacklist and inactive flags do not block booking, queueing or billing.

## Security

- Category: file storage access. Patient documents and insurance card images are stored with the external storage provider and referenced by URL; access to those URLs is not mediated by the Platform's permission checks.
- Category: upload endpoint breadth. `POST /uploads` is open to any organization member, independent of `patients.documents.manage`.
- Category: data retention. Consent signatures are stored inline as image data in the database row; worth a retention review.
