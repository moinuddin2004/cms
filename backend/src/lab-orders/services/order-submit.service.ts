import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import {
  IdempotencyService,
  requestHash,
} from 'src/common/idempotency/idempotency.service';
import { NumberSequenceService } from 'src/common/sequences/number-sequence.service';
import { FormSchemaVersion } from 'src/engine/entities/form-schema-version.entity';
import { validateFormData } from 'src/engine/forms/form-data.validator';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { LabService } from 'src/lab-catalog/entities/lab-service.entity';
import { LabPriceResolver } from 'src/lab-catalog/pricing/lab-price-resolver.service';
import { OrderTemplatesService } from 'src/lab-catalog/templates/order-templates.service';
import { NotificationAudience } from 'src/notifications/notifications.enums';
import { NotificationService } from 'src/notifications/services/notification.service';
import { ClinicCall, clinicTransitionActor } from '../common/order-context';
import { orderError, OrderIssue } from '../common/order-errors';
import {
  DentalItemDetails,
  ItemFormResponse,
  ItemTooth,
} from '../entities/item-parts.entity';
import { LabOrderItem } from '../entities/lab-order-item.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { OrderRevision } from '../entities/order-records.entity';
import { ORDER_ENTITY } from '../enums/order.enums';
import {
  estimateExpectedOn,
  extractTeeth,
  fileAnswerIds,
  lineQuantity,
  lineTotal,
  promotedColumns,
  ToothRow,
} from '../submit/order-lines';
import { orderRecipients } from '../workflow/order-recipients';
import { OrderWorkflowService } from '../workflow/order-workflow.service';

export const SUBMIT_SCOPE = 'lab_order.submit';
export const ORDER_SEQUENCE = { key: 'lab_order', prefix: 'LAB' };

/** `dental_item_details` column → entity property. */
const DETAIL_PROPS: Record<string, keyof DentalItemDetails> = {
  shade_system: 'shadeSystem',
  shade: 'shade',
  material_code: 'materialCode',
  implant_system: 'implantSystem',
  implant_platform: 'implantPlatform',
  implant_diameter_mm: 'implantDiameterMm',
  margin_type: 'marginType',
};

export interface LineFacts {
  item: LabOrderItem;
  answers: Record<string, unknown>;
  def: FormSchemaVersion | null;
  /** Filled while submitting. */
  teeth?: ToothRow[];
}

/**
 * Order submit — ONE transaction (lab ERD §10): idempotency → draft →
 * submitted through `transition()` → `order_no` → per line: price snapshot,
 * form validation against the pinned version, teeth, promotions → revision
 * 1 → item statuses + history → outbox `order.submitted`. Anything fails,
 * nothing happened (the order number is given back too).
 */
@Injectable()
export class OrderSubmitService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly idempotency: IdempotencyService,
    private readonly sequences: NumberSequenceService,
    private readonly engine: WorkflowEngine,
    private readonly workflow: OrderWorkflowService,
    private readonly prices: LabPriceResolver,
    private readonly templates: OrderTemplatesService,
    private readonly notifications: NotificationService,
  ) {}

  async submit(
    c: ClinicCall,
    id: string,
    version: number,
    idempotencyKey: string | undefined,
  ): Promise<{ orderId: string; orderNo: string; replayed: boolean }> {
    const key = idempotencyKey?.trim();
    if (!key) {
      throw orderError(
        'IDEMPOTENCY_KEY_REQUIRED',
        'Send an Idempotency-Key header to submit an order',
      );
    }
    const org = c.tenant.organizationId;
    return this.dataSource.transaction(async (m) => {
      const replay = await this.idempotency.claim(
        m,
        org,
        SUBMIT_SCOPE,
        key,
        requestHash({ orderId: id, version }),
      );
      if (replay) {
        return {
          ...(replay.response as { orderId: string; orderNo: string }),
          replayed: true,
        };
      }

      // Status first: wrong state → 422, wrong role → 403, stale → 409.
      await this.engine.transitionIn(m, {
        organizationId: org,
        entityType: ORDER_ENTITY.ORDER,
        entityId: id,
        action: 'submit',
        actor: clinicTransitionActor(c),
        expectedVersion: version,
      });
      const order = await m
        .getRepository(LabOrder)
        .findOneByOrFail({ id, organizationId: org });
      if (!order.doctorId) {
        throw orderError('LAB_ORDER_INVALID', 'Choose the ordering doctor', {
          issues: [
            {
              line: null,
              path: 'doctorId',
              code: 'required',
              message: 'Choose the ordering doctor',
            },
          ],
        });
      }

      const tz = await this.clock.timezoneFor(order.locationId);
      const today = this.clock.today(tz);
      const lines = await this.loadLines(m, order.id);
      if (!lines.length) {
        throw orderError('LAB_ORDER_INVALID', 'Add at least one line');
      }
      const issues: OrderIssue[] = [];
      const turnarounds: number[] = [];
      const services = new Map(
        (
          await m
            .getRepository(LabService)
            .findBy({ id: In(lines.map((l) => l.item.labServiceId)) })
        ).map((s) => [s.id, s]),
      );
      const fileIds = await this.orderFileIds(m, order.id);

      for (const line of lines) {
        const { item } = line;
        const n = item.lineNo;
        // 1. Answers against the pinned version (never a newer one).
        const result = line.def
          ? validateFormData(line.def.schemaJson, line.answers)
          : Object.keys(line.answers).length
            ? {
                ok: false,
                value: {},
                issues: [
                  {
                    path: '',
                    code: 'no_form',
                    message: 'This service takes no form answers',
                  },
                ],
              }
            : { ok: true, value: {}, issues: [] };
        issues.push(...result.issues.map((i) => ({ line: n, ...i })));
        if (!result.ok) continue;
        line.answers = result.value;
        for (const fileId of line.def
          ? fileAnswerIds(line.def.schemaJson, line.answers)
          : []) {
          if (!fileIds.has(fileId)) {
            issues.push({
              line: n,
              path: '',
              code: 'file_not_found',
              message: 'An attached file is not part of this order',
            });
          }
        }

        // 2. Quantity from the teeth for per-tooth services.
        const teeth = line.def
          ? extractTeeth(line.def.schemaJson, line.answers)
          : [];
        const service = services.get(item.labServiceId)!;
        const qty = lineQuantity(service.unitType, item.quantity, teeth.length);
        if (qty.issue) {
          issues.push({
            line: n,
            path: 'teeth',
            code: 'teeth_required',
            message: qty.issue,
          });
          continue;
        }

        // 3. Both prices on the submit day.
        const quote = await this.prices.quote(
          {
            organizationId: org,
            locationId: order.locationId,
            labServiceId: item.labServiceId,
            optionIds: item.optionIds,
            rush: item.rush,
            on: today,
            clinicTreatmentId: item.clinicTreatmentId,
            doctorId: order.doctorId,
          },
          m,
        );
        if (quote.labService.labId !== order.labId) {
          throw orderError(
            'LAB_ORDER_LAB_MISMATCH',
            'Every line must be a service of the order’s lab',
          );
        }
        if (!quote.patient) {
          issues.push({
            line: n,
            path: 'clinicTreatmentId',
            code: 'patient_price_missing',
            message: `${quote.labService.name} isn’t mapped to a treatment — map it in the lab price list or choose a treatment`,
          });
          continue;
        }
        turnarounds.push(service.defaultTurnaroundDays);

        Object.assign(item, {
          quantity: qty.quantity,
          clinicTreatmentId: quote.patient.clinicTreatmentId,
          serviceCodeSnap: quote.labService.code,
          serviceNameSnap: quote.labService.name,
          unitType: quote.labService.unitType,
          optionsSnap: quote.lab.options,
          labPriceId: quote.lab.priceId,
          currency: quote.lab.currency,
          labUnitCostPaisa: quote.lab.unitPaisa,
          labLineCostPaisa: lineTotal(quote.lab.unitPaisa, qty.quantity),
          patientUnitPricePaisa: quote.patient.unitPricePaisa,
          patientLinePricePaisa: lineTotal(
            quote.patient.unitPricePaisa,
            qty.quantity,
          ),
          pricedOn: today,
        });
        line.teeth = teeth;
      }
      if (issues.length) {
        throw orderError(
          'LAB_ORDER_INVALID',
          'Some lines need attention before submitting',
          { issues },
        );
      }

      // Order header.
      order.orderNo = await this.sequences.next(m, org, ORDER_SEQUENCE);
      order.currentRevisionNo = 1;
      order.labExpectedOn = estimateExpectedOn(
        today,
        turnarounds,
        order.requestedOn,
      );
      order.updatedBy = c.actor.userId;
      await m.getRepository(LabOrder).save(order);

      // Lines: snapshot, answers, teeth, promotions, initial status.
      for (const line of lines) {
        const status = await this.workflow.initialState(
          m,
          line.item.workflowTemplateVersionId,
        );
        line.item.statusCode = status;
        line.item.updatedBy = c.actor.userId;
        await m.getRepository(LabOrderItem).save(line.item);
        await this.writeAnswers(
          m,
          line.item,
          line.def,
          line.answers,
          line.teeth ?? [],
        );
        await this.audit.recordStatus(m, c.ref, {
          organizationId: org,
          entityType: ORDER_ENTITY.ITEM,
          entityId: line.item.id,
          fromState: null,
          toState: status,
          actionCode: 'submit',
        });
      }

      await m.getRepository(OrderRevision).save({
        organizationId: org,
        orderId: order.id,
        revisionNo: 1,
        snapshot: await this.snapshot(m, order),
        reason: null,
        createdBy: c.actor.userId,
      });
      if (order.orderTemplateId) {
        await this.templates.markUsed(m, org, c.actor, order.orderTemplateId);
      }
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: ORDER_ENTITY.ORDER,
        entityId: order.id,
        action: AuditAction.UPDATE,
        before: { orderNo: null, revision: 0 },
        after: {
          orderNo: order.orderNo,
          revision: 1,
          labExpectedOn: order.labExpectedOn,
        },
      });

      // Lab ERD §10: the notification is an outbox row in this transaction.
      const who = await orderRecipients(m, order.id);
      await this.notifications.enqueue(m, {
        organizationId: org,
        locationId: who.locationId,
        eventCode: 'order.submitted',
        recipients: who.recipients.filter(
          (r) => r.audience === NotificationAudience.LAB,
        ),
        variables: who.variables,
        link: who.link,
        entity: { type: ORDER_ENTITY.ORDER, id: order.id },
      });

      const response = { orderId: order.id, orderNo: order.orderNo };
      await this.idempotency.complete(m, org, SUBMIT_SCOPE, key, response);
      return { ...response, replayed: false };
    });
  }

  /** Lines with their answers and pinned form version. */
  async loadLines(m: EntityManager, orderId: string): Promise<LineFacts[]> {
    const items = await m
      .getRepository(LabOrderItem)
      .find({ where: { orderId }, order: { lineNo: 'ASC' } });
    if (!items.length) return [];
    const responses = await m
      .getRepository(ItemFormResponse)
      .findBy({ itemId: In(items.map((i) => i.id)) });
    const versionIds = [
      ...new Set(
        items.map((i) => i.formSchemaVersionId).filter((x): x is string => !!x),
      ),
    ];
    const versions = versionIds.length
      ? await m.getRepository(FormSchemaVersion).findBy({ id: In(versionIds) })
      : [];
    const answers = new Map(responses.map((r) => [r.itemId, r.data]));
    const defs = new Map(versions.map((v) => [v.id, v]));
    return items.map((item) => ({
      item,
      answers: answers.get(item.id) ?? {},
      def: item.formSchemaVersionId
        ? (defs.get(item.formSchemaVersionId) ?? null)
        : null,
    }));
  }

  /**
   * Validated answers, teeth and promoted columns of one line (submit and
   * revisions). Teeth and details are derived from the answers, so they
   * are rewritten; the revision snapshots keep the history.
   */
  async writeAnswers(
    m: EntityManager,
    item: LabOrderItem,
    def: FormSchemaVersion | null,
    answers: Record<string, unknown>,
    teeth: ToothRow[],
  ): Promise<void> {
    await m.getRepository(ItemFormResponse).save({
      itemId: item.id,
      organizationId: item.organizationId,
      formSchemaVersionId: item.formSchemaVersionId,
      data: answers,
      validatedAt: new Date(),
    });
    await m.delete(ItemTooth, { itemId: item.id });
    if (teeth.length) {
      await m.getRepository(ItemTooth).insert(
        teeth.map((t) => ({
          ...t,
          itemId: item.id,
          organizationId: item.organizationId,
        })),
      );
    }
    const promoted = promotedColumns(
      def?.promotions,
      answers,
    ).dental_item_details;
    await m.delete(DentalItemDetails, { itemId: item.id });
    if (promoted) {
      const row: Partial<DentalItemDetails> = {
        itemId: item.id,
        organizationId: item.organizationId,
      };
      for (const [column, value] of Object.entries(promoted)) {
        const prop = DETAIL_PROPS[column];
        if (prop) (row as Record<string, unknown>)[prop] = String(value);
      }
      await m
        .getRepository(DentalItemDetails)
        .save(m.getRepository(DentalItemDetails).create(row));
    }
  }

  /**
   * What the lab is asked to make, frozen into `order_revisions.snapshot`.
   * The lab reads it, so it carries the lab cost but never the patient price.
   */
  async snapshot(
    m: EntityManager,
    order: LabOrder,
  ): Promise<Record<string, unknown>> {
    const lines = await this.loadLines(m, order.id);
    const teeth = lines.length
      ? await m
          .getRepository(ItemTooth)
          .findBy({ itemId: In(lines.map((l) => l.item.id)) })
      : [];
    return {
      orderNo: order.orderNo,
      priority: order.priority,
      requestedOn: order.requestedOn,
      labExpectedOn: order.labExpectedOn,
      notes: order.notes,
      items: lines.map(({ item, answers }) => ({
        itemId: item.id,
        lineNo: item.lineNo,
        labServiceId: item.labServiceId,
        serviceCode: item.serviceCodeSnap,
        serviceName: item.serviceNameSnap,
        unitType: item.unitType,
        quantity: item.quantity,
        rush: item.rush,
        options: item.optionsSnap,
        labUnitCostPaisa: item.labUnitCostPaisa,
        labLineCostPaisa: item.labLineCostPaisa,
        formSchemaVersionId: item.formSchemaVersionId,
        answers,
        teeth: teeth
          .filter((t) => t.itemId === item.id)
          .map((t) => ({
            tooth: t.toothCode,
            role: t.toothRole,
            surfaces: t.surfaces,
          })),
      })),
    };
  }

  private async orderFileIds(
    m: EntityManager,
    orderId: string,
  ): Promise<Set<string>> {
    const rows = await sqlRows<{ id: string }>(
      m,
      `SELECT id FROM attachments WHERE order_id = $1`,
      [orderId],
    );
    return new Set(rows.map((r) => r.id));
  }
}
