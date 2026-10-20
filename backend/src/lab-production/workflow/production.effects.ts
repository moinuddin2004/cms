import { Injectable } from '@nestjs/common';
import { engineError } from 'src/engine/common/engine-errors';
import {
  EffectContext,
  EffectHandler,
  EffectRegistry,
} from 'src/engine/runtime/effect-registry';
import { ORDER_ENTITY } from 'src/lab-orders/enums/order.enums';
import { ProductionWorkflowService } from './production-workflow.service';

/** These effects act on items; anywhere else is a workflow mistake. */
function itemOnly(ctx: EffectContext, code: string): void {
  if (ctx.request.entityType !== ORDER_ENTITY.ITEM) {
    throw engineError(
      'WORKFLOW_MISCONFIGURED',
      `${code} only runs on item transitions`,
    );
  }
}

/**
 * `init_stages` (lab ERD §17): round-1 stage rows from the item's stage
 * template, at lab accept. Idempotent.
 */
@Injectable()
export class InitStagesEffect implements EffectHandler {
  readonly code = 'init_stages';
  readonly description =
    "Create the item's try-in stages (round 1) from its stage template.";
  readonly isFinancial = false;

  constructor(
    registry: EffectRegistry,
    private readonly production: ProductionWorkflowService,
  ) {
    registry.register(this);
  }

  async run(ctx: EffectContext): Promise<void> {
    itemOnly(ctx, this.code);
    await this.production.initStages(ctx.m, ctx.subject.id, ctx.actor);
  }
}

/**
 * `start_warranty`: warranty from the delivery day. Params: `months`
 * (default 12), `terms`.
 */
@Injectable()
export class StartWarrantyEffect implements EffectHandler {
  readonly code = 'start_warranty';
  readonly description =
    'Start the item’s warranty (params.months, default 12; params.terms).';
  readonly isFinancial = false;

  constructor(
    registry: EffectRegistry,
    private readonly production: ProductionWorkflowService,
  ) {
    registry.register(this);
  }

  async run(ctx: EffectContext): Promise<void> {
    itemOnly(ctx, this.code);
    const { months, terms } = ctx.params;
    if (
      months !== undefined &&
      (!Number.isInteger(months) || (months as number) < 1)
    ) {
      throw engineError(
        'WORKFLOW_MISCONFIGURED',
        'start_warranty params.months must be a positive whole number',
      );
    }
    await this.production.startWarranty(ctx.m, ctx.subject.id, ctx.actor, {
      months: months as number | undefined,
      terms: typeof terms === 'string' ? terms : null,
    });
  }
}

/**
 * `check_warranty_on_remake`: opens the item's remake request, marked a
 * warranty claim when its warranty is active. Reads `reason_code` from the
 * transition input and the reason as notes.
 */
@Injectable()
export class CheckWarrantyOnRemakeEffect implements EffectHandler {
  readonly code = 'check_warranty_on_remake';
  readonly description =
    'Open a remake request for the item; an active warranty makes it a warranty claim.';
  readonly isFinancial = false;

  constructor(
    registry: EffectRegistry,
    private readonly production: ProductionWorkflowService,
  ) {
    registry.register(this);
  }

  async run(ctx: EffectContext): Promise<void> {
    itemOnly(ctx, this.code);
    await this.production.openRemakeRequest(ctx.m, ctx.subject.id, ctx.actor, {
      reasonCode: ctx.request.input?.reason_code as string | undefined,
      notes: ctx.request.reason ?? null,
    });
  }
}
