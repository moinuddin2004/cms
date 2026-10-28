# Conflicts — ch21-billing-ledgers-and-closing

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| `billing-audit-log.entity.ts` comment (repeated in catalog) | "The repo has no general audit module" | `audit_logs` (common) now exists and is used by ~18 modules | `common/audit/entities/audit-log.entity.ts` |
| `ledger-journal.entity.ts` (`JournalSource.EXPENSE`) | Expenses post journals | No code posts `expense` journals; clinic invoices/payments do not post either. Only `lab-finance/lab-receivables-ledger.service.ts` and `lab-payables` services call `GeneralLedgerService` | grep `JournalSource.` |

## Oddities
- No screen or report reads `ledger_journals` / `ledger_journal_lines`.
- `expenses`, `credit_packages`, `patient_credits` use `timestamp without time zone`, unlike the rest of billing.
- Credit packages: backend `credit-packages.controller.ts` exists; web hook `useCreditPackages` is not used by any page.
