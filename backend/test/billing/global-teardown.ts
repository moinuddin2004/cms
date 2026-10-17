import { Client } from 'pg';
import { IT_SCHEMA, itDatabaseUrl, itSsl } from './db.config';

export default async function globalTeardown(): Promise<void> {
  if (process.env.BILLING_IT_KEEP_SCHEMA) return;
  const client = new Client({
    connectionString: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${IT_SCHEMA} CASCADE`);
  } finally {
    await client.end();
  }
}
