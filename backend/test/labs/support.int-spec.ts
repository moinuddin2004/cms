import { DataSource, EntityManager } from 'typeorm';
import { NumberSequenceService } from 'src/common/sequences/number-sequence.service';
import { LabManagementFoundation1792490000000 } from 'src/migrations/1792490000000-lab-management-foundation';
import { itDatabaseUrl, itSsl } from '../billing/db.config';
import { LabsFixture, createLabsFixture } from './labs-it.harness';

const IT_SCHEMA = 'labs_it_support';
const MIGRATION_SCHEMA = 'labs_it_migration';
const TABLES = [
  'audit_logs',
  'status_history',
  'number_sequences',
  'labs',
  'lab_members',
  'lab_clinic_links',
];

/** Support tables (lab ERD §8) and the Sprint 1 migration. */
describe('Labs integration — support tables and migration', () => {
  let fx: LabsFixture;
  let ds: DataSource;

  beforeAll(async () => {
    fx = await createLabsFixture(IT_SCHEMA);
    ds = fx.dataSource;
  }, 300_000);

  afterAll(async () => {
    await ds?.query(`DROP SCHEMA IF EXISTS ${MIGRATION_SCHEMA} CASCADE`);
    await fx?.close();
  });

  describe('number sequences', () => {
    const spec = { key: 'lab_order', prefix: 'LAB' };

    it('hands out gapless, unique numbers under concurrency', async () => {
      const sequences = fx.app.get(NumberSequenceService);
      const org = fx.clinicA.organizationId;
      const numbers = await Promise.all(
        Array.from({ length: 20 }, () =>
          ds.transaction((m) => sequences.next(m, org, spec)),
        ),
      );
      expect([...numbers].sort()).toEqual(
        Array.from(
          { length: 20 },
          (_, i) => `LAB-${String(i + 1).padStart(4, '0')}`,
        ),
      );
    });

    it('gives a number back when the transaction rolls back', async () => {
      const sequences = fx.app.get(NumberSequenceService);
      const org = fx.clinicB.organizationId;
      await expect(
        ds.transaction(async (m) => {
          await sequences.next(m, org, spec);
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      expect(await ds.transaction((m) => sequences.next(m, org, spec))).toBe(
        'LAB-0001',
      );
    });

    it('refuses to run outside a transaction', async () => {
      const sequences = fx.app.get(NumberSequenceService);
      await expect(
        sequences.next(ds.manager, fx.clinicA.organizationId, spec),
      ).rejects.toThrow(/inside a transaction/);
    });
  });

  describe('migration LabManagementFoundation', () => {
    const migration = new LabManagementFoundation1792490000000();

    /**
     * A connection whose search path STARTS at the migration schema: TypeORM
     * resolves unqualified names (hasTable, CREATE TABLE) against the schema
     * fixed at connect time. FKs to organizations / users resolve to IT_SCHEMA.
     */
    let mds: DataSource;
    const inMigrationSchema = (fn: (m: EntityManager) => Promise<unknown>) =>
      mds.transaction(async (m) => {
        await fn(m);
      });

    const constraints = (schema: string) =>
      ds.query(
        `SELECT c.relname AS "table", k.conname AS name, k.contype AS type
           FROM pg_constraint k
           JOIN pg_class c ON c.oid = k.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = ANY($2)
          UNION ALL
         SELECT tablename, indexname, 'i' FROM pg_indexes
          WHERE schemaname = $1 AND tablename = ANY($2)
          ORDER BY 1, 2, 3`,
        [schema, TABLES],
      );

    beforeAll(async () => {
      await ds.query(`DROP SCHEMA IF EXISTS ${MIGRATION_SCHEMA} CASCADE`);
      await ds.query(`CREATE SCHEMA ${MIGRATION_SCHEMA}`);
      mds = await new DataSource({
        type: 'postgres',
        url: itDatabaseUrl(),
        ssl: itSsl(),
        entities: [],
        extra: {
          options: `-c search_path=${MIGRATION_SCHEMA},${IT_SCHEMA},public`,
          max: 2,
        },
      }).initialize();
      await inMigrationSchema((m) => migration.up(m.queryRunner!));
    });

    afterAll(async () => {
      await mds?.destroy();
    });

    it('builds the same constraints and indexes as synchronize', async () => {
      expect(await constraints(MIGRATION_SCHEMA)).toEqual(
        await constraints(IT_SCHEMA),
      );
    });

    it('is idempotent', async () => {
      await inMigrationSchema((m) => migration.up(m.queryRunner!));
    });

    it('makes audit_logs and status_history append-only', async () => {
      const org = fx.clinicA.organizationId;
      await inMigrationSchema(async (m) => {
        await m.query(
          `INSERT INTO audit_logs (organization_id, entity_type, entity_id, action, actor_side)
           VALUES ($1, 'lab', gen_random_uuid(), 'create', 'platform')`,
          [org],
        );
        await m.query(
          `INSERT INTO status_history (organization_id, entity_type, entity_id, to_state, action_code, actor_side)
           VALUES ($1, 'lab_clinic_link', gen_random_uuid(), 'invited', 'invite', 'clinic')`,
          [org],
        );
      });
      for (const sql of [
        `UPDATE audit_logs SET entity_type = 'x'`,
        `DELETE FROM audit_logs`,
        `UPDATE status_history SET reason = 'x'`,
        `DELETE FROM status_history`,
      ]) {
        await expect(inMigrationSchema((m) => m.query(sql))).rejects.toThrow(
          /append-only/,
        );
      }
    });

    it('reverts cleanly', async () => {
      await inMigrationSchema((m) => migration.down(m.queryRunner!));
      const left: unknown[] = await ds.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
        [MIGRATION_SCHEMA],
      );
      expect(left).toEqual([]);
    });
  });
});
