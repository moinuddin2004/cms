import { Injectable } from '@nestjs/common';
import type { EffectContext } from 'src/engine/runtime/effect-registry';
import type { NotificationRecipient } from '../services/notification.service';

/** Who an event about one subject goes to, plus what the template needs. */
export interface ResolvedRecipients {
  recipients: NotificationRecipient[];
  variables?: Record<string, string | number | null | undefined>;
  link?: string | null;
  /** For quiet hours (the order's location). */
  locationId?: string | null;
}

/**
 * Resolves recipients for a `notify` effect. `ctx.m` is the transition's
 * transaction — read with it, so a just-written row is visible.
 */
export type RecipientResolver = (
  ctx: EffectContext & { eventCode: string },
) => Promise<ResolvedRecipients>;

/**
 * One resolver per workflow entity type (order, item, stage …). The engine
 * knows no table names, and neither does `notify`: the module owning the
 * subject registers how to find its doctor, coordinator, lab and patient.
 */
@Injectable()
export class NotificationRecipientsRegistry {
  private readonly resolvers = new Map<string, RecipientResolver>();

  register(entityType: string, resolver: RecipientResolver): void {
    if (this.resolvers.has(entityType)) {
      throw new Error(
        `Notification recipients for ${entityType} registered twice`,
      );
    }
    this.resolvers.set(entityType, resolver);
  }

  /** Replaces a registration (tests). */
  override(entityType: string, resolver: RecipientResolver): void {
    this.resolvers.set(entityType, resolver);
  }

  get(entityType: string): RecipientResolver | undefined {
    return this.resolvers.get(entityType);
  }
}
