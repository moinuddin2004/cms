import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import type { NotificationPayload } from '../entities/notification-outbox.entity';
import {
  NotificationAudience,
  NotificationChannel,
  OutboxStatus,
  RecipientType,
} from '../notifications.enums';
import {
  DeferSendError,
  OutgoingNotification,
  PermanentSendError,
  SkipSendError,
} from './channel-provider';
import { ChannelProviderRegistry } from './channel-provider.registry';
import { PayloadFinalizers } from './payload-finalizers';

export const MAX_SEND_ATTEMPTS = 5;
const BATCH = 50;
/** A claimed row reappears after this if the worker died mid-send. */
const LEASE = '5 minutes';
/** Wait before attempt n+1 (seconds). */
const BACKOFF_SEC = [30, 120, 600, 3600];

export interface DrainResult {
  sent: number;
  retrying: number;
  failed: number;
}

interface ClaimedRow {
  id: string;
  organization_id: string;
  event_code: string;
  audience: NotificationAudience;
  recipient_type: RecipientType;
  recipient_id: string;
  channel: NotificationChannel;
  payload: NotificationPayload;
  attempts: number;
}

/**
 * Sends committed outbox rows. A row is claimed by one short statement
 * (`FOR UPDATE SKIP LOCKED`, so two workers never take the same row) that
 * bumps `attempts` and pushes `scheduled_for` out by a lease; the provider
 * is then called with no transaction open, and the result is written back
 * only if this claim is still the latest (`attempts` unchanged). Failures
 * retry with backoff up to MAX_SEND_ATTEMPTS, then become `failed`.
 * Delivery is at-least-once; in-app copies are idempotent per outbox row.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private draining: Promise<DrainResult> | null = null;
  private again = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly providers: ChannelProviderRegistry,
    private readonly finalizers: PayloadFinalizers,
  ) {}

  /** Sends everything that is due. Concurrent calls coalesce into one run. */
  drain(): Promise<DrainResult> {
    if (this.draining) {
      this.again = true;
      return this.draining;
    }
    this.draining = this.run().finally(() => {
      this.draining = null;
    });
    return this.draining;
  }

  private async run(): Promise<DrainResult> {
    const total: DrainResult = { sent: 0, retrying: 0, failed: 0 };
    let claimed: OutgoingNotification[];
    do {
      this.again = false;
      claimed = await this.claim(BATCH);
      for (const n of claimed) {
        const outcome = await this.deliver(n);
        total[outcome]++;
      }
    } while (claimed.length === BATCH || this.again);
    return total;
  }

  async claim(limit: number): Promise<OutgoingNotification[]> {
    const rows = await sqlRows<ClaimedRow>(
      this.dataSource,
      `UPDATE notification_outbox o
          SET status = '${OutboxStatus.QUEUED}',
              attempts = o.attempts + 1,
              scheduled_for = now() + interval '${LEASE}',
              updated_at = now()
        WHERE o.id IN (
          SELECT id FROM notification_outbox
           WHERE status IN ('${OutboxStatus.QUEUED}', '${OutboxStatus.HELD_QUIET_HOURS}')
             AND scheduled_for <= now()
           ORDER BY scheduled_for
           LIMIT $1
           FOR UPDATE SKIP LOCKED)
        RETURNING o.id, o.organization_id, o.event_code, o.audience,
                  o.recipient_type, o.recipient_id, o.channel, o.payload, o.attempts`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      eventCode: r.event_code,
      audience: r.audience,
      recipientType: r.recipient_type,
      recipientId: r.recipient_id,
      channel: r.channel,
      payload: r.payload,
      attempts: r.attempts,
    }));
  }

  private async deliver(n: OutgoingNotification): Promise<keyof DrainResult> {
    const provider = this.providers.for(n.channel);
    try {
      if (!provider) {
        throw new PermanentSendError(`No provider for channel ${n.channel}`);
      }
      const result = await provider.send(await this.finalizers.apply(n));
      await this.dataSource.query(
        `UPDATE notification_outbox
            SET status = '${OutboxStatus.SENT}', sent_at = now(), updated_at = now(),
                provider_message_id = $3, last_error = NULL
          WHERE id = $1 AND attempts = $2`,
        [n.id, n.attempts, result.providerMessageId],
      );
      return 'sent';
    } catch (err) {
      if (err instanceof SkipSendError) {
        // Not a failure: decided at send time (e.g. unverified address).
        await this.dataSource.query(
          `UPDATE notification_outbox
              SET status = $3, last_error = $4, updated_at = now()
            WHERE id = $1 AND attempts = $2`,
          [n.id, n.attempts, err.status, err.message.slice(0, 1000)],
        );
        return 'failed';
      }
      if (err instanceof DeferSendError) {
        // Later, and this attempt does not count toward MAX_SEND_ATTEMPTS.
        await this.dataSource.query(
          `UPDATE notification_outbox
              SET status = '${OutboxStatus.QUEUED}', attempts = attempts - 1,
                  scheduled_for = $3, last_error = $4, updated_at = now()
            WHERE id = $1 AND attempts = $2`,
          [n.id, n.attempts, err.until, err.message.slice(0, 1000)],
        );
        return 'retrying';
      }
      const message = (err as Error).message?.slice(0, 1000) || 'Send failed';
      const permanent =
        err instanceof PermanentSendError || n.attempts >= MAX_SEND_ATTEMPTS;
      if (permanent) {
        await this.dataSource.query(
          `UPDATE notification_outbox
              SET status = '${OutboxStatus.FAILED}', last_error = $3, updated_at = now()
            WHERE id = $1 AND attempts = $2`,
          [n.id, n.attempts, message],
        );
        this.logger.warn(
          `Notification ${n.id} (${n.channel}) failed: ${message}`,
        );
        return 'failed';
      }
      const wait =
        BACKOFF_SEC[Math.min(n.attempts - 1, BACKOFF_SEC.length - 1)];
      await this.dataSource.query(
        `UPDATE notification_outbox
            SET last_error = $3, scheduled_for = now() + make_interval(secs => $4),
                updated_at = now()
          WHERE id = $1 AND attempts = $2`,
        [n.id, n.attempts, message, wait],
      );
      return 'retrying';
    }
  }
}
