import { QueryClient } from '@tanstack/react-query';

import { createPatientInvalidator } from './realtime-invalidation';

function setup() {
  jest.useFakeTimers();
  const qc = new QueryClient();
  const spy = jest.spyOn(qc, 'invalidateQueries').mockResolvedValue();
  return { spy, inv: createPatientInvalidator(qc, 100) };
}
afterEach(() => jest.useRealTimers());

const keys = (spy: jest.SpyInstance) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);

describe('patient invalidator', () => {
  it('a burst of visit events refetches the active queue once', () => {
    const { spy, inv } = setup();
    inv.visitEvent({ entryId: 'e1', seq: 1 });
    inv.visitEvent({ entryId: 'e1', seq: 2 });
    inv.visitEvent({ entryId: 'e2', seq: 2 });
    expect(spy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(keys(spy)).toEqual([['queue-active']]);
  });

  it('feed.changed maps kinds to query roots', () => {
    const { spy, inv } = setup();
    inv.feedChanged({ kinds: ['appointments', 'links'] });
    jest.advanceTimersByTime(100);
    const k = keys(spy).map((x) => x[0]);
    expect(k).toEqual(
      expect.arrayContaining(['records-appointments', 'records-appointments-upcoming', 'links']),
    );
  });

  it('dispose drops pending work', () => {
    const { spy, inv } = setup();
    inv.all();
    inv.dispose();
    jest.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
  });
});
