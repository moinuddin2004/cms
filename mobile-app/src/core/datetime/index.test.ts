import { dayBoundsInZone, formatInZone, zonedDateTimeToUtc } from './index';

/**
 * Zone conversions are the source of every clinic date/time on screen
 * (docs/04 §10). These tests pin both a zone without DST (Asia/Karachi,
 * UTC+05) and one that changes offset (America/New_York), including the two
 * 2026 DST boundaries.
 */
describe('core/datetime dayBoundsInZone', () => {
  it('bounds a Karachi day (UTC+05, no DST)', () => {
    expect(dayBoundsInZone('2026-11-02', 'Asia/Karachi')).toEqual({
      start: '2026-11-01T19:00:00.000Z',
      end: '2026-11-02T18:59:59.999Z',
    });
  });

  it('bounds a New York day when DST starts (2026-03-08)', () => {
    expect(dayBoundsInZone('2026-03-08', 'America/New_York')).toEqual({
      // Midnight is still EST (UTC-05); the following midnight is EDT (UTC-04).
      start: '2026-03-08T05:00:00.000Z',
      end: '2026-03-09T03:59:59.999Z',
    });
  });

  it('bounds a New York day when DST ends (2026-11-01)', () => {
    expect(dayBoundsInZone('2026-11-01', 'America/New_York')).toEqual({
      // Midnight is still EDT (UTC-04); the following midnight is EST (UTC-05).
      start: '2026-11-01T04:00:00.000Z',
      end: '2026-11-02T04:59:59.999Z',
    });
  });
});

describe('core/datetime formatInZone', () => {
  const instant = '2026-11-02T10:00:00.000Z';

  it('shows a UTC instant on the Karachi clock', () => {
    expect(formatInZone(instant, 'Asia/Karachi', 'yyyy-MM-dd HH:mm')).toBe('2026-11-02 15:00');
  });

  it('shows the same instant on the New York clock', () => {
    expect(formatInZone(instant, 'America/New_York', 'yyyy-MM-dd HH:mm')).toBe(
      '2026-11-02 05:00',
    );
  });

  it('rolls the calendar date with the zone', () => {
    expect(formatInZone('2026-11-02T20:30:00.000Z', 'Asia/Karachi', 'yyyy-MM-dd HH:mm')).toBe(
      '2026-11-03 01:30',
    );
    expect(formatInZone('2026-11-02T20:30:00.000Z', 'America/New_York', 'yyyy-MM-dd HH:mm')).toBe(
      '2026-11-02 15:30',
    );
  });

  it('formats a calendar date without a timezone shift', () => {
    expect(formatInZone('2026-11-02', 'America/New_York', 'MMM d, yyyy')).toBe('Nov 2, 2026');
  });

  it('returns an em dash for empty or invalid values', () => {
    expect(formatInZone(null, 'Asia/Karachi', 'HH:mm')).toBe('—');
    expect(formatInZone('not-a-date', 'Asia/Karachi', 'HH:mm')).toBe('—');
  });
});

describe('core/datetime zonedDateTimeToUtc', () => {
  it('converts the same wall time to a different UTC instant per zone', () => {
    expect(zonedDateTimeToUtc('2026-11-02', '09:30', 'Asia/Karachi')).toBe(
      '2026-11-02T04:30:00.000Z',
    );
    expect(zonedDateTimeToUtc('2026-11-02', '09:30', 'America/New_York')).toBe(
      '2026-11-02T14:30:00.000Z',
    );
  });
});
