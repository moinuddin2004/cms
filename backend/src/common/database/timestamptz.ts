import { DataSource, EntityManager } from 'typeorm';

/**
 * Converts every `timestamp without time zone` column in `public` to
 * `timestamptz`, reading the old values as UTC (they were written by the
 * database's `now()` / `CURRENT_TIMESTAMP` in a UTC session).
 *
 * Must run BEFORE synchronize: on a type change synchronize drops and re-adds
 * the column, which would reset every `created_at` to "now". Once converted,
 * the column already matches the entity and synchronize leaves it alone.
 * Idempotent — a database with no naive timestamps is a no-op.
 */
export async function upgradeNaiveTimestamps(
  db: DataSource | EntityManager,
): Promise<void> {
  const columns: { table_name: string; column_name: string }[] =
    await db.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp without time zone'`,
    );
  for (const { table_name, column_name } of columns) {
    await db.query(
      `ALTER TABLE "${table_name}"
         ALTER COLUMN "${column_name}" TYPE timestamptz
         USING "${column_name}" AT TIME ZONE 'UTC'`,
    );
  }
}
