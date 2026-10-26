# Appendix E — Scheduled Jobs and Background Loops

This appendix lists everything the Platform does on its own, without a user clicking anything. That covers timed jobs that run on a schedule, and background loops that deliver realtime events and notifications. It also explains which server process runs each one, because running a job twice can cause duplicate work.

## E.1 Where background work runs

The backend is one program that can start in three process roles:

- **`api` role:** serves web requests and the realtime socket connection. It never runs scheduled jobs, so you can run several `api` processes side by side without jobs running twice.
- **`worker` role:** runs the scheduled jobs and the background relays. **Exactly one** worker process must run.
- **`all` role:** does both. It is the default in development and needs no Redis.

The code enables the job scheduler only in processes whose role is not `api`.

**Technical references:** `backend/src/common/runtime/process-role.ts` · `runsJobs` · `backend/src/app.module.ts` · `AppModule.forRole` · `backend/src/main.worker.ts`

## E.2 Timed jobs

| Job | Schedule | What it does | Status |
|---|---|---|---|
| Queue no-show marker | Every 60 seconds | Marks a booked patient as a no-show once they have not checked in by the appointment start plus the location's maximum lateness from the queue policy. | [Implemented] |
| Queue call timeout | Every 15 seconds | Auto-skips a called patient who never came to the doctor, when the queue policy has a call timeout set. | [Implemented] |
| Queue session day-end | Every 5 minutes | Closes queue sessions from a past clinic day when they are empty. Sessions that still have waiting or on-hold patients are left open for an admin and logged as an alert. They are never auto-cancelled. | [Implemented] |
| Queue cleanup | Every day at 03:15 | Deletes idempotency keys older than 24 hours and published realtime outbox rows older than 7 days. | [Implemented] |
| Patient credit expiry | Every day at 01:00 | Marks prepaid patient credits (from credit packages) whose expiry date has passed as expired. | [Implemented] |
| Billing invariant check | Every day at 02:30 | Recomputes billing totals and checks the money rules (invariants), including the commission ledger rule, and logs any break it finds. | [Implemented] |
| Month-end payroll | 05:00 on the 1st of every month | Generates payroll records for the month that just ended, for every active location of every organization. Locations already generated are skipped, so a re-run is safe. | [Implemented] |
| Inventory alerts | Every day at 08:00 | Counts low-stock and soon-expiring items per location and writes a warning to the server log. No user is notified, and nothing appears in any inbox or screen. | [Partial] |

The table lists eight timed jobs. The first four keep the live queue consistent. The other four do daily or monthly housekeeping for credits, billing checks, payroll and stock.

**Times use the server clock.** None of these jobs sets a timezone, so the daily and monthly schedules follow the timezone of the server running the worker. They do not follow each clinic's location timezone. For clinics in a different timezone from the server, "01:00" or "the 1st at 05:00" therefore happens at a different local clinic time. The queue day-end job avoids this problem. It decides what "a past clinic day" means for each location from that location's queue policy (including its day cut-off) and the Platform clock, not from the server date alone.

**Code comment vs code.** The payroll job's comment says it runs "at 00:05 on the 1st". The schedule expression `0 5 1 * *` actually means 05:00 on the 1st. This handbook follows the code.

**The credit expiry job uses the server clock.** It works out "today" from the server's local date rather than the location's clock. Every other clinic-day rule in the Platform uses the location's timezone, so a credit can expire up to a few hours early or late for a clinic whose timezone differs from the server's.

**Technical references:** `backend/src/queue/jobs/queue-jobs.service.ts` · `backend/src/billing/patient-credits.service.ts` · `checkExpiredCredits` · `backend/src/billing/invariants/billing-invariant.job.ts` · `backend/src/payroll/payroll.service.ts` · `month-end-payroll` · `backend/src/inventory/services/inventory-alerts.service.ts`

## E.3 Background loops (always running in the worker)

| Loop | How it wakes up | What it does | Status |
|---|---|---|---|
| Queue outbox relay | Database LISTEN on the queue outbox channel, plus a poll every 1 second as a fallback | Takes queue events written in the same transaction as each queue change and publishes them, through Redis, to the realtime socket rooms that reception screens, doctor screens and the TV display listen to. | [Implemented] |
| Notification relay | Database LISTEN on the notification outbox channel, plus a poll every 2 seconds | Delivers queued notifications to users' in-app inboxes. | [Implemented] |
| Realtime heartbeat and watchdog | Timer | Checks that the Redis publish and subscribe link between processes is alive. | [Implemented] |

These three loops are what make the Platform feel live. The two relays follow the "transactional outbox" pattern. A change and the message announcing it are saved together in one database transaction, and a separate loop delivers the message afterwards. So a message is never lost, and is never sent for a change that was rolled back. If the database LISTEN connection drops, both relays log a warning and keep working by polling alone.

**Technical references:** `backend/src/queue/realtime/outbox-relay.service.ts` · `backend/src/notifications/delivery/notification-relay.service.ts` · `backend/src/queue/realtime/redis-realtime.publisher.ts` · `redis-realtime.subscriber.ts`
