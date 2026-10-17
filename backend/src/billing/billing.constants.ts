import { DocumentType } from './enums/billing.enums';

export const BILLING_FEATURE = 'billing.invoices';
export const DISCOUNTS_FEATURE = 'billing.discounts';

/** `{CODE}-{PREFIX}-{YYYY}-{NNNNN}` (D15). */
export const DOC_PREFIX: Readonly<Record<DocumentType, string>> = {
  [DocumentType.INVOICE]: 'INV',
  [DocumentType.RECEIPT]: 'REC',
  [DocumentType.REFUND]: 'RFD',
};
export const DOC_NUMBER_PAD = 5;
export const DOCUMENT_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;

export const REASON_MIN_LENGTH = 5;
export const NOTE_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 300;

export const DEFAULT_DUE_DAYS = 7;
export const MAX_DUE_DAYS = 365;
export const DEFAULT_CASH_ACCOUNT_NAME = 'Cash';
export const CUSTOM_DISCOUNT_NAME = 'Custom';

export const MAX_OUTSTANDING_PATIENT_IDS = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Postgres unique-violation SQLSTATE. */
export const PG_UNIQUE_VIOLATION = '23505';
