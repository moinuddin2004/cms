import { actionsByDose, expandDoses, localDayStart, localYmd } from './doses';
import { at, event, schedule } from './test-fixtures';

describe('expandDoses', () => {
  it('returns the doses in the half-open window, ordered', () => {
    const out = expandDoses([schedule({ times: ['20:00', '08:00'] })], at(2026, 11, 16, 8), at(2026, 11, 16, 20));
    expect(out.map((d) => d.time)).toEqual(['08:00']);
  });

  it('spans midnight and several schedules', () => {
    const out = expandDoses(
      [schedule({ id: 'b', times: ['06:00'] }), schedule({ id: 'a', times: ['23:30'] })],
      at(2026, 11, 16, 12),
      at(2026, 11, 17, 12),
    );
    expect(out.map((d) => [d.scheduleId, d.dueMs])).toEqual([
      ['a', at(2026, 11, 16, 23, 30)],
      ['b', at(2026, 11, 17, 6)],
    ]);
  });

  it('is empty for an empty or inverted window', () => {
    expect(expandDoses([schedule()], 5, 5)).toEqual([]);
    expect(expandDoses([schedule()], 9, 5)).toEqual([]);
  });

  it('local day helpers use the phone calendar', () => {
    expect(localYmd(at(2026, 1, 5, 23, 59))).toBe('2026-01-05');
    expect(localDayStart(at(2026, 1, 5, 13), 1)).toBe(at(2026, 1, 6));
  });
});

describe('actionsByDose', () => {
  it('latest actedAt wins per dose', () => {
    const due = at(2026, 11, 16, 8);
    const m = actionsByDose([
      event('s1', due, 'taken', 1000),
      event('s1', due, 'skipped', 2000),
      event('s1', due, 'taken', 1500),
    ]);
    expect([...m.values()]).toEqual([{ action: 'skipped', actedMs: 2000 }]);
  });
});
