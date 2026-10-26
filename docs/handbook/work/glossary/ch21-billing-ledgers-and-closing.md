# Glossary — ch21-billing-ledgers-and-closing

- **Patient statement** — the one-sided per-patient ledger of invoices, adjustments, payments and refunds (`ledger_entries`).
- **General ledger** — double-entry bookkeeping in paisa: journals and journal lines (`ledger_journals`, `ledger_journal_lines`).
- **Journal** — one balanced double-entry posting (`ledger_journals`).
- **Journal line** — one debit or credit side of a journal on one account code (`ledger_journal_lines`).
- **Account code** — a code from the fixed chart of accounts kept in code (`ACCOUNT` constant), for example CASH, LAB_PAYABLE.
- **Reversal journal** — a mirror journal that cancels an earlier one (`ledger_journals.reversal_of_id`).
- **Cash close** — an immutable end-of-period count of a location's counter (`cash_closes`).
- **Cash close line** — one payment account's expected, counted and variance figures in a cash close (`cash_close_lines`).
- **Document sequence** — the per-location, per-type, per-year counter behind invoice, receipt and refund numbers (`document_sequences`).
- **Billing audit log** — billing's own audit trail with before/after snapshots (`billing_audit_logs`).
- **Expense** — one clinic running cost at a location (`expenses`).
- **Credit package** — a prepaid credit offer of an organization (`credit_packages`).
- **Patient credit** — one patient's purchase of a credit package (`patient_credits`).
