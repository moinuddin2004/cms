| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| Ch 17 | Patient record | [Implemented] | patient_number unique per organization; phone not unique |
| Ch 17 | Dental profile | [Implemented] | One per patient |
| Ch 17 | Teeth chart | [Implemented] | FDI JSON chart |
| Ch 17 | Vitals | [Implemented] |  |
| Ch 17 | Patient treatment plans and items | [Partial] | Backend endpoints; billing reads; no web screen calls create/update |
| Ch 17 | Documents | [Implemented] | deleted_at soft delete |
| Ch 17 | Consents | [Implemented] | Immutable only by convention |
| Ch 17 | Legacy quick prescriptions | [Implemented] | Legacy section of Clinical tab |
| Ch 17 | Per-location visit summary (patient_visits) | [Partial] | Read endpoint only; nothing writes rows; no screen calls it |
| Ch 17 | Communication log | [Implemented] | Staff-written log; nothing sends messages |
| Ch 17 | Recalls | [Partial] | Backend endpoints only; no screen calls them |
| Ch 17 | Referrals | [Partial] | Screen lists; no screen creates |
| Ch 17 | Feedback | [Partial] | Screen lists; no screen creates |
| Ch 17 | Insurance | [Partial] | Backend endpoints only; no screen calls them |
| Ch 17 | Permanent patient delete | [Partial] | Cascades clinical rows; blocked by RESTRICT billing/lab FKs (service comment claims cascade) |
