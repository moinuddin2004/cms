import './bootstrap/utc';
import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import {
  MIGRATIONS_GLOB,
  recordLegacyBaseline,
} from './common/database/migrations';
import { upgradeNaiveTimestamps } from './common/database/timestamptz';
import { renamePaisaToMinor } from './common/database/minor-units';

// Load environment variables
config();

/**
 * TypeORM CLI data source (`npm run migration:* / schema:*`). Works from
 * `src` (ts-node) and from the build (`dist/src/data-sourse.js`).
 *
 * Entities by glob so new modules can't be forgotten. Note the glob also
 * picks up entity files no Nest module registers (e.g. the legacy inventory entity),
 * which the running app's `autoLoadEntities` ignores — check generated
 * migrations / `schema:log` output for tables you don't expect.
 */
class CliDataSource extends DataSource {
  // Same rule as app startup: the legacy baseline is never executed.
  override async runMigrations(
    options?: Parameters<DataSource['runMigrations']>[0],
  ) {
    await recordLegacyBaseline(this);
    return super.runMigrations(options);
  }

  // Same rule as app startup: naive timestamps become timestamptz and
  // `*_paisa` columns become `*_minor` in place first, so `schema:sync`
  // doesn't drop and re-add them.
  override async synchronize(dropBeforeSync?: boolean) {
    await upgradeNaiveTimestamps(this);
    await renamePaisaToMinor(this);
    return super.synchronize(dropBeforeSync);
  }
}

export const AppDataSource = new CliDataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon')
    ? { rejectUnauthorized: false }
    : false,
  // Only `schema:sync` should change the schema from entities; never as a
  // side effect of loading this file.
  synchronize: false,
  logging: true,
  entities: [
    join(__dirname, '**', '*.entity{.ts,.js}'),
    join(__dirname, 'auth', 'entities', '*{.ts,.js}'),
  ],
  migrations: [MIGRATIONS_GLOB],
  subscribers: [],
});
