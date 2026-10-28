| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 41 | Sign in as a lab member | [Implemented] | labMemberships in login response; lab-only users land on /lab-portal |
| 41 | Work in one lab or switch between labs | [Implemented] | x-lab-id header; LabPortalGuard |
| 41 | See the lab dashboard | [Implemented] | Three counters |
| 41 | Read the order inbox | [Implemented] | Drafts hidden; patient ref by data level |
| 41 | Open an order | [Implemented] | Lab mapper: no patient price |
| 41 | Accept an order with an expected date | [Implemented] | Lab admin; creates stages and vendor bill draft |
| 41 | Reject an order | [Implemented] | Order-level reject with reason |
| 41 | Ask the clinic a question | [Implemented] | Moves order to clarification_needed |
| 41 | Change the expected date | [Implemented] | Lab admin; reason; accepted/in progress/partially ready/on hold |
| 41 | Write a note to the clinic | [Implemented] | Notes only; no status change |
| 41 | Acknowledge a revision | [Implemented] | Idempotent |
| 41 | Ask for an extra charge | [Partial] | Backend only; no portal form |
| 41 | Upload files to an order | [Partial] | Backend only; no portal control |
| 41 | Download files the clinic shared | [Implemented] | lab_shared only; 10-minute URL |
| 41 | Run the work queue: start, QC pass, QC fail | [Implemented] | Lab admin and technician |
| 41 | Assign a technician | [Implemented] | Lab admin; unassign endpoint has no button |
| 41 | Ship a try-in or finished work to the clinic | [Implemented] | SHP number, QR slip |
| 41 | Receive what the clinic sent | [Implemented] | Portal always records full qty, condition ok |
| 41 | Report a shipment lost | [Implemented] | Open lines become missing |
| 41 | Dispute a remake request | [Implemented] | Lab admin; only requested status |
| 41 | Accept, suspend or reactivate a clinic | [Implemented] | Lab admin; shared transition code |
| 41 | Manage the lab's team | [Implemented] | Lab admin; no self change |
| 41 | View and edit the lab profile | [Implemented] | Contact fields only |
| 41 | See bills, payments and statements | [Implemented] | Read only; drafts hidden |
| 41 | Answer an order from a magic link, without logging in | [Implemented] | Accept, reject, ask; public routes; throttled |
| 41 | Open an order from the printed QR code | [Implemented] | /o/:orderId resolves lab or clinic |
| 41 | Be told about new work | [Partial] | In-app rows exist; no inbox in portal layout found |
