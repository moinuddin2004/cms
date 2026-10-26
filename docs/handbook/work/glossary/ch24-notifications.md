# Glossary — ch24-notifications

- **Notification event** — a platform-defined kind of event that can notify someone, keyed by a text code (`notification_events`).
- **Audience** — who a notification is for: patient, doctor, coordinator or lab.
- **Channel** — how it is delivered: in_app, whatsapp, sms, email (only in_app is active).
- **Notification rule** — a clinic's on/off switch for one event, audience and channel (`notification_rules`).
- **Notification template** — wording of one event on one channel in one language; platform default or clinic override (`notification_templates`).
- **Audience setting** — a clinic's master switch and quiet hours for one audience (`notification_audience_settings`).
- **Quiet hours** — local times during which messages are held (`quiet_start`, `quiet_end`).
- **Notification outbox** — one message to one recipient on one channel, written in the same transaction as the cause (`notification_outbox`).
- **Bell** — a user's in-app inbox; one row per sent in-app outbox row (`user_notifications`).
- **Patient communication preferences** — a patient's channel opt-outs and language (`patient_comm_prefs`).
- **Mandatory internal** — an event that internal audiences always receive in-app (`is_mandatory_internal`).
