import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { AppRole } from 'src/common/enums/app-role.enum';
import { validateFormData } from 'src/engine/forms/form-data.validator';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { LabPriceResolver } from 'src/lab-catalog/pricing/lab-price-resolver.service';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import {
  ClinicCall,
  clinicTransitionActor,
  LabCall,
  labRef,
  labTransitionActor,
} from '../common/order-context';
import { orderError, OrderIssue } from '../common/order-errors';
import {
  CreateChargeDto,
  CreateMessageDto,
  CreateRevisionDto,
  DecideChargeDto,
  ListOrdersQueryDto,
  OrderTransitionDto,
} from '../dto/order.dto';
import { LabOrderItem } from '../entities/lab-order-item.entity';
import { LabOrder } from '../entities/lab-order.entity';
import {
  OrderChargeRequest,
  OrderMessage,
  OrderRevision,
} from '../entities/order-records.entity';
import {
  ChargeStatus,
  MessageKind,
  MessageSide,
  ORDER_ENTITY,
} from '../enums/order.enums';
import {
  answerRows,
  ClinicOrderResponse,
  patientForLab,
  toClinicOrder,
} from '../mappers/order-response';
import { extractTeeth, lineQuantity, lineTotal } from '../submit/order-lines';
import { OrderReaderService } from './order-reader.service';
import { OrderSubmitService } from './order-submit.service';

/** Actions with their own endpoint (they write more than a status). */
const OWN_ENDPOINT = new Set(['submit', 'reply', 'request_clarification']);

/** Order statuses in which the clinic may still revise the instructions. */
const REVISABLE = new Set([
  'submitted',
  'clarification_needed',
  'accepted',
  'in_progress',
  'on_hold',
]);

const CLOSED = new Set(['draft', 'cancelled', 'completed', 'rejected_by_lab']);

/**
 * The clinic side of lab orders after draft editing: list and detail,
 * status actions (through `transition()` only), revisions, messages and
 * charge requests — plus the lab-side writes on the same records, which the
 * portal controller calls with a lab-scoped order id.
 */
@Injectable()
export class LabOrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly engine: WorkflowEngine,
    private readonly reader: OrderReaderService,
    private readonly submitter: OrderSubmitService,
    private readonly prices: LabPriceResolver,
  ) {}

  async list(c: ClinicCall, q: ListOrdersQueryDto) {
    const qb = this.dataSource
      .getRepository(LabOrder)
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.patient', 'p')
      .innerJoinAndSelect('o.lab', 'l')
      .leftJoinAndSelect('o.doctor', 'd')
      .where('o.organization_id = :org', { org: c.tenant.organizationId })
      .addSelect(
        (s) =>
          s
            .select('COUNT(*)')
            .from(LabOrderItem, 'i')
            .where('i.order_id = o.id'),
        'item_count',
      )
      .addSelect(
        (s) =>
          s
            .select('COALESCE(SUM(i2.lab_line_cost_paisa), 0)')
            .from(LabOrderItem, 'i2')
            .where('i2.order_id = o.id')
            .andWhere(`COALESCE(i2.status_code, '') <> 'cancelled'`),
        'lab_cost',
      )
      .addSelect(
        (s) =>
          s
            .select('COALESCE(SUM(i3.patient_line_price_paisa), 0)')
            .from(LabOrderItem, 'i3')
            .where('i3.order_id = o.id')
            .andWhere(`COALESCE(i3.status_code, '') <> 'cancelled'`),
        'patient_price',
      );
    if (q.status) qb.andWhere('o.status_code = :status', { status: q.status });
    if (q.submittedOnly) qb.andWhere(`o.status_code <> 'draft'`);
    if (q.labId) qb.andWhere('o.lab_id = :labId', { labId: q.labId });
    if (q.doctorId)
      qb.andWhere('o.doctor_id = :doctorId', { doctorId: q.doctorId });
    if (q.patientId)
      qb.andWhere('o.patient_id = :patientId', { patientId: q.patientId });
    if (q.from) qb.andWhere('o.created_at >= :from::date', { from: q.from });
    if (q.to) qb.andWhere(`o.created_at < (:to::date + 1)`, { to: q.to });
    if (q.search) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('o.order_no ILIKE :s', { s: `%${q.search}%` })
            .orWhere('p.full_name ILIKE :s')
            .orWhere('p.patient_number ILIKE :s'),
        ),
      );
    }
    const total = await qb.getCount();
    const { entities, raw } = await qb
      .orderBy('o.createdAt', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .offset((q.page - 1) * q.limit)
      .limit(q.limit)
      .getRawAndEntities<{
        item_count: string;
        lab_cost: string;
        patient_price: string;
      }>();
    return {
      data: entities.map((o, idx) => ({
        id: o.id,
        orderNo: o.orderNo,
        status: o.statusCode,
        priority: o.priority,
        patient: {
          id: o.patient.id,
          fullName: o.patient.fullName,
          patientNumber: o.patient.patientNumber,
        },
        doctor: o.doctor
          ? { id: o.doctor.id, fullName: o.doctor.fullName }
          : null,
        lab: { id: o.lab.id, name: o.lab.name },
        itemCount: Number(raw[idx]?.item_count ?? 0),
        labCostPaisa:
          o.statusCode === 'draft' ? null : Number(raw[idx]?.lab_cost ?? 0),
        patientPricePaisa:
          o.statusCode === 'draft'
            ? null
            : Number(raw[idx]?.patient_price ?? 0),
        requestedOn: o.requestedOn,
        labExpectedOn: o.labExpectedOn,
        submittedAt: o.submittedAt,
        createdAt: o.createdAt,
        version: o.version,
      })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async get(c: ClinicCall, id: string): Promise<ClinicOrderResponse> {
    const order = await this.find(
      this.dataSource.manager,
      c.tenant.organizationId,
      id,
    );
    const bundle = await this.reader.load(order);
    return toClinicOrder(bundle, {
      availableActions: (
        await this.engine.availableActions(
          order.workflowTemplateVersionId,
          order.statusCode,
          clinicTransitionActor(c),
        )
      ).filter((a) => !OWN_ENDPOINT.has(a)),
      warnings: await this.reader.warnings(bundle),
    });
  }

  /** Clinic status actions (cancel, hold, resume, reopen …) — workflow-checked. */
  async transition(
    c: ClinicCall,
    id: string,
    dto: OrderTransitionDto,
  ): Promise<void> {
    if (OWN_ENDPOINT.has(dto.action)) {
      throw orderError(
        'LAB_ORDER_INVALID',
        `Use the ${dto.action} endpoint for this action`,
      );
    }
    await this.engine.transition({
      organizationId: c.tenant.organizationId,
      entityType: ORDER_ENTITY.ORDER,
      entityId: id,
      action: dto.action,
      actor: clinicTransitionActor(c),
      reason: dto.reason ?? null,
      expectedVersion: dto.version,
    });
  }

  /**
   * A new revision (lab ERD §13: never an overwrite). Changed lines are
   * re-validated against their pinned form and re-priced on the original
   * price day, so a catalog change since submit doesn't leak in. A revision
   * also answers an open clarification request.
   */
  async revise(
    c: ClinicCall,
    id: string,
    dto: CreateRevisionDto,
  ): Promise<number> {
    const org = c.tenant.organizationId;
    return this.dataSource.transaction(async (m) => {
      const order = await this.find(m, org, id, true);
      assertVersion(order.version, dto.version);
      if (!REVISABLE.has(order.statusCode)) {
        throw orderError(
          'LAB_ORDER_REVISION_NOT_ALLOWED',
          `A ${order.statusCode} order can’t be revised`,
        );
      }
      const lines = await this.submitter.loadLines(m, order.id);
      const byId = new Map(lines.map((l) => [l.item.id, l]));
      const issues: OrderIssue[] = [];
      for (const change of dto.items) {
        const line = byId.get(change.itemId);
        if (!line || line.item.statusCode === 'cancelled') {
          throw orderError('LAB_ORDER_ITEM_NOT_FOUND', 'Line not found');
        }
        const { item } = line;
        let answers = line.answers;
        if (change.answers) {
          const result = line.def
            ? validateFormData(line.def.schemaJson, change.answers)
            : {
                ok: false,
                value: {},
                issues: [
                  {
                    path: '',
                    code: 'no_form',
                    message: 'This service takes no form answers',
                  },
                ],
              };
          if (!result.ok) {
            issues.push(
              ...result.issues.map((i) => ({ line: item.lineNo, ...i })),
            );
            continue;
          }
          answers = result.value;
        }
        const teeth = line.def
          ? extractTeeth(line.def.schemaJson, answers)
          : [];
        const qty = lineQuantity(
          item.unitType!,
          change.quantity ?? item.quantity,
          teeth.length,
        );
        if (qty.issue) {
          issues.push({
            line: item.lineNo,
            path: 'teeth',
            code: 'teeth_required',
            message: qty.issue,
          });
          continue;
        }
        const quote = await this.prices.quote(
          {
            organizationId: org,
            locationId: order.locationId,
            labServiceId: item.labServiceId,
            optionIds: change.optionIds ?? item.optionIds,
            rush: change.rush ?? item.rush,
            on: item.pricedOn ?? undefined,
            clinicTreatmentId: item.clinicTreatmentId,
            doctorId: order.doctorId,
          },
          m,
        );
        Object.assign(item, {
          optionIds: change.optionIds ?? item.optionIds,
          rush: change.rush ?? item.rush,
          quantity: qty.quantity,
          optionsSnap: quote.lab.options,
          labPriceId: quote.lab.priceId,
          labUnitCostPaisa: quote.lab.unitPaisa,
          labLineCostPaisa: lineTotal(quote.lab.unitPaisa, qty.quantity),
          patientUnitPricePaisa:
            quote.patient?.unitPricePaisa ?? item.patientUnitPricePaisa,
          patientLinePricePaisa: lineTotal(
            quote.patient?.unitPricePaisa ?? item.patientUnitPricePaisa,
            qty.quantity,
          ),
          updatedBy: c.actor.userId,
        });
        await m
          .getRepository(LabOrderItem)
          .save(item, { data: { snapshotChange: 'revision' } });
        await this.submitter.writeAnswers(m, item, line.def, answers, teeth);
      }
      if (issues.length) {
        throw orderError('LAB_ORDER_INVALID', 'Some lines need attention', {
          issues,
        });
      }
      // Approved item charges stay on top of the re-priced line.
      await this.reapplyCharges(
        m,
        order.id,
        dto.items.map((i) => i.itemId),
      );

      if (dto.notes !== undefined) order.notes = dto.notes;
      order.currentRevisionNo += 1;
      order.updatedBy = c.actor.userId;
      await m.getRepository(LabOrder).save(order);
      await m.getRepository(OrderRevision).save({
        organizationId: org,
        orderId: order.id,
        revisionNo: order.currentRevisionNo,
        snapshot: await this.submitter.snapshot(m, order),
        reason: dto.reason,
        createdBy: c.actor.userId,
      });
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: ORDER_ENTITY.ORDER,
        entityId: order.id,
        action: AuditAction.UPDATE,
        before: { revision: order.currentRevisionNo - 1 },
        after: { revision: order.currentRevisionNo, reason: dto.reason },
      });
      if (order.statusCode === 'clarification_needed') {
        await this.resolveClarifications(m, order.id);
        await this.engine.transitionIn(m, {
          organizationId: org,
          entityType: ORDER_ENTITY.ORDER,
          entityId: order.id,
          action: 'reply',
          actor: clinicTransitionActor(c),
          reason: dto.reason,
        });
      }
      return order.currentRevisionNo;
    });
  }

  /** Clinic messages: notes, and the reply that answers a clarification request. */
  async clinicMessage(
    c: ClinicCall,
    id: string,
    dto: CreateMessageDto,
  ): Promise<void> {
    const org = c.tenant.organizationId;
    if (dto.kind === MessageKind.CLARIFICATION_REQUEST) {
      throw orderError(
        'LAB_ORDER_MESSAGE_INVALID',
        'Only the lab asks for clarification',
      );
    }
    await this.dataSource.transaction(async (m) => {
      const order = await this.find(m, org, id, true);
      this.assertOpen(order);
      await this.assertItem(m, order.id, dto.itemId);
      if (dto.kind === MessageKind.REPLY) {
        if (order.statusCode !== 'clarification_needed') {
          throw orderError(
            'LAB_ORDER_MESSAGE_INVALID',
            'The lab hasn’t asked anything to reply to',
          );
        }
        await this.resolveClarifications(m, order.id);
      }
      await this.writeMessage(
        m,
        order,
        dto,
        MessageSide.CLINIC,
        c.actor.userId,
        c.ref,
      );
      if (dto.kind === MessageKind.REPLY) {
        await this.engine.transitionIn(m, {
          organizationId: org,
          entityType: ORDER_ENTITY.ORDER,
          entityId: order.id,
          action: 'reply',
          actor: clinicTransitionActor(c),
          reason: dto.body,
        });
      }
    });
  }

  /** Lab messages: notes, and clarification requests (submitted → clarification_needed). */
  async labMessage(
    l: LabCall,
    order: LabOrder,
    dto: CreateMessageDto,
  ): Promise<void> {
    if (dto.kind === MessageKind.REPLY) {
      throw orderError(
        'LAB_ORDER_MESSAGE_INVALID',
        'Replies come from the clinic',
      );
    }
    await this.dataSource.transaction(async (m) => {
      const locked = await this.find(m, order.organizationId, order.id, true);
      this.assertOpen(locked);
      await this.assertItem(m, locked.id, dto.itemId);
      await this.writeMessage(
        m,
        locked,
        dto,
        MessageSide.LAB,
        l.lab.userId,
        labRef(l),
      );
      if (dto.kind === MessageKind.CLARIFICATION_REQUEST) {
        await this.engine.transitionIn(m, {
          organizationId: locked.organizationId,
          entityType: ORDER_ENTITY.ORDER,
          entityId: locked.id,
          action: 'request_clarification',
          actor: labTransitionActor(l),
          reason: dto.body,
        });
      }
    });
  }

  async acknowledgeRevision(
    l: LabCall,
    order: LabOrder,
    revisionNo: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const rev = await m.getRepository(OrderRevision).findOne({
        where: { orderId: order.id, revisionNo },
        lock: { mode: 'pessimistic_write' },
      });
      if (!rev)
        throw orderError('LAB_ORDER_REVISION_NOT_FOUND', 'Revision not found');
      if (rev.labAcknowledgedAt) return;
      rev.labAcknowledgedAt = new Date();
      rev.labAcknowledgedBy = l.lab.userId;
      await m.getRepository(OrderRevision).save(rev);
      await this.audit.record(m, labRef(l), {
        organizationId: order.organizationId,
        entityType: ORDER_ENTITY.REVISION,
        entityId: rev.id,
        action: AuditAction.UPDATE,
        before: { labAcknowledgedAt: null },
        after: { labAcknowledgedAt: rev.labAcknowledgedAt.toISOString() },
      });
    });
  }

  /** The lab asks for an extra charge; the clinic decides. */
  async requestCharge(
    l: LabCall,
    order: LabOrder,
    dto: CreateChargeDto,
  ): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const locked = await this.find(m, order.organizationId, order.id, true);
      this.assertOpen(locked);
      await this.assertItem(m, locked.id, dto.itemId);
      const charge = await m.getRepository(OrderChargeRequest).save({
        organizationId: locked.organizationId,
        orderId: locked.id,
        itemId: dto.itemId ?? null,
        kind: dto.kind,
        amountPaisa: dto.amountPaisa,
        reason: dto.reason,
        status: ChargeStatus.PENDING,
        requestedBy: l.lab.userId,
      });
      await this.audit.record(m, labRef(l), {
        organizationId: locked.organizationId,
        entityType: ORDER_ENTITY.CHARGE,
        entityId: charge.id,
        action: AuditAction.CREATE,
        after: {
          kind: dto.kind,
          amountPaisa: dto.amountPaisa,
          itemId: dto.itemId ?? null,
        },
      });
      return charge.id;
    });
  }

  /**
   * Approve or reject a charge request (clinic admin / doctor). An approved
   * item-level charge is added to the item's lab line cost — the only way
   * besides a revision a frozen price moves (inv. 3). Order-level charges
   * (shipping …) stay separate rows for the vendor bill.
   */
  async decideCharge(
    c: ClinicCall,
    id: string,
    chargeId: string,
    dto: DecideChargeDto,
  ): Promise<void> {
    if (
      !c.actor.roles.some(
        (r) => r === AppRole.CLINIC_ADMIN || r === AppRole.DOCTOR,
      )
    ) {
      throw orderError(
        'LAB_ORDER_FORBIDDEN',
        'Only doctors and clinic admins decide charges',
      );
    }
    const org = c.tenant.organizationId;
    await this.dataSource.transaction(async (m) => {
      const order = await this.find(m, org, id, true);
      const charge = await m.getRepository(OrderChargeRequest).findOne({
        where: { id: chargeId, orderId: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!charge)
        throw orderError(
          'LAB_ORDER_CHARGE_NOT_FOUND',
          'Charge request not found',
        );
      assertVersion(charge.version, dto.version);
      if (charge.status !== ChargeStatus.PENDING) {
        throw orderError(
          'LAB_ORDER_CHARGE_DECIDED',
          'This charge was already decided',
        );
      }
      charge.status =
        dto.decision === 'approve'
          ? ChargeStatus.APPROVED
          : ChargeStatus.REJECTED;
      charge.decidedBy = c.actor.userId;
      charge.decidedAt = new Date();
      charge.decisionNote = dto.note ?? null;
      await m.getRepository(OrderChargeRequest).save(charge);
      if (charge.status === ChargeStatus.APPROVED && charge.itemId) {
        const item = await m
          .getRepository(LabOrderItem)
          .findOneByOrFail({ id: charge.itemId });
        item.labLineCostPaisa += charge.amountPaisa;
        await m
          .getRepository(LabOrderItem)
          .save(item, { data: { snapshotChange: 'charge' } });
      }
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: ORDER_ENTITY.CHARGE,
        entityId: charge.id,
        action: AuditAction.UPDATE,
        before: { status: ChargeStatus.PENDING },
        after: { status: charge.status, note: charge.decisionNote },
      });
    });
  }

  /**
   * Printable work order (QR + instructions) for a submitted order. It goes
   * to the lab with the case, so it carries no prices.
   */
  async workOrder(c: ClinicCall, id: string) {
    const order = await this.find(
      this.dataSource.manager,
      c.tenant.organizationId,
      id,
    );
    if (!order.orderNo) {
      throw orderError(
        'LAB_ORDER_INVALID',
        'Submit the order before printing its work order',
      );
    }
    const b = await this.reader.load(order);
    const link = await this.dataSource
      .getRepository(LabClinicLink)
      .findOneByOrFail({ id: order.labClinicLinkId });
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    return {
      orderNo: order.orderNo,
      // Resolves per viewer: lab members → portal, clinic staff → clinic order.
      qrValue: `${base}/o/${order.id}`,
      status: order.statusCode,
      priority: order.priority,
      revisionNo: order.currentRevisionNo,
      submittedAt: order.submittedAt,
      requestedOn: order.requestedOn,
      labExpectedOn: order.labExpectedOn,
      notes: order.notes,
      clinic: { name: b.clinicName, location: order.location?.name ?? null },
      lab: {
        name: order.lab.name,
        city: order.lab.city,
        phone: order.lab.phone,
      },
      patient: patientForLab(link.patientDataLevel, order.patient),
      doctor: order.doctor ? { fullName: order.doctor.fullName } : null,
      items: b.items
        .filter((i) => i.statusCode !== 'cancelled')
        .map((i) => {
          const form = i.formSchemaVersionId
            ? b.forms.get(i.formSchemaVersionId)
            : null;
          return {
            lineNo: i.lineNo,
            serviceCode: i.serviceCodeSnap,
            serviceName: i.serviceNameSnap,
            unitType: i.unitType,
            quantity: i.quantity,
            rush: i.rush,
            options: (i.optionsSnap ?? []).map((o) => o.name),
            teeth: b.teeth
              .filter((t) => t.itemId === i.id)
              .map((t) => ({ tooth: t.toothCode, role: t.toothRole })),
            answers: form
              ? answerRows(
                  form.schemaJson.fields,
                  b.answers.get(i.id)?.data ?? {},
                )
              : [],
          };
        }),
    };
  }

  /** The tenant's order (for attachment routes), or 404. */
  byId(organizationId: string, id: string): Promise<LabOrder> {
    return this.find(this.dataSource.manager, organizationId, id);
  }

  // ── helpers ───────────────────────────────────────────────────────────

  private async find(
    m: EntityManager,
    organizationId: string,
    id: string,
    lock = false,
  ): Promise<LabOrder> {
    const order = lock
      ? await m.getRepository(LabOrder).findOne({
          where: { id, organizationId },
          lock: { mode: 'pessimistic_write' },
        })
      : await m.getRepository(LabOrder).findOne({
          where: { id, organizationId },
          relations: { patient: true, doctor: true, lab: true, location: true },
        });
    if (!order) throw orderError('LAB_ORDER_NOT_FOUND', 'Order not found');
    return order;
  }

  private assertOpen(order: LabOrder): void {
    if (CLOSED.has(order.statusCode)) {
      throw orderError(
        'LAB_ORDER_INVALID',
        `This order is ${order.statusCode}`,
      );
    }
  }

  private async assertItem(
    m: EntityManager,
    orderId: string,
    itemId?: string | null,
  ): Promise<void> {
    if (!itemId) return;
    const found = await m
      .getRepository(LabOrderItem)
      .existsBy({ id: itemId, orderId });
    if (!found) throw orderError('LAB_ORDER_ITEM_NOT_FOUND', 'Line not found');
  }

  private async writeMessage(
    m: EntityManager,
    order: LabOrder,
    dto: CreateMessageDto,
    side: MessageSide,
    userId: string,
    ref: ClinicCall['ref'],
  ): Promise<void> {
    const msg = await m.getRepository(OrderMessage).save({
      organizationId: order.organizationId,
      orderId: order.id,
      itemId: dto.itemId ?? null,
      authorUserId: userId,
      authorSide: side,
      kind: dto.kind,
      body: dto.body,
    });
    await this.audit.record(m, ref, {
      organizationId: order.organizationId,
      entityType: ORDER_ENTITY.MESSAGE,
      entityId: msg.id,
      action: AuditAction.CREATE,
      after: { orderId: order.id, kind: dto.kind },
    });
  }

  private async resolveClarifications(
    m: EntityManager,
    orderId: string,
  ): Promise<void> {
    await m.query(
      `UPDATE order_messages SET resolved_at = now()
        WHERE order_id = $1 AND kind = $2 AND resolved_at IS NULL`,
      [orderId, MessageKind.CLARIFICATION_REQUEST],
    );
  }

  /** Re-adds approved item charges to lines a revision just re-priced. */
  private async reapplyCharges(
    m: EntityManager,
    orderId: string,
    itemIds: string[],
  ): Promise<void> {
    if (!itemIds.length) return;
    const rows = await m
      .getRepository(OrderChargeRequest)
      .createQueryBuilder('c')
      .select('c.item_id', 'itemId')
      .addSelect('SUM(c.amount_paisa)', 'total')
      .where('c.order_id = :orderId', { orderId })
      .andWhere('c.status = :approved', { approved: ChargeStatus.APPROVED })
      .andWhere('c.item_id IN (:...itemIds)', { itemIds })
      .groupBy('c.item_id')
      .getRawMany<{ itemId: string; total: string }>();
    for (const r of rows) {
      const item = await m
        .getRepository(LabOrderItem)
        .findOneByOrFail({ id: r.itemId });
      item.labLineCostPaisa += Number(r.total);
      await m
        .getRepository(LabOrderItem)
        .save(item, { data: { snapshotChange: 'charge' } });
    }
  }
}
