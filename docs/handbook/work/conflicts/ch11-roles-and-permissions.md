# Conflicts — ch11

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| docs/access-control/README.md | `GET /me/catalog` | `GET /access/catalog` | `access/access.controller.ts` |
| docs/access-control/README.md | Assistant template summary | Also grants `lab.orders.view` (location) | `access/catalog/templates.ts` |
| CLAUDE.md | Guard chain of 4 | 5 guards | `app.module.ts` |
| access.guard.ts comment | "wave 3 makes a missing decorator a boot error" | Not done; only the unit test enforces markers | `access.guard.ts`, `access-coverage.spec.ts` |

## Oddities
- `AccessTemplatesService` recreates a system role deleted directly in the database at next boot.
- Admin template removes `earnings.own.view` and `queue.doctor.own`, but both return through implies.
- Role delete is audited as `VOID` (the audit enum has no DELETE).
