import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import type { TransitionActor } from 'src/engine/runtime/runtime.types';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { orderError } from 'src/lab-orders/common/order-errors';
import { LabOrderItem } from 'src/lab-orders/entities/lab-order-item.entity';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { OrderMessage } from 'src/lab-orders/entities/order-records.entity';
import {
  MessageKind,
  MessageSide,
  ORDER_ENTITY,
} from 'src/lab-orders/enums/order.enums';
import { orderRecipients } from 'src/lab-orders/workflow/order-recipients';
import { LabMemberRole } from 'src/labs/enums/lab.enums';
import { NotificationAudience } from 'src/notifications/notifications.enums';
import { NotificationService } from 'src/notifications/services/notification.service';
import { accessError } from '../common/access-errors';
import {
  AcceptOrderDto,
  ClarificationDto,
  ExpectedDateDto,
  RejectOrderDto,
} from '../dto/lab-access.dto';

/** Actions the lab side has on an order (buttons in the portal / link page). */
export type LabAction =
  | 'accept'
  | 'reject'
  | 'request_clarification'
  | 'change_expected_date';

/** Orders whose expected date the lab may still move. */
const DATE_CHANGEABLE = new Set([
  'accepted',
  'in_progress',
  'partially_ready',
  'on_hold',
]);

/**
 * Who acts for the lab, by which route (lab ERD §7, §13): the portal (a lab
 * member), a magic link (no user), or a clinic proxy (`via = proxy`,
 * `on_behalf_of_lab_id`). The transition actor carries `via`, so every
 * status change is recorded with its route.
 */
export interface LabSideCall {
  actor: TransitionActor;
  /** Set for proxy updates — the order's lab. */
  onBehalfOfLabId: string | null;
  /** Audit ref (side lab, or clinic for proxy). */
  ref: ActorRef;
  /** Message author (null for magic links). */
  authorUserId: string | null;
  /** Extra facts stored with the status change (e.g. `magic_link_id`). */
  meta?: Record<string, string>;
}

/**
 * The lab's answer to a submitted order (lab ERD §10 "Lab accept", §14
 * step 5) — accept with an expected date, reject with a reason, ask for
 * clarification — and later date changes. Status changes only through
 * `transition()`; each operation is one transaction including its outbox
 * rows. Callers pass an order already scoped to the caller (portal: the
 * member's lab; magic link: the link's order; proxy: the clinic's order).
 */
@Injectable()
export class LabOrderActionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly engine: WorkflowEngine,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * §10: `lab_expected_on` → every waiting item `accept` (the item workflow
   * runs its effects, e.g. stages / vendor bill draft when those sprints
   * register them) → order status derives to `accepted` → outbox.
   */
  async accept(
    order: LabOrder,
    dto: AcceptOrderDto,
    call: LabSideCall,
    m?: EntityManager,
  ): Promise<void> {
    await this.run(m, async (tx) => {
      const locked = await this.lock(tx, order, dto.version);
      if (locked.statusCode !== 'submitted') {
        throw accessError(
          'LAB_ACTION_NOT_ALLOWED',
          `A ${locked.statusCode} order can’t be accepted`,
        );
      }
      await this.assertNotPast(locked, dto.labExpectedOn);
      const items = await tx.getRepository(LabOrderItem).find({
        where: { orderId: locked.id, statusCode: 'pending_acceptance' },
        order: { lineNo: 'ASC' },
      });
      if (!items.length) {
        throw accessError(
          'LAB_ACTION_NOT_ALLOWED',
          'No line is waiting for acceptance',
        );
      }
      const before = locked.labExpectedOn;
      await this.setExpectedOn(tx, locked.id, dto.labExpectedOn);
      for (const item of items) {
        await this.engine.transitionIn(tx, {
          organizationId: locked.organizationId,
          entityType: ORDER_ENTITY.ITEM,
          entityId: item.id,
          action: 'accept',
          actor: call.actor,
          onBehalfOfLabId: call.onBehalfOfLabId,
          input: { lab_expected_on: dto.labExpectedOn, ...call.meta },
          reason: dto.note?.trim() || null,
        });
      }
      await this.audit.record(tx, call.ref, {
        organizationId: locked.organizationId,
        entityType: ORDER_ENTITY.ORDER,
        entityId: locked.id,
        action: AuditAction.UPDATE,
        before: { labExpectedOn: before },
        after: { labExpectedOn: dto.labExpectedOn, ...this.trail(call) },
      });
      await this.notifyDoctor(tx, locked, 'order.accepted', {
        expected_on: dto.labExpectedOn,
      });
    });
  }

  /** Order-level reject (§9c submitted → rejected_by_lab); the reason is required. */
  async reject(
    order: LabOrder,
    dto: RejectOrderDto,
    call: LabSideCall,
    m?: EntityManager,
  ): Promise<void> {
    await this.run(m, async (tx) => {
      const locked = await this.lock(tx, order, dto.version);
      await this.engine.transitionIn(tx, {
        organizationId: locked.organizationId,
        entityType: ORDER_ENTITY.ORDER,
        entityId: locked.id,
        action: 'reject',
        actor: call.actor,
        onBehalfOfLabId: call.onBehalfOfLabId,
        input: call.meta,
        reason: dto.reason,
      });
      await this.notifyDoctor(tx, locked, 'order.rejected', {
        reason: dto.reason,
      });
    });
  }

  /** A question for the clinic: message + submitted → clarification_needed. */
  async clarify(
    order: LabOrder,
    dto: ClarificationDto,
    call: LabSideCall,
    m?: EntityManager,
  ): Promise<void> {
    await this.run(m, async (tx) => {
      const locked = await this.lock(tx, order);
      if (dto.itemId) {
        const found = await tx
          .getRepository(LabOrderItem)
          .existsBy({ id: dto.itemId, orderId: locked.id });
        if (!found)
          throw orderError('LAB_ORDER_ITEM_NOT_FOUND', 'Line not found');
      }
      // Status first, so a wrong state writes no message.
      await this.engine.transitionIn(tx, {
        organizationId: locked.organizationId,
        entityType: ORDER_ENTITY.ORDER,
        entityId: locked.id,
        action: 'request_clarification',
        actor: call.actor,
        onBehalfOfLabId: call.onBehalfOfLabId,
        input: call.meta,
        reason: dto.body,
      });
      const msg = await tx.getRepository(OrderMessage).save({
        organizationId: locked.organizationId,
        orderId: locked.id,
        itemId: dto.itemId ?? null,
        authorUserId: call.authorUserId,
        authorSide: MessageSide.LAB,
        kind: MessageKind.CLARIFICATION_REQUEST,
        body: dto.body,
      });
      await this.audit.record(tx, call.ref, {
        organizationId: locked.organizationId,
        entityType: ORDER_ENTITY.MESSAGE,
        entityId: msg.id,
        action: AuditAction.CREATE,
        after: {
          orderId: locked.id,
          kind: MessageKind.CLARIFICATION_REQUEST,
          ...this.trail(call),
        },
      });
      await this.notifyDoctor(tx, locked, 'order.clarification_requested', {
        question:
          dto.body.length > 300 ? `${dto.body.slice(0, 297)}…` : dto.body,
      });
    });
  }

  /** §14 exceptions: the lab moves its date (reason required; the doctor is told). */
  async changeExpectedDate(
    order: LabOrder,
    dto: ExpectedDateDto,
    call: LabSideCall,
    m?: EntityManager,
  ): Promise<void> {
    await this.run(m, async (tx) => {
      const locked = await this.lock(tx, order, dto.version);
      if (!DATE_CHANGEABLE.has(locked.statusCode)) {
        throw accessError(
          'LAB_ACTION_NOT_ALLOWED',
          `The date of a ${locked.statusCode} order can’t be changed`,
        );
      }
      if (locked.labExpectedOn === dto.labExpectedOn) {
        throw accessError(
          'LAB_EXPECTED_DATE_INVALID',
          'That is already the expected date',
        );
      }
      await this.assertNotPast(locked, dto.labExpectedOn);
      await this.setExpectedOn(tx, locked.id, dto.labExpectedOn);
      await this.audit.record(tx, call.ref, {
        organizationId: locked.organizationId,
        entityType: ORDER_ENTITY.ORDER,
        entityId: locked.id,
        action: AuditAction.UPDATE,
        before: { labExpectedOn: locked.labExpectedOn },
        after: {
          labExpectedOn: dto.labExpectedOn,
          reason: dto.reason,
          ...this.trail(call),
        },
      });
      await this.notifyDoctor(tx, locked, 'order.expected_date_changed', {
        expected_on: dto.labExpectedOn,
        previous_expected_on: locked.labExpectedOn ?? '—',
        reason: dto.reason,
      });
    });
  }

  /**
   * What the lab side can do now, from the pinned workflows (so a custom
   * workflow's roles apply). Proxy callers are checked as the lab, without
   * lab roles — like the engine does.
   */
  async available(order: LabOrder, call: LabSideCall): Promise<LabAction[]> {
    const proxy = call.onBehalfOfLabId !== null;
    const asLab: TransitionActor = {
      ...call.actor,
      side: 'lab',
      roles: proxy ? [LabMemberRole.LAB_ADMIN] : call.actor.roles,
    };
    const out: LabAction[] = [];
    if (order.statusCode === 'submitted') {
      const orderActions = await this.engine.availableActions(
        order.workflowTemplateVersionId,
        'submitted',
        asLab,
      );
      const [pending] = await sqlRows<{ v: string }>(
        this.dataSource,
        `SELECT workflow_template_version_id AS v FROM lab_order_items
          WHERE order_id = $1 AND status_code = 'pending_acceptance' LIMIT 1`,
        [order.id],
      );
      if (
        pending &&
        (
          await this.engine.availableActions(
            pending.v,
            'pending_acceptance',
            asLab,
          )
        ).includes('accept')
      ) {
        out.push('accept');
      }
      if (orderActions.includes('reject')) out.push('reject');
      if (orderActions.includes('request_clarification'))
        out.push('request_clarification');
    }
    const admin = proxy || call.actor.roles.includes(LabMemberRole.LAB_ADMIN);
    if (admin && DATE_CHANGEABLE.has(order.statusCode)) {
      out.push('change_expected_date');
    }
    return out;
  }

  // ── helpers ───────────────────────────────────────────────────────────

  private run(
    m: EntityManager | undefined,
    fn: (tx: EntityManager) => Promise<void>,
  ): Promise<void> {
    return m ? fn(m) : this.dataSource.transaction(fn);
  }

  private async lock(
    m: EntityManager,
    order: LabOrder,
    version?: number,
  ): Promise<LabOrder> {
    const locked = await m.getRepository(LabOrder).findOne({
      where: { id: order.id, organizationId: order.organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) throw orderError('LAB_ORDER_NOT_FOUND', 'Order not found');
    if (version !== undefined) assertVersion(locked.version, version);
    return locked;
  }

  private async assertNotPast(order: LabOrder, ymd: string): Promise<void> {
    const tz = await this.clock.timezoneFor(order.locationId);
    const today = this.clock.today(tz);
    if (Number.isNaN(Date.parse(`${ymd}T00:00:00Z`)) || ymd < today) {
      throw accessError(
        'LAB_EXPECTED_DATE_INVALID',
        'The expected date can’t be in the past',
      );
    }
  }

  private async setExpectedOn(
    m: EntityManager,
    orderId: string,
    ymd: string,
  ): Promise<void> {
    await m.query(
      `UPDATE lab_orders SET lab_expected_on = $2, version = version + 1, updated_at = now()
        WHERE id = $1`,
      [orderId, ymd],
    );
  }

  /** Audit context for proxy / magic-link updates. */
  private trail(call: LabSideCall): Record<string, unknown> {
    return {
      via: call.actor.via ?? null,
      ...(call.onBehalfOfLabId
        ? { onBehalfOfLabId: call.onBehalfOfLabId }
        : {}),
      ...(call.meta ?? {}),
    };
  }

  /** Lab ERD §7: internal notification to the ordering doctor, in this transaction. */
  private async notifyDoctor(
    m: EntityManager,
    order: LabOrder,
    eventCode: string,
    vars: Record<string, string>,
  ): Promise<void> {
    const who = await orderRecipients(m, order.id);
    const [lab] = await sqlRows<{ name: string }>(
      m,
      `SELECT name FROM labs WHERE id = $1`,
      [order.labId],
    );
    await this.notifications.enqueue(m, {
      organizationId: order.organizationId,
      locationId: who.locationId,
      eventCode,
      recipients: who.recipients.filter(
        (r) => r.audience === NotificationAudience.DOCTOR,
      ),
      variables: { ...who.variables, lab_name: lab?.name ?? '', ...vars },
      link: `/lab-orders/${order.id}`,
      entity: { type: ORDER_ENTITY.ORDER, id: order.id },
    });
  }
}
