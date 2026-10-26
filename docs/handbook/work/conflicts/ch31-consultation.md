# Conflicts and oddities — Chapter 31 Consultation

## Doc vs code
- INVENTORY.md lists "SOAP clinical notes" as [Partial]; the chapter labels a SOAP note entity / note templates [Not implemented] and the encounter text fields as implemented visit notes (per assignment brief). Same facts, different split.
- docs/appointments-and-queue.md §4.7 matches the code (encounter created at start-consultation, reused after a test).

## Oddities (code)
- `patient_encounters` has no status column; state is derived from the queue entry.
- `PATCH /encounters/:id` and `POST /encounters/:id/treatments` do not check the queue entry status; edits after completion are accepted, and treatments added after completion are never charged (sync runs only in `complete`).
- `ChargeSourcesService.handleRemoved` ("Treatment removed by doctor") has no reachable trigger: no treatment delete endpoint exists, and `syncForEncounter` runs once per completion (`completed` is terminal).
- The consultation Prescription panel is not wrapped in a permission/feature check; writes fail server-side for users without `prescriptions.create` or with `patients.prescriptions` off.
- `CreateEncounterDto` exists but no endpoint uses it (encounters are only created by the queue).
- Treatments created via `POST /treatments` without an encounter are not part of automatic charges.
- Quick-pick phrases (complaints, diagnoses, procedures) are dental-specific and hard-coded, against the neutral-branding direction for all clinic types.

## Security
- No new category-level finding in this module.
