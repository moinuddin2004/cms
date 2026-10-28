| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 39 | Browse stock and see stock health | [Partial] | Works; no sidebar entry |
| 39 | Add, edit and deactivate an item | [Partial] | Initial stock uses movement path (FK risk) |
| 39 | Manage categories | [Partial] | API only; no screen creates; seedDefaults never called |
| 39 | Adjust stock and keep the movement history | [Unverified] | performedBy gets user id but FK is to employees |
| 39 | Manage suppliers | [Partial] | Works; no sidebar entry |
| 39 | Raise and track a purchase order | [Unverified] | createdBy FK risk; poNumber global unique vs per-org sequence |
| 39 | Receive goods into stock | [Unverified] | Same FK risk via applyMovement |
| 39 | Define consumption templates | [Partial] | CRUD works; nothing uses templates |
| 39 | Record materials used on a patient | [Not implemented] | ConsumptionRecorder not placed on any screen |
| 39 | Daily low-stock and expiry alerts | [Partial] | 08:00 server-time cron only logs |
