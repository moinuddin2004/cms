import type { NotificationPayload } from '../entities/notification-outbox.entity';
import { OutboxStatus } from '../notifications.enums';
import type {
  NotificationAudience,
  NotificationChannel,
  RecipientType,
} from '../notifications.enums';

/** A claimed outbox row, as the worker hands it to a provider. */
export interface OutgoingNotification {
  id: string;
  organizationId: string;
  /** The clinic branch the change happened at (push `data`, 07 §8). */
  locationId: string | null;
  eventCode: string;
  audience: NotificationAudience;
  recipientType: RecipientType;
  recipientId: string;
  channel: NotificationChannel;
  /** The row that caused it (e.g. the queue entry — push `data`, 07 §8). */
  entityId: string | null;
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

/**
 * Thrown by a provider when this message must not go out, and that is not a
 * failure: the row gets `status` (e.g. `skipped_unverified`) and is not retried.
 */
export class SkipSendError extends Error {
  constructor(
    readonly status: OutboxStatus,
    message: string,
  ) {
    super(message);
    this.name = 'SkipSendError';
  }
}

/** Thrown to send later (daily email cap reached): requeued for `until`, the attempt not counted. */
export class DeferSendError extends Error {
  constructor(
    readonly until: Date,
    message: string,
  ) {
    super(message);
    this.name = 'DeferSendError';
  }
}
