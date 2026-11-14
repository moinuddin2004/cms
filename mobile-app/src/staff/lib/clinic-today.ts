import { useEffect, useReducer } from 'react';
import { AppState } from 'react-native';

import { clinicDayBounds, todayYmd, useClinicTimezone } from '@/staff/lib/datetime';

/**
 * "Today" at the active clinic, kept current: re-renders at the next clinic
 * midnight and whenever the app returns to the foreground, so a screen left
 * open overnight (with a live socket nothing else re-renders) switches day.
 */
export function useClinicToday(): string {
  const zone = useClinicTimezone();
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const today = todayYmd();

  useEffect(() => {
    // `end` is the last millisecond of today: +1 is the next midnight.
    const nextMidnight = Date.parse(clinicDayBounds(today).end) + 1;
    const timer = setTimeout(bump, Math.max(nextMidnight - Date.now(), 0) + 50);
    return () => clearTimeout(timer);
    // `tick` re-arms the timer if it fired a hair early; `zone` follows a location change.
  }, [today, tick, zone]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') bump();
    });
    return () => sub.remove();
  }, []);

  return today;
}
