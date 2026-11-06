import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../notifications.enums';
import {
  ChannelProvider,
  OutgoingNotification,
  PermanentSendError,
  SendResult,
} from './channel-provider';

/**
 * Development stand-in for WhatsApp, SMS and email: logs the message instead
 * of sending it. Lets every flow run end to end (outbox → worker → `sent`)
 * until real providers are chosen.
 */
@Injectable()
export class DevLogChannelProvider implements ChannelProvider {
  readonly name = 'dev_log';
  readonly channels = [
    NotificationChannel.WHATSAPP,
    NotificationChannel.SMS,
    NotificationChannel.EMAIL,
  ] as const;
  private readonly logger = new Logger('Notifications');

  send(n: OutgoingNotification): Promise<SendResult> {
    if (!n.payload.to) {
      return Promise.reject(new PermanentSendError('No recipient address'));
    }
    const template = n.payload.providerTemplateRef
      ? ` template=${n.payload.providerTemplateRef}`
      : '';
    this.logger.log(
      // Never the body: it can hold magic-link URLs (credentials) and patient names.
      `[${n.channel}] ${n.eventCode} → ${n.payload.to}${template} (not sent: no provider configured)`,
    );
    return Promise.resolve({ providerMessageId: `devlog-${randomUUID()}` });
  }
}
