import { HOUR_MS, actionsByDose, expandDoses } from './doses';
import type { DoseEvent, MealRelation, MedicationSchedule } from '../types/medications.types';

/** Defaults from the card: plan 72 h ahead, at most 60 pending (iOS keeps 64 per app). */
export const DEFAULT_HORIZON_MS = 72 * HOUR_MS;
export const DEFAULT_CAP = 60;

/**
 * One local notification to be scheduled. It carries the FIELDS the text is built from, not the
 * text itself — and a private reminder carries `null` for everything clinical, so the medicine
 * name can never reach the lock screen by accident (docs/03 §5, A-14).
 */
export interface ReminderRequest {
  /** `dose.<scheduleId>.<dueMs>` — stable; the scheduler appends a content hash. */
  id: string;
  /** When the OS should fire it (= the dose time). */
  fireAtMs: number;
  /** UTC ISO instant of the dose (a dose-event `dueAt`). */
  dueAt: string;
  scheduleId: string;
  profileId: string;
  private: boolean;
  /** First name of the family member; `null` when unknown. */
  profileName: string | null;
  medicineName: string | null;
  doseText: string | null;
  mealRelation: MealRelation | null;
}

export interface PlanContext {
  /** Profile → "private reminders" on (a missing answer means off, docs/03 §5). */
  isPrivate?: (profileId: string) => boolean;
  /** Profile → display name ("Ali R. Khan" → "Ali" is done by the caller or the text builder). */
  profileName?: (profileId: string) => string | null;
}

export const reminderRequestId = (scheduleId: string, dueMs: number) => `dose.${scheduleId}.${dueMs}`;

/**
 * The next reminders to schedule: every dose due in `(now, now + horizon]` of an active schedule
 * that has no taken/skipped event yet, earliest first, capped at `cap`.
 */
export function planReminders(
  schedules: readonly MedicationSchedule[],
  events: readonly DoseEvent[],
  now: number | Date,
  horizonMs: number = DEFAULT_HORIZON_MS,
  cap: number = DEFAULT_CAP,
  ctx: PlanContext = {},
): ReminderRequest[] {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  if (cap <= 0) return [];
  const acted = actionsByDose(events);
  const byId = new Map(schedules.map((s) => [s.id, s]));

  const due = expandDoses(schedules, nowMs + 1, nowMs + horizonMs + 1).filter((d) => !acted.has(d.key));

  return due.slice(0, cap).map((d) => {
    const s = byId.get(d.scheduleId)!;
    const isPrivate = ctx.isPrivate?.(d.profileId) ?? false;
    return {
      id: reminderRequestId(d.scheduleId, d.dueMs),
      fireAtMs: d.dueMs,
      dueAt: d.dueAt,
      scheduleId: d.scheduleId,
      profileId: d.profileId,
      private: isPrivate,
      profileName: ctx.profileName?.(d.profileId) ?? null,
      medicineName: isPrivate ? null : s.name,
      doseText: isPrivate ? null : s.doseText || null,
      mealRelation: isPrivate ? null : s.mealRelation,
    };
  });
}
