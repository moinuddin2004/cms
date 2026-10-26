# Glossary — ch17-patients.md

- **patients** — Patient: one record per patient per organization.
- **patient_dental_info** — Dental profile (one per patient).
- **patient_teeth_chart** — Teeth chart snapshot in FDI notation.
- **patient_vitals** — Vitals reading.
- **patient_treatment_plans** — Treatment plan: planned work for a patient.
- **treatment_plan_items** — Treatment plan item: one planned procedure.
- **patient_documents** — Patient document: an uploaded file.
- **patient_consents** — Signed consent (immutable by convention).
- **patient_prescriptions** — Legacy quick prescription (see Chapter 19).
- **patient_visits** — Per-location visit summary; nothing writes it.
- **patient_communications** — Communication log entry.
- **patient_recalls** — Recall: a reminder that the patient is due back.
- **patient_referrals** — Patient referral: one patient referring another.
- **patient_feedback** — Patient feedback: a rating with optional text and staff response.
- **patient_insurance** — Insurance policy.
- **FDI notation** — The two-digit tooth numbering used as keys in `chart_data` (for example "11").
- **Permanent delete (patient)** — Hard delete of the patient row; cascading children go with it, RESTRICT children block it.
