import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { DefinitionStatus } from 'src/engine/enums/engine.enums';
import type {
  AdapterContext,
  SubjectAdapter,
  WorkflowSubject,
} from 'src/engine/runtime/runtime.types';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import {
  deriveOrderStatus,
  isDerivable,
} from 'src/engine/workflows/order-status';
import type { WorkflowEntityType } from 'src/engine/workflows/workflow.types';
import { NotificationRecipientsRegistry } from 'src/notifications/effects/notification-recipients.registry';
import { orderError } from '../common/order-errors';
import { ORDER_ENTITY } from '../enums/order.enums';
import { OrderLifecycleHooks } from './order-hooks';
import { orderRecipients } from './order-recipients';

interface SubjectRow {
  id: string;
  organization_id: string;
  workflow_template_version_id: string;
  status_code: string | null;
  version: number;
  lab_id: string;
}

/**
 * Called after every item transition, before the order is re-derived, in
 * the same transaction — how other lab modules (production: stages,
 * warranties, remake requests) react to item states the order module
 * owns, whichever endpoint or workflow version moved the item.
 */
export type ItemListener = (
  m: EntityManager,
  item: WorkflowSubject,
  ctx: AdapterContext,
) => Promise<void>;

const toSubject = (r: SubjectRow): WorkflowSubject => ({
  id: r.id,
  organizationId: r.organization_id,
  workflowVersionId: r.workflow_template_version_id,
  state: r.status_code ?? '',
  version: r.version,
  labId: r.lab_id,
});

/** Timestamp columns stamped the first time an order reaches a state. */
const ORDER_STAMPS: Record<string, string> = {
  submitted: 'submitted_at',
  accepted: 'accepted_at',
  completed: 'completed_at',
  cancelled: 'cancelled_at',
};

/**
 * Owns how the engine reads and writes orders and items (lab ERD §17):
 * registers the `order` / `item` SubjectAdapters, so every status change
 * goes through `WorkflowEngine.transition()`, and an item change re-derives
 * its order in the same transaction (§9c, inv. 8). Also resolves which
 * workflow / form versions a new order or line pins (inv. 7).
 */
@Injectable()
export class OrderWorkflowService {
  private readonly itemListeners: ItemListener[] = [];

  constructor(
    private readonly engine: WorkflowEngine,
    recipients: NotificationRecipientsRegistry,
    private readonly hooks: OrderLifecycleHooks,
  ) {
    engine.registerAdapter(this.orderAdapter());
    engine.registerAdapter(this.itemAdapter());
    recipients.register(ORDER_ENTITY.ORDER, (ctx) =>
      orderRecipients(ctx.m, ctx.subject.id),
    );
  }

  onItemTransition(listener: ItemListener): void {
    this.itemListeners.push(listener);
  }

  /**
   * §9c: recompute the order's status from its items. Locks the order.
   * `reopen`: a completed order may be derived again (a remake adds new
   * work to it, lab ERD §5b "Remake").
   */
  async deriveOrder(
    m: EntityManager,
    orderId: string,
    opts: { reopen?: boolean } = {},
  ): Promise<void> {
    const [row] = await sqlRows<SubjectRow>(
      m,
      `SELECT id, organization_id, workflow_template_version_id, status_code, version, lab_id
         FROM lab_orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    );
    const current = row?.status_code ?? 'draft';
    if (
      !row ||
      (!isDerivable(current) && !(opts.reopen && current === 'completed'))
    ) {
      return;
    }
    const items = await sqlRows<{ status_code: string | null }>(
      m,
      `SELECT status_code FROM lab_order_items WHERE order_id = $1`,
      [orderId],
    );
    const order = toSubject(row);
    const next = deriveOrderStatus({
      itemStatuses: items.map((i) => i.status_code ?? 'pending_acceptance'),
      onHold: order.state === 'on_hold',
    });
    await this.engine.applyDerived(m, ORDER_ENTITY.ORDER, order, next, {
      cause: 'item_changed',
    });
  }

  /**
   * The published version a new subject pins: the newest published version
   * of `templateId`, or — without one — of the specialty's default template
   * for the entity type (the organization's own beats the platform's).
   */
  async pinWorkflowVersion(
    m: EntityManager,
    organizationId: string,
    specialtyId: string,
    entityType: WorkflowEntityType,
    templateId: string | null = null,
  ): Promise<string> {
    const [row] = await sqlRows<{ id: string }>(
      m,
      `SELECT v.id
         FROM workflow_template_versions v
         JOIN workflow_templates t ON t.id = v.workflow_template_id
        WHERE v.status = $1 AND t.is_active
          AND t.entity_type = $2 AND t.specialty_id = $3
          AND ($4::uuid IS NULL OR t.id = $4)
          AND (t.organization_id IS NULL OR t.organization_id = $5)
        ORDER BY (t.organization_id IS NOT NULL) DESC, t.created_at ASC, v.version_no DESC
        LIMIT 1`,
      [
        DefinitionStatus.PUBLISHED,
        entityType,
        specialtyId,
        templateId,
        organizationId,
      ],
    );
    if (!row) {
      throw orderError(
        'LAB_ORDER_WORKFLOW_MISSING',
        `No published ${entityType} workflow for this specialty`,
      );
    }
    return row.id;
  }

  /** The initial state of a pinned workflow version. */
  async initialState(m: EntityManager, versionId: string): Promise<string> {
    const workflow = await this.engine.compiled(m, versionId);
    const initial = [...workflow.states.values()].find(
      (s) => s.category === 'initial',
    );
    if (!initial) {
      throw orderError(
        'LAB_ORDER_WORKFLOW_MISSING',
        'The workflow has no initial state',
      );
    }
    return initial.code;
  }

  // ── adapters ─────────────────────────────────────────────────────────

  private orderAdapter(): SubjectAdapter {
    return {
      entityType: ORDER_ENTITY.ORDER,
      lock: (m, organizationId, id) =>
        this.lock(m, 'lab_orders', organizationId, id),
      setState: async (m, s, to) => {
        const stamp = ORDER_STAMPS[to];
        const [row] = await sqlRows<{ version: number }>(
          m,
          `UPDATE lab_orders SET status_code = $2, version = version + 1, updated_at = now()
             ${stamp ? `, ${stamp} = COALESCE(${stamp}, now())` : ''}
           WHERE id = $1 RETURNING version`,
          [s.id, to],
        );
        await this.hooks.runStateChanged(m, s.id, to);
        return row.version;
      },
      recompute: (s, { m }: AdapterContext) => this.deriveOrder(m, s.id),
    };
  }

  private itemAdapter(): SubjectAdapter {
    return {
      entityType: ORDER_ENTITY.ITEM,
      lock: async (m, organizationId, id) => {
        const [row] = await sqlRows<SubjectRow>(
          m,
          `SELECT i.id, i.organization_id, i.workflow_template_version_id, i.status_code,
                  i.version, o.lab_id
             FROM lab_order_items i JOIN lab_orders o ON o.id = i.order_id
            WHERE i.id = $1 AND i.organization_id = $2 AND i.status_code IS NOT NULL
            FOR UPDATE OF i`,
          [id, organizationId],
        );
        return row ? toSubject(row) : null;
      },
      setState: async (m, s, to) => {
        const [row] = await sqlRows<{ version: number }>(
          m,
          `UPDATE lab_order_items SET status_code = $2, version = version + 1, updated_at = now()
            WHERE id = $1 RETURNING version`,
          [s.id, to],
        );
        return row.version;
      },
      afterTransition: async (s, ctx) => {
        const { m } = ctx;
        for (const listener of this.itemListeners) await listener(m, s, ctx);
        const [{ order_id }] = await sqlRows<{ order_id: string }>(
          m,
          `SELECT order_id FROM lab_order_items WHERE id = $1`,
          [s.id],
        );
        await this.deriveOrder(m, order_id);
      },
    };
  }

  private async lock(
    m: EntityManager,
    table: 'lab_orders',
    organizationId: string,
    id: string,
  ): Promise<WorkflowSubject | null> {
    const [row] = await sqlRows<SubjectRow>(
      m,
      `SELECT id, organization_id, workflow_template_version_id, status_code, version, lab_id
         FROM ${table} WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [id, organizationId],
    );
    return row ? toSubject(row) : null;
  }
}
