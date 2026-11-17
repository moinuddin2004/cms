import { t as translateNow, type TFunction } from '@/core/i18n';

import { DEFAULT_CAP, DEFAULT_HORIZON_MS, type ReminderRequest } from './plan-reminders';
import { buildReminderContent } from './reminder-content';
import { REMINDER_ID_PREFIX, contentHash, toScheduled, type ScheduledReminder } from './reminder-scheduler';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * The plan only reaches 72 h ahead (A-09): without a nudge a patient who never opens the app would
 * silently stop being reminded (audit H3). A final notification is scheduled right where the planned
 * window ends — at the last planned reminder when the 60-notification cap cut the window short,
 * otherwise `now + horizon`. Nothing is planned → no nudge (there is nothing to keep alive).
 */
export function windowEndReminder(
  plan: readonly ReminderRequest[],
  nowMs: number,
  t: TFunction = translateNow,
  horizonMs: number = DEFAULT_HORIZON_MS,
  cap: number = DEFAULT_CAP,
): ScheduledReminder | null {
  if (plan.length === 0) return null;
  const last = plan[plan.length - 1].fireAtMs;
  // Rounded UP to the hour so the id (and therefore the OS state) is stable between passes.
  const fireAtMs =
    plan.length >= cap
      ? last + MINUTE_MS
      : Math.ceil(Math.max(nowMs + horizonMs, last + MINUTE_MS) / HOUR_MS) * HOUR_MS;
  const content = { title: t('reminders.window.title'), body: t('reminders.window.body') };
  return {
    id: `${REMINDER_ID_PREFIX}window-end.${fireAtMs}.${contentHash(content)}`,
    fireAtMs,
    title: content.title,
    body: content.body,
    data: { space: 'patient', type: 'medication.window', route: '/today', entityId: '' },
  };
}

/** Plan → everything to schedule: one notification per dose plus the window-end nudge. */
export function buildScheduledReminders(
  plan: readonly ReminderRequest[],
  nowMs: number,
  t: TFunction = translateNow,
): ScheduledReminder[] {
  const doses = toScheduled(plan, (r) => buildReminderContent(r, t));
  const end = windowEndReminder(plan, nowMs, t);
  return end ? [...doses, end] : doses;
}
