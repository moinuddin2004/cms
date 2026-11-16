import type { DataSource } from 'typeorm';
import { MedicationSweepService } from './medication-sweep.service';
import type { MedicationSyncService } from './medication-sync.service';

function build(rows: { id: string }[], sync: Partial<MedicationSyncService>) {
  const query = jest.fn().mockResolvedValue(rows);
  const svc = new MedicationSweepService(
    { query } as unknown as DataSource,
    sync as MedicationSyncService,
  );
  return { svc, query };
}

describe('MedicationSweepService', () => {
  it('re-syncs every prescription that is missing or behind the version marker', async () => {
    const syncPrescription = jest.fn().mockResolvedValue({});
    const { svc, query } = build([{ id: 'a' }, { id: 'b' }], { syncPrescription });
    expect(await svc.sweep()).toBe(2);
    expect(syncPrescription.mock.calls).toEqual([['a'], ['b']]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("p.status = 'FINALIZED'");
    expect(sql).toContain("l.status = 'active'");
    expect(sql).toContain('s.prescription_version >= p.version');
    expect(query.mock.calls[0][1]).toEqual([14]);
  });

  it('one failing prescription does not stop the rest', async () => {
    const syncPrescription = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});
    const { svc } = build([{ id: 'a' }, { id: 'b' }], { syncPrescription });
    expect(await svc.sweep()).toBe(1);
    expect(syncPrescription).toHaveBeenCalledTimes(2);
  });

  it('a failing query is swallowed', async () => {
    const svc = new MedicationSweepService(
      { query: jest.fn().mockRejectedValue(new Error('db down')) } as unknown as DataSource,
      {} as MedicationSyncService,
    );
    await expect(svc.sweep()).resolves.toBe(0);
  });

  it('does not run twice at once', async () => {
    let release!: () => void;
    const syncPrescription = jest.fn(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const { svc } = build([{ id: 'a' }], { syncPrescription: syncPrescription as never });
    const first = svc.sweep();
    await Promise.resolve();
    await Promise.resolve();
    expect(await svc.sweep()).toBe(0);
    release();
    expect(await first).toBe(1);
  });
});
