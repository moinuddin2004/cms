# Conflicts — ch24-notifications

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| Table CHECKs / enums | Channels whatsapp, sms, email | Commented out in `CHANNELS_BY_AUDIENCE`; only in_app for internal audiences; patient audience has none | `notifications/notifications.enums.ts:58-89` |
| `notification-outbox.entity.ts` comment | "Never deleted" | Not enforced by a trigger | ENTITY_CATALOG §10 |

## Oddities
- `user_notifications` has two equivalent unique constraints on `outbox_id` (a UQ and a REL constraint).
