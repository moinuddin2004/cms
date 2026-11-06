import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays } from 'src/common/clock/tz.util';
import { pgError, sqlRows } from 'src/common/database/sql';
import { NumberSequenceService } from 'src/common/sequences/number-sequence.service';
import { ClinicCall } from 'src/lab-orders/common/order-context';
import { ChargeKind, ChargeStatus } from 'src/lab-orders/enums/order.enums';
import { labBillingError, notFound } from '../common/lab-billing-errors';
import {
  LineMathError,
  lineMath,
  spreadDiscount,
} from '../common/lab-billing-math';
import {
  CreateInvoiceDto,
  InvoiceLineDto,
  IssueInvoiceDto,
  UpdateInvoiceDto,
  VoidInvoiceDto,
} from '../dto/lab-billing.dto';
import { LabBillingSettings } from '../entities/lab-credit.entity';
import { LabInvoice, LabInvoiceLine } from '../entities/lab-invoice.entity';
import {
  LAB_BILLING_ENTITY,
  LabInvoiceLineKind,
  LabInvoiceStatus,
} from '../enums/lab-billing.enums';
import { LabBillingEvents } from '../events/lab-billing-events';
import {
  LAB_BILLING_SEQUENCES,
  UNBILLABLE_ITEM_STATES,
} from '../lab-billing.constants';
import { LabPatientNotifier } from '../notifications/patient-notifier.service';
import { isOpen, LabAllocations } from './lab-allocations.service';
import { LabBillingLocks } from './lab-billing-locks';
import { LabBillingTotals } from './lab-billing-totals.service';

interface OrderRef {
  id: string;
  patientId: string;
  locationId: string;
  doctorId: string | null;
}

interface BillableItem {
  id: string;
  service_name_snap: string;
  quantity: number;
  patient_unit_price_minor: string;
  patient_line_price_minor: string;
  clinic_treatment_id: string | null;
  status_code: string;
  teeth: string | null;
  billed: boolean;
}

interface BillableCharge {
  id: string;
  kind: ChargeKind;
  reason: string;
  amount_minor: string;
  status: ChargeStatus;
  billed: boolean;
}

type DraftLine = Omit<
  LabInvoiceLine,
  | 'id'
  | 'invoice'
  | 'invoiceId'
  | 'labOrderItem'
  | 'orderChargeRequest'
  | 'createdAt'
  | 'isVoid'
  | 'organizationId'
  | 'lineNo'
  | 'taxMinor'
  | 'lineTotalMinor'
  | 'taxRateBp'
  // commission snapshot: set at issue by lab-finance
  | 'performingAssignmentId'
  | 'commissionPlanId'
  | 'commissionRateBps'
  | 'commissionFixedMinor'
>;

const CHARGE_LABEL: Record<ChargeKind, string> = {
  [ChargeKind.RUSH]: 'Rush charge',
  [ChargeKind.MATERIAL]: 'Extra material',
  [ChargeKind.SHIPPING]: 'Shipping',
  [ChargeKind.OTHER]: 'Lab charge',
};

/**
 * Lab invoices (lab ERD §6a): estimates (drafts) built from a lab order's
 * frozen patient prices, issue (number + due date + advance), void. The
 * same structure as billing v2's invoices, on the lab's own tables.
 */
@Injectable()
export class LabInvoicesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
    private readonly sequences: NumberSequenceService,
    private readonly audit: AuditService,
    private readonly totals: LabBillingTotals,
    private readonly allocations: LabAllocations,
    private readonly events: LabBillingEvents,
    private readonly notifier: LabPatientNotifier,
  ) {}

  async settings(
    m: EntityManager,
    organizationId: string,
  ): Promise<{ taxRateBp: number; dueDays: number }> {
    const row = await m
      .getRepository(LabBillingSettings)
      .findOneBy({ organizationId });
    return { taxRateBp: row?.taxRateBp ?? 0, dueDays: row?.dueDays ?? 0 };
  }

  readSettings(organizationId: string) {
    return this.settings(this.dataSource.manager, organizationId);
  }

  async updateSettings(
    c: ClinicCall,
    dto: { taxRateBp?: number; dueDays?: number },
  ): Promise<{ taxRateBp: number; dueDays: number }> {
    return this.dataSource.transaction(async (m) => {
      const org = c.tenant.organizationId;
      const before = await this.settings(m, org);
      const after = {
        taxRateBp: dto.taxRateBp ?? before.taxRateBp,
        dueDays: dto.dueDays ?? before.dueDays,
      };
      await m.getRepository(LabBillingSettings).save({
        organizationId: org,
        ...after,
        updatedBy: c.actor.userId,
      });
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: LAB_BILLING_ENTITY.SETTINGS,
        entityId: org,
        action: AuditAction.UPDATE,
        before,
        after,
      });
      return after;
    });
  }

  async create(c: ClinicCall, dto: CreateInvoiceDto): Promise<string> {
    return this.withUniqueGuard(() =>
      this.dataSource.transaction(async (m) => {
        const org = c.tenant.organizationId;
        const order = dto.orderId
          ? await this.order(m, org, dto.orderId)
          : null;
        const patientId = order?.patientId ?? dto.patientId;
        if (!patientId)
          throw labBillingError(
            'LAB_BILLING_INVALID',
            'Pick a patient or an order',
          );
        if (order && dto.patientId && dto.patientId !== order.patientId)
          throw labBillingError(
            'LAB_BILLING_INVALID',
            'The order is for another patient',
          );
        await this.assertPatient(m, org, patientId);

        const repo = m.getRepository(LabInvoice);
        const invoice = await repo.save(
          repo.create({
            organizationId: org,
            locationId: order?.locationId ?? c.tenant.locationId,
            patientId,
            orderId: order?.id ?? null,
            status: LabInvoiceStatus.DRAFT,
            notes: dto.notes?.trim() || null,
            createdBy: c.actor.userId,
            updatedBy: c.actor.userId,
          }),
        );
        await this.writeLines(m, c, invoice, order, dto);
        await this.audit.record(m, c.ref, {
          organizationId: org,
          entityType: LAB_BILLING_ENTITY.INVOICE,
          entityId: invoice.id,
          action: AuditAction.CREATE,
          after: { orderId: invoice.orderId, patientId, status: 'draft' },
        });
        if (dto.issue) await this.issueIn(m, c, invoice.id, true);
        return invoice.id;
      }),
    );
  }

  /** Replaces a draft's lines (an estimate is not a posted record yet). */
  async update(
    c: ClinicCall,
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<void> {
    await this.withUniqueGuard(() =>
      this.dataSource.transaction(async (m) => {
        const org = c.tenant.organizationId;
        const [invoice] = await LabBillingLocks.invoices(m, org, [id]);
        this.assertDraft(invoice, dto.version);
        const order = invoice.orderId
          ? await this.order(m, org, invoice.orderId)
          : null;
        const before = await this.lineSnapshot(m, id);
        await m.getRepository(LabInvoiceLine).delete({ invoiceId: id });
        await m.getRepository(LabInvoice).update(id, {
          notes:
            dto.notes === undefined ? invoice.notes : dto.notes.trim() || null,
          updatedBy: c.actor.userId,
          version: invoice.version + 1,
        });
        await this.writeLines(m, c, invoice, order, dto);
        await this.audit.record(m, c.ref, {
          organizationId: org,
          entityType: LAB_BILLING_ENTITY.INVOICE,
          entityId: id,
          action: AuditAction.UPDATE,
          before: { lines: before },
          after: { lines: await this.lineSnapshot(m, id) },
        });
      }),
    );
  }

  async issue(c: ClinicCall, id: string, dto: IssueInvoiceDto): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const [invoice] = await LabBillingLocks.invoices(
        m,
        c.tenant.organizationId,
        [id],
      );
      this.assertDraft(invoice, dto.version);
      await this.issueIn(m, c, id, dto.applyAdvance ?? true);
    });
  }

  /** Draft → issued (number, dates), then the patient's advance is applied (§6a). */
  private async issueIn(
    m: EntityManager,
    c: ClinicCall,
    id: string,
    applyAdvance: boolean,
  ): Promise<void> {
    const org = c.tenant.organizationId;
    const invoice = await m.getRepository(LabInvoice).findOneByOrFail({ id });
    const lines = await m
      .getRepository(LabInvoiceLine)
      .countBy({ invoiceId: id });
    if (!lines)
      throw labBillingError(
        'LAB_BILLING_INVALID',
        'Add at least one line before issuing',
      );
    const tz = await this.clock.timezoneFor(invoice.locationId);
    const today = this.clock.today(tz);
    const { dueDays } = await this.settings(m, org);
    const invoiceNo = await this.sequences.next(
      m,
      org,
      LAB_BILLING_SEQUENCES.INVOICE,
    );
    await m.getRepository(LabInvoice).update(id, {
      invoiceNo,
      status: LabInvoiceStatus.ISSUED,
      issuedOn: today,
      dueOn: addDays(today, dueDays),
      issuedAt: this.clock.now(),
      issuedBy: c.actor.userId,
      updatedBy: c.actor.userId,
      version: invoice.version + 1,
    });
    await this.totals.recomputeInvoices(m, [id]);
    const issued = await m.getRepository(LabInvoice).findOneByOrFail({ id });
    await this.audit.recordStatus(m, c.ref, {
      organizationId: org,
      entityType: LAB_BILLING_ENTITY.INVOICE,
      entityId: id,
      fromState: LabInvoiceStatus.DRAFT,
      toState: LabInvoiceStatus.ISSUED,
      actionCode: 'issue',
      metadata: { invoiceNo, totalMinor: issued.totalMinor },
    });
    await this.events.emit(m, 'invoiceIssued', {
      organizationId: org,
      locationId: issued.locationId,
      patientId: issued.patientId,
      actorUserId: c.actor.userId,
      invoiceId: id,
      invoiceNo,
      issuedOn: today,
      totalMinor: issued.totalMinor,
    });
    if (!applyAdvance) return;
    const refs = await this.allocations.applyAdvance(m, c, issued);
    if (refs.length) {
      await this.events.emit(m, 'advanceApplied', {
        organizationId: org,
        locationId: issued.locationId,
        patientId: issued.patientId,
        actorUserId: c.actor.userId,
        allocations: refs,
      });
    }
  }

  /** A draft, or an issued invoice nobody paid or credited. Lines are freed for re-billing. */
  async void(c: ClinicCall, id: string, dto: VoidInvoiceDto): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const org = c.tenant.organizationId;
      const [invoice] = await LabBillingLocks.invoices(m, org, [id]);
      if (invoice.version !== dto.version) throw this.versionConflict();
      if (invoice.status === LabInvoiceStatus.VOID)
        throw labBillingError(
          'LAB_BILLING_INVOICE_NOT_OPEN',
          'This invoice is already void',
        );
      if (invoice.paidMinor > 0 || invoice.creditedMinor > 0)
        throw labBillingError(
          'LAB_BILLING_INVOICE_HAS_MONEY',
          'Payments or credit notes are on this invoice — reverse or credit them instead',
        );
      await m.getRepository(LabInvoice).update(id, {
        status: LabInvoiceStatus.VOID,
        voidReason: dto.reason.trim(),
        voidedAt: this.clock.now(),
        voidedBy: c.actor.userId,
        updatedBy: c.actor.userId,
        version: invoice.version + 1,
      });
      await m
        .getRepository(LabInvoiceLine)
        .update({ invoiceId: id }, { isVoid: true });
      await this.audit.recordStatus(m, c.ref, {
        organizationId: org,
        entityType: LAB_BILLING_ENTITY.INVOICE,
        entityId: id,
        fromState: invoice.status,
        toState: LabInvoiceStatus.VOID,
        actionCode: 'void',
        reason: dto.reason.trim(),
      });
      await this.events.emit(m, 'invoiceVoided', {
        organizationId: org,
        locationId: invoice.locationId,
        patientId: invoice.patientId,
        actorUserId: c.actor.userId,
        invoiceId: id,
        wasIssued: invoice.status !== LabInvoiceStatus.DRAFT,
        totalMinor: invoice.totalMinor,
      });
    });
  }

  /** §16 "Outstanding payment reminder", on request. Returns the outbox rows. */
  async remind(c: ClinicCall, id: string) {
    return this.dataSource.transaction(async (m) => {
      const [invoice] = await LabBillingLocks.invoices(
        m,
        c.tenant.organizationId,
        [id],
      );
      if (!isOpen(invoice) || invoice.balanceMinor <= 0)
        throw labBillingError(
          'LAB_BILLING_INVOICE_NOT_OPEN',
          'Nothing is owed on this invoice',
        );
      const rows = await this.notifier.reminder(m, invoice);
      await this.audit.record(m, c.ref, {
        organizationId: invoice.organizationId,
        entityType: LAB_BILLING_ENTITY.INVOICE,
        entityId: id,
        action: AuditAction.UPDATE,
        after: {
          reminder: rows.map((r) => `${r.channel}:${r.status}`).join(', '),
        },
      });
      return rows;
    });
  }

  // ─── lines ───────────────────────────────────────────────────────────

  private async writeLines(
    m: EntityManager,
    c: ClinicCall,
    invoice: LabInvoice,
    order: OrderRef | null,
    dto: {
      lines?: InvoiceLineDto[];
      discountMinor?: number;
      taxRateBp?: number;
    },
  ): Promise<void> {
    const org = c.tenant.organizationId;
    const items = order
      ? await this.billableItems(m, order.id, invoice.id)
      : [];
    const charges = order
      ? await this.billableCharges(m, order.id, invoice.id)
      : [];
    const wanted: InvoiceLineDto[] =
      dto.lines ??
      items
        .filter((i) => !i.billed && this.isBillable(i))
        .map((i) => ({ kind: LabInvoiceLineKind.LAB_ITEM, itemId: i.id }));
    if (!wanted.length)
      throw labBillingError(
        'LAB_BILLING_INVALID',
        order
          ? 'Nothing is left to bill on this order'
          : 'Add at least one line',
      );

    const seen = new Set<string>();
    const drafts: Array<DraftLine & { discountMinor: number }> = wanted.map(
      (l) => {
        const ref = l.itemId ?? l.chargeRequestId;
        if (ref) {
          if (seen.has(ref))
            throw labBillingError(
              'LAB_BILLING_INVALID',
              'The same item is on two lines',
            );
          seen.add(ref);
        }
        return this.draftLine(l, order, items, charges);
      },
    );

    const taxRateBp = dto.taxRateBp ?? (await this.settings(m, org)).taxRateBp;
    const gross = drafts.map((d) => d.quantity * d.unitPriceMinor);
    let discounts = drafts.map((d) => d.discountMinor);
    try {
      if (dto.discountMinor !== undefined)
        discounts = spreadDiscount(gross, dto.discountMinor);
      const repo = m.getRepository(LabInvoiceLine);
      await repo.save(
        drafts.map((d, i) => {
          const money = lineMath({
            quantity: d.quantity,
            unitPriceMinor: d.unitPriceMinor,
            discountMinor: discounts[i],
            taxRateBp,
          });
          return repo.create({
            ...d,
            organizationId: org,
            invoiceId: invoice.id,
            lineNo: i + 1,
            discountMinor: discounts[i],
            taxRateBp,
            taxMinor: money.taxMinor,
            lineTotalMinor: money.lineTotalMinor,
          });
        }),
      );
    } catch (err) {
      if (err instanceof LineMathError)
        throw labBillingError('LAB_BILLING_INVALID', err.message);
      throw err;
    }
    await this.totals.recomputeInvoices(m, [invoice.id]);
  }

  private draftLine(
    l: InvoiceLineDto,
    order: OrderRef | null,
    items: BillableItem[],
    charges: BillableCharge[],
  ): DraftLine & { discountMinor: number } {
    const discountMinor = l.discountMinor ?? 0;
    switch (l.kind) {
      case LabInvoiceLineKind.LAB_ITEM: {
        const item = items.find((i) => i.id === l.itemId);
        if (!order || !item)
          throw labBillingError(
            'LAB_BILLING_ITEM_NOT_BILLABLE',
            'Item not found on this order',
          );
        if (!this.isBillable(item))
          throw labBillingError(
            'LAB_BILLING_ITEM_NOT_BILLABLE',
            `${item.service_name_snap} is ${item.status_code} and cannot be billed`,
          );
        if (item.billed)
          throw labBillingError(
            'LAB_BILLING_ALREADY_BILLED',
            `${item.service_name_snap} is already on another invoice`,
          );
        // Frozen at submit (inv. 3): the line repeats the snapshot exactly.
        // A billing manager may charge this line differently (a richer patient,
        // premium material): `unitPriceMinor` then IS the whole line price.
        const overridden = l.unitPriceMinor !== undefined;
        const unit = Number(item.patient_unit_price_minor);
        const total = overridden
          ? (l.unitPriceMinor as number)
          : Number(item.patient_line_price_minor);
        const exact = !overridden && item.quantity * unit === total;
        return {
          lineKind: LabInvoiceLineKind.LAB_ITEM,
          labOrderItemId: item.id,
          orderChargeRequestId: null,
          clinicTreatmentId: item.clinic_treatment_id,
          doctorId: order.doctorId,
          description: (
            item.service_name_snap +
            (item.teeth ? ` — teeth ${item.teeth}` : '')
          ).slice(0, 200),
          quantity: exact ? item.quantity : 1,
          unitPriceMinor: exact ? unit : total,
          discountMinor,
        };
      }
      case LabInvoiceLineKind.LAB_CHARGE: {
        const charge = charges.find((x) => x.id === l.chargeRequestId);
        if (!order || !charge || charge.status !== ChargeStatus.APPROVED)
          throw labBillingError(
            'LAB_BILLING_ITEM_NOT_BILLABLE',
            'Only an approved charge of this order can be billed',
          );
        if (charge.billed)
          throw labBillingError(
            'LAB_BILLING_ALREADY_BILLED',
            'This charge is already billed',
          );
        return {
          lineKind: LabInvoiceLineKind.LAB_CHARGE,
          labOrderItemId: null,
          orderChargeRequestId: charge.id,
          clinicTreatmentId: null,
          doctorId: order.doctorId,
          description: (
            l.description?.trim() ||
            `${CHARGE_LABEL[charge.kind]}: ${charge.reason}`
          ).slice(0, 200),
          quantity: 1,
          unitPriceMinor: l.unitPriceMinor ?? Number(charge.amount_minor),
          discountMinor,
        };
      }
      case LabInvoiceLineKind.MANUAL: {
        if (!l.description?.trim() || l.unitPriceMinor === undefined)
          throw labBillingError(
            'LAB_BILLING_INVALID',
            'A manual line needs a description and a price',
          );
        return {
          lineKind: LabInvoiceLineKind.MANUAL,
          labOrderItemId: null,
          orderChargeRequestId: null,
          clinicTreatmentId: null,
          doctorId: order?.doctorId ?? null,
          description: l.description.trim(),
          quantity: l.quantity ?? 1,
          unitPriceMinor: l.unitPriceMinor,
          discountMinor,
        };
      }
    }
  }

  private isBillable(i: BillableItem): boolean {
    return !UNBILLABLE_ITEM_STATES.includes(i.status_code);
  }

  /** Submitted items of an order; `billed` = on a non-void line of another invoice. */
  billableItems(
    m: EntityManager,
    orderId: string,
    exceptInvoiceId: string | null = null,
  ): Promise<BillableItem[]> {
    return sqlRows<BillableItem>(
      m,
      `SELECT i.id, i.service_name_snap, i.quantity, i.patient_unit_price_minor,
              i.patient_line_price_minor, i.clinic_treatment_id, i.status_code,
              (SELECT string_agg(t.tooth_code, ', ' ORDER BY t.tooth_code)
                 FROM item_teeth t WHERE t.item_id = i.id) AS teeth,
              EXISTS (SELECT 1 FROM lab_invoice_lines l
                       WHERE l.lab_order_item_id = i.id AND NOT l.is_void
                         AND l.invoice_id IS DISTINCT FROM $2::uuid) AS billed
         FROM lab_order_items i
        WHERE i.order_id = $1 AND i.status_code IS NOT NULL
        ORDER BY i.line_no`,
      [orderId, exceptInvoiceId],
    );
  }

  billableCharges(
    m: EntityManager,
    orderId: string,
    exceptInvoiceId: string | null = null,
  ): Promise<BillableCharge[]> {
    return sqlRows<BillableCharge>(
      m,
      `SELECT c.id, c.kind, c.reason, c.amount_minor, c.status,
              EXISTS (SELECT 1 FROM lab_invoice_lines l
                       WHERE l.order_charge_request_id = c.id AND NOT l.is_void
                         AND l.invoice_id IS DISTINCT FROM $2::uuid) AS billed
         FROM order_charge_requests c
        WHERE c.order_id = $1
        ORDER BY c.created_at`,
      [orderId, exceptInvoiceId],
    );
  }

  // ─── helpers ─────────────────────────────────────────────────────────

  private async order(
    m: EntityManager,
    org: string,
    id: string,
  ): Promise<OrderRef> {
    const [o] = await sqlRows<{
      id: string;
      patient_id: string;
      location_id: string;
      doctor_id: string | null;
      status_code: string;
    }>(
      m,
      `SELECT id, patient_id, location_id, doctor_id, status_code FROM lab_orders
        WHERE id = $1 AND organization_id = $2`,
      [id, org],
    );
    if (!o) throw notFound('Lab order');
    if (o.status_code === 'draft')
      throw labBillingError(
        'LAB_BILLING_INVALID',
        'Submit the order before billing it',
      );
    return {
      id: o.id,
      patientId: o.patient_id,
      locationId: o.location_id,
      doctorId: o.doctor_id,
    };
  }

  private async assertPatient(m: EntityManager, org: string, id: string) {
    const [p] = await sqlRows<{ id: string }>(
      m,
      `SELECT id FROM patients WHERE id = $1 AND organization_id = $2`,
      [id, org],
    );
    if (!p) throw notFound('Patient');
  }

  private assertDraft(invoice: LabInvoice, version: number): void {
    if (invoice.status !== LabInvoiceStatus.DRAFT)
      throw labBillingError(
        'LAB_BILLING_INVOICE_NOT_DRAFT',
        'Only an estimate can be changed',
      );
    if (invoice.version !== version) throw this.versionConflict();
  }

  private versionConflict() {
    return labBillingError(
      'LAB_BILLING_VERSION_CONFLICT',
      'Someone else changed this invoice — reload and try again',
    );
  }

  private async lineSnapshot(m: EntityManager, invoiceId: string) {
    const lines = await m
      .getRepository(LabInvoiceLine)
      .find({ where: { invoiceId }, order: { lineNo: 'ASC' } });
    return lines.map(
      (l) => `${l.description} × ${l.quantity} = ${l.lineTotalMinor}`,
    );
  }

  /** Two drafts racing for the same item: the partial unique index decides. */
  private async withUniqueGuard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const { code, constraint } = pgError(err);
      if (
        code === '23505' &&
        (constraint === 'uq_lab_invoice_lines_item' ||
          constraint === 'uq_lab_invoice_lines_charge')
      )
        throw labBillingError(
          'LAB_BILLING_ALREADY_BILLED',
          'This work is already on another invoice',
        );
      throw err;
    }
  }
}
