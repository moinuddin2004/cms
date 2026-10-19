import type { NotificationPayload } from '../entities/notification-outbox.entity';
import type {
  NotificationAudience,
  NotificationChannel,
  RecipientType,
} from '../notifications.enums';

/** A claimed outbox row, as the worker hands it to a provider. */
export interface OutgoingNotification {
  id: string;
  organizationId: string;
  eventCode: string;
  audience: NotificationAudience;
  recipientType: RecipientType;
  recipientId: string;
  channel: NotificationChannel;
  payload: NotificationPayload;
  /** Including this one. */
  attempts: number;
}

export interface SendResult {
  providerMessageId: string | null;
}

/**
 * Sends one message on one channel. Called by the worker only — after
 * commit, outside any transaction. Throw `PermanentSendError` when retrying
 * cannot help (bad number, template rejected); any other error is retried.
 *
 * WhatsApp's provider (Meta Cloud API or a BSP) is an open decision (lab
 * ERD §12): a real one implements this interface and replaces
 * `DevLogChannelProvider` for its channel in `ChannelProviderRegistry`.
 */
export interface ChannelProvider {
  readonly name: string;
  readonly channels: readonly NotificationChannel[];
  send(message: OutgoingNotification): Promise<SendResult>;
}

export class PermanentSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentSendError';
  }
}
