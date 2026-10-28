# Conflicts: ch57-access-control

## Doc vs code
- ch11 version cache 15 s and context cache 5 min confirmed. The feature-set cache time was not re-verified; the chapter says only "short".
## Oddities
- `ownerOrSuperAdmin` sidebar flag is defined but unused.
- `/user` controller is class-level `@ContextFree` with per-handler checks.
- Access coverage spec exempts path prefixes auth, session, health.
## Security
- Tenant isolation: application-level only, no database row-level policies.
- A handler without a marker passes the access guard at runtime; only a test prevents it.
- Realtime: socket token verified only at connect.
