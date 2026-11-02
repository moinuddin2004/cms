import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  GeneralLedgerService,
  JournalLineInput,
} from 'src/billing/ledger/journal/general-ledger.service';
import {
  ACCOUNT,
  JournalSource,
  LedgerJournal,
} from 'src/billing/ledger/journal/ledger-journal.entity';
import { divRoundHalfUp } from 'src/billing/commissions/commission-math';
import { sqlRows } from 'src/common/database/sql';
import type {
  AllocationRef,
  LabBillingEventMap,
} from 'src/lab-billing/events/lab-billing-events';
import { LabPaymentMethod } from 'src/lab-billing/enums/lab-billing.enums';
import type { LabCommissionDelta } from './lab-commission.service';

const sum = (refs: AllocationRef[]) =>
  refs.reduce((a, r) => a + r.amountMinor, 0);

const cashAccount = (method: string) =>
  method === (LabPaymentMethod.CASH as string) ? ACCOUNT.CASH : ACCOUNT.BANK;

/**
 * Lab ERD §6c posting rules for the patient side of lab work, into billing's
 * double-entry journals (`GeneralLedgerService`), in the money operation's
 * own transaction:
 *
 * | Event                  | Debit                          | Credit                          |
 * | invoice issue          | Patient Receivable             | Lab Revenue (+ Tax Payable)     |
 * | payment                | Cash / Bank                    | Receivable (allocated) + Advances (rest) |
 * | advance applied        | Patient Advances               | Patient Receivable              |
 * | credit note            | Lab Revenue (+ Tax Payable)    | Patient Receivable              |
 * |   …money released      | Patient Receivable             | Patient Advances                |
 * | refund                 | Patient Advances               | Cash / Bank                     |
 * | commission accrue      | Commission Expense             | Commission Payable              |
 * | void / reversal        | mirror                         | mirror                          |
 *
 * A payment reversal posts the exact opposite of what the payment still
 * holds (cash out; receivable back for its released allocations, the rest
 * out of advance) rather than mirroring the collect journal: a credit note
 * may have moved part of it into advance in between.
 */
@Injectable()
export class LabReceivablesLedger {
  constructor(private readonly gl: GeneralLedgerService) {}

  async invoiceIssued(
    m: EntityManager,
    e: LabBillingEventMap['invoiceIssued'],
  ): Promise<void> {
    if (e.totalMinor <= 0) return;
    const [inv] = await sqlRows<{ tax_minor: string; order_id: string | null }>(
      m,
      `SELECT tax_minor, order_id FROM lab_invoices WHERE id = $1`,
      [e.invoiceId],
    );
    const tax = Number(inv.tax_minor);
    const tag = { patientId: e.patientId, labOrderId: inv.order_id };
    await this.gl.post(m, {
      organizationId: e.organizationId,
      locationId: e.locationId,
      entryOn: e.issuedOn,
      sourceType: JournalSource.INVOICE,
      sourceId: e.invoiceId,
      memo: `Lab invoice ${e.invoiceNo}`,
      createdBy: e.actorUserId,
      lines: [
        {
          accountCode: ACCOUNT.PATIENT_RECEIVABLE,
          debitMinor: e.totalMinor,
          ...tag,
        },
        {
          accountCode: ACCOUNT.LAB_REVENUE,
          creditMinor: e.totalMinor - tax,
          ...tag,
        },
        { accountCode: ACCOUNT.TAX_PAYABLE, creditMinor: tax, ...tag },
      ],
    });
  }

  /** Void of an issued invoice (no money on it): mirror its issue journal. */
  async invoiceVoided(
    m: EntityManager,
    e: LabBillingEventMap['invoiceVoided'],
    entryOn: string,
  ): Promise<void> {
    if (!e.wasIssued) return;
    const journals = await this.gl.forSource(
      m,
      e.organizationId,
      JournalSource.INVOICE,
      e.invoiceId,
    );
    for (const j of this.unreversed(journals))
      await this.gl.reverse(m, j.id, {
        entryOn,
        memo: `Void of ${j.memo}`,
        createdBy: e.actorUserId,
      });
  }

  async paymentCollected(
    m: EntityManager,
    e: LabBillingEventMap['paymentCollected'],
  ): Promise<void> {
    const allocated = sum(e.allocations);
    const tag = { patientId: e.patientId };
    await this.gl.post(m, {
      organizationId: e.organizationId,
      locationId: e.locationId,
      entryOn: e.receivedOn,
      sourceType: JournalSource.PAYMENT,
      sourceId: e.paymentId,
      memo: `Lab receipt ${e.receiptNo}`,
      createdBy: e.actorUserId,
      lines: [
        {
          accountCode: cashAccount(e.method),
          debitMinor: e.amountMinor,
          ...tag,
        },
        {
          accountCode: ACCOUNT.PATIENT_RECEIVABLE,
          creditMinor: allocated,
          ...tag,
        },
        {
          accountCode: ACCOUNT.PATIENT_ADVANCES,
          creditMinor: e.amountMinor - allocated,
          ...tag,
        },
      ],
    });
  }

  /** One journal per funding payment (source = that payment). */
  async advanceApplied(
    m: EntityManager,
    e: LabBillingEventMap['advanceApplied'],
    entryOn: string,
  ): Promise<void> {
    const byPayment = new Map<string, number>();
    for (const a of e.allocations)
      byPayment.set(
        a.paymentId,
        (byPayment.get(a.paymentId) ?? 0) + a.amountMinor,
      );
    const tag = { patientId: e.patientId };
    for (const [paymentId, amount] of byPayment) {
      if (amount <= 0) continue;
      await this.gl.post(m, {
        organizationId: e.organizationId,
        locationId: e.locationId,
        entryOn,
        sourceType: JournalSource.PAYMENT,
        sourceId: paymentId,
        memo: 'Lab advance applied',
        createdBy: e.actorUserId,
        lines: [
          { accountCode: ACCOUNT.PATIENT_ADVANCES, debitMinor: amount, ...tag },
          {
            accountCode: ACCOUNT.PATIENT_RECEIVABLE,
            creditMinor: amount,
            ...tag,
          },
        ],
      });
    }
  }

  async paymentReversed(
    m: EntityManager,
    e: LabBillingEventMap['paymentReversed'],
    entryOn: string,
  ): Promise<void> {
    const released = sum(e.releasedAllocations);
    const tag = { patientId: e.patientId };
    await this.gl.post(m, {
      organizationId: e.organizationId,
      locationId: e.locationId,
      entryOn,
      sourceType: JournalSource.PAYMENT,
      sourceId: e.paymentId,
      memo: `Reversal ${e.receiptNo}`,
      createdBy: e.actorUserId,
      lines: [
        {
          accountCode: ACCOUNT.PATIENT_RECEIVABLE,
          debitMinor: released,
          ...tag,
        },
        {
          accountCode: ACCOUNT.PATIENT_ADVANCES,
          debitMinor: e.amountMinor - released,
          ...tag,
        },
        {
          accountCode: cashAccount(e.method),
          creditMinor: e.amountMinor,
          ...tag,
        },
      ],
    });
  }

  async creditNoteIssued(
    m: EntityManager,
    e: LabBillingEventMap['creditNoteIssued'],
    entryOn: string,
  ): Promise<void> {
    const [inv] = await sqlRows<{
      tax_minor: string;
      total_minor: string;
      order_id: string | null;
    }>(
      m,
      `SELECT tax_minor, total_minor, order_id FROM lab_invoices WHERE id = $1`,
      [e.invoiceId],
    );
    const total = Number(inv.total_minor);
    const tax =
      total > 0
        ? Number(
            divRoundHalfUp(
              BigInt(e.amountMinor) * BigInt(inv.tax_minor),
              BigInt(total),
            ),
          )
        : 0;
    const moved = sum(e.releasedAllocations) - sum(e.keptAllocations);
    const tag = { patientId: e.patientId, labOrderId: inv.order_id };
    const lines: JournalLineInput[] = [
      {
        accountCode: ACCOUNT.LAB_REVENUE,
        debitMinor: e.amountMinor - tax,
        ...tag,
      },
      { accountCode: ACCOUNT.TAX_PAYABLE, debitMinor: tax, ...tag },
      {
        accountCode: ACCOUNT.PATIENT_RECEIVABLE,
        creditMinor: e.amountMinor,
        ...tag,
      },
    ];
    if (moved > 0)
      lines.push(
        { accountCode: ACCOUNT.PATIENT_RECEIVABLE, debitMinor: moved, ...tag },
        { accountCode: ACCOUNT.PATIENT_ADVANCES, creditMinor: moved, ...tag },
      );
    await this.gl.post(m, {
      organizationId: e.organizationId,
      locationId: e.locationId,
      entryOn,
      sourceType: JournalSource.CREDIT_NOTE,
      sourceId: e.creditNoteId,
      memo: `Lab credit note ${e.creditNoteNo}`,
      createdBy: e.actorUserId,
      lines,
    });
  }

  async refundPaid(
    m: EntityManager,
    e: LabBillingEventMap['refundPaid'],
    entryOn: string,
  ): Promise<void> {
    const tag = { patientId: e.patientId };
    await this.gl.post(m, {
      organizationId: e.organizationId,
      locationId: e.locationId,
      entryOn,
      sourceType: JournalSource.REFUND,
      sourceId: e.refundId,
      memo: `Lab refund ${e.refundNo}`,
      createdBy: e.actorUserId,
      lines: [
        {
          accountCode: ACCOUNT.PATIENT_ADVANCES,
          debitMinor: e.amountMinor,
          ...tag,
        },
        {
          accountCode: cashAccount(e.method),
          creditMinor: e.amountMinor,
          ...tag,
        },
      ],
    });
  }

  /** Signed per-doctor commission → one balanced journal for the operation. */
  async commission(
    m: EntityManager,
    base: { organizationId: string; actorUserId: string | null },
    sourceId: string,
    entryOn: string,
    deltas: LabCommissionDelta[],
  ): Promise<void> {
    if (!deltas.length) return;
    const lines: JournalLineInput[] = [];
    for (const d of deltas) {
      const tag = {
        doctorId: d.doctorId,
        patientId: d.patientId,
        labOrderId: d.orderId,
      };
      const amount = Math.abs(d.amountMinor);
      const [debit, credit] =
        d.amountMinor > 0
          ? [ACCOUNT.COMMISSION_EXPENSE, ACCOUNT.COMMISSION_PAYABLE]
          : [ACCOUNT.COMMISSION_PAYABLE, ACCOUNT.COMMISSION_EXPENSE];
      lines.push(
        { accountCode: debit, debitMinor: amount, ...tag },
        { accountCode: credit, creditMinor: amount, ...tag },
      );
    }
    await this.gl.post(m, {
      organizationId: base.organizationId,
      locationId: deltas[0].locationId,
      entryOn,
      sourceType: JournalSource.COMMISSION,
      sourceId,
      memo:
        deltas.reduce((a, d) => a + d.amountMinor, 0) >= 0
          ? 'Doctor commission on lab work'
          : 'Doctor commission reversed (lab work)',
      createdBy: base.actorUserId,
      lines,
    });
  }

  private unreversed(journals: LedgerJournal[]): LedgerJournal[] {
    const reversed = new Set(
      journals.flatMap((j) => (j.reversalOfId ? [j.reversalOfId] : [])),
    );
    return journals.filter((j) => !j.reversalOfId && !reversed.has(j.id));
  }
}
