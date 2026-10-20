import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import {
  ClinicCall,
  clinicTransitionActor,
} from 'src/lab-orders/common/order-context';
import {
  DentalItemDetails,
  ItemFormResponse,
  ItemTooth,
} from 'src/lab-orders/entities/item-parts.entity';
import { LabOrderItem } from 'src/lab-orders/entities/lab-order-item.entity';
import { ORDER_ENTITY } from 'src/lab-orders/enums/order.enums';
import { OrderWorkflowService } from 'src/lab-orders/workflow/order-workflow.service';
import { productionError } from '../common/production-errors';
import { clinicItem } from '../common/production-items';
import {
  RejectWorkDto,
  RemakeDecisionDto,
  RequestRemakeDto,
  StageDecisionDto,
  TryinDto,
} from '../dto/production.dto';
import { OrderItemStage } from '../entities/order-item-stage.entity';
import { RemakeRequest } from '../entities/production-records.entity';
import {
  PRODUCTION_ENTITY,
  RemakeStatus,
  ResponsibleParty,
  StageOutcome,
} from '../enums/production.enums';
import { ProductionNotifier } from '../workflow/production-notifier';
import {
  ITEM_STATE,
  ProductionWorkflowService,
  STAGE_STATE,
} from '../workflow/production-workflow.service';

/**
 * Who pays for a remake (lab ERD §10 "Remake decision"): the lab's fault →
 * lab cost and patient price both 0; the clinic's → the clinic pays the
 * lab, the patient pays nothing; the patient's → both as originally priced.
 */
export function remakeCharges(
  party: ResponsibleParty,
  original: { labLineCostPaisa: number; patientLinePricePaisa: number },
): { labPaisa: number; patientPaisa: number } {
  switch (party) {
    case ResponsibleParty.LAB:
      return { labPaisa: 0, patientPaisa: 0 };
    case ResponsibleParty.CLINIC:
      return { labPaisa: original.labLineCostPaisa, patientPaisa: 0 };
    case ResponsibleParty.PATIENT:
      return {
        labPaisa: original.labLineCostPaisa,
        patientPaisa: original.patientLinePricePaisa,
      };
    default:
      throw productionError(
        'PRODUCTION_INVALID',
        'Decide who is responsible before agreeing a remake',
      );
  }
}

/**
 * The clinic side of production (lab ERD §14 steps 6–8): try-in, approve
 * or correct each stage, approve / reject the final work (→ remake),
 * deliver (→ warranty), remake decisions. Status changes only through
 * `transition()`; the item listener moves stages and re-derives the order.
 */
@Injectable()
export class ClinicProductionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly production: ProductionWorkflowService,
    private readonly orders: OrderWorkflowService,
    private readonly notifier: ProductionNotifier,
  ) {}

  /** The patient visit with the try-in work (stage received → tryin_done). */
  async recordTryin(
    c: ClinicCall,
    orderId: string,
    stageId: string,
    dto: TryinDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const stage = await this.stageOf(m, c, orderId, stageId);
      if (dto.appointmentId) {
        const [ok] = await sqlRows<{ id: string }>(
          m,
          `SELECT a.id FROM appointments a JOIN lab_orders o ON o.patient_id = a.patient_id
            WHERE a.id = $1 AND a.organization_id = $2 AND o.id = $3`,
          [dto.appointmentId, c.tenant.organizationId, orderId],
        );
        if (!ok) {
          throw productionError(
            'PRODUCTION_INVALID',
            'The appointment is not one of this patient’s',
          );
        }
      }
      await this.production.stage(
        m,
        c.tenant.organizationId,
        stage.id,
        'record_tryin',
        clinicTransitionActor(c),
        { expectedVersion: dto.version },
      );
      await m.getRepository(OrderItemStage).update(
        { id: stage.id },
        {
          appointmentId: dto.appointmentId ?? stage.appointmentId,
          tryinNotes: dto.notes?.trim() || null,
        },
      );
    });
  }

  /**
   * Doctor's decision after a try-in (§9b). Approve → next stage (or, for
   * the final stage, the item is approved). Correction → this round closes
   * and the same stage starts again as `round_no + 1` (§5b try-in loop).
   */
  async decideStage(
    c: ClinicCall,
    orderId: string,
    stageId: string,
    dto: StageDecisionDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const stage = await this.stageOf(m, c, orderId, stageId);
      const org = c.tenant.organizationId;
      const actor = clinicTransitionActor(c);
      const item = await clinicItem(m, org, orderId, stage.itemId);
      const vars = {
        item_name: item.service_name_snap,
        stage_name: stage.nameSnap,
      };
      await this.ensureTriedIn(m, c, stage, dto.version);

      if (dto.decision === 'approve') {
        await this.production.stage(m, org, stage.id, 'approve', actor);
        await this.close(m, c, stage, StageOutcome.APPROVED, null);
        // Final work: the item is approved. A try-in: the item goes back to
        // production and the listener starts the next stage.
        await this.production.item(
          m,
          org,
          stage.itemId,
          stage.isFinal ? 'approve' : 'resume',
          stage.isFinal ? actor : ProductionWorkflowService.system(actor),
        );
        await this.notifier.toLab(m, orderId, 'stage.approved', vars);
        return;
      }

      if (stage.isFinal) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          'Final work is approved or rejected (remake), not corrected',
        );
      }
      const notes = dto.notes?.trim();
      if (!notes) {
        throw productionError(
          'PRODUCTION_INVALID',
          'Say what the lab must correct',
        );
      }
      await this.production.stage(
        m,
        org,
        stage.id,
        'request_correction',
        actor,
        {
          reason: notes,
          input: { correction_notes: notes },
        },
      );
      await this.close(m, c, stage, StageOutcome.CORRECTION, notes);
      const roundId = await this.production.addRound(m, stage);
      await this.production.item(
        m,
        org,
        stage.itemId,
        'resume',
        ProductionWorkflowService.system(actor),
      );
      const round = await m
        .getRepository(OrderItemStage)
        .findOneByOrFail({ id: roundId });
      await this.notifier.toLab(m, orderId, 'stage.correction', {
        ...vars,
        round_no: round.roundNo,
        notes,
      });
    });
  }

  /**
   * Final work rejected (§14 step 7): the final round closes as rejected,
   * the item goes `remake_required`, and a remake request opens with the
   * warranty check. Returns the request.
   */
  async rejectWork(
    c: ClinicCall,
    orderId: string,
    itemId: string,
    dto: RejectWorkDto,
  ): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const org = c.tenant.organizationId;
      const actor = clinicTransitionActor(c);
      const item = await clinicItem(m, org, orderId, itemId);
      if (item.status_code !== ITEM_STATE.RECEIVED) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          `Only received work can be rejected (this item is ${item.status_code})`,
        );
      }
      const stage = await this.production.activeStage(m, item.id);
      if (stage) {
        await this.ensureTriedIn(m, c, stage, undefined, true);
        await this.production.stage(
          m,
          org,
          stage.id,
          'request_correction',
          actor,
          {
            reason: dto.reason,
            input: { correction_notes: dto.reason },
          },
        );
        await this.close(m, c, stage, StageOutcome.REJECTED, dto.reason);
      }
      await this.production.item(m, org, item.id, 'reject_work', actor, {
        reason: dto.reason,
        input: { reason_code: dto.reasonCode },
        expectedVersion: dto.version,
      });
      // The listener (or a `check_warranty_on_remake` effect) opened it.
      const request = await this.production.openRemakeRequest(
        m,
        item.id,
        actor,
        { reasonCode: dto.reasonCode, notes: dto.reason },
      );
      return request.id;
    });
  }

  /**
   * The doctor approves received final work (§14 step 7). With stages this
   * is the final stage's approval; an item without stages is approved
   * directly.
   */
  async approveWork(
    c: ClinicCall,
    orderId: string,
    itemId: string,
    version?: number,
  ): Promise<void> {
    const stage = await this.dataSource.transaction(async (m) => {
      const item = await clinicItem(
        m,
        c.tenant.organizationId,
        orderId,
        itemId,
      );
      const active = await this.production.activeStage(m, item.id);
      if (active) return active;
      await this.production.item(
        m,
        c.tenant.organizationId,
        item.id,
        'approve',
        clinicTransitionActor(c),
        { expectedVersion: version },
      );
      return null;
    });
    if (stage) {
      if (!stage.isFinal) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          `${stage.nameSnap} is a try-in — approve the stage instead`,
        );
      }
      await this.decideStage(c, orderId, stage.id, { decision: 'approve' });
    }
  }

  /** Fitted on the patient → delivered; the warranty starts (§14 step 8). */
  async deliver(
    c: ClinicCall,
    orderId: string,
    itemId: string,
    version?: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const item = await clinicItem(
        m,
        c.tenant.organizationId,
        orderId,
        itemId,
      );
      await this.production.item(
        m,
        c.tenant.organizationId,
        item.id,
        'deliver',
        clinicTransitionActor(c),
        { expectedVersion: version },
      );
    });
  }

  /** Cancels one item (workflow-checked: accepted / in production only). */
  async cancelItem(
    c: ClinicCall,
    orderId: string,
    itemId: string,
    reason: string,
    version?: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const item = await clinicItem(
        m,
        c.tenant.organizationId,
        orderId,
        itemId,
      );
      await this.production.item(
        m,
        c.tenant.organizationId,
        item.id,
        'cancel',
        clinicTransitionActor(c),
        { reason, expectedVersion: version },
      );
    });
  }

  /**
   * After-care remake of delivered work (e.g. a fracture months later):
   * the item stays delivered; the request is a warranty claim when its
   * warranty is active. Received work is rejected instead (`rejectWork`).
   */
  async requestRemake(
    c: ClinicCall,
    orderId: string,
    itemId: string,
    dto: RequestRemakeDto,
  ): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const item = await clinicItem(
        m,
        c.tenant.organizationId,
        orderId,
        itemId,
      );
      if (item.status_code === ITEM_STATE.REMAKE_REQUIRED) {
        const done = await m.getRepository(RemakeRequest).existsBy({
          originalItemId: item.id,
          status: RemakeStatus.AGREED,
        });
        if (done) {
          throw productionError(
            'PRODUCTION_NOT_ALLOWED',
            'This item was already remade',
          );
        }
      } else if (item.status_code !== ITEM_STATE.DELIVERED) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          item.status_code === ITEM_STATE.RECEIVED
            ? 'Reject the received work to ask for a remake'
            : `A remake can't be requested while the item is ${item.status_code}`,
        );
      }
      await m.query(`SELECT id FROM lab_order_items WHERE id = $1 FOR UPDATE`, [
        item.id,
      ]);
      const r = await this.production.openRemakeRequest(
        m,
        item.id,
        clinicTransitionActor(c),
        { reasonCode: dto.reasonCode, notes: dto.notes ?? null },
      );
      return r.id;
    });
  }

  /**
   * Remake decision — ONE transaction (lab ERD §10): request agreed → a
   * new item in the same order (`remake_of_item_id`), priced by who is
   * responsible → order re-derived (a completed order reopens). Or closed
   * without a remake.
   */
  async decideRemake(
    c: ClinicCall,
    orderId: string,
    remakeId: string,
    dto: RemakeDecisionDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(RemakeRequest);
      const r = await repo.findOne({
        where: {
          id: remakeId,
          orderId,
          organizationId: c.tenant.organizationId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!r) {
        throw productionError(
          'PRODUCTION_REMAKE_NOT_FOUND',
          'Remake request not found',
        );
      }
      assertVersion(r.version, dto.version);
      if (
        r.status !== RemakeStatus.REQUESTED &&
        r.status !== RemakeStatus.DISPUTED
      ) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          `This remake request is ${r.status}`,
        );
      }
      const before = { status: r.status, responsibleParty: r.responsibleParty };
      r.decidedBy = c.actor.userId;
      r.decidedAt = new Date();
      r.decisionNote = dto.note?.trim() || null;

      if (dto.decision === 'close') {
        r.status = RemakeStatus.CLOSED;
        await repo.save(r);
      } else {
        const party = dto.responsibleParty ?? r.responsibleParty;
        const original = await m
          .getRepository(LabOrderItem)
          .findOneByOrFail({ id: r.originalItemId });
        const charges = remakeCharges(party, original);
        const newItem = await this.createRemakeItem(m, c, original, charges);
        Object.assign(r, {
          status: RemakeStatus.AGREED,
          responsibleParty: party,
          labChargePaisa: charges.labPaisa,
          patientChargePaisa: charges.patientPaisa,
          newItemId: newItem.id,
        });
        await repo.save(r);
        await this.orders.deriveOrder(m, orderId, { reopen: true });
        await this.notifier.toLab(m, orderId, 'remake.agreed', {
          item_name: original.serviceNameSnap,
          responsible_party: party,
        });
      }
      await this.audit.record(m, c.ref, {
        organizationId: r.organizationId,
        entityType: PRODUCTION_ENTITY.REMAKE,
        entityId: r.id,
        action: AuditAction.UPDATE,
        before,
        after: {
          status: r.status,
          responsibleParty: r.responsibleParty,
          newItemId: r.newItemId,
          labChargePaisa: r.labChargePaisa,
          patientChargePaisa: r.patientChargePaisa,
        },
      });
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────

  /**
   * The remake line: the original's frozen snapshot (service, options,
   * answers, teeth, pinned versions) with the responsibility's prices,
   * starting at the item workflow's initial state — the lab accepts it
   * like any new work.
   */
  private async createRemakeItem(
    m: EntityManager,
    c: ClinicCall,
    original: LabOrderItem,
    charges: { labPaisa: number; patientPaisa: number },
  ): Promise<LabOrderItem> {
    const [{ max }] = await sqlRows<{ max: number }>(
      m,
      `SELECT max(line_no)::int AS max FROM lab_order_items WHERE order_id = $1`,
      [original.orderId],
    );
    const status = await this.orders.initialState(
      m,
      original.workflowTemplateVersionId,
    );
    const unit = (line: number, unitPaisa: number) => (line ? unitPaisa : 0);
    const repo = m.getRepository(LabOrderItem);
    const item = await repo.save(
      repo.create({
        organizationId: original.organizationId,
        orderId: original.orderId,
        lineNo: max + 1,
        labServiceId: original.labServiceId,
        clinicTreatmentId: original.clinicTreatmentId,
        optionIds: original.optionIds,
        rush: original.rush,
        quantity: original.quantity,
        serviceCodeSnap: original.serviceCodeSnap,
        serviceNameSnap: original.serviceNameSnap,
        unitType: original.unitType,
        optionsSnap: original.optionsSnap,
        labPriceId: original.labPriceId,
        currency: original.currency,
        labUnitCostPaisa: unit(charges.labPaisa, original.labUnitCostPaisa),
        labLineCostPaisa: charges.labPaisa,
        patientUnitPricePaisa: unit(
          charges.patientPaisa,
          original.patientUnitPricePaisa,
        ),
        patientLinePricePaisa: charges.patientPaisa,
        pricedOn: original.pricedOn,
        formSchemaVersionId: original.formSchemaVersionId,
        workflowTemplateVersionId: original.workflowTemplateVersionId,
        stageTemplateId: original.stageTemplateId,
        statusCode: status,
        remakeOfItemId: original.id,
        createdBy: c.actor.userId,
        updatedBy: c.actor.userId,
      }),
    );
    const answers = await m
      .getRepository(ItemFormResponse)
      .findOneBy({ itemId: original.id });
    if (answers) {
      await m.getRepository(ItemFormResponse).save({
        itemId: item.id,
        organizationId: item.organizationId,
        formSchemaVersionId: answers.formSchemaVersionId,
        data: answers.data,
        validatedAt: answers.validatedAt,
      });
    }
    const teeth = await m
      .getRepository(ItemTooth)
      .findBy({ itemId: original.id });
    if (teeth.length) {
      await m.getRepository(ItemTooth).insert(
        teeth.map((t) => ({
          organizationId: t.organizationId,
          itemId: item.id,
          numberingSystem: t.numberingSystem,
          toothCode: t.toothCode,
          dentition: t.dentition,
          toothRole: t.toothRole,
          surfaces: t.surfaces,
        })),
      );
    }
    const details = await m
      .getRepository(DentalItemDetails)
      .findOneBy({ itemId: original.id });
    if (details) {
      await m.getRepository(DentalItemDetails).insert({
        itemId: item.id,
        organizationId: details.organizationId,
        shadeSystem: details.shadeSystem,
        shade: details.shade,
        materialCode: details.materialCode,
        implantSystem: details.implantSystem,
        implantPlatform: details.implantPlatform,
        implantDiameterMm: details.implantDiameterMm,
        marginType: details.marginType,
      });
    }
    await this.audit.recordStatus(m, c.ref, {
      organizationId: item.organizationId,
      entityType: ORDER_ENTITY.ITEM,
      entityId: item.id,
      fromState: null,
      toState: status,
      actionCode: 'remake',
      metadata: { remakeOfItemId: original.id },
    });
    await this.audit.record(m, c.ref, {
      organizationId: item.organizationId,
      entityType: ORDER_ENTITY.ITEM,
      entityId: item.id,
      action: AuditAction.CREATE,
      after: {
        remakeOfItemId: original.id,
        labLineCostPaisa: item.labLineCostPaisa,
        patientLinePricePaisa: item.patientLinePricePaisa,
      },
    });
    return item;
  }

  /**
   * A stage with no patient visit goes straight from received to the
   * decision; with `force` (rejecting final work on arrival) too.
   */
  private async ensureTriedIn(
    m: EntityManager,
    c: ClinicCall,
    stage: OrderItemStage,
    version: number | undefined,
    force = false,
  ): Promise<void> {
    if (
      stage.statusCode === STAGE_STATE.RECEIVED &&
      (force || !stage.requiresPatientVisit)
    ) {
      const r = await this.production.stage(
        m,
        c.tenant.organizationId,
        stage.id,
        'record_tryin',
        clinicTransitionActor(c),
        { expectedVersion: version },
      );
      stage.statusCode = r.toState;
      stage.version = r.version;
    } else if (version !== undefined) {
      assertVersion(stage.version, version);
    }
  }

  private async close(
    m: EntityManager,
    c: ClinicCall,
    stage: OrderItemStage,
    outcome: StageOutcome,
    notes: string | null,
  ): Promise<void> {
    await m.getRepository(OrderItemStage).update(
      { id: stage.id },
      {
        outcome,
        correctionNotes: notes,
        decidedBy: c.actor.userId,
        decidedAt: new Date(),
      },
    );
  }

  private async stageOf(
    m: EntityManager,
    c: ClinicCall,
    orderId: string,
    stageId: string,
  ): Promise<OrderItemStage> {
    const stage = await m.getRepository(OrderItemStage).findOneBy({
      id: stageId,
      orderId,
      organizationId: c.tenant.organizationId,
    });
    if (!stage) {
      throw productionError('PRODUCTION_STAGE_NOT_FOUND', 'Stage not found');
    }
    return stage;
  }
}
