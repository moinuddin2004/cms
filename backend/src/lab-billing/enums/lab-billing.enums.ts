/** Lab invoice status (lab ERD §6a). Stored, but written only by the totals service. */
export enum LabInvoiceStatus {
  /** An estimate: editable, no number yet, nothing owed. */
  DRAFT = 'draft',
  ISSUED = 'issued',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  VOID = 'void',
}

export enum LabInvoiceLineKind {
  /** A lab order item, priced from its frozen patient price. */
  LAB_ITEM = 'lab_item',
  /** An approved lab charge request passed on to the patient. */
  LAB_CHARGE = 'lab_charge',
  MANUAL = 'manual',
}

export enum LabPaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  WALLET = 'wallet',
}

export enum LabPaymentStatus {
  POSTED = 'posted',
  REVERSED = 'reversed',
}

/** Why an allocation stopped counting (`reversed_at` set). */
export enum AllocationReleaseReason {
  PAYMENT_REVERSED = 'payment_reversed',
  /** Taken off a paid invoice by a credit note; the money is advance again. */
  CREDIT_NOTE = 'credit_note',
}

export enum LabCreditNoteStatus {
  /** Part of it came off payments and is waiting to be refunded. */
  ISSUED = 'issued',
  /** Fully absorbed by the invoice balance (nothing to pay out). */
  APPLIED = 'applied',
  REFUNDED = 'refunded',
}

/** Audit / status-history entity types. */
export const LAB_BILLING_ENTITY = {
  INVOICE: 'lab_invoice',
  PAYMENT: 'lab_payment',
  CREDIT_NOTE: 'lab_credit_note',
  REFUND: 'lab_refund',
  SETTINGS: 'lab_billing_settings',
} as const;
