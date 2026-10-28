| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 20 | Service catalog and location/doctor prices (`services`, `service_prices`) | [Implemented] | Partial unique indexes enforce one price per location and per doctor |
| 20 | Charges with price/discount snapshots | [Implemented] | `uq_charges_source` prevents double charging a source |
| 20 | Invoices (issue-only, revisions) | [Implemented] | Number unique per org; cached totals written by one service |
| 20 | Payments with client request id | [Implemented] | Duplicate-submit protection by unique (org, client_request_id) |
| 20 | Payment allocations (append-only) | [Implemented] | Append-only by application only; no trigger |
| 20 | Refunds and refund sources | [Implemented] | Always from advance |
| 20 | Discount types | [Implemented] | Name and code unique per org |
| 20 | Payment accounts and location billing settings | [Implemented] | Settings PK is the location id |
