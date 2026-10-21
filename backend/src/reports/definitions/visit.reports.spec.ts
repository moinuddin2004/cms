import { hourMatrix } from './visit.reports';

describe('hourMatrix', () => {
  it('pivots check-ins into one row per hour with weekday columns', () => {
    const rows = hourMatrix([
      { dow: 1, hour: 9, n: '2' },
      { dow: 6, hour: 9, n: 3 },
      { dow: 7, hour: 23, n: '1' },
    ]);
    expect(rows).toEqual([
      {
        hour: '09:00–10:00',
        mon: 2,
        tue: 0,
        wed: 0,
        thu: 0,
        fri: 0,
        sat: 3,
        sun: 0,
        total: 5,
      },
      {
        hour: '23:00–00:00',
        mon: 0,
        tue: 0,
        wed: 0,
        thu: 0,
        fri: 0,
        sat: 0,
        sun: 1,
        total: 1,
      },
    ]);
  });
});
