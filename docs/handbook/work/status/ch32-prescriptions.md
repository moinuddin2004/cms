| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 32 | Browse and filter prescriptions | [Implemented] | GET /prescriptions and /stats, location + patient scope; "this month" uses server clock |
| 32 | Write a prescription and save as draft | [Implemented] | POST /prescriptions; RX-{year}-{5 digits} per org, unique platform-wide |
| 32 | Fill from a preset | [Implemented] | Builder replaces list; workspace appends and offers advice |
| 32 | Sign (finalize) a prescription | [Implemented] | DRAFT/AMENDED only, needs a medicine; best-effort PDF upload |
| 32 | Amend a signed prescription | [Implemented] | PATCH on FINALIZED gives AMENDED, version+1, snapshot in history |
| 32 | Add/edit/remove one medicine line | [Partial] | Backend only; screens send the full list |
| 32 | Duplicate a prescription | [Partial] | Backend only; stores user id as doctor_id (FK to employees), unverified |
| 32 | Change history | [Partial] | Rows written; no viewer; read requests undeclared relation changedByEmployee |
| 32 | PDF with Urdu (Nastaliq) | [Implemented] | pdf-lib + fontkit-shaped Noto Nastaliq outlines; single page; drafts printable |
| 32 | Print layouts (prescription templates) | [Implemented] | Default per location/org; UI creates org-wide only; orientation/logo/reg no. not printed |
| 32 | Doctor signatures | [Implemented] | Keyed by user id; delete and by-doctor read have no screen |
| 32 | Medicine directory incl. search and seed | [Implemented] | Soft deactivate; seed adds 10 medicines only when empty |
| 32 | Prescription presets (treatment-plan-templates) | [Implemented] | About 40 PresetCategory values; not clinical plan templates |
| 32 | Prescriptions by patient / visit / appointment | [Partial] | By-appointment lookup has no screen |
| 32 | Legacy quick prescriptions (patient_prescriptions) | [Implemented] | Still readable/writable from patient tab; separate numbering, no link to new table |
