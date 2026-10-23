import { Client } from 'pg';
import { UUID_V7_FUNCTION_SQL } from '../../../src/common/database/uuid-v7';
import { itDatabaseUrl, itSsl } from '../../billing/db.config';
import { ACCEPT_SCHEMA } from './schema';

/**
 * Creates the acceptance suite's OWN schema (never `public`, never another
 * suite's). The tables are built by the first spec that boots the app
 * (`synchronize`), then reused by the next ones; teardown drops everything.
 */
export default async function globalSetup(): Promise<void> {
  const client = new Client({
    connectionString: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query(UUID_V7_FUNCTION_SQL);
    if (!process.env.ACCEPT_IT_REUSE_SCHEMA) {
      await client.query(`DROP SCHEMA IF EXISTS ${ACCEPT_SCHEMA} CASCADE`);
    }
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${ACCEPT_SCHEMA}`);
  } finally {
    await client.end();
  }
}
