import { addDays, format } from 'date-fns';

import { isYmd, ymdToDate } from '@/core/datetime';

export const DAY_STRIP_BEFORE = 1;
export const DAY_STRIP_AFTER = 6;

/**
 * The schedule's day picker: yesterday … today + 6 as "YYYY-MM-DD" (8 days).
 * `today` is the clinic's calendar date (`todayYmd()`), so the strip follows
 * the clinic clock, not the phone's. An invalid `today` gives an empty strip.
 */
export function dayStrip(today: string): string[] {
  if (!isYmd(today)) return [];
  const base = ymdToDate(today);
  const days: string[] = [];
  for (let i = -DAY_STRIP_BEFORE; i <= DAY_STRIP_AFTER; i += 1) {
    days.push(format(addDays(base, i), 'yyyy-MM-dd'));
  }
  return days;
}
