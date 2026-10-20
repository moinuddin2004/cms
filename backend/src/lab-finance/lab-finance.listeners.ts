import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CommissionSourceType } from 'src/billing/commissions/commission.enums';
import { ClockService } from 'src/common/clock/clock.service';
import { LabBillingEvents } from 'src/lab-billing/events/lab-billing-events';
import { LabCommissionService } from './lab-commission.service';
import { LabReceivablesLedger } from './lab-receivables-ledger.service';

/**
 * Plugs the ledger and doctor commission into lab patient billing through
 * `LabBillingEvents` (lab ERD §10 "Patient payment" / "Payment reversal"):
 * everything runs inside the money operation's transaction, so the payment,
 * its journal and its commission commit together or not at all.
 */
@Injectable()
export class LabFinanceListeners implements OnModuleInit {
  constructor(
    private readonly events: LabBillingEvents,
    private readonly ledger: LabReceivablesLedger,
    private readonly commission: LabCommissionService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    this.events.on('invoiceIssued', async (m, e) => {
      await this.commission.snapshot(
        m,
        e.organizationId,
        e.locationId,
        e.invoiceId,
        e.issuedOn,
      );
      await this.ledger.invoiceIssued(m, e);
    });
    this.events.on('invoiceVoided', async (m, e) =>
      this.ledger.invoiceVoided(m, e, await this.today(e.locationId)),
    );
    this.events.onPaymentCollected(async (m, e) => {
      await this.ledger.paymentCollected(m, e);
      await this.accrue(
        m,
        e,
        e.allocations.map((a) => a.invoiceId),
        CommissionSourceType.ALLOCATION,
        e.paymentId,
        e.receivedOn,
      );
    });
    this.events.on('advanceApplied', async (m, e) => {
      const today = await this.today(e.locationId);
      await this.ledger.advanceApplied(m, e, today);
      await this.accrue(
        m,
        e,
        e.allocations.map((a) => a.invoiceId),
        CommissionSourceType.ALLOCATION,
        e.allocations[0]?.allocationId,
        today,
      );
    });
    this.events.onPaymentReversed(async (m, e) => {
      const today = await this.today(e.locationId);
      await this.ledger.paymentReversed(m, e, today);
      await this.accrue(
        m,
        e,
        e.releasedAllocations.map((a) => a.invoiceId),
        CommissionSourceType.UNAPPLY,
        e.reversalPaymentId,
        today,
      );
    });
    this.events.on('creditNoteIssued', async (m, e) => {
      const today = await this.today(e.locationId);
      await this.ledger.creditNoteIssued(m, e, today);
      await this.accrue(
        m,
        e,
        [e.invoiceId],
        CommissionSourceType.CHARGE_ADJUST,
        e.creditNoteId,
        today,
      );
    });
    this.events.on('refundPaid', async (m, e) =>
      this.ledger.refundPaid(m, e, await this.today(e.locationId)),
    );
  }

  /** Commission entries for the touched invoices + their journal. */
  private async accrue(
    m: EntityManager,
    base: { organizationId: string; actorUserId: string | null },
    invoiceIds: string[],
    type: CommissionSourceType,
    sourceId: string | undefined,
    entryOn: string,
  ): Promise<void> {
    const deltas = await this.commission.recordForInvoices(m, invoiceIds, {
      type,
      id: sourceId,
    });
    if (deltas.length && sourceId)
      await this.ledger.commission(m, base, sourceId, entryOn, deltas);
  }

  private async today(locationId: string): Promise<string> {
    return this.clock.today(await this.clock.timezoneFor(locationId));
  }
}
