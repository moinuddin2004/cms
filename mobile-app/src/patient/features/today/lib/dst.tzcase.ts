/**
 * Day-boundary cases in a zone with daylight saving. NOT picked up by the normal jest run (its name
 * does not match the default test pattern): `dst.test.ts` starts a child jest with `TZ` set, because
 * the zone of a Jest process cannot be changed from inside a test file.
 */
import { DAY_MS, expandDoses, localDayStart, localYmd } from '@/patient/features/medications';
import type { MedicationSchedule } from '@/patient/features/medications';

import { buildTodayDoses } from './today-model';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

const schedule = (times: string[]): MedicationSchedule => ({
  id: 's1',
  profileId: 'p1',
  source: 'prescription',
  clinic: null,
  prescriptionId: 'rx',
  prescriptionMedicineId: 'm',
  name: 'Amoxicillin',
  nameUrdu: null,
  doseText: '500 mg',
  mealRelation: 'NONE',
  times,
  startDate: '2020-01-01',
  endDate: null,
  endDateSource: 'unknown',
  status: 'active',
  instructions: null,
  instructionsUrdu: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('daylight saving (America/New_York)', () => {
  it('runs in the intended zone with real DST', () => {
    expect(process.env.TZ).toBe('America/New_York');
    expect((at(2026, 3, 9) - at(2026, 3, 8)) / 3600000).toBe(23); // spring forward
    expect((at(2026, 11, 2) - at(2026, 11, 1)) / 3600000).toBe(25); // fall back
  });

  it('a day is 23 h / 25 h long and localDayStart follows the calendar', () => {
    expect(localDayStart(at(2026, 3, 8, 12), 1) - localDayStart(at(2026, 3, 8, 12))).toBe(23 * 3600000);
    expect(localDayStart(at(2026, 11, 1, 12), 1) - localDayStart(at(2026, 11, 1, 12))).toBe(25 * 3600000);
    expect(localYmd(localDayStart(at(2026, 11, 1, 12), 1))).toBe('2026-11-02');
  });

  it('spring forward: every time exists once on the day; a time inside the skipped hour still produces one dose', () => {
    const noon = at(2026, 3, 8, 12);
    const doses = buildTodayDoses([schedule(['02:30', '08:00', '20:00'])], [], noon);
    expect(doses.map((d) => d.time)).toEqual(['02:30', '08:00', '20:00']);
    expect(new Set(doses.map((d) => d.dueMs)).size).toBe(3);
    // 02:30 does not exist: the phone shows it as 03:30 — still on the same calendar day, in order.
    expect(doses[0].dueMs).toBeLessThan(doses[1].dueMs);
    expect(localYmd(doses[0].dueMs)).toBe('2026-03-08');
  });

  it('fall back: the repeated hour produces one dose (the first 01:30), the day has no duplicates', () => {
    const noon = at(2026, 11, 1, 12);
    const doses = buildTodayDoses([schedule(['01:30', '08:00', '20:00'])], [], noon);
    expect(doses.map((d) => d.time)).toEqual(['01:30', '08:00', '20:00']);
    expect(new Set(doses.map((d) => d.dueMs)).size).toBe(3);
  });

  it('a window across the change gives each day its doses exactly once', () => {
    const fall = expandDoses([schedule(['08:00'])], at(2026, 10, 31, 0), at(2026, 11, 2, 12));
    expect(fall.map((d) => d.dueMs)).toEqual([at(2026, 10, 31, 8), at(2026, 11, 1, 8), at(2026, 11, 2, 8)]);
    expect(fall[1].dueMs - fall[0].dueMs).toBe(DAY_MS + 3600000); // 25 h across the fall-back night
    expect(fall[2].dueMs - fall[1].dueMs).toBe(DAY_MS);

    const spring = expandDoses([schedule(['08:00'])], at(2026, 3, 7, 0), at(2026, 3, 9, 12));
    expect(spring.map((d) => d.dueMs)).toEqual([at(2026, 3, 7, 8), at(2026, 3, 8, 8), at(2026, 3, 9, 8)]);
    expect(spring[1].dueMs - spring[0].dueMs).toBe(DAY_MS - 3600000); // 23 h across the spring-forward night
  });
});
