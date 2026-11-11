import type { Organization, SignInBlock } from '@/staff/store/useStaffAuthStore';

import { locationOptions } from './location-options';

const org = (id: string, locations: string[], signInBlock: SignInBlock | null = null): Organization => ({
  id,
  name: `Clinic ${id}`,
  slug: id,
  accessSource: 'employee',
  specialtyTags: [],
  signInBlock,
  locations: locations.map((l) => ({
    id: l,
    name: `Loc ${l}`,
    code: l,
    isMainBranch: false,
    accessSource: 'employee',
    isPrimary: false,
  })),
});

describe('locationOptions', () => {
  it('flags the current place and skips blocked clinics', () => {
    const blocked: SignInBlock = { code: 'CLINIC_REJECTED', message: 'no' };
    const opts = locationOptions([org('a', ['1', '2']), org('b', ['3'], blocked)], 'a', '2');
    expect(opts.map((o) => [o.label, o.current])).toEqual([
      ['Loc 1', false],
      ['Loc 2', true],
    ]);
  });

  it('prefixes the clinic name when there are several clinics', () => {
    const opts = locationOptions([org('a', ['1']), org('b', ['2'])], null, null);
    expect(opts.map((o) => o.label)).toEqual(['Clinic a · Loc 1', 'Clinic b · Loc 2']);
  });
});
