// ─── Billing v2 ───────────────────────────────────────────────────────
// Charge-based billing (D1). Payment / refund / invoice states that are
// derived from money (paid, overdue, refunded) are computed, never stored.

export enum ServiceKind {
  CONSULTATION = 'CONSULTATION',
  PROCEDURE = 'PROCEDURE',
  OTHER = 'OTHER',
}

export enum ChargeSource {
  CONSULTATION = 'CONSULTATION',
  TREATMENT = 'TREATMENT',
  TREATMENT_PLAN = 'TREATMENT_PLAN',
  MANUAL = 'MANUAL',
}

export enum ChargeStatus {
  ACTIVE = 'ACTIVE',
  VOID = 'VOID',
}

export enum DiscountKind {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum DiscountAppliesTo {
  ALL = 'ALL',
  SERVICE_KINDS = 'SERVICE_KINDS',
  SERVICES = 'SERVICES',
}

export enum InvoiceStatus {
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

/** Computed, never stored (D16). */
export enum InvoicePaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

/** Computed, never stored (6.18). */
export enum InvoiceRefundStatus {
  NONE = 'NONE',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  FULLY_REFUNDED = 'FULLY_REFUNDED',
}

/** The kind of a payment account (D20). */
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  ONLINE_WALLET = 'ONLINE_WALLET',
}

export enum AllocationMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export enum AllocationReason {
  PAYMENT = 'PAYMENT',
  ADVANCE_APPLIED = 'ADVANCE_APPLIED',
  INVOICE_EDIT_RELEASE = 'INVOICE_EDIT_RELEASE',
  UNAPPLY = 'UNAPPLY',
}

export enum LedgerEntryType {
  INVOICE_ISSUED = 'INVOICE_ISSUED',
  INVOICE_ADJUSTED = 'INVOICE_ADJUSTED',
  INVOICE_CANCELLED = 'INVOICE_CANCELLED',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
}

export enum DocumentType {
  INVOICE = 'INVOICE',
  RECEIPT = 'RECEIPT',
  REFUND = 'REFUND',
}

export enum PrintFormat {
  A4 = 'A4',
  THERMAL_80 = 'THERMAL_80',
}

export enum BillingAuditEntity {
  CHARGE = 'CHARGE',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  DISCOUNT_TYPE = 'DISCOUNT_TYPE',
  SERVICE = 'SERVICE',
  SERVICE_PRICE = 'SERVICE_PRICE',
  SETTINGS = 'SETTINGS',
  PAYMENT_ACCOUNT = 'PAYMENT_ACCOUNT',
  CASH_CLOSE = 'CASH_CLOSE',
}

export enum BillingAuditAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  VOIDED = 'VOIDED',
  DISCOUNT_APPLIED = 'DISCOUNT_APPLIED',
  DISCOUNT_REMOVED = 'DISCOUNT_REMOVED',
  PRICE_CHANGED = 'PRICE_CHANGED',
  ISSUED = 'ISSUED',
  EDITED = 'EDITED',
  CANCELLED = 'CANCELLED',
  ALLOCATED = 'ALLOCATED',
  UNAPPLIED = 'UNAPPLIED',
  REFUNDED = 'REFUNDED',
  CLOSED = 'CLOSED',
}

// ─── Non-billing-v2 (expenses, credit packages) ───────────────────────

/** Expenses keep their own method list; billing payments use payment accounts. */
export enum ExpensePaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  ONLINE = 'ONLINE',
  INSURANCE = 'INSURANCE',
  CHEQUE = 'CHEQUE',
  CREDIT_PACKAGE = 'CREDIT_PACKAGE',
}

export enum ExpenseCategory {
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  SUPPLIES = 'SUPPLIES',
  SALARY = 'SALARY',
  EQUIPMENT = 'EQUIPMENT',
  MARKETING = 'MARKETING',
  MAINTENANCE = 'MAINTENANCE',
  OTHER = 'OTHER',
}

export enum CreditStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  EXHAUSTED = 'EXHAUSTED',
}
