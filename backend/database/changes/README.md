# Change scripts

One file per schema change for databases that already exist:
`YYYY-MM-DD_short-description.sql`, run in date order. See `../README.md`
("Changing the schema later"). Every change here must also be reflected in
`../schema/` and in the entity.

## Scripts so far

| File | What |
|---|---|
| `2026-11-06_users-avatar-key.sql` | `users.avatar_key` (profile photo storage key) |
| `2026-11-08_desktop_auth_handoffs.sql` | `desktop_auth_handoffs` (desktop Google sign-in one-time codes) |
| `2026-11-08_prescriptions-number-per-clinic.sql` | Prescription number unique per clinic, not globally |
| `2026-11-11_push_devices.sql` | `user_devices` (staff Expo push tokens), push channel and `skipped_no_device` status on the notification outbox |
| `2026-11-12_patient_identity.sql` | Patient space identity: accounts, identities, sessions, login codes, profiles, record links, claim tokens, consents, access log |
| `2026-11-15_medications.sql` | `medication_schedules`, `medication_dose_events` (and later columns `prescription_version`, `hidden`) |
| `2026-11-15_patient_profiles_soft_delete.sql` | `patient_profiles.deleted_at` |
| `2026-11-15_product_events.sql` | `product_events` |
| `2026-11-15_queue_visit_tokens.sql` | `queue_visit_tokens` (public visit-page tokens) |
| `2026-11-16_appointment_patient_confirmed.sql` | `appointments.patient_confirmed_at` |
| `2026-11-16_patient_push.sql` | `patient_devices`, `queue_policies.patient_turn_near_ahead`, `queue_entries.turn_near_notified_at` |
| `2026-11-17_patient_devices_session.sql` | `patient_devices.session_id` |

A database built from `../schema/` after these dates already has all of them.
