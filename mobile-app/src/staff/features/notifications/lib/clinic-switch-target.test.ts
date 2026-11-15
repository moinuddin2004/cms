import type { Organization } from '@/staff/store/useStaffAuthStore';

import { clinicSwitchTarget, orgNameMap } from './clinic-switch-target';

const org = (id: string, locs: string[], block = false) =>
  ({
    id,
    name: `Clinic ${id}`,
    locations: locs.map((l) => ({ id: l, name: l })),
    signInBlock: block ? { code: 'GOOGLE_SIGN_IN_REQUIRED', message: 'x' } : null,
  }) as unknown as Organization;

describe('clinicSwitchTarget', () => {
  const orgs = [org('a', ['a1', 'a2']), org('b', []), org('c', ['c1'], true)];
  it('picks the first location', () => {
    expect(clinicSwitchTarget(orgs, 'a')).toEqual({ organizationId: 'a', locationId: 'a1' });
  });
  it('is null for no locations, blocked or unknown clinics', () => {
    expect(clinicSwitchTarget(orgs, 'b')).toBeNull();
    expect(clinicSwitchTarget(orgs, 'c')).toBeNull();
    expect(clinicSwitchTarget(orgs, 'zzz')).toBeNull();
  });
  it('maps names', () => {
    expect(orgNameMap(orgs).a).toBe('Clinic a');
  });
});
