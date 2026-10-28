| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 42 | Estimate and invoice lab work | [Implemented] | draft to issued, LINV numbers, frozen patient prices |
| 42 | Browse lab invoices and see one | [Implemented] | overdue computed in location timezone |
| 42 | Void estimate or unpaid invoice | [Implemented] | needs billing.invoice.void too |
| 42 | Collect lab payment | [Implemented] | Idempotency-Key required, FIFO auto-allocation |
| 42 | Use patient advance | [Implemented] | also automatic at issue |
| 42 | Reverse lab payment | [Implemented] | needs billing.refund.issue; refused after refund |
| 42 | Credit note | [Implemented] | releases newest allocations to advance |
| 42 | Refund advance | [Implemented] | needs billing.refund.issue |
| 42 | Payment reminder | [Partial] | queued to outbox, patient audience off by default, nothing delivered |
| 42 | Order and patient billing summaries | [Implemented] | read panels |
| 42 | Lab billing settings | [Implemented] | tax bp and due days; needs admin.settings.manage |
| 42 | Doctor commission on lab work | [Implemented] | collected basis net of lab cost; skipped when billing.commissions off |
| 42 | Receivables journals (GL) | [Partial] | written for all lab money, no screen or report reads them |
| 42 | Vendor bill drafts at lab accept | [Implemented] | effect create_vendor_bill_draft plus item listener |
| 42 | Review, approve, void vendor bill | [Partial] | PATCH bill and add line exist in API only |
| 42 | Pay a lab | [Implemented] | allocations over approved bills, journals |
| 42 | Use lab advance on bills | [Partial] | endpoint and api client exist, no UI button |
| 42 | Reverse lab payment | [Implemented] | mirrors journals |
| 42 | Lab statements and reconciliation | [Implemented] | manual line entry, no upload |
| 42 | Payables reports | [Implemented] | aging, monthly cost, case profit |
| 42 | Lab portal payables (read) | [Implemented] | drafts excluded |
