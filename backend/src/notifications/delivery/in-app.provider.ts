import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
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
    const [row] = await sqlRows<{ id: string }>(
      this.dataSource,
      `WITH ins AS (
         INSERT INTO user_notifications
           (user_id, outbox_id, organization_id, event_code, title, body, link)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (outbox_id) DO NOTHING
         RETURNING id
       )
       SELECT id FROM ins
       UNION ALL
       SELECT id FROM user_notifications WHERE outbox_id = $2
       LIMIT 1`,
      [
        n.recipientId,
        n.id,
        n.organizationId,
        n.eventCode,
        n.payload.title ?? '',
        n.payload.body,
        n.payload.link,
      ],
    );
    return { providerMessageId: row?.id ?? null };
  }
}
