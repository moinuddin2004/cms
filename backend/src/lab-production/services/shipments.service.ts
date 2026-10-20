import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  ActorRef,
  AuditAction,
  TransitionVia,
} from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { NumberSequenceService } from 'src/common/sequences/number-sequence.service';
import type { TransitionActor } from 'src/engine/runtime/runtime.types';
import {
  ClinicCall,
  clinicTransitionActor,
  LabCall,
  labRef,
  labTransitionActor,
} from 'src/lab-orders/common/order-context';
import { productionError } from '../common/production-errors';
import {
  clinicItem,
  CLOSED_ITEM_STATES,
  labItem,
  ProductionItem,
} from '../common/production-items';
import { DispatchShipmentDto, ReceiveShipmentDto } from '../dto/production.dto';
import { OrderItemStage } from '../entities/order-item-stage.entity';
import { Shipment, ShipmentItem } from '../entities/production-records.entity';
import {
  PRODUCTION_ENTITY,
  SHIPMENT_SEQUENCE,
  ShipmentCondition,
  ShipmentContents,
  ShipmentDirection,
  ShipmentStatus,
} from '../enums/production.enums';
import { ProductionNotifier } from '../workflow/production-notifier';
import {
  ITEM_STATE,
  ProductionWorkflowService,
  STAGE_STATE,
} from '../workflow/production-workflow.service';

/** Who is acting on a shipment — the clinic or the lab. */
export type ShipmentCaller =
  | { side: 'clinic'; c: ClinicCall }
  | { side: 'lab'; c: LabCall };

const OPEN = new Set([
  ShipmentStatus.DISPATCHED,
  ShipmentStatus.PARTIALLY_RECEIVED,
]);

interface PlannedLine {
  item: ProductionItem;
  stage: OrderItemStage | null;
  contents: ShipmentContents;
  quantity: number;
  /** Item / stage transitions this line makes (none for a re-shipment). */
  itemAction: string | null;
  stageAction: string | null;
}

/**
 * Shipments both ways (lab ERD §5b, §10 "Shipment receive", §14 steps 6–7
 * and exceptions). Lab → clinic moves the work: a try-in stage goes
 * `sent_to_clinic` (item `at_clinic_tryin`), final work goes `dispatched`.
 * Receiving records quantity, condition and QC per line and moves item and
 * stage to `received`; a missing line or a lost shipment leaves the work
 * owed, so the lab can ship it again. One transaction each.
 */
@Injectable()
export class ShipmentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly sequences: NumberSequenceService,
    private readonly production: ProductionWorkflowService,
    private readonly notifier: ProductionNotifier,
  ) {}

  // ── dispatch ─────────────────────────────────────────────────────────

  /** Lab → clinic: try-in rounds and finished work. */
  async dispatchToClinic(
    c: LabCall,
    dto: DispatchShipmentDto,
  ): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const items = await this.distinctItems(m, dto, (id) =>
        labItem(m, c.lab.labId, id),
      );
      const org = this.oneOf(items, (i) => i.organization_id, 'clinic');
      const plan: PlannedLine[] = [];
      for (const [i, line] of dto.lines.entries()) {
        plan.push(await this.planToClinic(m, items[i], line));
      }
      const actor = labTransitionActor(c);
      const system = ProductionWorkflowService.system(actor);
      for (const p of plan) {
        if (p.itemAction) {
          await this.production.item(m, org, p.item.id, p.itemAction, system);
        }
        if (p.stage && p.stageAction) {
          await this.production.stage(m, org, p.stage.id, p.stageAction, actor);
        }
      }
      const shipment = await this.create(
        m,
        {
          organizationId: org,
          labId: c.lab.labId,
          direction: ShipmentDirection.TO_CLINIC,
          userId: c.lab.userId,
          ref: labRef(c),
        },
        dto,
        plan,
      );
      for (const p of plan) {
        await this.notifier.toDoctor(
          m,
          p.item.order_id,
          'stage.sent_to_clinic',
          {
            item_name: p.item.service_name_snap,
            stage_name: p.stage?.nameSnap ?? 'Finished work',
            shipment_no: shipment.shipmentNo,
          },
          { entity: { type: PRODUCTION_ENTITY.SHIPMENT, id: shipment.id } },
        );
      }
      return shipment.id;
    });
  }

  /** Clinic → lab: impressions, models, work going back. No status changes. */
  async dispatchToLab(
    c: ClinicCall,
    dto: DispatchShipmentDto,
  ): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const items = await this.distinctItems(m, dto, (id) =>
        this.clinicItemById(m, c.tenant.organizationId, id),
      );
      const labId = this.oneOf(items, (i) => i.lab_id, 'lab');
      const plan = dto.lines.map((line, i): PlannedLine => {
        const item = items[i];
        if (['rejected', 'cancelled'].includes(item.status_code)) {
          throw productionError(
            'PRODUCTION_NOT_ALLOWED',
            `Line ${item.line_no} of ${item.order_no} is ${item.status_code}`,
          );
        }
        return {
          item,
          stage: null,
          contents: line.contents ?? ShipmentContents.IMPRESSION,
          quantity: line.quantity ?? 1,
          itemAction: null,
          stageAction: null,
        };
      });
      const shipment = await this.create(
        m,
        {
          organizationId: c.tenant.organizationId,
          labId,
          direction: ShipmentDirection.TO_LAB,
          userId: c.actor.userId,
          ref: c.ref,
        },
        dto,
        plan,
      );
      return shipment.id;
    });
  }

  /**
   * What one lab → clinic line does. The active stage decides: a try-in
   * round at the lab is sent for try-in; the final stage (or an item without
   * stages) must have passed QC (`ready`). Work whose earlier shipment was
   * lost / missing may be shipped again without a status change.
   */
  private async planToClinic(
    m: EntityManager,
    item: ProductionItem,
    line: DispatchShipmentDto['lines'][number],
  ): Promise<PlannedLine> {
    const stage = await this.production.activeStage(m, item.id);
    const base = {
      item,
      stage,
      quantity: line.quantity ?? item.quantity,
      contents:
        line.contents ??
        (stage && !stage.isFinal
          ? ShipmentContents.TRYIN
          : ShipmentContents.FINAL),
    };
    const refuse = (why: string) =>
      productionError(
        'PRODUCTION_NOT_ALLOWED',
        `Line ${item.line_no} of ${item.order_no}: ${why}`,
      );

    if (!stage && (await this.production.hasStages(m, item.id))) {
      throw refuse('no stage is in progress');
    }
    if (stage) {
      if (stage.statusCode === STAGE_STATE.AT_LAB) {
        if (stage.isFinal) {
          if (item.status_code !== ITEM_STATE.READY) {
            throw refuse('finished work must pass QC before it ships');
          }
          return { ...base, itemAction: 'dispatch', stageAction: 'dispatch' };
        }
        if (item.status_code !== ITEM_STATE.IN_PRODUCTION) {
          throw refuse(`the item is ${item.status_code}`);
        }
        return { ...base, itemAction: 'send_tryin', stageAction: 'dispatch' };
      }
      if (
        stage.statusCode === STAGE_STATE.SENT_TO_CLINIC &&
        !(await this.hasOpenLine(m, item.id))
      ) {
        return { ...base, itemAction: null, stageAction: null };
      }
      throw refuse(`${stage.nameSnap} is ${stage.statusCode}`);
    }
    if (item.status_code === ITEM_STATE.READY) {
      return { ...base, itemAction: 'dispatch', stageAction: null };
    }
    if (
      item.status_code === ITEM_STATE.DISPATCHED &&
      !(await this.hasOpenLine(m, item.id))
    ) {
      return { ...base, itemAction: null, stageAction: null };
    }
    throw refuse(
      CLOSED_ITEM_STATES.has(item.status_code)
        ? `the item is ${item.status_code}`
        : 'the work must pass QC before it ships',
    );
  }

  // ── receive ──────────────────────────────────────────────────────────

  /**
   * Receiving (lab ERD §10): per line quantity, condition and QC → item and
   * stage `received` → order derived → history → outbox. Lines left out
   * stay open (partial receiving); `missing` closes a line without
   * receiving the work.
   */
  async receive(
    who: ShipmentCaller,
    shipmentId: string,
    dto: ReceiveShipmentDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const s = await this.lockShipment(m, who, shipmentId);
      const expected =
        who.side === 'clinic'
          ? ShipmentDirection.TO_CLINIC
          : ShipmentDirection.TO_LAB;
      if (s.direction !== expected) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          'Only the receiving side can receive this shipment',
        );
      }
      if (!OPEN.has(s.status)) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          `This shipment is ${s.status}`,
        );
      }
      const lines = await m
        .getRepository(ShipmentItem)
        .findBy({ shipmentId: s.id });
      const byId = new Map(lines.map((l) => [l.id, l]));
      const seen = new Set<string>();
      const userId =
        who.side === 'clinic' ? who.c.actor.userId : who.c.lab.userId;
      const actor: TransitionActor =
        who.side === 'clinic'
          ? {
              ...clinicTransitionActor(who.c),
              via: dto.viaQr ? TransitionVia.QR : TransitionVia.APP,
            }
          : labTransitionActor(who.c);
      const now = new Date();

      for (const input of dto.lines) {
        const line = byId.get(input.shipmentItemId);
        if (!line || seen.has(line.id)) {
          throw productionError(
            'PRODUCTION_INVALID',
            'A line is not part of this shipment (or listed twice)',
          );
        }
        seen.add(line.id);
        if (line.condition) {
          throw productionError(
            'PRODUCTION_NOT_ALLOWED',
            'A line of this shipment was already received',
          );
        }
        const missing = input.condition === ShipmentCondition.MISSING;
        if (
          missing
            ? input.receivedQty !== 0
            : input.receivedQty < 1 || input.receivedQty > line.quantity
        ) {
          throw productionError(
            'PRODUCTION_INVALID',
            missing
              ? 'A missing line has nothing received'
              : `Received quantity must be between 1 and ${line.quantity}`,
          );
        }
        Object.assign(line, {
          receivedQty: input.receivedQty,
          condition: input.condition,
          qcResult: missing ? null : (input.qcResult ?? null),
          qcNotes: input.qcNotes?.trim() || null,
          receivedAt: now,
          receivedBy: userId,
        });
        await m.getRepository(ShipmentItem).save(line);

        if (missing || s.direction !== ShipmentDirection.TO_CLINIC) continue;
        if (line.itemStageId) {
          await this.production.stage(
            m,
            s.organizationId,
            line.itemStageId,
            'receive',
            actor,
          );
        }
        const [item] = await sqlRows<{ status_code: string }>(
          m,
          `SELECT status_code FROM lab_order_items WHERE id = $1`,
          [line.orderItemId],
        );
        if (item.status_code === ITEM_STATE.DISPATCHED) {
          await this.production.item(
            m,
            s.organizationId,
            line.orderItemId,
            'receive',
            actor,
          );
        }
      }

      const before = s.status;
      const open = lines.filter((l) => !l.condition).length;
      s.status = open
        ? ShipmentStatus.PARTIALLY_RECEIVED
        : ShipmentStatus.RECEIVED;
      if (!open) {
        s.receivedAt = now;
        s.receivedBy = userId;
      }
      await m.getRepository(Shipment).save(s);
      await this.audit.record(m, this.ref(who), {
        organizationId: s.organizationId,
        entityType: PRODUCTION_ENTITY.SHIPMENT,
        entityId: s.id,
        action: AuditAction.UPDATE,
        before: { status: before },
        after: {
          status: s.status,
          lines: dto.lines.map((l) => ({
            id: l.shipmentItemId,
            receivedQty: l.receivedQty,
            condition: l.condition,
            qcResult: l.qcResult ?? null,
          })),
        },
      });
      if (s.direction === ShipmentDirection.TO_CLINIC) {
        await this.notifier.toLab(
          m,
          lines[0].orderId,
          'shipment.received',
          { shipment_no: s.shipmentNo },
          { type: PRODUCTION_ENTITY.SHIPMENT, id: s.id },
        );
      }
    });
  }

  /**
   * Lost in transit (§14 exceptions). Open lines become `missing`; the
   * work stays owed (dispatched / sent to clinic), so the lab ships it
   * again. Either side may report it.
   */
  async markLost(
    who: ShipmentCaller,
    shipmentId: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const s = await this.lockShipment(m, who, shipmentId);
      if (!OPEN.has(s.status)) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          `This shipment is ${s.status}`,
        );
      }
      const before = s.status;
      await m.query(
        `UPDATE shipment_items SET condition = 'missing', received_qty = 0
          WHERE shipment_id = $1 AND condition IS NULL`,
        [s.id],
      );
      s.status = ShipmentStatus.LOST;
      s.lostAt = new Date();
      s.lostReason = reason.trim();
      await m.getRepository(Shipment).save(s);
      await this.audit.record(m, this.ref(who), {
        organizationId: s.organizationId,
        entityType: PRODUCTION_ENTITY.SHIPMENT,
        entityId: s.id,
        action: AuditAction.UPDATE,
        before: { status: before },
        after: { status: s.status, lostReason: s.lostReason },
      });
      const orders = await sqlRows<{ order_id: string }>(
        m,
        `SELECT DISTINCT order_id FROM shipment_items WHERE shipment_id = $1`,
        [s.id],
      );
      const vars = { shipment_no: s.shipmentNo, reason: s.lostReason };
      const entity = { type: PRODUCTION_ENTITY.SHIPMENT, id: s.id };
      await this.notifier.toLab(
        m,
        orders[0].order_id,
        'shipment.lost',
        vars,
        entity,
      );
      for (const o of orders) {
        await this.notifier.toDoctor(m, o.order_id, 'shipment.lost', vars, {
          entity,
        });
      }
    });
  }

  /** The shipment behind a slip's QR token (clinic side), or 404. */
  async idByToken(organizationId: string, token: string): Promise<string> {
    const s = await this.dataSource
      .getRepository(Shipment)
      .findOneBy({ qrToken: token, organizationId });
    if (!s) {
      throw productionError(
        'PRODUCTION_SHIPMENT_NOT_FOUND',
        'Shipment not found',
      );
    }
    return s.id;
  }

  /** Visible to this caller (its clinic org / its lab), or 404. */
  async assertVisible(who: ShipmentCaller, id: string): Promise<void> {
    const found = await this.dataSource
      .getRepository(Shipment)
      .existsBy(
        who.side === 'clinic'
          ? { id, organizationId: who.c.tenant.organizationId }
          : { id, labId: who.c.lab.labId },
      );
    if (!found) {
      throw productionError(
        'PRODUCTION_SHIPMENT_NOT_FOUND',
        'Shipment not found',
      );
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async create(
    m: EntityManager,
    head: {
      organizationId: string;
      labId: string;
      direction: ShipmentDirection;
      userId: string;
      ref: ActorRef;
    },
    dto: DispatchShipmentDto,
    plan: PlannedLine[],
  ): Promise<Shipment> {
    const repo = m.getRepository(Shipment);
    const shipment = await repo.save(
      repo.create({
        organizationId: head.organizationId,
        labId: head.labId,
        shipmentNo: await this.sequences.next(
          m,
          head.organizationId,
          SHIPMENT_SEQUENCE,
        ),
        direction: head.direction,
        status: ShipmentStatus.DISPATCHED,
        courierName: dto.courierName?.trim() || null,
        trackingNo: dto.trackingNo?.trim() || null,
        notes: dto.notes?.trim() || null,
        dispatchedAt: new Date(),
        dispatchedBy: head.userId,
        qrToken: randomBytes(16).toString('hex'),
      }),
    );
    await m.getRepository(ShipmentItem).insert(
      plan.map((p) => ({
        organizationId: head.organizationId,
        shipmentId: shipment.id,
        orderId: p.item.order_id,
        orderItemId: p.item.id,
        itemStageId: p.stage?.id ?? null,
        contents: p.contents,
        quantity: p.quantity,
      })),
    );
    await this.audit.record(m, head.ref, {
      organizationId: head.organizationId,
      entityType: PRODUCTION_ENTITY.SHIPMENT,
      entityId: shipment.id,
      action: AuditAction.CREATE,
      after: {
        shipmentNo: shipment.shipmentNo,
        direction: head.direction,
        items: plan.map((p) => p.item.id),
      },
    });
    return shipment;
  }

  /** One row per line, refusing an item listed twice. */
  private async distinctItems(
    m: EntityManager,
    dto: DispatchShipmentDto,
    load: (id: string) => Promise<ProductionItem>,
  ): Promise<ProductionItem[]> {
    const ids = dto.lines.map((l) => l.itemId);
    if (new Set(ids).size !== ids.length) {
      throw productionError(
        'PRODUCTION_INVALID',
        'An item is listed twice in the shipment',
      );
    }
    const items: ProductionItem[] = [];
    for (const id of ids) items.push(await load(id));
    return items;
  }

  /** All lines must share one clinic (lab dispatch) / one lab (clinic dispatch). */
  private oneOf(
    items: ProductionItem[],
    key: (i: ProductionItem) => string,
    what: string,
  ): string {
    const values = new Set(items.map(key));
    if (values.size !== 1) {
      throw productionError(
        'PRODUCTION_INVALID',
        `One shipment goes to one ${what}`,
      );
    }
    return [...values][0];
  }

  private async clinicItemById(
    m: EntityManager,
    organizationId: string,
    itemId: string,
  ): Promise<ProductionItem> {
    const [row] = await sqlRows<{ order_id: string }>(
      m,
      `SELECT order_id FROM lab_order_items WHERE id = $1 AND organization_id = $2`,
      [itemId, organizationId],
    );
    if (!row) {
      throw productionError('PRODUCTION_ITEM_NOT_FOUND', 'Item not found');
    }
    return clinicItem(m, organizationId, row.order_id, itemId);
  }

  /** An unreceived line in a shipment that isn't lost: the work is in transit. */
  private async hasOpenLine(
    m: EntityManager,
    itemId: string,
  ): Promise<boolean> {
    const [row] = await sqlRows<{ n: number }>(
      m,
      `SELECT count(*)::int AS n FROM shipment_items sl JOIN shipments s ON s.id = sl.shipment_id
        WHERE sl.order_item_id = $1 AND s.direction = 'to_clinic'
          AND sl.condition IS NULL AND s.status <> 'lost'`,
      [itemId],
    );
    return row.n > 0;
  }

  private async lockShipment(
    m: EntityManager,
    who: ShipmentCaller,
    id: string,
  ): Promise<Shipment> {
    const s = await m.getRepository(Shipment).findOne({
      where:
        who.side === 'clinic'
          ? { id, organizationId: who.c.tenant.organizationId }
          : { id, labId: who.c.lab.labId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!s) {
      throw productionError(
        'PRODUCTION_SHIPMENT_NOT_FOUND',
        'Shipment not found',
      );
    }
    return s;
  }

  private ref(who: ShipmentCaller): ActorRef {
    return who.side === 'clinic' ? who.c.ref : labRef(who.c);
  }
}
