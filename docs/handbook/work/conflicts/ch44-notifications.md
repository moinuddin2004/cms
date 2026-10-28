# Conflicts and oddities — Chapter 44

- Brief says "21 seeded events (mostly lab + payment)". Code: 21 events; almost all are lab events, and the two payment events belong to lab patient invoices.
- Four events have no emitter: `order.overdue`, `shipment.dispatched`, `tryin.appointment_due`, `appointment.rescheduled_lab_delay` (search of backend/src).
- `OutboxStatus.DELIVERED` exists but nothing sets it.
- `notify` workflow effect: no shipped transition using it was found (seeded workflow data not exhaustively checked); marked Partial.
- Feature keys `comms.in_app` and `comms.whatsapp` are seeded but not referenced by notification code.
- Code comments reference a "lab ERD"; that document was not consulted.

## Security
- Category: logging. The dev-log stand-in writes message bodies and addresses to application logs; unsuitable for real patient data once patient channels are switched on.
- Category: data retention. Outbox payloads store rendered message text and recipient addresses; no retention or purge job was found.
