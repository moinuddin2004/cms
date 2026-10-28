# Conflicts: ch60-audit-logging

## Doc vs code
- The rollout plan names appointments, staff, payroll and organizations as later phases; code confirms none is written.
- A comment in the billing audit entity says no general audit module exists; one now exists and billing keeps its own table.
## Oddities
- `view_sensitive` action is defined but never written.
- billing_audit_logs, queue_events and prescription_history are append-only by convention; no trigger found in migration files.
## Security
- Audit coverage gaps for personnel and payroll data; no retention policy.
