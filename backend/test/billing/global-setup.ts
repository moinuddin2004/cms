import { Client } from 'pg';
import { UUID_V7_FUNCTION_SQL } from '../../src/common/database/uuid-v7';
import { IT_SCHEMA, itDatabaseUrl, itSsl } from './db.config';

export default async function globalSetup(): Promise<void> {
  const client = new Client({
    connectionString: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await client.connect();
  try {
    // Extensions live database-wide; both are IF NOT EXISTS no-ops on dev DBs.
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    // Default of the lab-management ids; the app creates it before synchronize too.
    await client.query(UUID_V7_FUNCTION_SQL);
    await client.query(`DROP SCHEMA IF EXISTS ${IT_SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${IT_SCHEMA}`);
  } finally {
    await client.end();
  }
}
