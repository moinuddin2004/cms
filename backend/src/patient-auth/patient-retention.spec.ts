import {
  PatientRetentionJob,
  PatientRetentionRuntimeModule,
} from './patient-retention.job';
import { readPatientLimits } from './patient-config';

describe('PatientRetentionJob', () => {
  const make = (env: Record<string, string> = {}) => {
    const query = jest.fn().mockResolvedValue([[], 3]);
    const job = new PatientRetentionJob(
      { query } as never,
      readPatientLimits(env),
    );
    return { job, query };
  };

  it('purges ended sessions, old product events and expired login codes with the configured ages', async () => {
    const { job, query } = make();
    await expect(job.run()).resolves.toEqual({
      sessions: 3,
      events: 3,
      codes: 3,
    });
    const sql = query.mock.calls.map((c) =>
      (c[0] as string).replace(/\s+/g, ' '),
    );
    expect(sql[0]).toContain('DELETE FROM patient_sessions');
    expect(sql[0]).toContain('make_interval(months => $1)');
    expect(sql[0]).not.toContain('revoked_at IS NULL'); // live sessions are never matched
    expect(sql[1]).toContain('DELETE FROM product_events');
    expect(sql[2]).toContain('DELETE FROM patient_login_codes');
    expect(query.mock.calls.map((c) => (c[1] as number[])[0])).toEqual([
      6, 400, 2,
    ]);
  });

  it('a retention of 0 keeps that table forever', async () => {
    const { job, query } = make({
      PATIENT_SESSION_RETENTION_MONTHS: '0',
      PRODUCT_EVENT_RETENTION_DAYS: '0',
    });
    await job.run();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('patient_login_codes');
  });

  it('is registered only where jobs run (not on a second api)', () => {
    expect(PatientRetentionRuntimeModule.forRole('api').providers).toEqual([]);
    expect(PatientRetentionRuntimeModule.forRole('all').providers).toHaveLength(
      2,
    );
    expect(
      PatientRetentionRuntimeModule.forRole('worker').providers,
    ).toHaveLength(2);
  });
});
