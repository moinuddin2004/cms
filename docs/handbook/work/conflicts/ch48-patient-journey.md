# Conflicts and oddities - Chapter 48

- OUTLINE order lists 'lab case' before 'automatic charges'. Code: charges are created at visit completion from consultation and treatments only; lab work never creates clinic charges (grep: no billing import in lab-billing, lab-finance, lab-orders). Lab work is billed by the separate lab invoice. Chapter 48 states this.
- The lab order API accepts optional appointmentId and treatmentId (lab-orders dto), but no web code in lab-orders sets them; marked Unverified.

## Security
- none at category level beyond those in chapters 28-34.
