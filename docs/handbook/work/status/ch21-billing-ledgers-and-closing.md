| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 21 | Patient statement (`ledger_entries`) | [Implemented] | Append-only by application only |
| 21 | Cash close and lines | [Implemented] | Unique period end per location |
| 21 | Document numbering (`document_sequences`) | [Implemented] | Per location/type/year; needs a document code |
| 21 | Billing audit log | [Implemented] | Separate from generic `audit_logs`; no trigger |
| 21 | General ledger (`ledger_journals`, lines) | [Partial] | Posted only for lab money; no screen or report reads it; `expense` source never posted |
| 21 | Expenses | [Implemented] | Optional lab case cost links without FK |
| 21 | Credit packages and patient credits | [Partial] | Backend only; no page; not a payment method |
