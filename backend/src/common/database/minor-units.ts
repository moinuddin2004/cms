import { DataSource, EntityManager } from 'typeorm';

/**
 * Money columns used to be named `*_paisa`; they are now `*_minor` (integer
 * minor units of the clinic's currency). Renames them in place — columns,
 * `chk_*_paisa` constraints, and plpgsql function bodies that read them
 * (e.g. the `commission_entries` append-only trigger).
 *
 * Must run BEFORE synchronize: synchronize would see a renamed column as one
 * dropped and one added, and the money in it would be lost. Idempotent — a
 * database with no `_paisa` names left is a no-op.
 */
export async function renamePaisaToMinor(
  db: DataSource | EntityManager,
): Promise<void> {
  const columns: { table_name: string; column_name: string }[] = await db.query(
    `SELECT c.table_name, c.column_name
         FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name LIKE '%\\_paisa'
          AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns n
                 WHERE n.table_schema = 'public'
                   AND n.table_name = c.table_name
                   AND n.column_name =
                       left(c.column_name, -length('_paisa')) || '_minor')`,
  );
  for (const { table_name, column_name } of columns) {
    await db.query(
      `ALTER TABLE "${table_name}" RENAME COLUMN "${column_name}"
         TO "${column_name.replace(/_paisa$/, '_minor')}"`,
    );
  }

  const constraints: { table_name: string; conname: string }[] = await db.query(
    `SELECT t.relname AS table_name, k.conname
         FROM pg_constraint k
         JOIN pg_class t ON t.oid = k.conrelid
         JOIN pg_namespace s ON s.oid = t.relnamespace
        WHERE s.nspname = 'public' AND k.conname LIKE '%\\_paisa'`,
  );
  for (const { table_name, conname } of constraints) {
    await db.query(
      `ALTER TABLE "${table_name}" RENAME CONSTRAINT "${conname}"
         TO "${conname.replace(/_paisa$/, '_minor')}"`,
    );
  }

  // Column renames follow into constraints and indexes, but not into
  // plpgsql bodies (they are plain text), so rewrite those.
  const functions: { def: string }[] = await db.query(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace s ON s.oid = p.pronamespace
      WHERE s.nspname = 'public'
        AND p.prokind = 'f'
        AND p.prosrc ~ '_paisa\\M'`,
  );
  for (const { def } of functions) {
    await db.query(def.replace(/_paisa\b/g, '_minor'));
  }
}
