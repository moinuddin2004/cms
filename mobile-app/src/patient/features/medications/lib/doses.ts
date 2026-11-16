import type { DoseAction, DoseEvent, MedicationSchedule } from '../types/medications.types';

/**
 * Pure dose maths shared by the reminder planner and the Today screen.
 *
 * Dose times are PHONE WALL-CLOCK (`HH:mm`, docs/07 A-10 / CLAUDE.md "dose reminders → phone
 * wall-clock"): a dose at "08:00" is 08:00 on whatever clock the phone shows, so every date here is
 * built with the local `Date` constructor — never a clinic zone.
 */
export interface DoseOccurrence {
  /** `<scheduleId>|<dueMs>` — the identity of one dose. */
  key: string;
  scheduleId: string;
  profileId: string;
  /** `HH:mm` as written on the schedule. */
  time: string;
  dueMs: number;
  /** UTC ISO instant — what `dose-events` use as `dueAt`. */
  dueAt: string;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export const doseKey = (scheduleId: string, dueMs: number) => `${scheduleId}|${dueMs}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of an instant on the phone's calendar. */
export const localYmd = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Local midnight (phone clock) of the day containing `ms`, shifted by `days`. */
export const localDayStart = (ms: number, days = 0): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0).getTime();
};

/** Only live, well-formed schedules ever produce doses. */
export const isReminderSchedule = (s: MedicationSchedule): boolean =>
  s.status === 'active' && s.times.length > 0;

/**
 * Every dose of the schedules whose due instant lies in `[fromMs, toMs)`, ordered by time then
 * schedule id. Respects `startDate` / `endDate` (inclusive, phone calendar) and skips malformed
 * times. Paused / stopped / completed schedules produce nothing.
 */
export function expandDoses(
  schedules: readonly MedicationSchedule[],
  fromMs: number,
  toMs: number,
): DoseOccurrence[] {
  const out: DoseOccurrence[] = [];
  if (!(toMs > fromMs)) return out;
  const firstDay = new Date(localDayStart(fromMs));
  const lastDayStart = localDayStart(toMs);

  for (const s of schedules) {
    if (!isReminderSchedule(s)) continue;
    const times = [...new Set(s.times)].filter((t) => HHMM.test(t)).sort();
    for (
      let day = 0, dayStart = firstDay.getTime();
      dayStart <= lastDayStart;
      day += 1, dayStart = localDayStart(firstDay.getTime(), day)
    ) {
      const ymd = localYmd(dayStart);
      if (ymd < s.startDate) continue;
      if (s.endDate && ymd > s.endDate) break;
      const base = new Date(dayStart);
      for (const time of times) {
        const [h, m] = time.split(':').map(Number);
        const dueMs = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0).getTime();
        if (dueMs < fromMs || dueMs >= toMs) continue;
        out.push({
          key: doseKey(s.id, dueMs),
          scheduleId: s.id,
          profileId: s.profileId,
          time,
          dueMs,
          dueAt: new Date(dueMs).toISOString(),
        });
      }
    }
  }
  return out.sort((a, b) => a.dueMs - b.dueMs || a.scheduleId.localeCompare(b.scheduleId));
}

/** `dose key → action` for events (a later `actedAt` wins when a key repeats). */
export function actionsByDose(events: readonly DoseEvent[]): Map<string, { action: DoseAction; actedMs: number }> {
  const map = new Map<string, { action: DoseAction; actedMs: number }>();
  for (const e of events) {
    const dueMs = Date.parse(e.dueAt);
    if (Number.isNaN(dueMs)) continue;
    const actedMs = Date.parse(e.actedAt);
    const key = doseKey(e.scheduleId, dueMs);
    const prev = map.get(key);
    if (!prev || (Number.isNaN(actedMs) ? 0 : actedMs) >= prev.actedMs) {
      map.set(key, { action: e.action, actedMs: Number.isNaN(actedMs) ? 0 : actedMs });
    }
  }
  return map;
}
