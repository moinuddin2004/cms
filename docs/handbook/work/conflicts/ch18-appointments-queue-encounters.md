# Conflicts and oddities — ch18-appointments-queue-encounters.md

## Doc vs code
- **ENTITY_CATALOG §9** says only the queue writes `idempotency_keys`. **Code:** `common/idempotency/idempotency.service.ts` also inserts into it, used by `engine/runtime/workflow-engine.service.ts`, `lab-billing` (credits, payments), `lab-orders/order-submit.service.ts`, `lab-payables/vendor-payments.service.ts`. The queue's daily cleanup (`queue-jobs.service.ts`, cron `15 3 * * *`, server timezone) deletes all rows older than 24 h, including those.
- **docs/appointments-and-queue.md** says there are no migrations (see ch12 conflicts).

## Oddities
- Queue tables keep `organization_id` / `location_id` without FKs.
- `queue_events` append-only only by convention.
