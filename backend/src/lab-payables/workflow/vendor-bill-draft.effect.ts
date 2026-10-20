import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { engineError } from 'src/engine/common/engine-errors';
import {
  EffectContext,
  EffectHandler,
  EffectRegistry,
} from 'src/engine/runtime/effect-registry';
import type { WorkflowSubject } from 'src/engine/runtime/runtime.types';
import { ORDER_ENTITY } from 'src/lab-orders/enums/order.enums';
import { OrderWorkflowService } from 'src/lab-orders/workflow/order-workflow.service';
import {
  ACCEPTED_STATE,
  BillDraftsService,
} from '../services/bill-drafts.service';

/**
 * `create_vendor_bill_draft` (lab ERD §6c, §10 "Lab accept", §17): the
 * order's draft vendor bill from the accepted items' frozen lab costs.
 * Financial: it checks its own preconditions (a submitted order, an item
 * the lab has accepted) whatever the workflow says. Like Sprint 8's
 * effects it also runs from the item listener on every accept, so
 * workflow versions published before it existed get drafts too; the sync
 * is idempotent, so listing the effect as well is harmless.
 */
@Injectable()
export class CreateVendorBillDraftEffect implements EffectHandler {
  readonly code = 'create_vendor_bill_draft';
  readonly description =
    "Create / update the order's draft vendor bill from the items' lab costs.";
  readonly isFinancial = true;

  constructor(
    registry: EffectRegistry,
    orders: OrderWorkflowService,
    private readonly drafts: BillDraftsService,
  ) {
    registry.register(this);
    orders.onItemTransition(async (m, item) => {
      if (item.state === ACCEPTED_STATE) await this.forItem(m, item);
    });
  }

  async run(ctx: EffectContext): Promise<void> {
    const type = ctx.request.entityType;
    if (type === ORDER_ENTITY.ITEM) return this.forItem(ctx.m, ctx.subject);
    if (type === ORDER_ENTITY.ORDER) {
      await this.drafts.sync(ctx.m, ctx.subject.id);
      return;
    }
    throw engineError(
      'WORKFLOW_MISCONFIGURED',
      `${this.code} runs on order or item transitions`,
    );
  }

  private async forItem(m: EntityManager, item: WorkflowSubject) {
    const [row] = await sqlRows<{ order_id: string; order_no: string | null }>(
      m,
      `SELECT i.order_id, o.order_no FROM lab_order_items i
         JOIN lab_orders o ON o.id = i.order_id WHERE i.id = $1`,
      [item.id],
    );
    if (!row?.order_no) {
      throw engineError(
        'WORKFLOW_MISCONFIGURED',
        `${this.code}: the order is not submitted (no lab cost snapshot)`,
      );
    }
    await this.drafts.sync(m, row.order_id);
  }
}
