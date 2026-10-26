| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 28 | Register a patient | [Implemented] | Two-step dialog, phone unique per org, P-number, optional first appointment |
| 28 | Check a phone number before saving | [Partial] | Endpoint and hook exist; no component calls them |
| 28 | Browse, search and filter the patient list | [Implemented] | Card + table; UI offers only search, gender, status |
| 28 | Open the patient detail page | [Implemented] | Tabs gated by permission and feature; out-of-scope = 404 |
| 28 | Edit patient details | [Implemented] | Audited diff |
| 28 | Activate or deactivate a patient | [Implemented] | status_history row; does not block booking |
| 28 | Blacklist a patient | [Partial] | API only (PUT); displayed on Overview; blocks nothing |
| 28 | Delete a patient permanently | [Partial] | Fails (500) when billing/lab rows exist (ON DELETE RESTRICT) |
| 28 | Import patients from a spreadsheet | [Implemented] | parse → dry run → batches of 500; error report CSV |
| 28 | Export the patient list | [Implemented] | 10,000-row cap, X-Export-Truncated, audit row |
| 28 | Appointments tab | [Implemented] | Appointments + walk-in queue visits |
| 28 | Visits and clinical history | [Implemented] | GET history; prices stripped without patients.price.view |
| 28 | Per-location visit statistics | [Not implemented] | patient_visits never written; endpoint always empty |
| 28 | Patient change history | [Implemented] | admin.audit.view; values redacted per permission |
| 28 | Dental info | [Implemented] | One row per patient, upsert |
| 28 | Vitals | [Implemented] | Append-only, BMI computed |
| 28 | Teeth chart (FDI) | [Implemented] | Append-only snapshots; feature off by default |
| 28 | Record a treatment from the patient page | [Implemented] | Needs clinical.edit + price.view to see button |
| 28 | Patient treatment plans | [Partial] | Backend only (see ch33) |
| 28 | Prescriptions tab and legacy quick-Rx | [Implemented] | Legacy patient_prescriptions table still writable |
| 28 | Signed consents | [Implemented] | Signature pad, PNG data URL stored in record |
| 28 | Documents (Files tab) | [Implemented] | Upload via storage provider, then record |
| 28 | Communications log | [Partial] | CrmTab component exists but not mounted |
| 28 | Recalls | [Partial] | Backend only; no reminder job |
| 28 | Referrals | [Partial] | Backend create/list only; CrmTab unmounted |
| 28 | Feedback | [Partial] | Backend create/list only; CrmTab unmounted |
| 28 | Insurance | [Partial] | Backend only; feature off by default |
| 28 | Billing tab | [Implemented] | Embedded billing module (ch34) |
| 28 | Patient portal / CRM feature keys | [Not implemented] | Retired feature keys |
| 28 | Patient scope (own/location/org) | [Implemented] | patientScope + PatientScopeGuard |
