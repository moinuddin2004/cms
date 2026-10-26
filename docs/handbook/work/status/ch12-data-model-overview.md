| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| Ch 12 | Schema owned by entities + synchronize (dev) | [Implemented] | `synchronize` on when the process owns the schema and NODE_ENV is not production |
| Ch 12 | Production schema via schema:sync:prod | [Implemented] | Manual reviewed step; documented in docs/database-migrations.md |
| Ch 12 | Hand-written migrations (2 running) | [Implemented] | doctor-compensation and lab-management-foundation; idempotent |
| Ch 12 | Legacy baseline migration | [Not implemented] | Recorded as applied, never executed |
| Ch 12 | Append-only triggers | [Implemented] | commission_entries, audit_logs, status_history only |
| Ch 12 | chairs and inventory tables | [Not implemented] | Entities exist; no module registers them |
