import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { dayBoundsInZone, todayYmdInZone } from '@/core/datetime';

import { useClinicToday } from './clinic-today';

const ZONE = 'Asia/Karachi'; // UTC+5, no DST
jest.mock('@/staff/lib/datetime', () => {
  const core = jest.requireActual<typeof import('@/core/datetime')>('@/core/datetime');
  return {
    useClinicTimezone: () => 'Asia/Karachi',
    todayYmd: () => core.todayYmdInZone('Asia/Karachi'),
    clinicDayBounds: (ymd: string) => core.dayBoundsInZone(ymd, 'Asia/Karachi'),
  };
});

describe('useClinicToday', () => {
  let handler: ((s: string) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    // 23:30 on 2026-11-14 in Karachi.
    jest.setSystemTime(new Date('2026-11-14T18:30:00Z'));
    handler = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      handler = fn as (s: string) => void;
      return { remove } as never;
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('sanity: the helpers see 2026-11-14 then 2026-11-15', () => {
    expect(todayYmdInZone(ZONE)).toBe('2026-11-14');
    expect(dayBoundsInZone('2026-11-14', ZONE).end).toBe('2026-11-14T18:59:59.999Z');
  });

  it('rolls to the next day at clinic midnight', async () => {
    const { result, unmount } = await renderHook(() => useClinicToday());
    expect(result.current).toBe('2026-11-14');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(29 * 60_000);
    });
    expect(result.current).toBe('2026-11-14');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2 * 60_000);
    });
    expect(result.current).toBe('2026-11-15');
    await unmount();
  });

  it('re-reads when the app returns to the foreground', async () => {
    const { result, unmount } = await renderHook(() => useClinicToday());
    expect(result.current).toBe('2026-11-14');

    // The phone slept through midnight: timers did not fire, the clock moved on.
    jest.setSystemTime(new Date('2026-11-15T03:00:00Z'));
    await act(async () => {
      handler?.('active');
    });
    expect(result.current).toBe('2026-11-15');

    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
