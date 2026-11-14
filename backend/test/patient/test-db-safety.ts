import { parse } from 'pg-connection-string';
import { itDatabaseUrl } from '../billing/db.config';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * True only when the host `pg` will actually connect to is local. Parsed with
 * the same library `pg` uses, so a `?host=` query override is seen. `hostaddr`
 * is rejected outright; unix-socket hosts (`/var/run/postgresql`) are local;
 * no host at all means pg's default (local socket / localhost).
 */
export function isLocalDatabaseUrl(raw: string): boolean {
  if (/[?&]hostaddr=/i.test(raw)) return false;
  let host: string | null | undefined;
  try {
    host = parse(raw).host;
  } catch {
    return false;
  }
  if (!host) return true;
  if (host.startsWith('/')) return true;
  // The URL authority (when it parses and has a host) must be local too.
  try {
    const { hostname } = new URL(raw);
    if (hostname && !LOCAL_HOSTS.includes(hostname)) return false;
  } catch {
    // empty authority, e.g. `postgres://u@/db?host=/var/run/postgresql`
  }
  return LOCAL_HOSTS.includes(host);
}

/**
 * Safety net for every patient integration spec (M0-09 review #3).
 *
 * These specs `DROP SCHEMA … CASCADE` in their own schema and `synchronize`
 * entities, so they must never touch a shared database by accident. They run
 * only when the effective database host is local, or when
 * `PATIENT_IT_DATABASE_URL` is set explicitly (a disposable Postgres). When it
 * is set it also becomes the URL the shared harness (`itDatabaseUrl`) uses.
 *
 * Call it at MODULE level (top of the spec file, before `describe`): a throw
 * there fails the whole file before any hook — `beforeAll` or `afterAll` — can
 * connect. Never call it inside a hook (Jest still runs `afterAll` after a
 * failed `beforeAll`, and teardown drops a schema).
 */
export function assertSafePatientTestDb(): void {
  const explicit = process.env.PATIENT_IT_DATABASE_URL;
  if (explicit) {
    process.env.BILLING_IT_DATABASE_URL = explicit;
    return;
  }
  if (!isLocalDatabaseUrl(itDatabaseUrl())) {
    throw new Error(
      'Refusing to run patient integration specs against a non-local database. ' +
        'Use a local Postgres, or set PATIENT_IT_DATABASE_URL to a disposable test database.',
    );
  }
}
