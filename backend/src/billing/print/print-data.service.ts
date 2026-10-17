import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Location } from 'src/locations/entities/location.entity';
import { LocationSettings } from 'src/locations/entities/location-settings.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { amountInWords } from '../common/amount-in-words';
import { BillingClock } from '../common/billing-clock.service';
import { BillingLookups } from '../common/billing-lookups';
import { fromPaisa, toPaisa } from '../common/money';
import { CashCloseService } from '../cash-close/cash-close.service';
import { PaymentAccount } from '../entities/payment-account.entity';
import { InvoiceStatus, PrintFormat } from '../enums/billing.enums';
import { InvoiceQueries } from '../invoices/invoices.queries';
import { InvoiceResponse } from '../mappers/billing-response.types';
import { PatientBillingQueries } from '../patient-billing/patient-billing.queries';
import { PaymentQueries } from '../payments/payments.queries';
import { RefundsService } from '../refunds/refunds.service';
import { BillingSettingsService } from '../settings/billing-settings.service';

export interface PrintHeader {
  clinicName: string;
  locationName: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  footerNote: string | null;
  format: PrintFormat;
  generatedAt: string;
}

/**
 * Frozen print payloads (9.1). Templates only display them; every number
 * here comes from the same queries the screens use.
 */
@Injectable()
export class PrintDataService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
    private readonly settings: BillingSettingsService,
    private readonly refunds: RefundsService,
    private readonly cashClose: CashCloseService,
  ) {}

  async invoice(tenant: TenantContext, invoiceId: string, revision?: number) {
    const manager = this.dataSource.manager;
    const { today } = await this.clock.read(tenant.locationId);
    const inv = await InvoiceQueries.detail(manager, tenant, invoiceId, today);
    const settings = await this.settings.getOrCreate(manager, tenant);
    const header = await this.header(
      manager,
      tenant,
      settings.invoicePrintFormat,
    );
    // A cancelled invoice's charges went back to "unbilled", so it prints
    // from its last snapshot, like a historic revision does.
    const wanted =
      revision ??
      (inv.status === InvoiceStatus.CANCELLED ? inv.revision : undefined);
    const historic =
      wanted &&
      (wanted !== inv.revision || inv.status === InvoiceStatus.CANCELLED)
        ? await InvoiceQueries.revisionSnapshot(
            manager,
            tenant,
            invoiceId,
            wanted,
          )
        : null;
    const snapshotTotal = historic
      ? Number(
          (historic.invoice as { totalAmount?: number | string } | undefined)
            ?.totalAmount,
        )
      : NaN;
    const other = settings.showPreviousBalance
      ? await this.otherOutstanding(manager, tenant, inv, today)
      : null;
    return {
      ...header,
      document: 'INVOICE' as const,
      invoice: inv,
      revisionShown: revision ?? inv.revision,
      historic,
      totalInWords: amountInWords(
        Number.isFinite(snapshotTotal) ? snapshotTotal : inv.totalAmount,
      ),
      otherOutstanding: other,
    };
  }

  async receipt(tenant: TenantContext, paymentId: string) {
    const manager = this.dataSource.manager;
    const { today } = await this.clock.read(tenant.locationId);
    const payment = await PaymentQueries.detail(manager, tenant, paymentId);
    const settings = await this.settings.getOrCreate(manager, tenant);
    const account = await manager.getRepository(PaymentAccount).findOne({
      where: { id: payment.paymentAccountId },
      select: { id: true, accountNumber: true, bankName: true },
    });
    const summary = await PatientBillingQueries.summary(
      manager,
      tenant,
      payment.patient.id,
      today,
    );
    return {
      ...(await this.header(manager, tenant, settings.receiptPrintFormat)),
      document: 'RECEIPT' as const,
      payment,
      accountLast4: account?.accountNumber
        ? account.accountNumber.slice(-4)
        : null,
      bankName: account?.bankName ?? null,
      amountInWords: amountInWords(payment.amount),
      remainingOutstanding: fromPaisa(
        toPaisa(summary.invoicedOutstanding) + toPaisa(summary.unbilledTotal),
      ),
      advanceHeld: summary.advance,
    };
  }

  async refund(tenant: TenantContext, refundId: string) {
    const refund = await this.refunds.detail(tenant, refundId);
    return {
      ...(await this.header(this.dataSource.manager, tenant, PrintFormat.A4)),
      document: 'REFUND' as const,
      refund,
      amountInWords: amountInWords(refund.amount),
    };
  }

  async statement(
    tenant: TenantContext,
    patientId: string,
    from?: string,
    to?: string,
  ) {
    const manager = this.dataSource.manager;
    const { today } = await this.clock.read(tenant.locationId);
    const statement = await PatientBillingQueries.statement(
      manager,
      tenant,
      patientId,
      from ?? null,
      to ?? null,
      today,
    );
    return {
      ...(await this.header(manager, tenant, PrintFormat.A4)),
      document: 'STATEMENT' as const,
      patient: await BillingLookups.patient(manager, tenant, patientId),
      statement,
    };
  }

  async cashCloseSlip(tenant: TenantContext, id: string) {
    const settings = await this.settings.getOrCreate(
      this.dataSource.manager,
      tenant,
    );
    return {
      ...(await this.header(
        this.dataSource.manager,
        tenant,
        settings.receiptPrintFormat,
      )),
      document: 'CASH_CLOSE' as const,
      close: await this.cashClose.detail(tenant, id),
    };
  }

  private async header(
    manager: EntityManager,
    tenant: TenantContext,
    format: PrintFormat,
  ): Promise<PrintHeader> {
    const [org, location, locSettings, settings, time] = await Promise.all([
      manager.getRepository(Organization).findOne({
        where: { id: tenant.organizationId },
        select: { id: true, name: true },
      }),
      manager.getRepository(Location).findOne({
        where: { id: tenant.locationId },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          phone: true,
        },
      }),
      manager
        .getRepository(LocationSettings)
        .findOne({ where: { locationId: tenant.locationId } }),
      this.settings.getOrCreate(manager, tenant),
      this.clock.read(tenant.locationId),
    ]);
    return {
      clinicName: org?.name ?? '',
      locationName: location?.name ?? '',
      address:
        [location?.address, location?.city].filter(Boolean).join(', ') || null,
      phone: location?.phone ?? null,
      logoUrl: settings.showLogo ? (locSettings?.logoUrl ?? null) : null,
      footerNote: settings.footerNote,
      format,
      generatedAt: time.now.toLocaleString('en-GB', { timeZone: time.tz }),
    };
  }

  /** The patient's other open balance, printed when `showPreviousBalance`. */
  private async otherOutstanding(
    manager: EntityManager,
    tenant: TenantContext,
    inv: InvoiceResponse,
    today: string,
  ): Promise<number> {
    const s = await PatientBillingQueries.summary(
      manager,
      tenant,
      inv.patient.id,
      today,
    );
    const own =
      inv.status === InvoiceStatus.ISSUED ? toPaisa(inv.balanceDue) : 0;
    return fromPaisa(
      Math.max(
        0,
        toPaisa(s.invoicedOutstanding) + toPaisa(s.unbilledTotal) - own,
      ),
    );
  }
}
