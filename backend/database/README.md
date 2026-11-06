# Database

The schema is maintained **by hand, in SQL**. The app never changes it:
TypeORM `synchronize` is off and there are no TypeORM migrations. You run
these scripts yourself (psql, DataGrip, pgAdmin, …). Plain PostgreSQL 13+;
nothing here is specific to Neon.

```
database/
  schema/      full CREATE scripts — builds an empty database from zero
  changes/     ALTER scripts for databases that already exist, one per change
```

## New, empty database

Run these files **in this order**, each top to bottom:

| # | File | What |
|---|---|---|
| 1 | `schema/01_extensions_functions.sql` | `btree_gist`, `pg_trgm`, `uuid_generate_v7()`, trigger functions |
| 2 | `schema/02_tables.sql` | every table (156), in dependency order: enum types, table, constraints, foreign keys, indexes |
| 3 | `schema/03_foreign_keys_circular.sql` | foreign keys between tables that point at each other (currently none) |
| 4 | `schema/04_search_indexes.sql` | Ctrl+K trigram search indexes on `patients` |
| 5 | `schema/05_triggers.sql` | append-only triggers (audit, status history, commission ledger) |

With psql, from `backend/database/`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f schema/run_all.sql
```

(`-1` runs everything in one transaction: if anything fails, nothing is left behind.)

The extensions need a user allowed to `CREATE EXTENSION` (database owner on
Postgres 13+ for these two; on managed hosts they are normally allowed).

After the tables exist, start the API once: on startup it inserts its own
catalog rows (feature flags, permissions, notification events, …). Seed data
for testing is a separate step.

### Wiping a dev database

`schema/00_reset_public_schema.sql` drops **everything** in the `public`
schema (all tables and data) and recreates it empty. Dev/QA only — never on
production. It is not part of `run_all.sql`.

## Changing the schema later

Every change touches three places, in the same commit:

1. **The entity** (`src/**/*.entity.ts`), so the app's model matches.
2. **The CREATE script** (`schema/02_tables.sql`, the table's block, or the
   matching file), so a fresh database gets the new shape.
3. **A change script** in `changes/`, for databases that already exist:
   `changes/YYYY-MM-DD_short-description.sql`, e.g.
   `2026-11-20_patients-add-blood-group.sql`. Write it so it can run safely
   (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, …), wrap it in
   `BEGIN; … COMMIT;`, and include any data backfill it needs.

Deploying: take a backup, run the new `changes/` files in date order on the
database, then deploy the new API build. Keep a note (release notes or a
table) of which change files each database has had.

Naming conventions in the scripts: `pk`/primary key inline, `fk_<table>_<column>`,
`uq_<table>_<columns>`, `idx_<table>_<columns>`, `chk_<table>_…`. Constraint
names the code depends on (e.g. `no_doctor_overlap`,
`uq_lab_payments_org_idempotency`, `one_active_entry_per_patient`) must never
be renamed — the services catch unique violations by these names.

## Connection settings (`.env`)

| Variable | Values |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname` |
| `DATABASE_SSL` | `true` (default; SSL, Neon / managed hosts) · `verify` (SSL + certificate check) · `false` (local Postgres without SSL) |

## Tests

The integration-test harnesses (`test/**/…harness.ts`) still build their
throw-away test databases from the entities with `synchronize`. That is test
code only; the app itself never does.
