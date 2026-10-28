# Conflicts and oddities — Chapter 40 (Dental Lab, clinic side)

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| Code comment in `labs/links/lab-link-transitions.ts` | "until the portal ships every lab is activated by the clinic" | The lab portal ships; a lab admin can activate, suspend and reactivate from `/lab-portal/clinics` | `LabPortalService.transitionClinic` |
| Code comment in `lab-catalog/services/lab-services.service.ts` | "the lab portal will add its own route group" for the catalog | No portal route or screen manages a lab's catalog; super admin only | `/lab-portal/*` controllers |
| `backend/docs/data-model/ENTITY_CATALOG.md` comments and several source comments | Cite internal references ("lab ERD §10", "Sprint 6") | A reader cannot follow them; chapter text restates the behaviour instead | INVENTORY.md §2 defect 3 |
| OUTLINE (Lab clinic side) | "Item approve / reject / deliver / cancel" as screen features | Item cancel has an endpoint but no screen; clinic-to-lab shipments have an endpoint and an unused web API function | `ClinicProductionController`, `production.api.ts` |
| OUTLINE (Notifications) | Events are lab events such as `order.overdue`, `tryin.appointment_due` | Four seeded events are never emitted: `order.overdue`, `shipment.dispatched`, `tryin.appointment_due`, `appointment.rescheduled_lab_delay`; no overdue job | grep of `eventCode` and `@Cron` in `backend/src` |

## Oddities

- Seeded item workflow has a `reject` transition (pending_acceptance to rejected, lab admin) and a `rejected` state, but the lab's reject endpoints only transition the order (`rejected_by_lab`); no endpoint found calls the item-level reject. Treated as unreachable (marked unverified in the hand-back).
- After an order is rejected by the lab and reopened as a draft, its items keep status `pending_acceptance` while the order is `draft`; the draft editor then re-writes lines under a row lock. Not tested.
- The seeded order `cancel` transition has no effect that cancels items, and cancel is not offered from `in_progress`; item cancel has no screen, so stopping in-flight work from the web app is not possible.
- `estimateExpectedOn` uses the requested date when given, else submit day plus the longest default turnaround; the lab's accept date may differ and replaces it.
- Price quote endpoint defaults to the Asia/Karachi day (`CATALOG_TIMEZONE`); submit prices on the location's clinic day. These disagree around midnight for locations in other timezones.
- `POST /lab-catalog/order-templates/:id/use` exists; the web app never calls it. Use counts rise only at submit through `markUsed`.
- `LabAccessPanel` text hard-codes "expires after a day" while the lifetime is configurable by environment variable.
- `magic_links.max_uses` is never set by code, so the `used_up` state cannot occur; `receive_shipment` purpose and `shipment_id` exist with no creator.
- Shipment receive and lost need only `lab.orders.view` (no shipments permission in the catalog), so Receptionist and Assistant can receive; the workflow's `receive` roles still apply.
- Attachment visibility `patient_shared` is stored but no patient-facing reader exists.
- Order `workOrder` uses the front-end base URL environment variable with a localhost fallback; a deployment without it would print localhost QR codes.
- `clinic_admin` workflow role is derived from any `admin.*` permission (legacy mapping), and `doctor` from `consultation.conduct`; the Admin system role template removes `consultation.conduct`, so Admin acts as clinic admin, not doctor.

## Security

- Access control: lab-facing routes are public by design (token as credential); the chapter describes the design only.
- Rate limiting: the magic-link throttle is in process memory, so it is per server instance and resets on restart.
- Secrets handling: the magic-link signing secret falls back to the access-token signing secret when its own variable is missing (key reuse).
- Authorisation granularity: shipment receive and lost are open to every holder of `lab.orders.view`.
- Data exposure: patient name versus code is a per-link setting enforced in mappers; the patient number is always included.
