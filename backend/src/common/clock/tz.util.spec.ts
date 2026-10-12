import {
  addDays,
  dayOfWeekOf,
  localDate,
  localDayRange,
  localHHMM,
  localParts,
  safeTimezone,
  zonedTimeToUtc,
} from './tz.util';

describe('tz.util', () => {
  const KHI = 'Asia/Karachi'; // UTC+5, no DST
  const NY = 'America/New_York'; // DST

  it('reads wall-clock parts in the location timezone, not the server one', () => {
    // 2026-10-12 23:30 UTC is already 13 Oct 04:30 in Karachi.
    const instant = new Date('2026-10-12T23:30:00Z');
    expect(localDate(KHI, instant)).toBe('2026-10-13');
    expect(localHHMM(KHI, instant)).toBe('04:30');
    expect(localParts(KHI, instant).dayOfWeek).toBe(2); // Tuesday
  });

  it('converts a local wall time back to the right instant', () => {
    expect(zonedTimeToUtc(KHI, '2026-10-12', '09:00').toISOString()).toBe(
      '2026-10-12T04:00:00.000Z',
    );
    // New York is UTC-4 in October (EDT) and UTC-5 in December (EST).
    expect(zonedTimeToUtc(NY, '2026-10-12', '09:00').toISOString()).toBe(
      '2026-10-12T13:00:00.000Z',
    );
    expect(zonedTimeToUtc(NY, '2026-12-12', '09:00').toISOString()).toBe(
      '2026-12-12T14:00:00.000Z',
    );
  });

  it('builds a half-open local day range', () => {
    const { start, end } = localDayRange(KHI, '2026-10-12');
    expect(start.toISOString()).toBe('2026-10-11T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-12T19:00:00.000Z');
  });

  it('keeps a 23-hour DST day correct', () => {
    // US spring-forward: 8 March 2026 is 23 hours long in New York.
    const { start, end } = localDayRange(NY, '2026-03-08');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it('does calendar arithmetic without timezone drift', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayOfWeekOf('2026-10-12')).toBe(1); // Monday
  });

  it('falls back to UTC for unknown or empty zones', () => {
    expect(safeTimezone('Not/AZone')).toBe('UTC');
    expect(safeTimezone(null)).toBe('UTC');
    expect(safeTimezone(KHI)).toBe(KHI);
  });
});
