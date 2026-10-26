# Conflicts and oddities — Chapter 30 (Queue)

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| `docs/appointments-and-queue.md` §5 | Worker runs "1+" instances | Worker must run exactly one instance | `backend/src/common/runtime/process-role.ts` ("Run exactly one") |
| `docs/appointments-and-queue.md` §5 | Fan-out uses "Socket.IO Redis adapter" | Own Redis publish/subscribe (`RedisRealtimePublisher` / `RedisRealtimeSubscriber`) with a worker heartbeat; no Socket.IO adapter | `backend/src/queue/realtime/` |
| `docs/appointments-and-queue.md` §6 | API list | Omits `POST /queue/sessions` (`@AnyMember`) | `queue.controller.ts` |
| `docs/appointments-and-queue.md` §7, §10 | No migrations; production must switch from synchronize | 3 migrations exist (none for queue); production runs synchronize off + reviewed schema sync | `backend/src/migrations/` |
| UI message on saving queue settings | "they apply from tomorrow's queues" | Only `smart_queue_enabled` is snapshotted into a session; all other policy values are read live (60 s per-process cache) | `QueuePoliciesService.getEffective`, `TokenEngine.ensureSession` |

## Oddities

- `queue.display.manage` is in the catalog and Receptionist template but never checked.
- `GET /queue/sessions/:id/next-preview`, `GET /queue/sessions/:id/events`, `GET /queue/me`, `POST /queue/sessions` have no web-app caller.
- `GET /queue/my-session` creates a session (a write through GET), so it bypasses the read-only subscription guard.
- The no-show marker updates `appointments` with plain SQL: no `queue_events`, no outbox message, no `updated_by`.
- Policy cache is per process; another API instance can use stale settings for up to 60 s after a save.
- The orchestrator sets `app.organization_id` / `app.location_id` GUCs but no RLS policies exist.
- Lanes / doctor lists include every active staff member assigned to the location (no role filter).
- Rejoin is allowed by the transition map from `called` and `on_hold`, not only `skipped`; the UI offers it only for skipped.
- `return-from-test` checks only `queue.checkin`, with no per-session rule.
- Urgent priority cannot be removed (no endpoint).
- `GET /queue/patients/:patientId/visits` is organization-wide and ignores the `patients.view` scope (a doctor with `own` scope can read visits of any patient id they know).
- Queue settings card is on `/locations/$id/settings` (route needs `admin.locations.manage`) while saving needs `admin.settings.manage`.
- Cleanup cron `15 3 * * *` has no timezone option → server time.

## Security

- Public endpoint exposure: `GET /queue/displays/:locationId/state` and the `location:<id>:display` socket room need no authentication; any holder of a location id can read doctor names, session status and token flow for that location (no patient data). Category: unauthenticated information exposure, by design.
- Authorization scope gap: patient visit history endpoint does not apply the permission's scope (see Oddities). Category: over-broad read access within an organization.
