# Glossary — ch18-appointments-queue-encounters.md

- **appointments** — Appointment: a booking.
- **queue_sessions** — Queue session: one doctor's queue for one service day at one location.
- **queue_entries** — Queue entry: a patient's place in a queue session.
- **queue_events** — Queue event: audit record of every queue change.
- **queue_policies** — Queue policy: organization default or location override of queue settings.
- **outbox** — Realtime outbox: messages published to socket rooms after commit.
- **idempotency_keys** — Idempotency record: saved result of a request keyed by its Idempotency-Key.
- **patient_encounters** — Encounter: the clinical record of one consultation.
- **treatments** — Treatment: work actually performed.
- **Service day** — A location-local clinic day, starting at the policy's `service_day_cutoff`.
- **Active queue entry** — An entry in status waiting, called, in_consultation, on_hold or skipped.
- **no_doctor_overlap** — The EXCLUDE constraint that stops overlapping live appointments for one doctor.
- **Transactional outbox** — The pattern of writing a message in the same transaction as the change and publishing it afterwards.
