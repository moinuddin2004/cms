import { deviceTimezone, isYmd, todayYmdInZone } from '@/core/datetime';

export type DobCheck = 'ok' | 'invalid' | 'future';

/** Is `value` ("YYYY-MM-DD") a real calendar day, and not after `today`? Compares as text, so no timezone maths. */
export function checkDob(value: string, today: string = todayYmdInZone(deviceTimezone())): DobCheck {
  if (!isYmd(value)) return 'invalid';
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return 'invalid';
  }
  if (y < 1900) return 'invalid';
  return value > today ? 'future' : 'ok';
}
