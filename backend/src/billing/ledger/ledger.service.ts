import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BillingContext } from '../common/billing-context';
import { fromMinor, toMinor } from '../common/money';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { LedgerEntryType } from '../enums/billing.enums';

export interface LedgerPosting {
  patientId: string;
  type: LedgerEntryType;
  entryDate: string;
  /** Signed rupees: + debit (patient owes more), − credit. 0 is skipped. */
  amount: number;
  description: string;
  invoiceId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  invoiceRevision?: number | null;
}

/** Append-only patient ledger (D18, 6.14). Never updates or deletes. */
@Injectable()
export class LedgerService {
  async post(
    manager: EntityManager,
    ctx: BillingContext,
    p: LedgerPosting,
  ): Promise<void> {
    const minor = toMinor(p.amount);
    if (minor === 0) return;
    await manager.getRepository(LedgerEntry).insert({
      organizationId: ctx.tenant.organizationId,
      locationId: ctx.tenant.locationId,
      patientId: p.patientId,
      type: p.type,
      entryDate: p.entryDate,
      debit: minor > 0 ? fromMinor(minor) : 0,
      credit: minor < 0 ? fromMinor(-minor) : 0,
      invoiceId: p.invoiceId ?? null,
      paymentId: p.paymentId ?? null,
      refundId: p.refundId ?? null,
      invoiceRevision: p.invoiceRevision ?? null,
      description: p.description.slice(0, 200),
      createdBy: ctx.actor.userId,
    });
  }
}
