import { formatInZone } from '@/core/datetime';
import {
  DAY_MS,
  actionsByDose,
  expandDoses,
  localDayStart,
  localYmd,
  type DoseAction,
  type DoseEvent,
  type MealRelation,
  type MedicationSchedule,
} from '@/patient/features/medications';
import type { PatientAppointment } from '@/patient/features/records';

/**
 * Pure model of the Today screen (docs/06 P-02): built on the device from cached schedules, dose
 * events (server + unsent local ones) and appointments, so it works offline.
 */
export type DoseGroup = 'morning' | 'afternoon' | 'evening' | 'night';
export type DoseState = 'pending' | DoseAction;

export interface TodayDose {
  key: string;
  scheduleId: string;
  profileId: string;
  name: string;
  doseText: string;
  mealRelation: MealRelation;
  /** `HH:mm`. */
  time: string;
  dueAt: string;
  dueMs: number;
  state: DoseState;
  group: DoseGroup;
  /** Whole days until the last day of the course (0 = today); `null` when there is no end date or it is far off. */
  courseEndsInDays: number | null;
}

/** morning 05–11:59 · afternoon 12–16:59 · evening 17–20:59 · night 21–04:59 (phone clock). */
export function groupOf(time: string): DoseGroup {
  const hour = Number(time.slice(0, 2));
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export const GROUP_ORDER: readonly DoseGroup[] = ['morning', 'afternoon', 'evening', 'night'];

/** Days from `fromYmd` to `toYmd` (both phone-calendar dates). */
function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00`).getTime();
  const b = new Date(`${toYmd}T12:00:00`).getTime();
  return Math.round((b - a) / DAY_MS);
}

/** Every dose of the phone's calendar day containing `nowMs`, with its state. */
export function buildTodayDoses(
  schedules: readonly MedicationSchedule[],
  events: readonly DoseEvent[],
  nowMs: number,
): TodayDose[] {
  const start = localDayStart(nowMs);
  const end = localDayStart(nowMs, 1);
  const acted = actionsByDose(events);
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const today = localYmd(nowMs);

  return expandDoses(schedules, start, end).map((d) => {
    const s = byId.get(d.scheduleId)!;
    const left = s.endDate ? daysBetween(today, s.endDate) : null;
    return {
      key: d.key,
      scheduleId: d.scheduleId,
      profileId: d.profileId,
      name: s.name,
      doseText: s.doseText,
      mealRelation: s.mealRelation,
      time: d.time,
      dueAt: d.dueAt,
      dueMs: d.dueMs,
      state: acted.get(d.key)?.action ?? 'pending',
      group: groupOf(d.time),
      courseEndsInDays: left !== null && left >= 0 && left <= 2 ? left : null,
    };
  });
}

export interface DoseSection {
  group: DoseGroup;
  doses: TodayDose[];
}

/** Non-empty sections in day order. */
export function groupDoses(doses: readonly TodayDose[]): DoseSection[] {
  return GROUP_ORDER.map((group) => ({ group, doses: doses.filter((d) => d.group === group) })).filter(
    (s) => s.doses.length > 0,
  );
}

const OPEN_STATUSES = new Set(['scheduled', 'confirmed', 'checked_in']);

export interface AppointmentSections {
  today: PatientAppointment[];
  comingUp: PatientAppointment[];
}

/**
 * Open appointments split into "today" and "the next 3 days", each judged on the APPOINTMENT's own
 * clinic clock (its location timezone) — never the phone's (CLAUDE.md "Time").
 */
export function splitAppointments(
  appointments: readonly PatientAppointment[],
  nowMs: number,
): AppointmentSections {
  const open = appointments
    .filter((a) => OPEN_STATUSES.has(a.status))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const todayList: PatientAppointment[] = [];
  const comingUp: PatientAppointment[] = [];

  for (const a of open) {
    const start = Date.parse(a.startTime);
    if (Number.isNaN(start)) continue;
    const zone = a.location.timezone;
    const dayOf = formatInZone(start, zone, 'yyyy-MM-dd');
    const todayThere = formatInZone(nowMs, zone, 'yyyy-MM-dd');
    if (dayOf === todayThere) {
      if (start >= nowMs - 60 * 60 * 1000) todayList.push(a); // still relevant for an hour after the start
    } else if (dayOf > todayThere && start <= nowMs + 3 * DAY_MS) {
      comingUp.push(a);
    }
  }
  return { today: todayList, comingUp };
}
