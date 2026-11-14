import type { AppointmentListItem } from '../types/appointments.types';

import { canCheckIn } from './checkin-rule';
import { groupByHour } from './group-by-hour';
import { STATUS_FILTER_OPTIONS, buildScheduleList, typeLabel } from './schedule-view';

const ZONE = 'Asia/Karachi'; // UTC+5, no DST

const row = (id: string, startTime: string, over: Partial<AppointmentListItem> = {}) =>
  ({
    id,
    status: 'scheduled',
    type: 'checkup',
    startTime,
    endTime: startTime,
    queueEntry: null,
    ...over,
  }) as AppointmentListItem;

describe('buildScheduleList', () => {
  it('puts each hour header before its rows and lists the header indexes', () => {
    // 09:10 and 09:40 Karachi are in the 9 AM group; 11:00 Karachi is its own.
    const groups = groupByHour(
      [
        row('c', '2026-11-15T06:00:00.000Z'),
        row('a', '2026-11-15T04:10:00.000Z'),
        row('b', '2026-11-15T04:40:00.000Z'),
      ],
      ZONE,
    );
    const { items, headerIndices } = buildScheduleList(groups);
    expect(items.map((i) => (i.type === 'header' ? `${i.label}(${i.count})` : i.row.id))).toEqual([
      '9 AM(2)',
      'a',
      'b',
      '11 AM(1)',
      'c',
    ]);
    expect(headerIndices).toEqual([0, 3]);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('is empty for no rows', () => {
    expect(buildScheduleList([])).toEqual({ items: [], headerIndices: [] });
  });

  it('groups on the clinic clock, not the phone clock', () => {
    // 20:30Z is 01:30 the next day in Karachi.
    const groups = groupByHour([row('a', '2026-11-14T20:30:00.000Z')], ZONE);
    expect(groups.map((g) => g.hour)).toEqual([1]);
  });
});

describe('labels', () => {
  it('names every type and offers every status', () => {
    expect(typeLabel('walk_in')).toBe('Walk-in');
    expect(typeLabel('follow_up')).toBe('Follow-up');
    expect(STATUS_FILTER_OPTIONS.map((o) => o.value)).toEqual([
      'scheduled',
      'confirmed',
      'checked_in',
      'completed',
      'cancelled',
      'no_show',
    ]);
  });
});

describe('canCheckIn', () => {
  const ctx = { permitted: true, today: '2026-11-15', zone: ZONE };
  const base = row('a', '2026-11-15T04:00:00.000Z');

  it('is true for a scheduled or confirmed booking today with no queue entry', () => {
    expect(canCheckIn(base, ctx)).toBe(true);
    expect(canCheckIn({ ...base, status: 'confirmed' }, ctx)).toBe(true);
  });

  it('needs queue.checkin', () => {
    expect(canCheckIn(base, { ...ctx, permitted: false })).toBe(false);
  });

  it.each(['checked_in', 'completed', 'cancelled', 'no_show'] as const)('is false for %s', (status) => {
    expect(canCheckIn({ ...base, status }, ctx)).toBe(false);
  });

  it('is false when a queue entry exists or the row is a walk-in', () => {
    const entry = { id: 'e', token: 'A-001', status: 'waiting', sessionId: 's' };
    expect(canCheckIn({ ...base, queueEntry: entry }, ctx)).toBe(false);
    expect(canCheckIn({ ...base, kind: 'walk_in' }, ctx)).toBe(false);
  });

  it('is false on another day, judged on the clinic clock', () => {
    expect(canCheckIn(row('b', '2026-11-16T04:00:00.000Z'), ctx)).toBe(false);
    // 20:00Z on the 14th is 01:00 on the 15th in Karachi: today there.
    expect(canCheckIn(row('c', '2026-11-14T20:00:00.000Z'), ctx)).toBe(true);
    // 20:00Z on the 15th is 01:00 on the 16th in Karachi: not today.
    expect(canCheckIn(row('d', '2026-11-15T20:00:00.000Z'), ctx)).toBe(false);
  });
});
