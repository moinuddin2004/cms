import { addDays } from 'src/common/clock/tz.util';

/**
 * Pure `YYYY-MM-DD` calendar math for report periods (no timezones: the
 * inputs are already clinic-local days).
 */

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const pad = (n: number) => String(n).padStart(2, '0');

function parts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function monthEnd(ymd: string): string {
  const { y, m } = parts(ymd);
  return `${ymd.slice(0, 7)}-${pad(daysInMonth(y, m))}`;
}

/** Same day `n` months later (clamped to the month's last day). */
export function addMonths(ymd: string, n: number): string {
  const { y, m, d } = parts(ymd);
  const index = y * 12 + (m - 1) + n;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}

/** Inclusive day count of a range. */
export function dayCount(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * The period to compare against. A range starting on the 1st compares with
 * the same days of the previous month (1–21 Oct ↔ 1–21 Sep; a whole month ↔
 * the whole previous month); any other range with the same number of days
 * right before it.
 */
export function previousRange(
  from: string,
  to: string,
): { from: string; to: string } {
  if (from.endsWith('-01')) {
    const months = monthsSpanned(from, to);
    if (to === monthEnd(to)) {
      return {
        from: addMonths(from, -months),
        to: monthEnd(addMonths(monthStart(to), -months)),
      };
    }
    if (months === 1) {
      return { from: addMonths(from, -1), to: addMonths(to, -1) };
    }
  }
  const span = dayCount(from, to);
  return { from: addDays(from, -span), to: addDays(from, -1) };
}

/** Calendar months a range touches (Oct 1 – Nov 3 → 2). */
export function monthsSpanned(from: string, to: string): number {
  const a = parts(from);
  const b = parts(to);
  return (b.y - a.y) * 12 + (b.m - a.m) + 1;
}

/** `YYYY-MM` keys of the `count` months ending with the month of `to`. */
export function trailingMonths(to: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(addMonths(monthStart(to), -i).slice(0, 7));
  }
  return out;
}

/** `2026-10` → `Oct 26`. */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`;
}

/** `2026-10-21` → `21 Oct 2026`. */
export function displayDate(ymd: string): string {
  const { y, m, d } = parts(ymd);
  return `${pad(d)} ${MONTH_SHORT[m - 1]} ${y}`;
}
