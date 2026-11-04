import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { NOTIFICATION_NEW_EVENT, userRoom } from '../notification-realtime';
import { NotificationChannel, RecipientType } from '../notifications.enums';
import {
  ChannelProvider,
  OutgoingNotification,
  PermanentSendError,
  SendResult,
} from './channel-provider';

/**
 * In-app "sending" = the user's `user_notifications` copy. Idempotent on
 * `outbox_id`, so a send retried after a crash never shows twice.
 *
 * A first insert also writes a realtime `outbox` row (topic `user:<id>`,
 * same transaction) that the queue's outbox relay publishes to the user's
 * sockets — the bell updates instantly, in the single `all` process and in a
 * split api/worker setup alike. A retry inserts nothing, so it never toasts
 * twice.
 */
@Injectable()
export class InAppChannelProvider implements ChannelProvider {
  readonly name = 'in_app';
  readonly channels = [NotificationChannel.IN_APP] as const;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async send(n: OutgoingNotification): Promise<SendResult> {
    if (n.recipientType !== RecipientType.USER) {
      throw new PermanentSendError(
        'In-app notifications need a user recipient',
      );
    }
    return this.dataSource.transaction(async (m) => {
      const title = n.payload.title ?? '';
      const [inserted] = await sqlRows<{ id: string; created_at: Date }>(
        m,
        `INSERT INTO user_notifications
           (user_id, outbox_id, organization_id, event_code, title, body, link)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (outbox_id) DO NOTHING
         RETURNING id, created_at`,
        [
          n.recipientId,
          n.id,
          n.organizationId,
          n.eventCode,
          title,
          n.payload.body,
          n.payload.link,
        ],
      );
      if (!inserted) {
        const [existing] = await sqlRows<{ id: string }>(
          m,
          `SELECT id FROM user_notifications WHERE outbox_id = $1`,
          [n.id],
        );
        return { providerMessageId: existing?.id ?? null };
      }

      const realtime = {
        type: NOTIFICATION_NEW_EVENT,
        id: inserted.id,
        organizationId: n.organizationId,
        eventCode: n.eventCode,
        title,
        body: n.payload.body,
        link: n.payload.link ?? null,
        createdAt: new Date(inserted.created_at).toISOString(),
      };
      await sqlRows(
        m,
        `WITH ob AS (
           INSERT INTO outbox (organization_id, topic, payload)
           VALUES ($1, $2, $3::jsonb)
         )
         SELECT pg_notify('queue_outbox', '')`,
        [n.organizationId, userRoom(n.recipientId), JSON.stringify(realtime)],
      );
      return { providerMessageId: inserted.id };
    });
  }
}
