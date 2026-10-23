import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { addDays } from 'src/common/clock/tz.util';
import { BillingAuditService } from '../audit/billing-audit.service';
import { ClinicTime } from '../common/billing-clock.service';
import { BillingContext } from '../common/billing-context';
import { billingError } from '../common/billing-errors';
import { Charge } from '../entities/charge.entity';
import { Invoice } from '../entities/invoice.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  ChargeStatus,
  DocumentType,
  InvoiceStatus,
  LedgerEntryType,
} from '../enums/billing.enums';
import { LedgerService } from '../ledger/ledger.service';
import { invoiceSnapshot } from '../mappers/invoice.mapper';
import { DocumentSequenceService } from '../numbering/document-sequence.service';
import { BillingSettingsService } from '../settings/billing-settings.service';
import { BillingTotalsService } from '../totals/billing-totals.service';
import { applyInvoiceTax } from '../tax/invoice-tax';
import { locationTaxRate } from '../tax/location-tax-rate';

/**
 * Issues one invoice for locked, unbilled charges (D2, D3, 6.6). Shared by
 * the manual "Issue invoice", collect payment and apply advance. Never
 * opens a transaction. Snapshots the location's sales-tax rate on the
 * invoice and spreads the exclusive tax over its charges.
 */
@Injectable()
export class InvoiceIssuer {
  constructor(
    private readonly sequences: DocumentSequenceService,
    private readonly settings: BillingSettingsService,
    private readonly totals: BillingTotalsService,
    private readonly ledger: LedgerService,
    private readonly audit: BillingAuditService,
  ) {}

  async issue(
    manager: EntityManager,
    ctx: BillingContext,
    time: ClinicTime,
    charges: Charge[],
    notes: string | null = null,
  ): Promise<Invoice> {
    this.assertIssuable(charges);
    const settings = await this.settings.getOrCreate(manager, ctx.tenant);
    const taxRate = await locationTaxRate(manager, ctx.tenant);
    applyInvoiceTax(charges, taxRate);
    const invoiceNumber = await this.sequences.next(
      manager,
      ctx.tenant,
      DocumentType.INVOICE,
      time.today,
    );

    const repo = manager.getRepository(Invoice);
    const { identifiers } = await repo.insert({
      organizationId: ctx.tenant.organizationId,
      locationId: ctx.tenant.locationId,
      patientId: charges[0].patientId,
      invoiceNumber,
      status: InvoiceStatus.ISSUED,
      revision: 1,
      issueDate: time.today,
      issuedAt: time.now,
      dueDate: addDays(time.today, settings.dueDays),
      taxRate,
      notes,
      issuedBy: ctx.actor.userId,
    });
    const invoiceId = identifiers[0].id as string;
    await manager.update(
      Charge,
      { id: In(charges.map((c) => c.id)) },
      { invoiceId, taxAmount: 0 },
    );
    for (const c of charges.filter((x) => x.taxAmount)) {
      await manager.update(Charge, { id: c.id }, { taxAmount: c.taxAmount });
    }
    charges.forEach((c) => (c.invoiceId = invoiceId));
    await this.totals.recomputeInvoices(manager, [invoiceId]);

    const invoice = await repo.findOneByOrFail({ id: invoiceId });
    await this.ledger.post(manager, ctx, {
      patientId: invoice.patientId,
      type: LedgerEntryType.INVOICE_ISSUED,
      entryDate: time.today,
      amount: invoice.totalAmount,
      description: `Invoice ${invoice.invoiceNumber}`,
      invoiceId,
      invoiceRevision: 1,
    });
    await this.audit.log(manager, ctx, {
      entityType: BillingAuditEntity.INVOICE,
      entityId: invoiceId,
      action: BillingAuditAction.ISSUED,
      after: invoiceSnapshot(invoice, charges),
      amount: invoice.totalAmount,
    });
    return invoice;
  }

  private assertIssuable(charges: Charge[]): void {
    if (!charges.length)
      throw billingError(
        'BILLING_CHARGE_INVALID',
        'Select at least one charge',
      );
    const patientId = charges[0].patientId;
    for (const c of charges) {
      if (
        c.status !== ChargeStatus.ACTIVE ||
        c.invoiceId ||
        c.patientId !== patientId
      ) {
        throw billingError(
          'BILLING_CHARGE_NOT_OPEN',
          `${c.description} cannot be invoiced`,
        );
      }
      if (c.needsPricing) {
        throw billingError(
          'BILLING_CHARGE_NEEDS_PRICING',
          `${c.description} needs a price first`,
        );
      }
    }
  }
}
