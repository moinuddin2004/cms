# Product analytics events (M2-13)

Our own, tiny, privacy-safe product analytics (docs/03 §6: no third-party SDK sees health data).
Goal before the pilot: **activation, claim success, daily use** — nothing else.

## Rules (a review fails on any breach)

- An event is an allow-listed **name** + allow-listed **scalar props** (enum values or a version string). No names,
  phones, emails, free text, tokens, diagnoses, medicine names, patient/record/visit ids.
- Who: `actor_id` = `users.uuid` (staff) or `patient_accounts.id` (patient), nothing else. `organization_id` is never taken from the client
  and is currently always null (org tagging is future work — see "Clinic" below; the only index is `(name, at)`).
- The server validates the name against the catalog (`backend/src/product-events/product-event-catalog.ts`), accepts a
  name only on its own endpoint (staff names on `/me/events`, patient names on `/patient-api/events`), drops unknown props and
  out-of-enum values, and answers `{ accepted }`; unknown events are dropped silently (analytics must never break the app).
- Rate limit: 60 requests / 5 min per IP on both endpoints, ≤ 50 events per request. Client time `at` is kept only if within
  the last 7 days and not in the future, else the server stamps now.
- Retention: **400 days** by default (`PRODUCT_EVENT_RETENTION_DAYS`, `0` = keep forever). The daily retention job
  (`backend/src/patient-auth/patient-retention.job.ts`, runs on the `worker` / `all` process at 03:15) deletes older rows.
- Account deletion (M2-11) does not need to touch these rows: they hold only the account id and enums. Delete by `actor_id`
  if a patient asks.
- Mobile: `src/core/analytics` `createTracker({ send })` — batched (5 s), in-memory, fire-and-forget, retries on network/5xx/429,
  drops on other 4xx, flushes when the app goes to the background, no-op under Jest. A queued event remembers its actor and is only sent while that same user/account is signed in; sign-out clears the queue first. Each space injects its sender (`staff/lib/analytics.ts`, `patient/lib/analytics.ts`).

## Event list

| Event | Endpoint | Props (all optional) | Fired when |
| --- | --- | --- | --- |
| `staff_signed_in` | `/me/events` | `method`: `password`·`google` (the catalog also allows `email`) | A staff sign-in succeeds (not on session restore) |
| `staff_checked_in` | `/me/events` | `source`: `appointment`·`walk_in` | Check-in from the schedule sheet succeeds (`appointment`) |
| `staff_called_next` | `/me/events` | — | Doctor "Call next" returns a patient |
| `app_opened` | `/me/events` | `platform`, `appVersion` | Reserved (not sent yet) |
| `patient_signed_in` | `/patient-api/events` | `method`: `email`·`google`; `isNewAccount`: `true`·`false` | Patient code verified |
| `claim_accepted` | `/patient-api/events` | `relation`: `self`·`child`·`parent`·`spouse`·`other` | A claim is accepted |
| `records_opened` | `/patient-api/events` | `kind`: `prescriptions`·`visits`·`invoices`·`appointments` | The Records tab shows a list (tab or segment change) |
| `patient_app_opened` | `/patient-api/events` | `platform`, `appVersion` | Reserved (not sent yet) |

Adding an event = catalog entry + this table + a spec case, in the same change.

**Clinic:** staff events are not tagged with a clinic on write (`/me/events` is `@ContextFree`, because the sign-in event is
sent before an organization/location is selected, and a client-sent org id would be untrusted). Per-clinic metrics join
`actor_id` to `employee_org_location_assignments.user_id` (a user in several clinics counts in each). Patient events are account-level by design.

## Pilot metrics (run on the production replica; replace the dates)

```sql
-- 1. Activation: patient accounts that signed in, and how many then linked a record within 7 days.
WITH signed AS (
  SELECT actor_id, MIN(at) AS first_in FROM product_events
  WHERE name = 'patient_signed_in' AND (props->>'isNewAccount') = 'true' AND at >= :from GROUP BY actor_id
), claimed AS (
  SELECT actor_id, MIN(at) AS first_claim FROM product_events WHERE name = 'claim_accepted' GROUP BY actor_id
)
SELECT count(*) AS new_accounts,
       count(c.first_claim) FILTER (WHERE c.first_claim <= s.first_in + interval '7 days') AS linked_within_7d,
       round(100.0 * count(c.first_claim) FILTER (WHERE c.first_claim <= s.first_in + interval '7 days') / NULLIF(count(*),0), 1) AS pct
FROM signed s LEFT JOIN claimed c USING (actor_id);

-- 2. Claim success: links issued by clinics vs used, per week (server tables, no events needed),
--    plus accepted-claim events from the app for cross-checking.
SELECT date_trunc('week', created_at) AS week, count(*) AS links_issued,
       count(*) FILTER (WHERE used_at IS NOT NULL) AS links_used,
       round(100.0 * count(*) FILTER (WHERE used_at IS NOT NULL) / count(*), 1) AS pct_used
FROM patient_claim_tokens WHERE created_at >= :from GROUP BY 1 ORDER BY 1;
SELECT date_trunc('week', at) AS week, count(*) AS claim_accepted_events
FROM product_events WHERE name = 'claim_accepted' AND at >= :from GROUP BY 1 ORDER BY 1;

-- 3. Daily use, patient: active accounts per day and WAU/MAU stickiness.
SELECT date_trunc('day', at) AS day, count(DISTINCT actor_id) AS dau
FROM product_events WHERE actor_type = 'patient' AND at >= :from GROUP BY 1 ORDER BY 1;
SELECT count(DISTINCT actor_id) FILTER (WHERE at >= now() - interval '7 days')  AS wau,
       count(DISTINCT actor_id) FILTER (WHERE at >= now() - interval '30 days') AS mau
FROM product_events WHERE actor_type = 'patient';

-- 4. Daily use, staff: users per day, and the core actions per day.
SELECT date_trunc('day', at) AS day,
       count(DISTINCT actor_id) AS staff_users,
       count(*) FILTER (WHERE name = 'staff_checked_in') AS check_ins,
       count(*) FILTER (WHERE name = 'staff_called_next') AS calls
FROM product_events WHERE actor_type = 'staff' AND at >= :from GROUP BY 1 ORDER BY 1;

-- 5. Records depth: which lists patients open.
SELECT props->>'kind' AS kind, count(*) AS opens, count(DISTINCT actor_id) AS patients
FROM product_events WHERE name = 'records_opened' AND at >= :from GROUP BY 1 ORDER BY 2 DESC;

-- 6. Per clinic staff usage (join through employees).
SELECT e.organization_id, date_trunc('week', pe.at) AS week, count(DISTINCT pe.actor_id) AS staff_users
FROM product_events pe
JOIN (SELECT DISTINCT user_id, organization_id FROM employee_org_location_assignments) e ON e.user_id = pe.actor_id
WHERE pe.actor_type = 'staff' AND pe.at >= :from GROUP BY 1, 2 ORDER BY 1, 2;
```

Caveats: events are batched in memory and a phone that closes the app within ~5 s of an action can lose it, so treat the
numbers as a floor. Counts of `records_opened` include re-selecting a tab.

