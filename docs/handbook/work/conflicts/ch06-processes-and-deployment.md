# Conflicts — ch06

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| docs/appointments-and-queue.md | Worker runs 1+; no migrations | Exactly one worker; 3 migrations; prod uses schema:sync:prod | `process-role.ts`, `backend/src/migrations/` |
| backend/.env.example, README | `JWT_REFRESH_SECRET`, `EMAIL_TOKEN_SECRET`, `RESET_TOKEN_SECRET` needed | No code reads them | grep over `backend/src` |
| backend/.env.example | (omits them) | Code reads `REDIS_URL`, `CORS_ORIGIN`, `FRONTEND_URL`, `MAGIC_LINK_SECRET`, `JWT_SECRET`, `LAB_*`, `RATE_LIMIT_*` | grep |
| backend/package.json | `start:prod` runs `node dist/main` | Build emits `dist/src/main.js` | `backend/dist/src` |
| payroll.service.ts comment | Runs 00:05 on the 1st | Cron `0 5 1 * *` is 05:00 | `payroll/payroll.service.ts:241` |

## Oddities
- No cron sets a timezone; triggers follow the server clock. Patient-credit expiry uses server-local midnight, not the location timezone.
- Redis channel names contain the former working name (`dentalflow:...`).
- Seeding runs in the worker as well as API processes (insert-missing, conflict-safe).

## Security
- Login rate limiting is in-memory per process, not shared across API instances (rate-limit category; already in INVENTORY section 7).
