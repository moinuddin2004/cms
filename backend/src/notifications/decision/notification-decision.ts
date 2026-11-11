import {
  addDays,
  localDate,
  localHHMM,
  zonedTimeToUtc,
} from 'src/common/clock/tz.util';
import {
  isInternalAudience,
  NotificationAudience,
  NotificationChannel,
  OutboxStatus,
} from '../notifications.enums';

export interface QuietHours {
  /** "HH:MM" or "HH:MM:SS" (Postgres `time`). */
  start: string;
  end: string;
  timezone: string;
}

export interface DecisionInput {
  audience: NotificationAudience;
  channel: NotificationChannel;
  isMandatoryInternal: boolean;
  /** `notification_audience_settings.is_enabled` (or its default). */
  audienceEnabled: boolean;
  /** `notification_rules.is_enabled` (or its default). */
  ruleEnabled: boolean;
  /** The patient opted out of this channel. */
  optedOut: boolean;
  quietHours: QuietHours | null;
  now: Date;
}

export type DecisionReason =
  | 'mandatory_internal'
  | 'audience_disabled'
  | 'rule_disabled'
  | 'opted_out'
  | 'quiet_hours'
  | 'enabled';

export interface Decision {
  status: OutboxStatus;
  scheduledFor: Date;
  reason: DecisionReason;
}

/**
 * The §7 decision order — the first check that matches decides the outbox
 * status:
 *   1. internal audience + mandatory event → queued (settings ignored)
 *   2. audience master switch off          → skipped_disabled
 *   3. rule (event × channel) off          → skipped_disabled
 *   4. patient opted out of the channel    → skipped_opt_out
 *   5. inside quiet hours                  → held_quiet_hours until they end
 *   6. otherwise                           → queued
 *
 * Step 1 covers the in-app channel only: "always send" can't mean paid
 * WhatsApp/SMS nobody configured; those follow steps 2–6. Quiet hours hold
 * the store-and-forward channels only: in-app is silent, and push is
 * time-sensitive (M1-04a — a "patient checked in" push delivered next
 * morning is useless), so neither is held.
 */
export function decide(input: DecisionInput): Decision {
  const { now } = input;
  if (
    input.isMandatoryInternal &&
    isInternalAudience(input.audience) &&
    input.channel === NotificationChannel.IN_APP
  ) {
    return {
      status: OutboxStatus.QUEUED,
      scheduledFor: now,
      reason: 'mandatory_internal',
    };
  }
  if (!input.audienceEnabled) {
    return {
      status: OutboxStatus.SKIPPED_DISABLED,
      scheduledFor: now,
      reason: 'audience_disabled',
    };
  }
  if (!input.ruleEnabled) {
    return {
      status: OutboxStatus.SKIPPED_DISABLED,
      scheduledFor: now,
      reason: 'rule_disabled',
    };
  }
  if (input.optedOut) {
    return {
      status: OutboxStatus.SKIPPED_OPT_OUT,
      scheduledFor: now,
      reason: 'opted_out',
    };
  }
  if (input.quietHours && !isQuietHoursExempt(input.channel)) {
    const until = quietHoursEnd(now, input.quietHours);
    if (until) {
      return {
        status: OutboxStatus.HELD_QUIET_HOURS,
        scheduledFor: until,
        reason: 'quiet_hours',
      };
    }
  }
  return { status: OutboxStatus.QUEUED, scheduledFor: now, reason: 'enabled' };
}

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Channels whose delivery is not held back by quiet hours: in-app (silent)
 * and push (time-sensitive — M1-04a). Everything else waits for the window.
 */
const isQuietHoursExempt = (channel: NotificationChannel) =>
  channel === NotificationChannel.IN_APP ||
  channel === NotificationChannel.PUSH;

/** True for a mandatory internal in-app rule — the settings screen shows it locked on. */
export const isLockedRule = (
  isMandatoryInternal: boolean,
  audience: NotificationAudience,
  channel: NotificationChannel,
) =>
  isMandatoryInternal &&
  isInternalAudience(audience) &&
  channel === NotificationChannel.IN_APP;

/**
 * When the quiet window that `now` falls in ends, or null when `now` is
 * outside it. The window is [start, end) in local wall-clock time and may
 * wrap midnight (22:00 → 08:00). start == end means no window.
 */
export function quietHoursEnd(now: Date, q: QuietHours): Date | null {
  const start = hhmm(q.start);
  const end = hhmm(q.end);
  if (start === end) return null;
  const local = localHHMM(q.timezone, now);
  const today = localDate(q.timezone, now);

  let endDay: string | null = null;
  if (start < end) {
    if (local >= start && local < end) endDay = today;
  } else if (local >= start) {
    endDay = addDays(today, 1);
  } else if (local < end) {
    endDay = today;
  }
  return endDay ? zonedTimeToUtc(q.timezone, endDay, end) : null;
}
