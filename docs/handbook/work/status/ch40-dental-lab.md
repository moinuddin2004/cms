| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 40 | Keep the platform lab directory | [Implemented] | Super admin; external and in-house labs; in-house lab auto-creates its active link |
| 40 | Manage the staff of a lab | [Implemented] | Super admin adds lab members by account email; deactivate, never delete |
| 40 | Manage a lab's services, options and prices | [Implemented] | Super admin only; price windows, void, history; lab cannot edit its own catalog |
| 40 | Service categories | [Partial] | Create/update endpoints exist, no screen; six dental categories seeded |
| 40 | Add a lab to the clinic's lab list | [Implemented] | Invited link; directory shows active external and own in-house labs |
| 40 | Set payment terms and patient data level | [Implemented] | full_name or code_only per link; 0-365 days |
| 40 | Activate, suspend and reactivate a lab link | [Implemented] | Reason to suspend; only suspending side reactivates |
| 40 | Read the lab price list | [Implemented] | Negotiated else list price; margin; AnyMember reads |
| 40 | Get a price quote | [Implemented] | LabPriceResolver; quote default day is Asia/Karachi |
| 40 | Map a lab service to a clinic treatment | [Implemented] | One default per treatment; needs lab.catalog.manage |
| 40 | Save and reuse order templates | [Implemented] | Private or shared; /use endpoint not called by web |
| 40 | Create a lab order draft | [Implemented] | Optional idempotency key; pins form and workflow versions |
| 40 | Start from a template or repeat a past order | [Implemented] | from-template and repeat endpoints |
| 40 | Submit an order to the lab | [Implemented] | One transaction; Idempotency-Key required; price snapshot; revision 1; magic link |
| 40 | List and search lab orders | [Implemented] | Scoped by lab.orders.view own/location/org |
| 40 | Open an order and print the work order | [Implemented] | QR /o/:orderId; no prices on work order |
| 40 | Cancel, hold, resume or reopen an order | [Implemented] | Workflow driven; cancel from draft/submitted/accepted only |
| 40 | Revise a submitted order | [Implemented] | New revision, re-priced on original day |
| 40 | Talk to the lab: messages and clarifications | [Implemented] | Clinic replies; only lab asks |
| 40 | Decide the lab's extra charge requests | [Implemented] | Approved item charge adds to lab cost |
| 40 | Attach and download files | [Implemented] | 50 MB; 10-minute signed URL; patient_shared not surfaced |
| 40 | Send, copy and revoke magic links | [Implemented] | Hash only in DB; 24 h default TTL |
| 40 | Update on behalf of a lab that does not answer | [Implemented] | Needs lab.orders.create and lab.links.manage; via proxy |
| 40 | Follow production and try-in rounds | [Implemented] | Stages from template; rounds; record try-in; decide |
| 40 | Approve, reject or deliver finished work | [Implemented] | Delivery starts 12-month warranty |
| 40 | Cancel one item | [Partial] | Endpoint only, no screen |
| 40 | Ask for a remake and decide who pays | [Implemented] | Warranty claim auto; charges by responsible party |
| 40 | Receive a shipment and report a lost one | [Implemented] | QR token; only lab.orders.view needed |
| 40 | Send impressions and models to the lab | [Partial] | Endpoint and unused web API function |
| 40 | Notifications about lab work | [Partial] | 4 seeded events never emitted; patient/lab-contact channels dev-log only |
