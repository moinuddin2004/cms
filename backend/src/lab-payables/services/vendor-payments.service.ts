import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { GeneralLedgerService } from 'src/billing/ledger/journal/general-ledger.service';
import {
  ACCOUNT,
  JournalSource,
  LedgerJournal,
} from 'src/billing/ledger/journal/ledger-journal.entity';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import {
  IdempotencyService,
  requestHash,
} from 'src/common/idempotency/idempotency.service';
import { NumberSequenceService } from 'src/common/sequences/number-sequence.service';
import type { ClinicCall } from 'src/lab-orders/common/order-context';
import { payablesError } from '../common/payables-errors';
import { settledStatus } from '../common/payables-math';
import { toAllocation, toPayment } from '../common/payables-response';
import {
  AllocatePaymentDto,
  AllocationDto,
  CreatePaymentDto,
  PaymentsQueryDto,
  ReasonVersionDto,
} from '../dto/payables.dto';
import { VendorBill } from '../entities/vendor-bill.entity';
import {
  VendorPayment,
  VendorPaymentAllocation,
} from '../entities/vendor-payment.entity';
import {
  PAYABLE_STATUSES,
  PAYABLES_ENTITY,
  VendorPaymentMethod,
  VendorPaymentStatus,
} from '../enums/payables.enums';

export const PAYMENT_SEQUENCE = { key: 'vendor_payment', prefix: 'VP' };
const IDEMPOTENCY_SCOPE = 'vendor_payment.create';

const moneyAccount = (method: VendorPaymentMethod) =>
  method === VendorPaymentMethod.CASH ? ACCOUNT.CASH : ACCOUNT.BANK;

/**
 * Paying labs (lab ERD §6b, §6c "Allocation limits", inv. 5): a payment is
 * split over the lab's approved bills, never more than the payment and never
 * more than a bill's balance. Bills are row-locked, their cached
 * paid/balance recomputed in the same transaction. Journals: Lab Payable
 * (+ Lab Advances for an unallocated rest) / Cash or Bank; a later
 * allocation moves Lab Advances → Lab Payable; a reversal mirrors them all.
 */
@Injectable()
export class VendorPaymentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: GeneralLedgerService,
    private readonly sequences: NumberSequenceService,
    private readonly idempotency: IdempotencyService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, q: PaymentsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [rows, total] = await this.dataSource
      .getRepository(VendorPayment)
      .findAndCount({
        where: { organizationId, ...(q.labId ? { labId: q.labId } : {}) },
        relations: { lab: true },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    return PaginatedResponseDto.create(
      rows.map((p) => toPayment(p, { labName: p.lab?.name }, 'clinic')),
      total,
      page,
      limit,
    );
  }

  async detail(organizationId: string, id: string) {
    const m = this.dataSource.manager;
    const p = await m
      .getRepository(VendorPayment)
      .findOne({ where: { id, organizationId }, relations: { lab: true } });
    if (!p)
      throw payablesError('PAYABLES_PAYMENT_NOT_FOUND', 'Payment not found');
    return this.view(m, p);
  }

  async create(c: ClinicCall, dto: CreatePaymentDto, idempotencyKey?: string) {
    const org = c.tenant.organizationId;
    return this.dataSource.transaction(async (m) => {
      if (idempotencyKey) {
        const replay = await this.idempotency.claim(
          m,
          org,
          IDEMPOTENCY_SCOPE,
          idempotencyKey,
          requestHash(dto),
        );
        if (replay) return replay.response;
      }
      const [link] = await sqlRows<{ id: string }>(
        m,
        `SELECT id FROM lab_clinic_links WHERE organization_id = $1 AND lab_id = $2`,
        [org, dto.labId],
      );
      if (!link)
        throw payablesError(
          'PAYABLES_LAB_NOT_FOUND',
          'Lab not linked to this clinic',
        );

      const allocations = mergeAllocations(dto.allocations);
      const allocated = allocations.reduce((a, x) => a + x.amountMinor, 0);
      if (allocated > dto.amountMinor) {
        throw payablesError(
          'PAYABLES_ALLOCATION_LIMIT',
          'Allocations add up to more than the payment',
          { allocatedMinor: allocated, amountMinor: dto.amountMinor },
        );
      }
      const bills = await this.lockBills(m, org, dto.labId, allocations);

      const tz = await this.clock.timezoneFor(c.tenant.locationId);
      const today = this.clock.today(tz);
      const repo = m.getRepository(VendorPayment);
      const payment = await repo.save(
        repo.create({
          organizationId: org,
          locationId: c.tenant.locationId,
          labId: dto.labId,
          paymentNo: await this.sequences.next(m, org, PAYMENT_SEQUENCE),
          amountMinor: dto.amountMinor,
          allocatedMinor: allocated,
          method: dto.method,
          reference: dto.reference?.trim() || null,
          paidOn: dto.paidOn ?? today,
          paidAt: new Date(),
          notes: dto.notes?.trim() || null,
          createdBy: c.actor.userId,
        }),
      );
      await this.writeAllocations(m, c, payment, allocations, bills);
      await this.ledger.post(m, {
        organizationId: org,
        locationId: payment.locationId,
        entryOn: payment.paidOn,
        sourceType: JournalSource.VENDOR_PAYMENT,
        sourceId: payment.id,
        memo: `Lab payment ${payment.paymentNo}`,
        createdBy: c.actor.userId,
        lines: [
          {
            accountCode: ACCOUNT.LAB_PAYABLE,
            debitMinor: allocated,
            labId: dto.labId,
          },
          {
            accountCode: ACCOUNT.LAB_ADVANCES,
            debitMinor: dto.amountMinor - allocated,
            labId: dto.labId,
          },
          {
            accountCode: moneyAccount(dto.method),
            creditMinor: dto.amountMinor,
            labId: dto.labId,
          },
        ],
      });
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: PAYABLES_ENTITY.PAYMENT,
        entityId: payment.id,
        action: AuditAction.CREATE,
        after: {
          paymentNo: payment.paymentNo,
          amountMinor: payment.amountMinor,
          allocatedMinor: allocated,
          method: payment.method,
        },
      });
      const result = await this.view(m, payment);
      if (idempotencyKey) {
        await this.idempotency.complete(
          m,
          org,
          IDEMPOTENCY_SCOPE,
          idempotencyKey,
          result,
        );
      }
      return result;
    });
  }

  /** Use a payment's unallocated rest (an advance) on bills. */
  async allocate(c: ClinicCall, id: string, dto: AllocatePaymentDto) {
    const org = c.tenant.organizationId;
    return this.dataSource.transaction(async (m) => {
      const payment = await this.lockPayment(m, org, id);
      assertVersion(payment.version, dto.version);
      if (payment.status !== VendorPaymentStatus.POSTED)
        throw payablesError('PAYABLES_NOT_ALLOWED', 'This payment is reversed');
      const allocations = mergeAllocations(dto.allocations);
      const adding = allocations.reduce((a, x) => a + x.amountMinor, 0);
      const free = payment.amountMinor - payment.allocatedMinor;
      if (adding > free) {
        throw payablesError(
          'PAYABLES_ALLOCATION_LIMIT',
          'Allocations add up to more than what is left on the payment',
          { unallocatedMinor: free, allocatedMinor: adding },
        );
      }
      const bills = await this.lockBills(m, org, payment.labId, allocations);
      await this.writeAllocations(m, c, payment, allocations, bills);
      payment.allocatedMinor += adding;
      await m.getRepository(VendorPayment).save(payment);
      const tz = await this.clock.timezoneFor(payment.locationId);
      await this.ledger.post(m, {
        organizationId: org,
        locationId: payment.locationId,
        entryOn: this.clock.today(tz),
        sourceType: JournalSource.VENDOR_PAYMENT,
        sourceId: payment.id,
        memo: `Lab advance ${payment.paymentNo} applied`,
        createdBy: c.actor.userId,
        lines: [
          {
            accountCode: ACCOUNT.LAB_PAYABLE,
            debitMinor: adding,
            labId: payment.labId,
          },
          {
            accountCode: ACCOUNT.LAB_ADVANCES,
            creditMinor: adding,
            labId: payment.labId,
          },
        ],
      });
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: PAYABLES_ENTITY.PAYMENT,
        entityId: payment.id,
        action: AuditAction.UPDATE,
        before: { allocatedMinor: payment.allocatedMinor - adding },
        after: { allocatedMinor: payment.allocatedMinor },
      });
      return this.view(m, payment);
    });
  }

  /**
   * Reverse a wrong payment (lab ERD §10 "Payment reversal", §15 "Ghalat
   * entry"): status reversed → allocations reversed → bill balances
   * recomputed → every journal of the payment mirrored.
   */
  async reverse(c: ClinicCall, id: string, dto: ReasonVersionDto) {
    const org = c.tenant.organizationId;
    return this.dataSource.transaction(async (m) => {
      const payment = await this.lockPayment(m, org, id);
      assertVersion(payment.version, dto.version);
      if (payment.status !== VendorPaymentStatus.POSTED)
        throw payablesError(
          'PAYABLES_NOT_ALLOWED',
          'This payment is already reversed',
        );
      const allocRepo = m.getRepository(VendorPaymentAllocation);
      const active = await allocRepo.find({
        where: { vendorPaymentId: payment.id },
      });
      const billIds = [
        ...new Set(
          active.filter((a) => !a.reversedAt).map((a) => a.vendorBillId),
        ),
      ].sort();
      for (const billId of billIds) {
        await m.getRepository(VendorBill).findOne({
          where: { id: billId },
          lock: { mode: 'pessimistic_write' },
        });
      }
      const now = new Date();
      await allocRepo
        .createQueryBuilder()
        .update()
        .set({ reversedAt: now })
        .where('vendor_payment_id = :id AND reversed_at IS NULL', {
          id: payment.id,
        })
        .execute();
      for (const billId of billIds) await this.recomputeBill(m, billId);

      const tz = await this.clock.timezoneFor(payment.locationId);
      const journals = await m.getRepository(LedgerJournal).find({
        where: {
          organizationId: org,
          sourceType: JournalSource.VENDOR_PAYMENT,
          sourceId: payment.id,
        },
        order: { createdAt: 'ASC' },
      });
      const reversed = new Set(
        journals.map((j) => j.reversalOfId).filter(Boolean),
      );
      for (const j of journals) {
        if (j.reversalOfId || reversed.has(j.id)) continue;
        await this.ledger.reverse(m, j.id, {
          entryOn: this.clock.today(tz),
          memo: `Reversal of ${payment.paymentNo}`,
          createdBy: c.actor.userId,
        });
      }
      Object.assign(payment, {
        status: VendorPaymentStatus.REVERSED,
        reversedAt: now,
        reversedBy: c.actor.userId,
        reversalReason: dto.reason.trim(),
      });
      await m.getRepository(VendorPayment).save(payment);
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: PAYABLES_ENTITY.PAYMENT,
        entityId: payment.id,
        action: AuditAction.VOID,
        before: { status: VendorPaymentStatus.POSTED },
        after: {
          status: payment.status,
          reversalReason: payment.reversalReason,
        },
      });
      return this.view(m, payment);
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async view(m: EntityManager, p: VendorPayment) {
    const [lab] = p.lab
      ? [p.lab]
      : await sqlRows<{ name: string }>(
          m,
          `SELECT name FROM labs WHERE id = $1`,
          [p.labId],
        );
    const allocations = await m.getRepository(VendorPaymentAllocation).find({
      where: { vendorPaymentId: p.id },
      relations: { bill: true },
      order: { createdAt: 'ASC' },
    });
    return {
      ...toPayment(p, { labName: lab?.name }, 'clinic'),
      allocations: allocations.map((a) =>
        toAllocation(a, { billNo: a.bill.billNo }),
      ),
    };
  }

  private async lockPayment(
    m: EntityManager,
    organizationId: string,
    id: string,
  ) {
    const p = await m.getRepository(VendorPayment).findOne({
      where: { id, organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!p)
      throw payablesError('PAYABLES_PAYMENT_NOT_FOUND', 'Payment not found');
    return p;
  }

  /** Lock the target bills (in id order) and check lab, status and balance. */
  private async lockBills(
    m: EntityManager,
    organizationId: string,
    labId: string,
    allocations: AllocationDto[],
  ): Promise<Map<string, VendorBill>> {
    const ids = allocations.map((a) => a.billId).sort();
    const bills = new Map<string, VendorBill>();
    if (!ids.length) return bills;
    const rows = await m.getRepository(VendorBill).find({
      where: { id: In(ids), organizationId },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    for (const b of rows) bills.set(b.id, b);
    for (const a of allocations) {
      const b = bills.get(a.billId);
      if (!b || b.labId !== labId)
        throw payablesError(
          'PAYABLES_BILL_NOT_FOUND',
          'Bill not found for this lab',
        );
      if (!PAYABLE_STATUSES.includes(b.status)) {
        throw payablesError(
          'PAYABLES_NOT_ALLOWED',
          `Bill ${b.billNo} is ${b.status}; only approved bills can be paid`,
        );
      }
      if (a.amountMinor > b.balanceMinor) {
        throw payablesError(
          'PAYABLES_ALLOCATION_LIMIT',
          `More than the balance of bill ${b.billNo}`,
          { billId: b.id, balanceMinor: b.balanceMinor },
        );
      }
    }
    return bills;
  }

  private async writeAllocations(
    m: EntityManager,
    c: ClinicCall,
    payment: VendorPayment,
    allocations: AllocationDto[],
    bills: Map<string, VendorBill>,
  ) {
    if (!allocations.length) return;
    await m.getRepository(VendorPaymentAllocation).insert(
      allocations.map((a) => ({
        organizationId: payment.organizationId,
        vendorPaymentId: payment.id,
        vendorBillId: a.billId,
        amountMinor: a.amountMinor,
        createdBy: c.actor.userId,
      })),
    );
    for (const id of bills.keys()) await this.recomputeBill(m, id);
  }

  /** Cached paid / balance / status from the active allocations (§6c). */
  private async recomputeBill(m: EntityManager, billId: string) {
    const [{ paid }] = await sqlRows<{ paid: string }>(
      m,
      `SELECT COALESCE(SUM(amount_minor), 0) AS paid FROM vendor_payment_allocations
        WHERE vendor_bill_id = $1 AND reversed_at IS NULL`,
      [billId],
    );
    const repo = m.getRepository(VendorBill);
    const bill = await repo.findOneByOrFail({ id: billId });
    const paidMinor = Number(paid);
    if (paidMinor > bill.totalMinor) {
      // inv. 4: never negative — the row lock makes this unreachable.
      throw payablesError(
        'PAYABLES_ALLOCATION_LIMIT',
        `Bill ${bill.billNo} would be overpaid`,
      );
    }
    Object.assign(bill, {
      paidMinor,
      balanceMinor: bill.totalMinor - paidMinor,
      status: settledStatus(bill.totalMinor, paidMinor),
    });
    await repo.save(bill);
  }
}

function mergeAllocations(list: AllocationDto[]): AllocationDto[] {
  const by = new Map<string, number>();
  for (const a of list)
    by.set(a.billId, (by.get(a.billId) ?? 0) + a.amountMinor);
  return [...by].map(([billId, amountMinor]) => ({ billId, amountMinor }));
}
