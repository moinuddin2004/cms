import type { SequenceSpec } from 'src/common/sequences/number-sequence.service';

/** `number_sequences` counters (per organization, gapless). */
export const LAB_BILLING_SEQUENCES = {
  INVOICE: { key: 'lab_invoice', prefix: 'LINV' },
  RECEIPT: { key: 'lab_receipt', prefix: 'LRC' },
  REVERSAL: { key: 'lab_payment_reversal', prefix: 'LRV' },
  CREDIT_NOTE: { key: 'lab_credit_note', prefix: 'LCN' },
  REFUND: { key: 'lab_refund', prefix: 'LRF' },
} as const satisfies Record<string, SequenceSpec>;

/** Item states that are never billed (the work will not reach the patient). */
export const UNBILLABLE_ITEM_STATES = ['cancelled', 'rejected'];

export const MAX_TAX_BP = 10_000;
