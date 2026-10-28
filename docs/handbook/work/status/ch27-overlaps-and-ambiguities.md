| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 27 | Two prescription tables | [Partial] | Legacy table still read and written from the Clinical tab |
| 27 | Four visit concepts | [Partial] | `patient_visits` read by `GET /patients/:id/visits` but never written |
| 27 | Treatment-plan table families | [Implemented] | Naming problem only |
| 27 | Multiple audit tables | [Implemented] | Five separate histories |
| 27 | Two ledgers | [Partial] | General ledger covers lab money only |
| 27 | Two outboxes | [Implemented] | Separate purposes |
| 27 | Two sequence mechanisms (+ inventory PO numbering) | [Implemented] | PO numbering defect noted |
| 27 | services vs lab_services | [Implemented] | Naming differs |
| 27 | Uncertain logical references | [Unverified] | dentist_id, manager_id, treatmentPlanId targets |
| 27 | Missing-looking FKs | [Not implemented] | magic_links.shipment_id |
| 27 | Append-only not DB-enforced | [Partial] | Triggers on 3 tables only |
| 27 | camelCase inventory columns | [Implemented] | As is |
| 27 | Global employee phone/CNIC uniqueness | [Implemented] | By design |
| 27 | PKs without defaults | [Implemented] | By design |
| 27 | Unregistered entities (chairs, inventory) | [Not implemented] | Dev and prod schemas can differ |
