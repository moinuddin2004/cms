import { trendLabel } from './clinic-overview.service';

describe('trendLabel', () => {
  it('labels day, week and month buckets', () => {
    expect(trendLabel('day', '2026-10-06')).toBe('06/10');
    expect(trendLabel('week', '2026-10-06')).toBe('6 Oct');
    expect(trendLabel('month', '2026-10-01')).toBe('Oct 26');
  });
});
