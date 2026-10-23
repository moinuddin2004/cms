import { Client } from 'pg';
import { itDatabaseUrl, itSsl } from '../../billing/db.config';
import { ACCEPT_SCHEMA } from './schema';

export default async function globalTeardown(): Promise<void> {
  if (process.env.ACCEPT_IT_KEEP_SCHEMA || process.env.ACCEPT_IT_REUSE_SCHEMA) {
    return;
  }
  const client = new Client({
    connectionString: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${ACCEPT_SCHEMA} CASCADE`);
  } finally {
    await client.end();
  }
}
