import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { BillingAuditService } from '../audit/billing-audit.service';
import { BillingClock, ClinicTime } from '../common/billing-clock.service';
import { assertBillingCan, BillingContext } from '../common/billing-context';
import { billingError } from '../common/billing-errors';
import { BillingLocks } from '../common/billing-locks';
import { BillingLookups } from '../common/billing-lookups';
import { fromPaisa, toPaisa } from '../common/money';
import { ChargeQueries } from '../charges/charges.queries';
import {
  CreateInvoiceDto,
  EditInvoicePreviewDto,
  ListInvoicesQueryDto,
} from '../dto/invoice.dto';
import { Charge } from '../entities/charge.entity';
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import {
  AllocationReason,
  BillingAuditAction,
  BillingAuditEntity,
  ChargeStatus,
  InvoiceStatus,
  LedgerEntryType,
} from '../enums/billing.enums';
import { LedgerService } from '../ledger/ledger.service';
import {
  ChargeResponse,
  InvoiceResponse,
} from '../mappers/billing-response.types';
import { invoiceSnapshot } from '../mappers/invoice.mapper';
import { toChargeResponse } from '../mappers/charge.mapper';
import { AllocationWriterService } from '../payments/allocation-writer.service';
import { BillingTotalsService } from '../totals/billing-totals.service';
import { InvoiceEditHandlers } from './edit-operations/invoice-edit.handlers';
import { InvoiceEditOperationInput } from './edit-operations/invoice-edit.types';
import { InvoiceIssuer } from './invoice-issuer.service';
import { applyInvoiceTax, chargePayablePaisa } from '../tax/invoice-tax';
import { CommissionService } from '../commissions/commission.service';
import { CommissionSourceType } from '../commissions/commission.enums';
import {
  InvoiceQueries,
  InvoiceStats,
  InvoiceViewAccess,
} from './invoices.queries';

export interface EditOutcome {
  invoice: Invoice;
  oldTotal: number;
  newTotal: number;
  /** Money moved to advance, per payment. */
  releases: Array<{ paymentId: string; amount: number }>;
}

export interface EditPreview {
  revision: number;
  oldTotal: number;
  newTotal: number;
  delta: number;
  /** Snapshot rate of the invoice (%); 0 = no tax line. */
  taxRate: number;
  /** Tax on the edited invoice (part of newTotal). */
  newTaxAmount: number;
  newBalanceDue: number;
  releasedToAdvance: number;
  releases: Array<{ paymentId: string; receiptNumber: string; amount: number }>;
  charges: ChargeResponse[];
}

/** Thrown to roll a preview transaction back while carrying its result. */
class PreviewRollback extends Error {
  constructor(readonly result: EditPreview) {
    super('preview');
  }
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
    private readonly issuer: InvoiceIssuer,
    private readonly handlers: InvoiceEditHandlers,
    private readonly allocations: AllocationWriterService,
    private readonly totals: BillingTotalsService,
    private readonly ledger: LedgerService,
    private readonly audit: BillingAuditService,
    private readonly commissions: CommissionService,
  ) {}

  async list(
    tenant: TenantContext,
    q: ListInvoicesQueryDto,
    access: InvoiceViewAccess,
  ): Promise<PaginatedResponseDto<InvoiceResponse>> {
    const { today } = await this.clock.read(tenant.locationId);
    return InvoiceQueries.list(
      this.dataSource.manager,
      tenant,
      q,
      today,
      access,
    );
  }

  async stats(
    tenant: TenantContext,
    from?: string,
    to?: string,
  ): Promise<InvoiceStats> {
    const { today } = await this.clock.read(tenant.locationId);
    return InvoiceQueries.stats(
      this.dataSource.manager,
      tenant,
      today,
      from,
      to,
    );
  }

  async detail(tenant: TenantContext, id: string): Promise<InvoiceResponse> {
    const { today } = await this.clock.read(tenant.locationId);
    return InvoiceQueries.detail(this.dataSource.manager, tenant, id, today);
  }

  revision(
    tenant: TenantContext,
    id: string,
    revision: number,
  ): Promise<Record<string, unknown>> {
    return InvoiceQueries.revisionSnapshot(
      this.dataSource.manager,
      tenant,
      id,
      revision,
    );
  }

  /** Manual "Issue invoice" for a patient leaving without paying (D3b). */
  async create(
    ctx: BillingContext,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceResponse> {
    const id = await this.dataSource.transaction(async (manager) => {
      await BillingLookups.patient(manager, ctx.tenant, dto.patientId);
      const charges = await BillingLocks.charges(
        manager,
        ctx.tenant,
        dto.chargeIds,
      );
      if (charges.some((c) => c.patientId !== dto.patientId)) {
        throw billingError(
          'BILLING_CHARGE_NOT_OPEN',
          'All charges must belong to this patient',
        );
      }
      const time = await this.clock.read(ctx.tenant.locationId);
      return (
        await this.issuer.issue(manager, ctx, time, charges, dto.notes ?? null)
      ).id;
    });
    return this.detail(ctx.tenant, id);
  }

  /** Edit an issued invoice (D10, 6.7). Touches I1–I4. */
  async edit(
    ctx: BillingContext,
    invoiceId: string,
    dto: EditInvoicePreviewDto,
    reason: string,
  ): Promise<InvoiceResponse> {
    await this.dataSource.transaction(async (manager) => {
      const time = await this.clock.read(ctx.tenant.locationId);
      await this.runEdit(manager, ctx, time, invoiceId, dto, reason);
    });
    return this.detail(ctx.tenant, invoiceId);
  }

  /**
   * Same algorithm as `edit`, run in a transaction that is always rolled
   * back — the preview is exactly what the edit would do, and the frontend
   * never computes money (7.3).
   */
  async editPreview(
    ctx: BillingContext,
    invoiceId: string,
    dto: EditInvoicePreviewDto,
  ): Promise<EditPreview> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const time = await this.clock.read(ctx.tenant.locationId);
        const out = await this.runEdit(
          manager,
          ctx,
          time,
          invoiceId,
          dto,
          'Preview',
        );
        throw new PreviewRollback(
          await this.previewOf(manager, ctx.tenant, out),
        );
      });
    } catch (err) {
      if (err instanceof PreviewRollback) return err.result;
      throw err;
    }
    throw new Error('unreachable');
  }

  /** Cancel an unpaid invoice; its charges become unbilled again (D11, 6.8). */
  async cancel(
    ctx: BillingContext,
    invoiceId: string,
    reason: string,
  ): Promise<InvoiceResponse> {
    assertBillingCan(ctx.actor, 'billing.invoice.void');
    await this.dataSource.transaction(async (manager) => {
      const [invoice] = await BillingLocks.invoices(manager, ctx.tenant, [
        invoiceId,
      ]);
      this.assertIssued(invoice);
      const charges = await this.lockInvoiceCharges(
        manager,
        ctx.tenant,
        invoice.id,
        [],
      );
      const paid = charges.reduce(
        (a, c) =>
          a +
          (c.status === ChargeStatus.ACTIVE ? toPaisa(c.allocatedAmount) : 0),
        0,
      );
      if (paid > 0 || toPaisa(invoice.paidAmount) > 0) {
        throw billingError(
          'BILLING_INVOICE_HAS_PAYMENTS',
          'Unapply its payments before cancelling this invoice',
        );
      }
      const time = await this.clock.read(ctx.tenant.locationId);
      await manager.update(
        Invoice,
        { id: invoice.id },
        {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: time.now,
          cancelledBy: ctx.actor.userId,
          cancelReason: reason,
        },
      );
      const active = charges
        .filter((c) => c.status === ChargeStatus.ACTIVE)
        .map((c) => c.id);
      // Back to unbilled: their tax share goes with the cancelled invoice,
      // which keeps its frozen totals (a re-issue taxes them afresh).
      if (active.length)
        await manager.update(
          Charge,
          { id: In(active) },
          { invoiceId: null, taxAmount: 0 },
        );
      await this.totals.recomputeInvoices(manager, [invoice.id]);
      await this.ledger.post(manager, ctx, {
        patientId: invoice.patientId,
        type: LedgerEntryType.INVOICE_CANCELLED,
        entryDate: time.today,
        amount: -invoice.totalAmount,
        description: `Invoice ${invoice.invoiceNumber} cancelled`,
        invoiceId: invoice.id,
        invoiceRevision: invoice.revision,
      });
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.INVOICE,
        entityId: invoice.id,
        action: BillingAuditAction.CANCELLED,
        before: invoiceSnapshot(invoice, charges),
        reason,
        amount: invoice.totalAmount,
      });
    });
    return this.detail(ctx.tenant, invoiceId);
  }

  /**
   * The edit algorithm (6.7) inside the caller's transaction. Exposed for
   * "refund from invoice", which runs edit + refund atomically (6.10).
   */
  async runEdit(
    manager: EntityManager,
    ctx: BillingContext,
    time: ClinicTime,
    invoiceId: string,
    dto: EditInvoicePreviewDto,
    reason: string,
  ): Promise<EditOutcome> {
    assertBillingCan(ctx.actor, 'billing.invoice.edit');
    const commands = this.handlers.parseAll(
      dto.operations as InvoiceEditOperationInput[],
    );
    const [invoice] = await BillingLocks.invoices(manager, ctx.tenant, [
      invoiceId,
    ]);
    this.assertIssued(invoice);
    if (invoice.revision !== dto.expectedRevision) {
      throw billingError(
        'BILLING_INVOICE_REVISION_CONFLICT',
        'This invoice was changed by someone else. Reload and try again.',
        { currentRevision: invoice.revision },
      );
    }
    const adding = commands.flatMap((c) =>
      c.op === 'addCharges' ? c.chargeIds : [],
    );
    const locked = await this.lockInvoiceCharges(
      manager,
      ctx.tenant,
      invoice.id,
      adding,
    );
    const before = invoiceSnapshot(invoice, locked);
    const charges = new Map(locked.map((c) => [c.id, c]));

    const editCtx = { manager, ctx, invoice, charges, reason, time };
    for (const cmd of commands) await this.handlers.apply(cmd, editCtx);
    const onInvoice = [...charges.values()].filter(
      (c) => c.invoiceId === invoice.id,
    );
    // Re-spread the tax at the rate snapshotted at issue — never the
    // location's current rate (VOID charges drop to 0).
    applyInvoiceTax(onInvoice, invoice.taxRate);
    await manager.save(onInvoice);

    const releases = await this.releaseExcess(manager, ctx, onInvoice, reason);
    const revision = invoice.revision + 1;
    await manager.update(
      Invoice,
      { id: invoice.id },
      {
        revision,
        lastEditedAt: time.now,
        lastEditedBy: ctx.actor.userId,
      },
    );
    await this.totals.recomputeCharges(
      manager,
      onInvoice.map((c) => c.id),
    );
    await this.totals.recomputeInvoices(manager, [invoice.id]);
    await this.totals.recomputePayments(
      manager,
      releases.map((r) => r.paymentId),
    );
    // Price / quantity / discount / void changed net and may have released
    // money: adjust commission to the new target (VOID entries for voids).
    await this.commissions.recordForCharges(
      manager,
      onInvoice.map((c) => c.id),
      { type: CommissionSourceType.CHARGE_ADJUST },
    );

    const after = await manager
      .getRepository(Invoice)
      .findOneByOrFail({ id: invoice.id });
    const afterCharges = await manager
      .getRepository(Charge)
      .findBy({ invoiceId: invoice.id });
    const delta = toPaisa(after.totalAmount) - toPaisa(invoice.totalAmount);
    await this.ledger.post(manager, ctx, {
      patientId: invoice.patientId,
      type: LedgerEntryType.INVOICE_ADJUSTED,
      entryDate: time.today,
      amount: fromPaisa(delta),
      description: `Invoice ${invoice.invoiceNumber} (Rev ${revision})`,
      invoiceId: invoice.id,
      invoiceRevision: revision,
    });
    await this.audit.log(manager, ctx, {
      entityType: BillingAuditEntity.INVOICE,
      entityId: invoice.id,
      action: BillingAuditAction.EDITED,
      before,
      after: { revision, ...invoiceSnapshot(after, afterCharges) },
      reason,
      amount: fromPaisa(delta),
    });
    return {
      invoice: after,
      oldTotal: invoice.totalAmount,
      newTotal: after.totalAmount,
      releases: releases.map((r) => ({
        paymentId: r.paymentId,
        amount: fromPaisa(r.amountPaisa),
      })),
    };
  }

  /** Net + tax below allocated (VOID = 0) → release the excess to advance (6.7 step 4). */
  private async releaseExcess(
    manager: EntityManager,
    ctx: BillingContext,
    charges: Charge[],
    reason: string,
  ): Promise<Array<{ paymentId: string; amountPaisa: number }>> {
    const out: Array<{ paymentId: string; amountPaisa: number }> = [];
    for (const c of charges) {
      // Not `-chargeBalancePaisa(c)`: that is 0 for a VOID charge, whose whole
      // allocation must go back to advance (net counts as 0).
      const cap = chargePayablePaisa(c);
      const excess = toPaisa(c.allocatedAmount) - cap;
      if (excess <= 0) continue;
      out.push(
        ...(await this.allocations.releaseFromCharge(
          manager,
          ctx,
          c,
          excess,
          AllocationReason.INVOICE_EDIT_RELEASE,
          reason,
        )),
      );
    }
    return out;
  }

  /** Locks the invoice's charges plus extra (unbilled) ones, by id. */
  private async lockInvoiceCharges(
    manager: EntityManager,
    tenant: TenantContext,
    invoiceId: string,
    extraIds: string[],
  ): Promise<Charge[]> {
    const own = await manager.getRepository(Charge).find({
      where: { invoiceId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    return BillingLocks.charges(manager, tenant, [
      ...own.map((c) => c.id),
      ...extraIds,
    ]);
  }

  private assertIssued(invoice: Invoice): void {
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw billingError(
        'BILLING_INVOICE_CANCELLED',
        'This invoice is cancelled and read-only',
      );
    }
  }

  private async previewOf(
    manager: EntityManager,
    tenant: TenantContext,
    out: EditOutcome,
  ): Promise<EditPreview> {
    const receipts = out.releases.length
      ? await manager.getRepository(Payment).find({
          where: { id: In(out.releases.map((r) => r.paymentId)) },
          select: { id: true, receiptNumber: true },
        })
      : [];
    const byId = new Map(receipts.map((p) => [p.id, p.receiptNumber]));
    const charges = await ChargeQueries.base(manager, tenant)
      .andWhere('c.invoice_id = :id', { id: out.invoice.id })
      .getMany();
    return {
      revision: out.invoice.revision,
      oldTotal: out.oldTotal,
      newTotal: out.newTotal,
      delta: fromPaisa(toPaisa(out.newTotal) - toPaisa(out.oldTotal)),
      taxRate: out.invoice.taxRate,
      newTaxAmount: out.invoice.taxAmount,
      newBalanceDue: out.invoice.balanceDue,
      releasedToAdvance: fromPaisa(
        out.releases.reduce((a, r) => a + toPaisa(r.amount), 0),
      ),
      releases: out.releases.map((r) => ({
        ...r,
        receiptNumber: byId.get(r.paymentId) ?? '',
      })),
      charges: charges.map(toChargeResponse),
    };
  }
}
