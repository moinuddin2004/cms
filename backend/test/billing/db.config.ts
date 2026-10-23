import { config } from 'dotenv';
import { join } from 'path';

/**
 * The integration tests run in their OWN Postgres schema, never in `public`:
 * `global-setup` drops and recreates it, `global-teardown` drops it. Nothing
 * else in the database is read or written. Schema name is fixed on purpose —
 * do not make it configurable, `DROP SCHEMA … CASCADE` runs against it.
 */
export const IT_SCHEMA = 'billingit';

config({ path: join(__dirname, '../../.env') });

/**
 * `BILLING_IT_DATABASE_URL` (a disposable Postgres), else `DATABASE_URL`.
 * Neon's pooler (pgbouncer) rejects the `search_path` startup option the
 * schema isolation needs, so `-pooler` is stripped from the host.
 */
export function itDatabaseUrl(): string {
  const raw = process.env.BILLING_IT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error('Set BILLING_IT_DATABASE_URL or DATABASE_URL');
  const url = new URL(raw);
  url.hostname = url.hostname.replace('-pooler', '');
  url.searchParams.delete('channel_binding');
  return url.toString();
}

export function itSsl(): false | { rejectUnauthorized: false } {
  const { hostname } = new URL(itDatabaseUrl());
  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
    ? false
    : { rejectUnauthorized: false };
}
