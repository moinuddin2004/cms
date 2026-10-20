/** Lab ERD §6b. */

export enum VendorBillStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  VOID = 'void',
}

export enum BillLineKind {
  SERVICE = 'service',
  RUSH = 'rush',
  SHIPPING = 'shipping',
  MATERIAL = 'material',
  REMAKE = 'remake',
  OTHER = 'other',
}

export enum VendorPaymentStatus {
  POSTED = 'posted',
  REVERSED = 'reversed',
}

export enum VendorPaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  CHEQUE = 'cheque',
  OTHER = 'other',
}

export enum StatementStatus {
  UPLOADED = 'uploaded',
  RECONCILING = 'reconciling',
  RECONCILED = 'reconciled',
  DISPUTED = 'disputed',
}

export enum StatementMatch {
  MATCHED = 'matched',
  AMOUNT_MISMATCH = 'amount_mismatch',
  MISSING_IN_SYSTEM = 'missing_in_system',
  MISSING_IN_STATEMENT = 'missing_in_statement',
}

/** Audit `entity_type` values written by this module. */
export const PAYABLES_ENTITY = {
  BILL: 'vendor_bill',
  PAYMENT: 'vendor_payment',
  STATEMENT: 'lab_statement',
} as const;

/** Bills a payment may settle. */
export const PAYABLE_STATUSES = [
  VendorBillStatus.APPROVED,
  VendorBillStatus.PARTIALLY_PAID,
];
