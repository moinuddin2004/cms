import { QueryFailedError } from 'typeorm';

/** Anything with TypeORM's `query()` — a DataSource, EntityManager or QueryRunner. */
interface Queryable {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

/**
 * Run raw SQL and get typed rows. TypeORM's postgres driver returns
 * `[rows, affectedCount]` for `UPDATE … RETURNING`; this unwraps it so callers
 * always get the row array.
 */
export async function sqlRows<T>(
  db: Queryable,
  sql: string,
  parameters: unknown[] = [],
): Promise<T[]> {
  const result = await db.query(sql, parameters);
  if (!Array.isArray(result)) return [];
  if (
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  ) {
    return result[0] as T[];
  }
  return result as T[];
}

/** Postgres error code (e.g. 23505, 23P01, 55P03) and constraint name, if any. */
export function pgError(err: unknown): { code?: string; constraint?: string } {
  if (!(err instanceof QueryFailedError)) return {};
  const driver = (
    err as QueryFailedError & {
      driverError?: { code?: string; constraint?: string };
    }
  ).driverError;
  return { code: driver?.code, constraint: driver?.constraint };
}
