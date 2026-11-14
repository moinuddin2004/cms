/* Unit-level checks for the safety helper; needs no database. */
import { isLocalDatabaseUrl } from './test-db-safety';

describe('isLocalDatabaseUrl', () => {
  it.each([
    'postgres://u:p@localhost:5432/db',
    'postgres://u:p@127.0.0.1/db',
    'postgres://u:p@[::1]:5432/db',
    'postgres://u:p@/db?host=/var/run/postgresql',
    'postgres://u:p@localhost/db?sslmode=disable',
  ])('accepts %s', (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it.each([
    'postgres://u:p@prod.example.com/db',
    'postgres://u:p@localhost/db?host=prod.example.com',
    'postgres://u:p@127.0.0.1/db?hostaddr=10.0.0.5',
    'postgres://u:p@ep-1.neon.tech/db?host=localhost',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });
});
