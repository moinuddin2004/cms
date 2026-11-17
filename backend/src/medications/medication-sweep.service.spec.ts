import type { DataSource } from 'typeorm';
import { MedicationSweepService } from './medication-sweep.service';
import type { SchedulerRegistry } from '@nestjs/schedule';
import type { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import type { MedicationSyncService } from './medication-sync.service';

const flags = (on: (org: string) => boolean = () => true) =>
  ({
    isFeatureEnabled: jest.fn((org: string) => Promise.resolve(on(org))),
  }) as unknown as FeatureFlagsService;

function build(rows: { id: string }[], sync: Partial<MedicationSyncService>) {
  const query = jest.fn().mockResolvedValue(rows);
  const svc = new MedicationSweepService(
    { query } as unknown as DataSource,
    sync as MedicationSyncService,
    flags(),
  );
  return { svc, query };
}

describe('MedicationSweepService', () => {
  it('re-syncs every prescription that is missing or behind the version marker', async () => {
    const syncPrescription = jest.fn().mockResolvedValue({});
    const { svc, query } = build([{ id: 'a' }, { id: 'b' }], {
      syncPrescription,
    });
    expect(await svc.sweep()).toBe(2);
    expect(syncPrescription.mock.calls).toEqual([['a'], ['b']]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("p.status = 'FINALIZED'");
    expect(sql).toContain("l.status = 'active'");
    expect(sql).toContain('s.prescription_version >= p.version');
    expect(sql).toContain('NOT s.hidden');
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
      {
        query: jest.fn().mockRejectedValue(new Error('db down')),
      } as unknown as DataSource,
      {} as MedicationSyncService,
      flags(),
    );
    await expect(svc.sweep()).resolves.toBe(0);
  });

  it('does not run twice at once', async () => {
    let release!: () => void;
    const syncPrescription = jest.fn(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const { svc } = build([{ id: 'a' }], {
      syncPrescription: syncPrescription as never,
    });
    const first = svc.sweep();
    await Promise.resolve();
    await Promise.resolve();
    expect(await svc.sweep()).toBe(0);
    release();
    expect(await first).toBe(1);
  });

  it('skips prescriptions of clinics with the patient app off (M10)', async () => {
    const syncPrescription = jest.fn().mockResolvedValue({});
    const query = jest.fn().mockResolvedValue([
      { id: 'off', organization_id: 'o1', location_id: 'l1', signed_at: 't1' },
      { id: 'on', organization_id: 'o2', location_id: 'l2', signed_at: 't2' },
    ]);
    const svc = new MedicationSweepService(
      { query } as unknown as DataSource,
      { syncPrescription } as unknown as MedicationSyncService,
      flags((org) => org !== 'o1'),
    );
    expect(await svc.sweep()).toBe(1);
    expect(syncPrescription.mock.calls).toEqual([['on']]);
  });

  it('pages past skipped clinics instead of starving the rest (M10)', async () => {
    const syncPrescription = jest.fn().mockResolvedValue({});
    const full = Array.from({ length: 200 }, (_, i) => ({
      id: `off${i}`,
      organization_id: 'o1',
      location_id: null,
      signed_at: `t${i}`,
    }));
    const query = jest
      .fn()
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce([
        { id: 'ok', organization_id: 'o2', location_id: null, signed_at: 'x' },
      ]);
    const svc = new MedicationSweepService(
      { query } as unknown as DataSource,
      { syncPrescription } as unknown as MedicationSyncService,
      flags((org) => org !== 'o1'),
    );
    expect(await svc.sweep()).toBe(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1]).toEqual([14, 't199', 'off199']);
  });

  it('runs the startup sweep only where scheduled jobs run (L19)', () => {
    jest.useFakeTimers();
    try {
      const mk = (scheduler?: SchedulerRegistry) => {
        const svc = new MedicationSweepService(
          { query: jest.fn().mockResolvedValue([]) } as unknown as DataSource,
          {} as MedicationSyncService,
          flags(),
          scheduler,
        );
        const spy = jest.spyOn(svc, 'sweep').mockResolvedValue(0);
        svc.onModuleInit();
        jest.advanceTimersByTime(60_000);
        svc.onModuleDestroy();
        return spy;
      };
      expect(mk()).not.toHaveBeenCalled();
      expect(mk({} as SchedulerRegistry)).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
