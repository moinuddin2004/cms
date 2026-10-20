import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ActorRef, ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import type {
  AdapterContext,
  SubjectAdapter,
  TransitionActor,
  TransitionResult,
  WorkflowSubject,
} from 'src/engine/runtime/runtime.types';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { ORDER_ENTITY } from 'src/lab-orders/enums/order.enums';
import { OrderWorkflowService } from 'src/lab-orders/workflow/order-workflow.service';
import {
  DEFAULT_WARRANTY_MONTHS,
  DEFAULT_WARRANTY_TERMS,
  PRODUCTION_ENTITY,
  RemakeReason,
  RemakeStatus,
} from '../enums/production.enums';
import { OrderItemStage } from '../entities/order-item-stage.entity';
import {
  ItemWarranty,
  RemakeRequest,
} from '../entities/production-records.entity';
import { ProductionNotifier } from './production-notifier';

/** Item states of the default item workflow (lab ERD §9a) this module reacts to. */
export const ITEM_STATE = {
  ACCEPTED: 'accepted',
  IN_PRODUCTION: 'in_production',
  AT_CLINIC_TRYIN: 'at_clinic_tryin',
  QC: 'qc',
  READY: 'ready',
  DISPATCHED: 'dispatched',
  RECEIVED: 'received',
  APPROVED: 'approved',
  DELIVERED: 'delivered',
  REMAKE_REQUIRED: 'remake_required',
} as const;

/** Stage states of the default stage workflow (§9b). */
export const STAGE_STATE = {
  AT_LAB: 'at_lab',
  SENT_TO_CLINIC: 'sent_to_clinic',
  RECEIVED: 'received',
  TRYIN_DONE: 'tryin_done',
} as const;

interface StageRow {
  id: string;
  organization_id: string;
  workflow_template_version_id: string;
  status_code: string;
  version: number;
  lab_id: string;
}

interface ItemFacts {
  id: string;
  organization_id: string;
  order_id: string;
  lab_id: string;
  location_id: string;
  specialty_id: string;
  stage_template_id: string | null;
  service_name_snap: string | null;
  lab_expected_on: string | null;
}

export interface RemakeInput {
  reasonCode?: RemakeReason | string | null;
  notes?: string | null;
}

/** Adds whole months to `YYYY-MM-DD`, clamping to the month's last day. */
export function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Warranty end: `months` after the start, the day before the anniversary. */
export const warrantyEndsOn = (startsOn: string, months: number): string =>
  addDays(addMonths(startsOn, months), -1);

const toRef = (actor: TransitionActor): ActorRef => ({
  userId: actor.userId,
  side: actor.side as ActorSide,
  ip: actor.ip ?? null,
  requestId: actor.requestId ?? null,
});

/**
 * Production plumbing shared by the clinic and lab sides (lab ERD §5b, §9b,
 * §17): registers the `stage` SubjectAdapter, creates round-1 stages from
 * the item's template (`init_stages`), keeps exactly one stage active per
 * item (inv. 9), starts warranties, opens remake requests with the warranty
 * check. It also listens to every item transition, so these happen however
 * the item moved (Sprint 7's accept, a proxy update, an org workflow) —
 * including workflow versions published before the effects existed. All
 * steps are idempotent, so a workflow that also lists the effect is fine.
 */
@Injectable()
export class ProductionWorkflowService {
  constructor(
    private readonly engine: WorkflowEngine,
    private readonly orders: OrderWorkflowService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
    private readonly notifier: ProductionNotifier,
  ) {
    engine.registerAdapter(this.stageAdapter());
    orders.onItemTransition((m, item, ctx) => this.onItem(m, item, ctx));
  }

  static system(actor: TransitionActor): TransitionActor {
    return { ...actor, side: 'system', roles: [] };
  }

  // ── transitions ──────────────────────────────────────────────────────

  item(
    m: EntityManager,
    organizationId: string,
    itemId: string,
    action: string,
    actor: TransitionActor,
    extra: {
      reason?: string | null;
      input?: Record<string, unknown>;
      expectedVersion?: number;
    } = {},
  ): Promise<TransitionResult> {
    return this.engine.transitionIn(m, {
      organizationId,
      entityType: ORDER_ENTITY.ITEM,
      entityId: itemId,
      action,
      actor,
      ...extra,
    });
  }

  stage(
    m: EntityManager,
    organizationId: string,
    stageId: string,
    action: string,
    actor: TransitionActor,
    extra: {
      reason?: string | null;
      input?: Record<string, unknown>;
      expectedVersion?: number;
    } = {},
  ): Promise<TransitionResult> {
    return this.engine.transitionIn(m, {
      organizationId,
      entityType: PRODUCTION_ENTITY.STAGE,
      entityId: stageId,
      action,
      actor,
      ...extra,
    });
  }

  /** The item's active stage round (inv. 9: at most one). */
  async activeStage(
    m: EntityManager,
    itemId: string,
  ): Promise<OrderItemStage | null> {
    return m
      .getRepository(OrderItemStage)
      .findOneBy({ itemId, isActive: true });
  }

  async hasStages(m: EntityManager, itemId: string): Promise<boolean> {
    return m.getRepository(OrderItemStage).existsBy({ itemId });
  }

  // ── item listener ────────────────────────────────────────────────────

  private async onItem(
    m: EntityManager,
    item: WorkflowSubject,
    ctx: AdapterContext,
  ): Promise<void> {
    switch (item.state) {
      case ITEM_STATE.ACCEPTED:
        await this.initStages(m, item.id, ctx.actor);
        break;
      case ITEM_STATE.IN_PRODUCTION:
        await this.initStages(m, item.id, ctx.actor);
        await this.ensureActiveStage(m, item.id, ctx.actor);
        break;
      case ITEM_STATE.DELIVERED:
        await this.startWarranty(m, item.id, ctx.actor);
        break;
      case ITEM_STATE.REMAKE_REQUIRED: {
        // The transition's own input (reason_code) and reason, already in history.
        const [h] = await sqlRows<{
          reason: string | null;
          metadata: { input?: Record<string, unknown> } | null;
        }>(
          m,
          `SELECT reason, metadata FROM status_history
            WHERE entity_type = $1 AND entity_id = $2 AND to_state = $3
            ORDER BY created_at DESC, id DESC LIMIT 1`,
          [ORDER_ENTITY.ITEM, item.id, ITEM_STATE.REMAKE_REQUIRED],
        );
        await this.openRemakeRequest(m, item.id, ctx.actor, {
          reasonCode: h?.metadata?.input?.reason_code as string | undefined,
          notes: h?.reason ?? null,
        });
        break;
      }
    }
  }

  // ── init_stages ──────────────────────────────────────────────────────

  /**
   * Round-1 stage rows from the item's stage template (lab ERD §10 "Lab
   * accept"). Names are copied, so a later template edit never changes
   * work in progress. No template → no stages (single-step work). No-op
   * when the item already has stages.
   */
  async initStages(
    m: EntityManager,
    itemId: string,
    actor: TransitionActor,
  ): Promise<number> {
    const item = await this.itemFacts(m, itemId);
    if (!item.stage_template_id || (await this.hasStages(m, itemId))) return 0;
    const steps = await sqlRows<{
      id: string;
      seq: number;
      code: string;
      name: string;
      requires_patient_visit: boolean;
      default_lab_days: number;
    }>(
      m,
      `SELECT id, seq, code, name, requires_patient_visit, default_lab_days
         FROM stage_template_steps WHERE stage_template_id = $1 ORDER BY seq`,
      [item.stage_template_id],
    );
    if (!steps.length) return 0;

    const versionId = await this.orders.pinWorkflowVersion(
      m,
      item.organization_id,
      item.specialty_id,
      'stage',
    );
    const initial = await this.orders.initialState(m, versionId);
    const today = this.clock.today(
      await this.clock.timezoneFor(item.location_id),
    );
    const last = steps[steps.length - 1].seq;
    let days = 0;
    const repo = m.getRepository(OrderItemStage);
    for (const step of steps) {
      days += step.default_lab_days;
      const isFinal = step.seq === last;
      const row = await repo.save(
        repo.create({
          organizationId: item.organization_id,
          labId: item.lab_id,
          orderId: item.order_id,
          itemId,
          stageTemplateStepId: step.id,
          workflowTemplateVersionId: versionId,
          seq: step.seq,
          roundNo: 1,
          codeSnap: step.code,
          nameSnap: step.name,
          isFinal,
          requiresPatientVisit: step.requires_patient_visit,
          statusCode: initial,
          isActive: false,
          labExpectedOn:
            isFinal && item.lab_expected_on
              ? item.lab_expected_on
              : addDays(today, days),
        }),
      );
      await this.audit.recordStatus(m, toRef(actor), {
        organizationId: item.organization_id,
        entityType: PRODUCTION_ENTITY.STAGE,
        entityId: row.id,
        fromState: null,
        toState: initial,
        actionCode: 'init_stages',
        metadata: { itemId, seq: step.seq, roundNo: 1 },
      });
    }
    return steps.length;
  }

  /**
   * Starts the next round that hasn't started (lowest seq, then round)
   * when the item has no active stage — the first stage when work starts,
   * the next one after an approval, the new round after a correction.
   */
  async ensureActiveStage(
    m: EntityManager,
    itemId: string,
    actor: TransitionActor,
  ): Promise<void> {
    if (await this.activeStage(m, itemId)) return;
    const [next] = await sqlRows<{
      id: string;
      seq: number;
      organization_id: string;
    }>(
      m,
      `SELECT id, seq, organization_id FROM order_item_stages
        WHERE item_id = $1 AND started_at IS NULL
        ORDER BY seq, round_no LIMIT 1`,
      [itemId],
    );
    if (!next) return;
    await this.stage(
      m,
      next.organization_id,
      next.id,
      'start',
      ProductionWorkflowService.system(actor),
    );
    await m.query(
      `UPDATE lab_order_items SET current_stage_seq = $2 WHERE id = $1`,
      [itemId, next.seq],
    );
  }

  /** A correction: the same stage again as `round_no + 1` (§5b try-in loop). */
  async addRound(m: EntityManager, closed: OrderItemStage): Promise<string> {
    const [{ max }] = await sqlRows<{ max: number }>(
      m,
      `SELECT max(round_no)::int AS max FROM order_item_stages WHERE item_id = $1 AND seq = $2`,
      [closed.itemId, closed.seq],
    );
    const repo = m.getRepository(OrderItemStage);
    const initial = await this.orders.initialState(
      m,
      closed.workflowTemplateVersionId,
    );
    const row = await repo.save(
      repo.create({
        organizationId: closed.organizationId,
        labId: closed.labId,
        orderId: closed.orderId,
        itemId: closed.itemId,
        stageTemplateStepId: closed.stageTemplateStepId,
        workflowTemplateVersionId: closed.workflowTemplateVersionId,
        seq: closed.seq,
        roundNo: max + 1,
        codeSnap: closed.codeSnap,
        nameSnap: closed.nameSnap,
        isFinal: closed.isFinal,
        requiresPatientVisit: closed.requiresPatientVisit,
        statusCode: initial,
        isActive: false,
        labExpectedOn: closed.labExpectedOn,
      }),
    );
    return row.id;
  }

  // ── start_warranty ───────────────────────────────────────────────────

  /** Warranty from the delivery day (§14 step 8). No-op if one exists. */
  async startWarranty(
    m: EntityManager,
    itemId: string,
    actor: TransitionActor,
    opts: { months?: number; terms?: string | null } = {},
  ): Promise<void> {
    if (await m.getRepository(ItemWarranty).existsBy({ itemId })) return;
    const item = await this.itemFacts(m, itemId);
    const startsOn = this.clock.today(
      await this.clock.timezoneFor(item.location_id),
    );
    const months = opts.months ?? DEFAULT_WARRANTY_MONTHS;
    const repo = m.getRepository(ItemWarranty);
    const row = await repo.save(
      repo.create({
        organizationId: item.organization_id,
        itemId,
        startsOn,
        endsOn: warrantyEndsOn(startsOn, months),
        terms: opts.terms ?? DEFAULT_WARRANTY_TERMS,
      }),
    );
    await this.audit.record(m, toRef(actor), {
      organizationId: item.organization_id,
      entityType: PRODUCTION_ENTITY.WARRANTY,
      entityId: row.id,
      action: AuditAction.CREATE,
      after: { itemId, startsOn: row.startsOn, endsOn: row.endsOn },
    });
  }

  // ── check_warranty_on_remake ─────────────────────────────────────────

  /** The item's warranty if it covers `on` (not voided). */
  async activeWarranty(
    m: EntityManager,
    itemId: string,
    on: string,
  ): Promise<ItemWarranty | null> {
    const w = await m.getRepository(ItemWarranty).findOneBy({ itemId });
    return w && !w.voidedAt && w.startsOn <= on && on <= w.endsOn ? w : null;
  }

  /**
   * Opens a remake request for an item (§14 step 7, §5b "Remake"): an
   * active warranty makes it a warranty claim automatically. Returns the
   * open request when there already is one.
   */
  async openRemakeRequest(
    m: EntityManager,
    itemId: string,
    actor: TransitionActor,
    input: RemakeInput,
  ): Promise<RemakeRequest> {
    const repo = m.getRepository(RemakeRequest);
    const open = await repo
      .createQueryBuilder('r')
      .where('r.original_item_id = :itemId', { itemId })
      .andWhere('r.status IN (:...open)', {
        open: [RemakeStatus.REQUESTED, RemakeStatus.DISPUTED],
      })
      .getOne();
    if (open) return open;

    const item = await this.itemFacts(m, itemId);
    const today = this.clock.today(
      await this.clock.timezoneFor(item.location_id),
    );
    const warranty = await this.activeWarranty(m, itemId, today);
    const reasonCode = Object.values(RemakeReason).includes(
      input.reasonCode as RemakeReason,
    )
      ? (input.reasonCode as RemakeReason)
      : RemakeReason.OTHER;
    const row = await repo.save(
      repo.create({
        organizationId: item.organization_id,
        labId: item.lab_id,
        orderId: item.order_id,
        originalItemId: itemId,
        reasonCode,
        notes: input.notes?.trim() || null,
        isWarrantyClaim: !!warranty,
        warrantyId: warranty?.id ?? null,
        requestedBy: actor.userId,
      }),
    );
    await this.audit.record(m, toRef(actor), {
      organizationId: item.organization_id,
      entityType: PRODUCTION_ENTITY.REMAKE,
      entityId: row.id,
      action: AuditAction.CREATE,
      after: {
        originalItemId: itemId,
        reasonCode,
        isWarrantyClaim: row.isWarrantyClaim,
      },
    });
    await this.notifier.toLab(
      m,
      item.order_id,
      'remake.requested',
      {
        item_name: item.service_name_snap,
        reason: row.notes ?? reasonCode,
      },
      { type: PRODUCTION_ENTITY.REMAKE, id: row.id },
    );
    return row;
  }

  // ── stage adapter ────────────────────────────────────────────────────

  private stageAdapter(): SubjectAdapter {
    return {
      entityType: PRODUCTION_ENTITY.STAGE,
      lock: async (m, organizationId, id) => {
        const [row] = await sqlRows<StageRow>(
          m,
          `SELECT id, organization_id, workflow_template_version_id, status_code, version, lab_id
             FROM order_item_stages WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
          [id, organizationId],
        );
        return row
          ? {
              id: row.id,
              organizationId: row.organization_id,
              workflowVersionId: row.workflow_template_version_id,
              state: row.status_code,
              version: row.version,
              labId: row.lab_id,
            }
          : null;
      },
      // `is_active` follows the state's category: active / waiting rounds
      // hold the item's one active slot (inv. 9).
      setState: async (m, s, to) => {
        const workflow = await this.engine.compiled(m, s.workflowVersionId);
        const category = workflow.states.get(to)?.category;
        const active = category === 'active' || category === 'waiting';
        const [row] = await sqlRows<{ version: number }>(
          m,
          `UPDATE order_item_stages
              SET status_code = $2, is_active = $3, version = version + 1, updated_at = now(),
                  started_at = CASE WHEN $3 THEN COALESCE(started_at, now()) ELSE started_at END
            WHERE id = $1 RETURNING version`,
          [s.id, to, active],
        );
        return row.version;
      },
    };
  }

  private async itemFacts(
    m: EntityManager,
    itemId: string,
  ): Promise<ItemFacts> {
    const [row] = await sqlRows<ItemFacts>(
      m,
      `SELECT i.id, i.organization_id, i.order_id, o.lab_id, o.location_id, o.specialty_id,
              i.stage_template_id, i.service_name_snap,
              to_char(o.lab_expected_on, 'YYYY-MM-DD') AS lab_expected_on
         FROM lab_order_items i JOIN lab_orders o ON o.id = i.order_id
        WHERE i.id = $1`,
      [itemId],
    );
    return row;
  }
}
