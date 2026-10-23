import {
  addMonths,
  dayCount,
  monthLabel,
  monthsSpanned,
  previousRange,
  trailingMonths,
} from './report-dates';

describe('report dates', () => {
  it('adds months, clamping to the month end', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-11-30', 2)).toBe('2027-01-30');
  });

  it('counts days inclusively', () => {
    expect(dayCount('2026-10-01', '2026-10-21')).toBe(21);
    expect(dayCount('2026-10-21', '2026-10-21')).toBe(1);
  });

  it('compares month-to-date with the same days last month', () => {
    expect(previousRange('2026-10-01', '2026-10-21')).toEqual({
      from: '2026-09-01',
      to: '2026-09-21',
    });
  });

  it('compares a whole month with the whole previous month', () => {
    expect(previousRange('2026-03-01', '2026-03-31')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(previousRange('2026-01-01', '2026-03-31')).toEqual({
      from: '2025-10-01',
      to: '2025-12-31',
    });
  });

  it('compares any other range with the same number of days before it', () => {
    expect(previousRange('2026-10-10', '2026-10-19')).toEqual({
      from: '2026-09-30',
      to: '2026-10-09',
    });
  });

  it('lists trailing months and labels them', () => {
    expect(trailingMonths('2026-02-10', 3)).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(monthLabel('2026-10')).toBe('Oct 26');
    expect(monthsSpanned('2026-10-01', '2026-11-03')).toBe(2);
  });
});
