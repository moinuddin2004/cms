| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 25 | Lab directory, lab links, lab members | [Implemented] | Labs are cross-tenant; members have no clinic membership |
| 25 | Magic links for orders | [Implemented] | Token hash only stored |
| 25 | Magic links for shipments (`receive_shipment`, `shipment_id`) | [Not implemented] | Enum value and column exist; no code creates them; FK never added |
| 25 | Lab catalog, options, price windows, mappings, order templates | [Implemented] | EXCLUDE constraint prevents overlapping price windows |
| 25 | Lab orders, items, teeth, details, form answers, messages, revisions, charge requests, attachments | [Implemented] | Snapshots frozen at submit; versions pinned |
| 25 | Production: stages, assignments, shipments, remakes, warranties | [Implemented] | Partial unique indexes: one active stage, one open assignment, one open remake |
| 25 | Patient lab invoices, payments, allocations, credit notes, refunds | [Implemented] | Paisa; posts general-ledger journals |
| 25 | Vendor bills, vendor payments, lab statements | [Implemented] | Draft bill per order at lab accept |
| 25 | Lab statement file upload (`attachment_id`) | [Not implemented] | No storage for statement files |
