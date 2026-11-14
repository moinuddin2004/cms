import type { AppointmentListItem } from '../types/appointments.types';

import { selectArrivals } from './arrivals';
import { dayStrip } from './day-strip';
import { groupByHour } from './group-by-hour';

function row(over: Partial<AppointmentListItem> & { id: string; startTime: string }): AppointmentListItem {
  return {
    organizationId: 'o',
    locationId: 'l',
    patientId: 'p',
    doctorId: 'd',
    type: 'checkup',
    status: 'scheduled',
    endTime: over.startTime,
    durationMinutes: 30,
    reasonForVisit: null,
    isEmergency: false,
    notes: null,
    checkedInAt: null,
    patient: { id: 'p', fullName: 'A', phone: '1', patientNumber: null },
    doctor: { id: 'd', fullName: 'Dr' },
    queueEntry: null,
    ...over,
  };
}

describe('groupByHour', () => {
  it('groups on the clinic clock, not UTC (Karachi UTC+5)', () => {
    // 19:30Z Nov 1 = 00:30 Nov 2 in Karachi; 04:10Z = 09:10; 04:50Z = 09:50
    const groups = groupByHour(
      [
        row({ id: 'c', startTime: '2026-11-02T04:50:00.000Z' }),
        row({ id: 'a', startTime: '2026-11-01T19:30:00.000Z' }),
        row({ id: 'b', startTime: '2026-11-02T04:10:00.000Z' }),
      ],
      'Asia/Karachi',
    );
    expect(groups.map((g) => [g.hour, g.label, g.items.map((i) => i.id)])).toEqual([
      [0, '12 AM', ['a']],
      [9, '9 AM', ['b', 'c']],
    ]);
  });

  it('returns no groups for no rows and does not mutate the input', () => {
    expect(groupByHour([], 'Asia/Karachi')).toEqual([]);
    const input = [
      row({ id: 'z', startTime: '2026-11-02T10:00:00.000Z' }),
      row({ id: 'y', startTime: '2026-11-02T06:00:00.000Z' }),
    ];
    groupByHour(input, 'Asia/Karachi');
    expect(input.map((r) => r.id)).toEqual(['z', 'y']);
  });

  it('shifts a row to another hour when the zone differs', () => {
    const r = row({ id: 'a', startTime: '2026-11-02T10:00:00.000Z' });
    expect(groupByHour([r], 'Asia/Karachi')[0].hour).toBe(15);
    expect(groupByHour([r], 'America/New_York')[0].hour).toBe(5);
  });
});

describe('dayStrip', () => {
  it('runs yesterday … today + 6 (8 days)', () => {
    expect(dayStrip('2026-11-14')).toEqual([
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ]);
  });

  it('crosses month and year boundaries', () => {
    const days = dayStrip('2026-12-30');
    expect(days[0]).toBe('2026-12-29');
    expect(days[7]).toBe('2027-01-05');
  });

  it('crosses a DST change without skipping or repeating a day', () => {
    expect(dayStrip('2026-11-01')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ]);
  });

  it('is empty for an invalid date', () => {
    expect(dayStrip('nope')).toEqual([]);
  });
});

describe('selectArrivals', () => {
  it('keeps only scheduled/confirmed bookings without a queue entry, earliest first', () => {
    const entry = { id: 'e', token: 'A-001', status: 'waiting', sessionId: 's' };
    const out = selectArrivals([
      row({ id: 'late', startTime: '2026-11-02T10:00:00.000Z', status: 'confirmed' }),
      row({ id: 'early', startTime: '2026-11-02T06:00:00.000Z', status: 'scheduled' }),
      row({ id: 'in', startTime: '2026-11-02T07:00:00.000Z', status: 'scheduled', queueEntry: entry }),
      row({ id: 'chk', startTime: '2026-11-02T08:00:00.000Z', status: 'checked_in' }),
      row({ id: 'done', startTime: '2026-11-02T08:00:00.000Z', status: 'completed' }),
      row({ id: 'ns', startTime: '2026-11-02T08:00:00.000Z', status: 'no_show' }),
      row({ id: 'x', startTime: '2026-11-02T08:00:00.000Z', status: 'cancelled' }),
      row({ id: 'walk', startTime: '2026-11-02T08:00:00.000Z', kind: 'walk_in' }),
    ]);
    expect(out.map((r) => r.id)).toEqual(['early', 'late']);
  });
});
