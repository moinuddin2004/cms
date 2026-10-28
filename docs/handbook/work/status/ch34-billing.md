| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 34 | Keep a service catalog | [Implemented] | Org-level services, audited, never deleted |
| 34 | Set location and doctor price overrides | [Implemented] | PATCH override and resolved-price endpoints unused by UI |
| 34 | Automatic charges from a completed consultation | [Implemented] | syncForEncounter in queue completion tx; removed treatment → VOID or Review |
| 34 | Add a manual charge | [Implemented] | Catalog or Other; price policy enforced |
| 34 | Create charges from a treatment plan | [Partial] | Backend only, no web call |
| 34 | Edit an unbilled charge (price policy) | [Implemented] | Catalog price needs billing.price.override |
| 34 | Void an unbilled charge | [Implemented] | Reason 5–300 chars |
| 34 | Manage discount types | [Implemented] | Code field not on screen |
| 34 | Discount one / many / custom | [Implemented] | Range via AccessContext.decide; custom needs note |
| 34 | Ready-to-bill list and billing desk | [Implemented] | Outstanding omits partly paid invoices |
| 34 | Collect a payment | [Implemented] | One tx, lock order, idempotent clientRequestId |
| 34 | Choose an allocation strategy | [Implemented] | Oldest first (FIFO) and Manual |
| 34 | Hold and apply advance | [Implemented] | Advance = amount − allocated − refunded |
| 34 | Unapply a payment | [Partial] | Backend only |
| 34 | Payment accounts and methods | [Implemented] | Auto Cash default; default/last account cannot be deactivated |
| 34 | Number invoices, receipts and refunds | [Implemented] | CODE-INV/REC/RFD-YYYY-NNNNN, gapless |
| 34 | Issue an invoice | [Implemented] | At collection/advance apply or manual; due days default 7 |
| 34 | Exclusive sales tax | [Implemented] | Snapshot of location_settings.tax_rate |
| 34 | Browse invoices and payment status | [Implemented] | Stored ISSUED/CANCELLED; computed payment status |
| 34 | Edit an issued invoice | [Implemented] | Preview in rolled-back tx; revision conflict check |
| 34 | Cancel an invoice | [Implemented] | Only when nothing paid; unapply has no UI |
| 34 | Refunds | [Implemented] | Always from advance; invoice refund may carry an edit |
| 34 | Patient billing summary and statement | [Implemented] | Ledger-based statement |
| 34 | Show dues at check-in | [Implemented] | Setting enforced only in web app |
| 34 | Daily collection | [Implemented] | Payments page |
| 34 | Cash close | [Implemented] | Advisory lock; immutable; variance flag |
| 34 | Printing | [Implemented] | Browser print A4/80 mm; English labels, Urdu typed text |
| 34 | Billing settings | [Implemented] | Document code locks after first number |
| 34 | Expenses | [Implemented] | Edit API-only; no delete confirm; hard delete |
| 34 | Credit packages and patient credits | [Partial] | Backend only; expiry cron 01:00 server date |
| 34 | Billing activity / audit log | [Implemented] | User/action filters not on screen |
| 34 | Nightly invariant check | [Implemented] | 02:30 server time, I1–I10, log only |
| 34 | Doctor revenue and financial summary | [Implemented] | Daily summary unused; details in Ch 36 |
| 34 | Commission snapshot on charges | [Implemented] | Cross-reference to Ch 35 |
