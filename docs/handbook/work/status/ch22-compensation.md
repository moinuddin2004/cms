| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 22 | Compensation plans (versioned, no overlap) | [Implemented] | EXCLUDE constraint with btree_gist |
| 22 | Commission rules (service / category overrides) | [Implemented] | CHECKs force exactly one target and one amount kind |
| 22 | Commission ledger (`commission_entries`) | [Implemented] | DB trigger enforces append-only; covers charges and lab invoice lines |
| 22 | Settlements through payroll | [Implemented] | PENDING → PAID with payroll; released and deleted if payroll deleted before payment |
