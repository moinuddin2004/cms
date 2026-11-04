import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Global quick search (Ctrl+K): pg_trgm + trigram GIN indexes on patients.
 *
 * Every index is on an EXPRESSION (`lower(...)`, `regexp_replace(...)`), not
 * a bare column. TypeORM's synchronize only loads column indexes, so it
 * never sees — and never drops — these. The search SQL in
 * `search/search.service.ts` uses exactly these expressions.
 * Idempotent: safe on databases where it already ran.
 */
export class PatientSearchTrigram1793800000000 implements MigrationInterface {
  name = 'PatientSearchTrigram1793800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_patients_name_trgm" ON "patients" USING gin (lower("full_name") gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_patients_number_trgm" ON "patients" USING gin (lower("patient_number") gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_patients_phone_digits_trgm" ON "patients" USING gin (regexp_replace("phone", '\\D', '', 'g') gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_patients_guardian_phone_digits_trgm" ON "patients" USING gin (regexp_replace(coalesce("guardian_phone", ''), '\\D', '', 'g') gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_patients_cnic_digits_trgm" ON "patients" USING gin (regexp_replace(coalesce("cnic", ''), '\\D', '', 'g') gin_trgm_ops)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const name of [
      'idx_patients_cnic_digits_trgm',
      'idx_patients_guardian_phone_digits_trgm',
      'idx_patients_phone_digits_trgm',
      'idx_patients_number_trgm',
      'idx_patients_name_trgm',
    ]) {
      await q.query(`DROP INDEX IF EXISTS "${name}"`);
    }
    // pg_trgm is left installed: other objects may depend on it.
  }
}
