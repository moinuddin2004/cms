import type { PatientLink } from '@/patient/features/clinics';

import { buildContacts, mapsUrl, telUrl, whatsappUrl } from './contacts';
import { DEFAULT_EMERGENCY_NUMBERS, parseEmergencyNumbers } from './emergency-numbers';

const link = (
  id: string,
  loc: Partial<NonNullable<PatientLink['location']>> | null,
  over: Partial<PatientLink> = {},
): PatientLink => ({
  id,
  profileId: 'p',
  clinic: { organizationId: 'o', name: 'Smile', logoUrl: null, brandColor: null, clinicStatus: 'active' },
  location: loc
    ? {
        id: 'loc',
        name: 'Main',
        timezone: 'UTC',
        phone: '+92 300 1234567',
        whatsapp: null,
        address: '1 Road',
        ...loc,
      }
    : null,
  status: 'active',
  linkedAt: '2026-01-01T00:00:00Z',
  linkMethod: 'qr',
  linkedByLabel: 'x',
  revokedAt: null,
  revokedBy: null,
  ...over,
});

describe('buildContacts', () => {
  it('dedupes by location, drops revoked and unreachable', () => {
    const out = buildContacts([
      link('1', {}),
      link('2', {}),
      link('3', { id: 'loc2' }, { status: 'revoked' }),
      link('4', { id: 'loc3', phone: null, address: null }),
      link('5', null),
    ]);
    expect(out.map((c) => c.key)).toEqual(['loc']);
  });
});

describe('urls', () => {
  it('builds tel / wa.me / maps links', () => {
    expect(telUrl('+92 300 1234567')).toBe('tel:+923001234567');
    expect(telUrl('(021) 555-1234')).toBe('tel:0215551234');
    expect(telUrl('1')).toBeNull();
    expect(whatsappUrl('+92 300 1234567')).toBe('https://wa.me/923001234567');
    expect(whatsappUrl('12')).toBeNull();
    expect(mapsUrl('1 Road & Co')).toContain('1%20Road%20%26%20Co');
  });
});

describe('parseEmergencyNumbers', () => {
  it('falls back to the documented default', () => {
    expect(parseEmergencyNumbers(undefined)).toBe(DEFAULT_EMERGENCY_NUMBERS);
    expect(parseEmergencyNumbers('garbage:abc')).toBe(DEFAULT_EMERGENCY_NUMBERS);
  });
  it('reads labelled and bare entries', () => {
    expect(parseEmergencyNumbers('Ambulance:1122; Police:15 ;999')).toEqual([
      { label: 'Ambulance', number: '1122' },
      { label: 'Police', number: '15' },
      { label: null, number: '999' },
    ]);
  });
});
