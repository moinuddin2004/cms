# Glossary — ch22-compensation

- **Compensation plan** — one dated version of how an assignment is paid: salary, commission or both (`compensation_plans`).
- **Commission rule** — a plan override for one service or one service category (`commission_rules`).
- **Commission entry** — one signed change in commission earned on one charge or lab invoice line; append-only (`commission_entries`).
- **Commission ledger** — the set of commission entries; protected by the trigger `trg_commission_entries_append_only`.
- **Settlement** — a batch of unsettled commission entries of one assignment, paid through one payroll record (`commission_settlements`).
- **Basis points (bps)** — rate unit; 10,000 bps = 100%, 4000 = 40%.
- **Commission basis** — whether the rate applies to the NET or GROSS charge amount (`compensation_plans.commission_basis`).
