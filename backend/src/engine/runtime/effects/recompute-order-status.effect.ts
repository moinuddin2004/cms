import { Injectable } from '@nestjs/common';
import { engineError } from '../../common/engine-errors';
import {
  EffectContext,
  EffectHandler,
  EffectRegistry,
} from '../effect-registry';

/**
 * Re-derives the subject's status from its children (an order from its
 * items) — e.g. when a manual hold is lifted. The subject's adapter knows
 * how; the derivation rules are `deriveOrderStatus`.
 */
@Injectable()
export class RecomputeOrderStatusEffect implements EffectHandler {
  readonly code = 'recompute_order_status';
  readonly description =
    "Recalculate the order's status from its items (lab ERD §9 rules).";
  readonly isFinancial = false;

  constructor(registry: EffectRegistry) {
    registry.register(this);
  }

  async run(ctx: EffectContext): Promise<void> {
    if (!ctx.adapter.recompute) {
      throw engineError(
        'WORKFLOW_MISCONFIGURED',
        `${ctx.adapter.entityType} cannot recompute its status`,
      );
    }
    await ctx.adapter.recompute(ctx.subject, { m: ctx.m, actor: ctx.actor });
  }
}
