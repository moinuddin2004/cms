import { isPersistableKey, shouldPersistQuery, staffPersistBuster } from './persist';

const TODAY = '2026-11-13';
const YESTERDAY = '2026-11-12';
const ORG = 'org-1';
const LOC = 'loc-1';

describe('staff persist allow-list', () => {
  const persisted: [string, readonly unknown[]][] = [
    ['access me', ['access', 'me', ORG, LOC]],
    ['my queue session today', ['queue', 'my-session', LOC, TODAY]],
    ['queue board today', ['queue', 'board', LOC, TODAY]],
    ['appointments today', ['appointments', 'list', ORG, LOC, TODAY]],
    ['patient detail', ['patients', 'detail', ORG, LOC, 'p-1']],
  ];
  const neverPersisted: [string, readonly unknown[]][] = [
    ['patient list (holds search text)', ['patients', 'list', ORG, LOC, { search: 'ali' }]],
    ['patient check-phone (holds a phone)', ['patients', 'check-phone', ORG, LOC, '0300']],
    ['patient history', ['patients', 'history', ORG, LOC, 'p-1']],
    ['patient vitals', ['patients', 'vitals', ORG, LOC, 'p-1']],
    ['patient teeth charts', ['patients', 'teeth-charts', ORG, LOC, 'p-1']],
    ['patient prescriptions', ['patients', 'prescriptions', ORG, LOC, 'p-1', 1]],
    ['queue board of another day', ['queue', 'board', LOC, YESTERDAY]],
    ['my queue session of another day', ['queue', 'my-session', LOC, YESTERDAY]],
    ['queue session by id', ['queue', 'session', 's-1']],
    ['queue ticket', ['queue', 'ticket', 'e-1']],
    ['queue patient visits', ['queue', 'patient-visits', 'p-1']],
    ['appointments of another day', ['appointments', 'list', ORG, LOC, YESTERDAY]],
    ['appointments with a filter object', ['appointments', 'list', { q: 'x', day: TODAY }]],
    ['theme', ['theme', 'clinic', ORG, LOC]],
    ['access root alone', ['access']],
    ['unknown root', ['billing', 'invoice', 'i-1']],
    ['empty key', []],
  ];

  it.each(persisted)('persists %s', (_name, key) => {
    expect(isPersistableKey(key, TODAY)).toBe(true);
  });

  it.each(neverPersisted)('never persists %s', (_name, key) => {
    expect(isPersistableKey(key, TODAY)).toBe(false);
  });

  it('persists successful queries only', () => {
    const key = ['access', 'me', ORG, LOC] as const;
    expect(shouldPersistQuery({ queryKey: key, state: { status: 'success' } } as never, TODAY)).toBe(true);
    for (const status of ['pending', 'error']) {
      expect(shouldPersistQuery({ queryKey: key, state: { status } } as never, TODAY)).toBe(false);
    }
  });
});

describe('staffPersistBuster', () => {
  const base = { appVersion: '1.0.0', userId: 'u1', orgId: 'o1', locationId: 'l1' };

  it('changes with build, user, org and location', () => {
    const seen = new Set([
      staffPersistBuster(base),
      staffPersistBuster({ ...base, appVersion: '1.1.0' }),
      staffPersistBuster({ ...base, userId: 'u2' }),
      staffPersistBuster({ ...base, orgId: 'o2' }),
      staffPersistBuster({ ...base, locationId: 'l2' }),
    ]);
    expect(seen.size).toBe(5);
    expect(staffPersistBuster(base)).toBe('1.0.0:u1:o1:l1');
  });

  it('is null while the identity is incomplete', () => {
    expect(staffPersistBuster({ ...base, userId: null })).toBeNull();
    expect(staffPersistBuster({ ...base, orgId: null })).toBeNull();
    expect(staffPersistBuster({ ...base, locationId: null })).toBeNull();
  });
});
