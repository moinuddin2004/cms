import { Injectable } from '@nestjs/common';
import { engineError } from 'src/engine/common/engine-errors';
import {
  EffectContext,
  EffectHandler,
  EffectRegistry,
} from 'src/engine/runtime/effect-registry';
import { NotificationService } from '../services/notification.service';
import { NotificationRecipientsRegistry } from './notification-recipients.registry';

/**
 * `notify` (lab ERD §17): enqueues an event inside the transition's own
 * transaction — outbox rows only, sent after commit, gone on rollback.
 *
 *   effects: [{ code: 'notify', params: { event: 'order.submitted' } }]
 *   params.audiences (optional) narrows who gets it, e.g. ['lab'].
 */
@Injectable()
export class NotifyEffect implements EffectHandler {
  readonly code = 'notify';
  readonly description =
    'Notify the people concerned (event code in params.event; optional params.audiences).';
  readonly isFinancial = false;

  constructor(
    registry: EffectRegistry,
    private readonly notifications: NotificationService,
    private readonly recipients: NotificationRecipientsRegistry,
  ) {
    registry.register(this);
  }

  async run(ctx: EffectContext): Promise<void> {
    const eventCode = ctx.params.event;
    if (typeof eventCode !== 'string' || !eventCode) {
      throw engineError('WORKFLOW_MISCONFIGURED', 'notify needs params.event');
    }
    const audiences = ctx.params.audiences;
    if (
      audiences !== undefined &&
      (!Array.isArray(audiences) ||
        audiences.some((a) => typeof a !== 'string'))
    ) {
      throw engineError(
        'WORKFLOW_MISCONFIGURED',
        'notify params.audiences must be a list of audiences',
      );
    }
    const entityType = ctx.request.entityType;
    const resolve = this.recipients.get(entityType);
    if (!resolve) {
      throw engineError(
        'WORKFLOW_MISCONFIGURED',
        `No notification recipients registered for ${entityType}`,
      );
    }
    // Unknown event codes fail the transition (a typo must not silently drop messages).
    await this.notifications.event(ctx.m, eventCode);

    const resolved = await resolve({ ...ctx, eventCode });
    const wanted = audiences as string[] | undefined;
    await this.notifications.enqueue(ctx.m, {
      organizationId: ctx.subject.organizationId,
      locationId: resolved.locationId ?? null,
      eventCode,
      recipients: wanted
        ? resolved.recipients.filter((r) => wanted.includes(r.audience))
        : resolved.recipients,
      variables: resolved.variables,
      link: resolved.link ?? null,
      entity: { type: entityType, id: ctx.subject.id },
    });
  }
}
