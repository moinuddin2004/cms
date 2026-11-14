import { itDatabaseUrl } from '../billing/db.config';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Safety net for every patient integration spec (M0-09 review #3).
 *
 * These specs `DROP SCHEMA … CASCADE` in their own schema and `synchronize`
 * entities, so they must never touch a shared database by accident. They run
 * only when the effective database host is local, or when
 * `PATIENT_IT_DATABASE_URL` is set explicitly (a disposable Postgres). When it
 * is set it also becomes the URL the shared harness (`itDatabaseUrl`) uses.
 *
 * Call it first in `beforeAll`, before any SQL.
 */
export function assertSafePatientTestDb(): void {
  const explicit = process.env.PATIENT_IT_DATABASE_URL;
  if (explicit) {
    process.env.BILLING_IT_DATABASE_URL = explicit;
    return;
  }
  const { hostname } = new URL(itDatabaseUrl());
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error(
      `Refusing to run patient integration specs against "${hostname}". ` +
        'Use a local Postgres, or set PATIENT_IT_DATABASE_URL to a disposable test database.',
    );
  }
}
