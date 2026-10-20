# Database schema and migrations

## Who owns what

- **Entities own the table shapes.** In development, TypeORM `synchronize`
  builds them on API startup. In production `synchronize` is off, and you
  apply entity changes with `schema:sync` after reviewing them (see below).
- **Migrations own everything `synchronize` can't do**: triggers (append-only
  ledgers), functions, backfills, data fixes. Every migration from
  `1792403456699-doctor-compensation` onward is hand-written and idempotent.
  It skips DDL for tables that already exist, so it gives the same result
  whether or not `synchronize` ran first.
- **`1776356529788-create-table.ts` is a legacy baseline that never runs.**
  It is a partial diff generated against an early dev database. It uses enum
  types it never creates, so it fails on an empty database, and it fails on a
  synchronized database because the tables already exist. Startup and
  `migration:run` record it as applied (`recordLegacyBaseline` in
  `backend/src/common/database/migrations.ts`) and never execute it. Don't
  edit or delete it.

## What happens on API startup

This only happens in processes that own the schema (`main.api` / `main`, not
`main.worker`). See `AppModule.forRole`.

1. `ensurePostgresExtensions` creates `btree_gist` and `uuid_generate_v7()`.
2. `DataSource.initialize()` runs `synchronize`, except when
   `NODE_ENV=production`.
3. `runPendingMigrations` records the legacy baseline if it's missing, then
   runs pending migrations from `dist/src/migrations`, each in its own
   transaction. It logs `[Migrations] Applied: …` or `Schema up to date`.

The order of steps 2 and 3 is deliberate. TypeORM's own `migrationsRun` runs
migrations before `synchronize`, so it is turned off and migrations are run
from `dataSourceFactory` instead. If a migration fails, startup fails, and
Nest's TypeORM retry loop tries again.

Before this fix, the glob was `dist/migrations/*.js`. `nest build` emits to
`dist/src/…`, so that glob matched nothing and no migration ever ran on
startup. Any database that relied on startup is missing the
commission-ledger and audit append-only triggers. It gets them on the first
start with this fix.

## Commands (`backend/`)

| Command | Use |
|---|---|
| `npm run migration:show` / `migration:run` / `migration:revert` | CLI from source, using ts-node and `src/data-sourse.ts` |
| `npm run schema:log` | Print the SQL `synchronize` would run, from source |
| `npm run schema:log:prod` / `schema:sync:prod` / `migration:run:prod` | Same, from the build (`dist/src/data-sourse.js`); no ts-node needed |

The CLI data source loads entities by glob (`**/*.entity.ts` plus
`auth/entities/*`). This includes entity files that no Nest module registers
yet, such as `chairs` and `inventory`, which the running app ignores. If
`schema:log` or `migration:generate` shows tables you don't expect, that's
why.

## Production deploy procedure (synchronize off)

1. Build: `npm ci && npm run build`.
2. **Review schema changes** against production:
   `DATABASE_URL=<prod> npm run schema:log:prod`. Read every statement.
   Watch for `DROP COLUMN`, `DROP TABLE`, and type changes. `synchronize`
   drops columns that were removed from entities, along with their data.
   If a drop would lose data that a new migration still needs to backfill
   from, run that migration first (`npm run migration:run:prod`), then sync.
3. **Apply them**: `DATABASE_URL=<prod> npm run schema:sync:prod`. Take a
   database backup or Neon branch first.
4. **Start one API instance** (`npm run start:api`). It runs pending
   migrations before serving. Start more API instances and the worker only
   after it logs `[Migrations] …`, because concurrent startups don't take a
   migration lock.
   Alternatively, run `npm run migration:run:prod` as a release step and
   then start everything.

A brand-new production database uses the same steps. Step 3 creates the full
schema, and step 4 records the baseline and runs every migration.

## Writing a new migration

- Name it `<timestamp>-<name>.ts` in `backend/src/migrations/`. It's picked
  up automatically.
- Make it idempotent and safe after `synchronize`. Guard DDL with
  `hasTable` / `IF NOT EXISTS`, use `CREATE OR REPLACE` for functions, and
  drop and recreate triggers. Use the same constraint and index names
  `synchronize` generates.
- Never edit a migration that has shipped. Add a new one instead.
