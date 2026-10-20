import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/** One allocation made or released by an operation. */
export interface AllocationRef {
  allocationId: string;
  paymentId: string;
  invoiceId: string;
  amountPaisa: number;
}

interface Base {
  organizationId: string;
  locationId: string;
  patientId: string;
  /** Who did it (users.uuid). */
  actorUserId: string | null;
}

/**
 * What lab billing announces, inside the operation's transaction. Sprint 10
 * plugs the ledger (double entry) and doctor commission (collected basis)
 * in here — lab ERD §10 "Patient payment" / "Payment reversal" — without
 * this module knowing about either. Allocation amounts are what was
 * collected per invoice; invoice lines carry `doctor_id` and
 * `clinic_treatment_id` for commission rules.
 */
export interface LabBillingEventMap {
  /** Draft → issued: receivable grows by `totalPaisa`. */
  invoiceIssued: Base & {
    invoiceId: string;
    invoiceNo: string;
    issuedOn: string;
    totalPaisa: number;
  };
  /** A draft or unpaid invoice voided (an issued one reverses its receivable). */
  invoiceVoided: Base & {
    invoiceId: string;
    wasIssued: boolean;
    totalPaisa: number;
  };
  /** New money in (cash/bank ↑); `allocations` = part applied to invoices, rest is advance. */
  paymentCollected: Base & {
    paymentId: string;
    receiptNo: string;
    receivedOn: string;
    amountPaisa: number;
    method: string;
    allocations: AllocationRef[];
  };
  /** Existing advance applied to invoices (no new money). */
  advanceApplied: Base & { allocations: AllocationRef[] };
  /** A payment reversed: mirror the payment and undo its allocations. */
  paymentReversed: Base & {
    paymentId: string;
    reversalPaymentId: string;
    receiptNo: string;
    amountPaisa: number;
    method: string;
    releasedAllocations: AllocationRef[];
  };
  /** Receivable down by `amountPaisa`; `releasedAllocations` went back to advance. */
  creditNoteIssued: Base & {
    creditNoteId: string;
    creditNoteNo: string;
    invoiceId: string;
    amountPaisa: number;
    releasedAllocations: AllocationRef[];
    /** Allocations re-created for the part of a released row that stays. */
    keptAllocations: AllocationRef[];
  };
  /** Money paid back out of advance. */
  refundPaid: Base & {
    refundId: string;
    refundNo: string;
    amountPaisa: number;
    method: string;
    creditNoteId: string | null;
    sources: Array<{ paymentId: string; amountPaisa: number }>;
  };
}

export type LabBillingEvent = keyof LabBillingEventMap;
export type LabBillingListener<K extends LabBillingEvent> = (
  m: EntityManager,
  event: LabBillingEventMap[K],
) => Promise<void>;

/**
 * Hook registry. No listeners = no-op. Listeners run in the caller's
 * transaction, in registration order; a throw rolls the whole operation
 * back (so a ledger journal and the payment commit together or not at all).
 *
 * ```ts
 * constructor(events: LabBillingEvents) {
 *   events.onPaymentCollected(async (m, e) => ledger.post(m, …));
 * }
 * ```
 */
@Injectable()
export class LabBillingEvents {
  private readonly listeners = new Map<
    LabBillingEvent,
    LabBillingListener<LabBillingEvent>[]
  >();

  on<K extends LabBillingEvent>(
    event: K,
    listener: LabBillingListener<K>,
  ): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as LabBillingListener<LabBillingEvent>);
    this.listeners.set(event, list);
  }

  onPaymentCollected(l: LabBillingListener<'paymentCollected'>): void {
    this.on('paymentCollected', l);
  }

  onPaymentReversed(l: LabBillingListener<'paymentReversed'>): void {
    this.on('paymentReversed', l);
  }

  async emit<K extends LabBillingEvent>(
    m: EntityManager,
    event: K,
    payload: LabBillingEventMap[K],
  ): Promise<void> {
    for (const listener of this.listeners.get(event) ?? [])
      await listener(m, payload);
  }
}
