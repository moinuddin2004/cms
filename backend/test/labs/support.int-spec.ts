import { DataSource } from 'typeorm';
import { NumberSequenceService } from 'src/common/sequences/number-sequence.service';
import { LabsFixture, createLabsFixture } from './labs-it.harness';

const IT_SCHEMA = 'labs_it_support';

/** Support tables (lab ERD §8). */
describe('Labs integration — support tables', () => {
  let fx: LabsFixture;
  let ds: DataSource;

  beforeAll(async () => {
    fx = await createLabsFixture(IT_SCHEMA);
    ds = fx.dataSource;
  }, 300_000);

  afterAll(async () => {
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
});
