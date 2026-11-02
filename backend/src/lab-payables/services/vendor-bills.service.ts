import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { GeneralLedgerService } from 'src/billing/ledger/journal/general-ledger.service';
import {
  ACCOUNT,
  JournalSource,
} from 'src/billing/ledger/journal/ledger-journal.entity';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import type { ClinicCall } from 'src/lab-orders/common/order-context';
import { payablesError } from '../common/payables-errors';
import { billTotals } from '../common/payables-math';
import { toAllocation, toBill, toBillLine } from '../common/payables-response';
import {
  AddBillLineDto,
  ApproveBillDto,
  BillsQueryDto,
  ReasonVersionDto,
  UpdateBillDto,
} from '../dto/payables.dto';
import { VendorBill, VendorBillLine } from '../entities/vendor-bill.entity';
import { VendorPaymentAllocation } from '../entities/vendor-payment.entity';
import { PAYABLES_ENTITY, VendorBillStatus } from '../enums/payables.enums';
import { BillDraftsService } from './bill-drafts.service';

const uniqueViolation = (e: unknown, constraint: string) =>
  (e as { code?: string; constraint?: string })?.code === '23505' &&
  (e as { constraint?: string }).constraint === constraint;

/**
 * Clinic side of vendor bills (lab ERD §6b, §10 "Vendor bill approve"):
 * list, review and edit a draft, approve (one transaction: status → Lab Cost
 * / Lab Payable journal → audit), void.
 */
@Injectable()
export class VendorBillsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly drafts: BillDraftsService,
    private readonly ledger: GeneralLedgerService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, q: BillsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.dataSource
      .getRepository(VendorBill)
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.lab', 'lab')
      .where('b.organization_id = :organizationId', { organizationId });
    if (q.status) qb.andWhere('b.status = :status', { status: q.status });
    if (q.labId) qb.andWhere('b.lab_id = :labId', { labId: q.labId });
    if (q.labOrderId)
      qb.andWhere('b.lab_order_id = :labOrderId', { labOrderId: q.labOrderId });
    if (q.from) qb.andWhere('b.bill_date >= :from', { from: q.from });
    if (q.to) qb.andWhere('b.bill_date <= :to', { to: q.to });
    if (q.open === 'true') qb.andWhere('b.balance_minor > 0');
    if (q.search?.trim()) {
      qb.andWhere(
        `(b.bill_no ILIKE :s OR b.vendor_invoice_no ILIKE :s OR EXISTS (
           SELECT 1 FROM lab_orders o WHERE o.id = b.lab_order_id AND o.order_no ILIKE :s))`,
        { s: `%${q.search.trim()}%` },
      );
    }
    const [rows, total] = await qb
      .orderBy('b.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const orderIds = rows
      .map((b) => b.labOrderId)
      .filter((x): x is string => !!x);
    const orders = await sqlRows<{ id: string; order_no: string | null }>(
      this.dataSource,
      `SELECT id, order_no FROM lab_orders WHERE id = ANY($1::uuid[])`,
      [orderIds],
    );
    const orderNo = new Map(orders.map((o) => [o.id, o.order_no]));
    return PaginatedResponseDto.create(
      rows.map((b) =>
        toBill(
          b,
          {
            labName: b.lab?.name,
            orderNo: b.labOrderId ? (orderNo.get(b.labOrderId) ?? null) : null,
          },
          'clinic',
        ),
      ),
      total,
      page,
      limit,
    );
  }

  async detail(organizationId: string, id: string) {
    const m = this.dataSource.manager;
    const bill = await this.byId(m, organizationId, id);
    return this.view(m, bill);
  }

  /** Bill + lines + allocations (+ the order no and lab name). */
  async view(m: EntityManager, bill: VendorBill) {
    const [lines, allocations, [extra]] = await Promise.all([
      m.getRepository(VendorBillLine).find({
        where: { vendorBillId: bill.id },
        order: { createdAt: 'ASC' },
      }),
      m.getRepository(VendorPaymentAllocation).find({
        where: { vendorBillId: bill.id },
        relations: { payment: true },
        order: { createdAt: 'ASC' },
      }),
      sqlRows<{ lab_name: string; order_no: string | null }>(
        m,
        `SELECT l.name AS lab_name, o.order_no
           FROM labs l LEFT JOIN lab_orders o ON o.id = $2 WHERE l.id = $1`,
        [bill.labId, bill.labOrderId],
      ),
    ]);
    return {
      ...toBill(
        bill,
        { labName: extra?.lab_name, orderNo: extra?.order_no },
        'clinic',
      ),
      lines: lines.map(toBillLine),
      allocations: allocations.map((a) =>
        toAllocation(a, { paymentNo: a.payment.paymentNo }),
      ),
    };
  }

  /** Edit a draft's header. */
  async update(c: ClinicCall, id: string, dto: UpdateBillDto) {
    return this.dataSource.transaction(async (m) => {
      const bill = await this.lockDraft(m, c, id, dto.version);
      const before = this.snap(bill);
      if (dto.vendorInvoiceNo !== undefined)
        bill.vendorInvoiceNo = dto.vendorInvoiceNo?.trim() || null;
      if (dto.billDate) bill.billDate = dto.billDate;
      if (dto.dueOn !== undefined) bill.dueOn = dto.dueOn || null;
      if (dto.notes !== undefined) bill.notes = dto.notes?.trim() || null;
      if (dto.taxBp !== undefined) bill.taxBp = dto.taxBp;
      await this.saveDraft(m, bill);
      await this.audit.record(m, c.ref, {
        organizationId: bill.organizationId,
        entityType: PAYABLES_ENTITY.BILL,
        entityId: bill.id,
        action: AuditAction.UPDATE,
        before,
        after: this.snap(bill),
      });
      return this.view(m, bill);
    });
  }

  /** A hand-entered cost on a draft (e.g. the lab's partial charge on a cancel). */
  async addLine(c: ClinicCall, id: string, dto: AddBillLineDto) {
    return this.dataSource.transaction(async (m) => {
      const bill = await this.lockDraft(m, c, id, dto.version);
      await m.getRepository(VendorBillLine).insert({
        organizationId: bill.organizationId,
        vendorBillId: bill.id,
        lineKind: dto.kind,
        labOrderId: bill.labOrderId,
        description: dto.description.trim(),
        quantity: dto.quantity,
        unitCostMinor: dto.unitCostMinor,
        lineTotalMinor: dto.quantity * dto.unitCostMinor,
        isManual: true,
      });
      await this.saveDraft(m, bill);
      await this.audit.record(m, c.ref, {
        organizationId: bill.organizationId,
        entityType: PAYABLES_ENTITY.BILL,
        entityId: bill.id,
        action: AuditAction.UPDATE,
        after: { addedLine: dto.description, totalMinor: bill.totalMinor },
      });
      return this.view(m, bill);
    });
  }

  /** Re-read the order's costs into its open draft (approved extras, remakes). */
  async syncOrder(organizationId: string, labOrderId: string) {
    return this.dataSource.transaction(async (m) => {
      const [order] = await sqlRows<{ id: string }>(
        m,
        `SELECT id FROM lab_orders WHERE id = $1 AND organization_id = $2`,
        [labOrderId, organizationId],
      );
      if (!order)
        throw payablesError('PAYABLES_BILL_NOT_FOUND', 'Lab order not found');
      return this.drafts.sync(m, labOrderId);
    });
  }

  /**
   * Approve (lab ERD §10): the draft is re-synced from its order first (in
   * its own transaction, so a change bumps the version and this approval
   * answers STALE_VERSION — the accountant approves what they saw). Then one
   * transaction: status → balanced Lab Cost / Lab Payable journal → audit.
   */
  async approve(c: ClinicCall, id: string, dto: ApproveBillDto) {
    const head = await this.byId(
      this.dataSource.manager,
      c.tenant.organizationId,
      id,
    );
    if (head.labOrderId && head.status === VendorBillStatus.DRAFT) {
      await this.dataSource.transaction((m) =>
        this.drafts.sync(m, head.labOrderId!),
      );
    }
    try {
      return await this.dataSource.transaction(async (m) => {
        const bill = await this.lockDraft(m, c, id, dto.version);
        const before = this.snap(bill);
        if (dto.vendorInvoiceNo !== undefined)
          bill.vendorInvoiceNo = dto.vendorInvoiceNo.trim() || null;
        if (dto.taxBp !== undefined) bill.taxBp = dto.taxBp;
        const lines = await m
          .getRepository(VendorBillLine)
          .findBy({ vendorBillId: bill.id });
        Object.assign(bill, billTotals(lines, bill.taxBp));
        if (bill.totalMinor <= 0) {
          throw payablesError(
            'PAYABLES_INVALID',
            'This bill is 0 — there is nothing to approve. Void it instead.',
          );
        }
        bill.dueOn =
          dto.dueOn ?? bill.dueOn ?? (await this.defaultDue(m, bill));
        const tz = await this.clock.timezoneFor(bill.locationId);
        const journal = await this.ledger.post(m, {
          organizationId: bill.organizationId,
          locationId: bill.locationId,
          entryOn: this.clock.today(tz),
          sourceType: JournalSource.VENDOR_BILL,
          sourceId: bill.id,
          memo: `Vendor bill ${bill.billNo}`,
          createdBy: c.actor.userId,
          lines: [
            {
              accountCode: ACCOUNT.LAB_COST,
              debitMinor: bill.totalMinor,
              labId: bill.labId,
              labOrderId: bill.labOrderId,
            },
            {
              accountCode: ACCOUNT.LAB_PAYABLE,
              creditMinor: bill.totalMinor,
              labId: bill.labId,
              labOrderId: bill.labOrderId,
            },
          ],
        });
        Object.assign(bill, {
          status: VendorBillStatus.APPROVED,
          paidMinor: 0,
          balanceMinor: bill.totalMinor,
          approvedBy: c.actor.userId,
          approvedAt: new Date(),
          journalId: journal.id,
        });
        await m.getRepository(VendorBill).save(bill);
        await this.audit.record(m, c.ref, {
          organizationId: bill.organizationId,
          entityType: PAYABLES_ENTITY.BILL,
          entityId: bill.id,
          action: AuditAction.UPDATE,
          before,
          after: { ...this.snap(bill), journalId: journal.id },
        });
        return this.view(m, bill);
      });
    } catch (e) {
      if (uniqueViolation(e, 'uq_vendor_bills_vendor_invoice')) {
        throw payablesError(
          'PAYABLES_DUPLICATE_INVOICE',
          "This lab's invoice number is already on another bill",
        );
      }
      throw e;
    }
  }

  /**
   * Void: a draft simply closes; an approved bill with nothing paid gets a
   * mirror journal. Paid money must be reversed first.
   */
  async void(c: ClinicCall, id: string, dto: ReasonVersionDto) {
    return this.dataSource.transaction(async (m) => {
      const bill = await this.lock(m, c.tenant.organizationId, id);
      assertVersion(bill.version, dto.version);
      const before = this.snap(bill);
      if (bill.status === VendorBillStatus.VOID || bill.paidMinor > 0) {
        throw payablesError(
          'PAYABLES_NOT_ALLOWED',
          bill.paidMinor > 0
            ? 'Reverse the payments on this bill before voiding it'
            : 'This bill is already void',
        );
      }
      if (bill.journalId) {
        const tz = await this.clock.timezoneFor(bill.locationId);
        await this.ledger.reverse(m, bill.journalId, {
          entryOn: this.clock.today(tz),
          memo: `Void vendor bill ${bill.billNo}`,
          createdBy: c.actor.userId,
        });
      }
      Object.assign(bill, {
        status: VendorBillStatus.VOID,
        balanceMinor: 0,
        voidedBy: c.actor.userId,
        voidedAt: new Date(),
        voidReason: dto.reason.trim(),
      });
      await m.getRepository(VendorBill).save(bill);
      await this.audit.record(m, c.ref, {
        organizationId: bill.organizationId,
        entityType: PAYABLES_ENTITY.BILL,
        entityId: bill.id,
        action: AuditAction.VOID,
        before,
        after: { ...this.snap(bill), voidReason: bill.voidReason },
      });
      return this.view(m, bill);
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────

  async byId(
    m: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<VendorBill> {
    const bill = await m
      .getRepository(VendorBill)
      .findOneBy({ id, organizationId });
    if (!bill)
      throw payablesError('PAYABLES_BILL_NOT_FOUND', 'Vendor bill not found');
    return bill;
  }

  private async lock(
    m: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<VendorBill> {
    const bill = await m.getRepository(VendorBill).findOne({
      where: { id, organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!bill)
      throw payablesError('PAYABLES_BILL_NOT_FOUND', 'Vendor bill not found');
    return bill;
  }

  private async lockDraft(
    m: EntityManager,
    c: ClinicCall,
    id: string,
    version: number,
  ): Promise<VendorBill> {
    const bill = await this.lock(m, c.tenant.organizationId, id);
    assertVersion(bill.version, version);
    if (bill.status !== VendorBillStatus.DRAFT) {
      throw payablesError(
        'PAYABLES_NOT_ALLOWED',
        `This bill is ${bill.status}; only drafts can change`,
      );
    }
    return bill;
  }

  private async saveDraft(m: EntityManager, bill: VendorBill) {
    const lines = await m
      .getRepository(VendorBillLine)
      .findBy({ vendorBillId: bill.id });
    Object.assign(bill, billTotals(lines, bill.taxBp));
    await m.getRepository(VendorBill).save(bill);
  }

  /** Bill date + the lab link's payment terms (default 30 days). */
  private async defaultDue(m: EntityManager, bill: VendorBill) {
    const [link] = await sqlRows<{ payment_terms_days: number }>(
      m,
      `SELECT payment_terms_days FROM lab_clinic_links
        WHERE organization_id = $1 AND lab_id = $2`,
      [bill.organizationId, bill.labId],
    );
    return addDays(bill.billDate, link?.payment_terms_days ?? 30);
  }

  private snap(b: VendorBill) {
    return {
      status: b.status,
      vendorInvoiceNo: b.vendorInvoiceNo,
      billDate: b.billDate,
      dueOn: b.dueOn,
      taxBp: b.taxBp,
      totalMinor: b.totalMinor,
      notes: b.notes,
    };
  }
}
