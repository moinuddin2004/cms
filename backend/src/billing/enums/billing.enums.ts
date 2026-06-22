export enum InvoiceStatus {
  DRAFT = 'DRAFT', // just created, still editing
  PENDING = 'PENDING', // sent to patient, awaiting payment
  PARTIALLY_PAID = 'PARTIALLY_PAID', // some payment received
  PAID = 'PAID', // fully paid
  OVERDUE = 'OVERDUE', // past due date, not fully paid
  CANCELLED = 'CANCELLED', // voided
  REFUNDED = 'REFUNDED', // money returned
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum PaymentMethod {
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

/**
 * Allowed status transitions for an invoice. CANCELLED and REFUNDED are
 * terminal. Any transition not listed here is rejected.
 */
export const VALID_INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> =
  {
    [InvoiceStatus.DRAFT]: [InvoiceStatus.PENDING, InvoiceStatus.CANCELLED],
    [InvoiceStatus.PENDING]: [
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.CANCELLED,
    ],
    [InvoiceStatus.PARTIALLY_PAID]: [
      InvoiceStatus.PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.CANCELLED,
      InvoiceStatus.REFUNDED,
    ],
    [InvoiceStatus.PAID]: [InvoiceStatus.REFUNDED],
    [InvoiceStatus.OVERDUE]: [
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.CANCELLED,
    ],
    [InvoiceStatus.CANCELLED]: [],
    [InvoiceStatus.REFUNDED]: [],
  };
