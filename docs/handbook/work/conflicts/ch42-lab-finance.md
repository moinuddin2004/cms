# Conflicts and oddities: Chapter 42

- Statement status enum has `uploaded` (column default) but create writes only `reconciled` or `reconciling`; `uploaded` is unused.
- `lab-billing.controller` doc comment says refund/reversal need billing keys; matches code (`billing.refund.issue`, `billing.invoice.void`).
- Lab invoice list is not location-scoped; permissions have no scope.
- Backend `PATCH /lab-payables/bills/:id`, `POST bills/:id/lines`, `POST payments/:id/allocations` have API client functions but no UI use.
- GL journals (`ledger_journals`) for lab money are not read by any screen or the P&L report.
- Unverified: whether a printable lab invoice or receipt exists.

## Security
- Money-moving endpoints rely on idempotency keys and row locks; vendor payment idempotency key is optional (category: replay protection inconsistency).
- Lab-billing reads are organization-scoped, not location-scoped (category: tenant granularity).
