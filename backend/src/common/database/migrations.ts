import { join } from 'path';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * `src/migrations` in ts-node/jest, `dist/src/migrations` after `nest build`
 * (the build output mirrors the backend root, so a hard-coded
 * `dist/migrations` glob matched nothing). TypeORM skips `.d.ts` files.
 */
export const MIGRATIONS_GLOB = join(
  __dirname,
  '..',
  '..',
  'migrations',
  '*{.ts,.js}',
);

/**
 * `1776356529788-create-table.ts` is a partial diff generated against an
 * early dev database: it uses enum types it never creates and tables that
 * already exist wherever the schema came from `synchronize`, so it fails on
 * every database, empty or not. The schema it describes is owned by the
 * entities (synchronize / `schema:sync`); it is recorded as applied so the
 * migrations after it can run. The file itself stays untouched.
 */
const LEGACY_BASELINE = {
  timestamp: 1776356529788,
  name: 'CreateTable1776356529788',
};

/** Same table TypeORM's MigrationExecutor creates (default name/schema). */
export async function recordLegacyBaseline(ds: DataSource): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" SERIAL NOT NULL,
      "timestamp" bigint NOT NULL,
      "name" character varying NOT NULL,
      CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id"))`);
  await ds.query(
    `INSERT INTO "migrations" ("timestamp", "name")
     SELECT $1::bigint, $2::varchar
      WHERE NOT EXISTS (SELECT 1 FROM "migrations" WHERE "name" = $2::varchar)`,
    [LEGACY_BASELINE.timestamp, LEGACY_BASELINE.name],
  );
}

/**
 * Runs pending migrations on an initialized DataSource. Called after
 * `initialize()` on purpose: TypeORM's own `migrationsRun` runs migrations
 * BEFORE `synchronize`, but our hand-written migrations expect the dev
 * schema to be synchronized first (they skip DDL for tables that exist and
 * only add triggers / backfills).
 */
export async function runPendingMigrations(ds: DataSource): Promise<void> {
  const logger = new Logger('Migrations');
  await recordLegacyBaseline(ds);
  const executed = await ds.runMigrations({ transaction: 'each' });
  if (executed.length)
    logger.log(`Applied: ${executed.map((m) => m.name).join(', ')}`);
  else logger.log('Schema up to date, no pending migrations');
}
