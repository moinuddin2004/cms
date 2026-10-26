# Conflicts and oddities — Chapter 32 Prescriptions

## Doc vs code
- ENTITY_CATALOG.md correctly shows `prescriptions.prescription_number` as globally UNIQUE, while the entity comment says "Sequential per org". Code generates per-org numbers, so a cross-organization collision is expected when two organizations reach the same year and sequence (not tested).
- The `DoctorSignature` entity comment says `employee_id` holds the user's UUID (`req.user.uuid`); the column name suggests an employee id. `PrescriptionService.finalize` and `duplicate` pass `req.user.uuid` where an employee id is expected (`duplicate` writes it to `prescriptions.doctor_id`, an FK to `employees`).
- `prescription_history.changed_by` mixes ids: employee id (dto.doctorId) on CREATED, user id on later changes.

## Oddities (code)
- `PrescriptionHistoryService.listFor` loads relation `changedByEmployee`, which `PrescriptionHistory` does not declare, so `GET /prescriptions/:id/history` is expected to throw (not run).
- Builder "History" button navigates with `search: { tab: 'history' }`, which the route neither validates nor reads.
- `PrescriptionHistoryChangeType.PRINTED` / `SHARED` are never written.
- PDF: single `addPage`, no overflow handling; `orientation`, `showLogo` and `registrationNumber` ignored by the PDF while the web preview shows the registration number.
- `getStats` month start uses the server-local clock instead of the location timezone (ClockService rule in CLAUDE.md).
- Prescription number generation reads "latest created" without locking (race on concurrent creates); the year prefix changes but the counter does not reset.
- `GET /prescriptions` filters by active location; patient/encounter/appointment lookups do not.
- Unused web hooks: usePrescriptionHistory, useAdd/Update/RemovePrescriptionMedicine, useDuplicatePrescription, usePrescriptionsByAppointment, useDeleteMySignature, useTreatmentPlanTemplate.
- Builder medicine-row delete icon has no tooltip (project rule requires one on every icon-only button).

## Security
- The doctor-signature "by doctor" read has no organization filter. Category: missing tenant isolation on a read.
- Prescription create does not verify that the given patient / encounter / appointment belong to the caller's organization or patient scope. Category: missing tenant/scope validation on write references.
- The PDF generator fetches a client-supplied signature image URL server-side. Category: server-side request to a user-controlled URL.
- Finalized prescription PDFs are uploaded to external storage and the returned URL is stored. Category: patient documents possibly at publicly reachable URLs (verify storage access settings).
