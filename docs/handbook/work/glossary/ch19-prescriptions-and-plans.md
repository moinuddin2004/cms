# Glossary — ch19-prescriptions-and-plans.md

- **prescriptions** — Prescription: the current prescription record.
- **prescription_medicines** — Prescription medicine line.
- **prescription_history** — Prescription change history with before-snapshots.
- **prescription_templates** — Print layout for printed prescriptions (UI: "Print layouts").
- **doctor_signatures** — Saved doctor signature; keyed by user id.
- **medicine_directory** — Medicine directory (UI: "Medicines").
- **treatment_plan_templates** — Prescription preset: a ready-made medicine set (UI: "Presets"); not a treatment plan.
- **treatment_plan_template_medicines** — Preset medicine line.
- **plan_templates** — Plan template: a predefined treatment plan (sidebar: "Treatment Plans").
- **Prescription preset** — A ready-made set of medicines and instructions that pre-fills a prescription (code name `treatment_plan_templates`).
- **Print layout** — The paper size, header, footer and styling of a printed prescription (code name `prescription_templates`).
- **Denormalized medicine line** — A medicine line that copies the directory values so it stays correct if the directory changes.
