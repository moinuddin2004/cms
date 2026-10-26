| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| Ch 18 | Appointments with no-doctor-overlap constraint | [Implemented] | GiST EXCLUDE excluding cancelled/no_show |
| Ch 18 | Queue sessions | [Implemented] | Unique per doctor/location/day; token counter |
| Ch 18 | Queue entries with partial unique invariants | [Implemented] | One active per appointment/patient; one with doctor |
| Ch 18 | Queue events | [Implemented] | Append-only by convention |
| Ch 18 | Queue policies | [Implemented] | Org default + location override; CHECK constraints |
| Ch 18 | Realtime outbox | [Implemented] | Cleanup daily 03:15 server time (7 days) |
| Ch 18 | Idempotency keys | [Implemented] | Shared by queue, labs, engine; 24 h cleanup |
| Ch 18 | Encounters | [Implemented] | One per queue entry |
| Ch 18 | Treatments performed | [Implemented] | Optional encounter and plan template links |
