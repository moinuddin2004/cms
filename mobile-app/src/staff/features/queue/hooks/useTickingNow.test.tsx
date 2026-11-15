import { act, renderHook } from '@testing-library/react-native';

import { useTickingNow } from './useTickingNow';

describe('useTickingNow', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts at the server time and advances by the elapsed phone time every minute', async () => {
    const { result } = await renderHook(() => useTickingNow('2026-11-15T08:30:00.000Z'));
    expect(result.current).toBe('2026-11-15T08:30:00.000Z');

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('2026-11-15T08:31:00.000Z');

    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });
    expect(result.current).toBe('2026-11-15T08:33:00.000Z');
  });

  it('re-bases on a new snapshot', async () => {
    const { result, rerender } = await renderHook(
      ({ now }: { now: string }) => useTickingNow(now),
      { initialProps: { now: '2026-11-15T08:30:00.000Z' } },
    );
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await rerender({ now: '2026-11-15T08:45:00.000Z' });
    expect(result.current).toBe('2026-11-15T08:45:00.000Z');
  });
});
