import { Injectable } from '@nestjs/common';
import type { NotificationPayload } from '../entities/notification-outbox.entity';
import type { OutgoingNotification } from './channel-provider';

/**
 * Last step before a provider sends a row: fills in what must never be
 * stored in the outbox (e.g. a magic-link token — lab ERD §7 "raw token
 * kabhi save nahi"). Runs in the worker, outside any transaction. Throw
 * `PermanentSendError` when the message must not go out any more (the link
 * was revoked).
 */
export type PayloadFinalizer = (
  n: OutgoingNotification,
) => Promise<NotificationPayload>;

/** One finalizer per event code; events without one are sent as stored. */
@Injectable()
export class PayloadFinalizers {
  private readonly byEvent = new Map<string, PayloadFinalizer>();

  register(eventCode: string, fn: PayloadFinalizer): void {
    if (this.byEvent.has(eventCode)) {
      throw new Error(`Payload finalizer for ${eventCode} registered twice`);
    }
    this.byEvent.set(eventCode, fn);
  }

  async apply(n: OutgoingNotification): Promise<OutgoingNotification> {
    const fn = this.byEvent.get(n.eventCode);
    return fn ? { ...n, payload: await fn(n) } : n;
  }
}
