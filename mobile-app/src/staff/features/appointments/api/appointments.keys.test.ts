import { isPersistableKey } from '@/staff/lib/persist';

import { appointmentKeys } from './appointments.keys';

const TODAY = '2026-11-14';

describe('appointmentKeys', () => {
  it('puts org, location and day in the list and stats keys', () => {
    expect(appointmentKeys.list('o1', 'l1', TODAY)).toEqual(['appointments', 'list', 'o1', 'l1', TODAY]);
    expect(appointmentKeys.stats('o1', 'l1', TODAY)).toEqual(['appointments', 'stats', 'o1', 'l1', TODAY]);
    expect(appointmentKeys.list('o1', 'l2', TODAY)).not.toEqual(appointmentKeys.list('o1', 'l1', TODAY));
  });

  it('treats empty / default filters as no filters', () => {
    const plain = appointmentKeys.list('o', 'l', TODAY);
    expect(appointmentKeys.list('o', 'l', TODAY, {})).toEqual(plain);
    expect(appointmentKeys.list('o', 'l', TODAY, { search: '  ', includeWalkIns: true })).toEqual(plain);
  });

  it('appends a normalised filter object for a filtered list', () => {
    expect(
      appointmentKeys.list('o', 'l', TODAY, { doctorId: 'd', search: ' ali ', status: 'confirmed' }),
    ).toEqual(['appointments', 'list', 'o', 'l', TODAY, { doctorId: 'd', status: 'confirmed', search: 'ali' }]);
  });

  describe('persist allow-list (staff/lib/persist.ts)', () => {
    it("persists only today's unfiltered list", () => {
      expect(isPersistableKey(appointmentKeys.list('o', 'l', TODAY), TODAY)).toBe(true);
      expect(isPersistableKey(appointmentKeys.list('o', 'l', '2026-11-13'), TODAY)).toBe(false);
    });

    it('never persists a filtered / searched list, stats, arrivals, detail or doctors', () => {
      expect(isPersistableKey(appointmentKeys.list('o', 'l', TODAY, { search: 'ali' }), TODAY)).toBe(false);
      expect(isPersistableKey(appointmentKeys.list('o', 'l', TODAY, { doctorId: 'd' }), TODAY)).toBe(false);
      expect(isPersistableKey(appointmentKeys.stats('o', 'l', TODAY), TODAY)).toBe(false);
      expect(isPersistableKey(appointmentKeys.arrivals('o', 'l', TODAY), TODAY)).toBe(false);
      expect(isPersistableKey(appointmentKeys.detail('o', 'l', 'a1'), TODAY)).toBe(false);
      expect(isPersistableKey(appointmentKeys.doctors('o', 'l'), TODAY)).toBe(false);
    });
  });
});
