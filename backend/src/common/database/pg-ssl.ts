/**
 * SSL for every Postgres connection the app opens (TypeORM + the LISTEN
 * clients). Plain PostgreSQL, any host:
 *
 *   DATABASE_SSL=false    no SSL (local Postgres on the same machine/network)
 *   DATABASE_SSL=true     SSL, certificate not verified (Neon and most managed hosts)
 *   DATABASE_SSL=verify   SSL with full certificate verification
 *
 * Unset: SSL on (true), the previous behaviour.
 */
export function pgSsl(): false | { rejectUnauthorized: boolean } {
  const mode = (process.env.DATABASE_SSL ?? 'true').trim().toLowerCase();
  if (mode === 'false' || mode === 'off' || mode === 'disable') return false;
  if (mode === 'verify') return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}
