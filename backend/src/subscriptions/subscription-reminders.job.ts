import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { safeTimezone } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import {
  ownerUserIds,
  staffRecipient,
} from 'src/notifications/recipients/staff-recipients';
import {
  formatClinicTime,
  NotificationService,
} from 'src/notifications/services/notification.service';
import { subscriptionState } from './subscription-state';

/** Days before the period ends when owners are reminded. */
export const REMINDER_DAYS = [7, 3, 1] as const;

/**
 * Daily: tells a clinic's owners that the trial / paid period ends soon
 * (7, 3 and 1 day before) and once when it has ended. Each reminder is sent
 * once — the outbox is the record (same pattern as `lab-order-overdue`).
 * Runs where jobs run (worker / all).
 */
@Injectable()
export class SubscriptionRemindersJob {
  private readonly logger = new Logger(SubscriptionRemindersJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationService,
  ) {}

  @Cron('0 4 * * *', { name: 'subscription-reminders' })
  async run(now = new Date()): Promise<number> {
    const orgs = await sqlRows<{
      id: string;
      trial_ends_at: Date | null;
      paid_until: Date | null;
    }>(
      this.dataSource,
      `SELECT id, trial_ends_at, paid_until FROM organizations
        WHERE is_active = true
          AND (trial_ends_at IS NOT NULL OR paid_until IS NOT NULL)`,
    );
    let sent = 0;
    for (const o of orgs) {
      try {
        if (await this.remind(o, now)) sent++;
      } catch (err) {
        this.logger.error(
          `Subscription reminder for ${o.id} failed: ${(err as Error).message}`,
        );
      }
    }
    return sent;
  }

  private async remind(
    o: { id: string; trial_ends_at: Date | null; paid_until: Date | null },
    now: Date,
  ): Promise<boolean> {
    const state = subscriptionState(
      {
        trialEndsAt: o.trial_ends_at ? new Date(o.trial_ends_at) : null,
        paidUntil: o.paid_until ? new Date(o.paid_until) : null,
      },
      now,
    );
    if (!state.periodEndsAt || state.daysLeft === null) return false;

    let eventCode: string;
    let key: string;
    if (
      (state.status === 'trialing' || state.status === 'active') &&
      (REMINDER_DAYS as readonly number[]).includes(state.daysLeft)
    ) {
      eventCode = 'subscription.ending_soon';
      key = `${state.periodEndsAt.toISOString()}:${state.daysLeft}`;
    } else if (state.status === 'grace' || state.status === 'expired') {
      eventCode = 'subscription.expired';
      key = state.periodEndsAt.toISOString();
    } else {
      return false;
    }

    // Once per period end (and per reminder day).
    const [dup] = await sqlRows<{ found: boolean }>(
      this.dataSource,
      `SELECT EXISTS (
         SELECT 1 FROM notification_outbox
          WHERE organization_id = $1 AND event_code = $2
            AND payload->'variables'->>'reminder_key' = $3
       ) AS found`,
      [o.id, eventCode, key],
    );
    if (dup?.found) return false;

    const owners = await ownerUserIds(this.dataSource.manager, o.id);
    if (!owners.length) return false;
    // Dates are shown on the clinic's clock (its main location).
    const [loc] = await sqlRows<{ timezone: string | null }>(
      this.dataSource,
      `SELECT timezone FROM locations WHERE organization_id = $1
        ORDER BY is_main_branch DESC, created_at ASC LIMIT 1`,
      [o.id],
    );
    await this.notifications.notify({
      organizationId: o.id,
      eventCode,
      recipients: owners.map(staffRecipient),
      variables: {
        days_left: state.daysLeft,
        ends_on: formatClinicTime(
          state.periodEndsAt,
          safeTimezone(loc?.timezone ?? 'UTC'),
        ),
        reminder_key: key,
      },
      link: '/settings/subscription',
      entity: { type: 'organization', id: o.id },
    });
    return true;
  }
}
