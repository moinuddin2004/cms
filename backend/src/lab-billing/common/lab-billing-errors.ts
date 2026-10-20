import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lab billing error codes. The global exception filter passes the response
 * object through as `error`, so clients read `error.code`.
 */
const STATUS_BY_CODE = {
  LAB_BILLING_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_BILLING_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_BILLING_ITEM_NOT_BILLABLE: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_BILLING_ALREADY_BILLED: HttpStatus.CONFLICT,
  LAB_BILLING_INVOICE_NOT_DRAFT: HttpStatus.CONFLICT,
  LAB_BILLING_INVOICE_NOT_OPEN: HttpStatus.CONFLICT,
  LAB_BILLING_INVOICE_HAS_MONEY: HttpStatus.CONFLICT,
  LAB_BILLING_ALLOCATION_EXCEEDS_BALANCE: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_BILLING_ALLOCATION_EXCEEDS_PAYMENT: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_BILLING_NOTHING_TO_APPLY: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_BILLING_PAYMENT_REVERSED: HttpStatus.CONFLICT,
  LAB_BILLING_PAYMENT_REFUNDED: HttpStatus.CONFLICT,
  LAB_BILLING_CREDIT_EXCEEDS_INVOICE: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_BILLING_REFUND_EXCEEDS_ADVANCE: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_BILLING_REFUND_EXCEEDS_CREDIT: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_BILLING_VERSION_CONFLICT: HttpStatus.CONFLICT,
  LAB_BILLING_INVARIANT_VIOLATION: HttpStatus.INTERNAL_SERVER_ERROR,
  IDEMPOTENCY_KEY_REQUIRED: HttpStatus.BAD_REQUEST,
  IDEMPOTENCY_KEY_REUSED: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;

export type LabBillingErrorCode = keyof typeof STATUS_BY_CODE;

export class LabBillingException extends HttpException {
  constructor(
    readonly code: LabBillingErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const labBillingError = (
  code: LabBillingErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): LabBillingException => new LabBillingException(code, message, extra);

export const notFound = (what: string): LabBillingException =>
  labBillingError('LAB_BILLING_NOT_FOUND', `${what} not found`);

export const invariant = (ok: boolean, message: string): void => {
  if (!ok) throw labBillingError('LAB_BILLING_INVARIANT_VIOLATION', message);
};

/** Idempotency-Key header (required on every money-moving POST). */
export function requireKey(key: string | undefined): string {
  const k = key?.trim();
  if (!k)
    throw labBillingError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Send an Idempotency-Key header with this request',
    );
  if (k.length > 150)
    throw labBillingError(
      'LAB_BILLING_INVALID',
      'Idempotency-Key must be at most 150 characters',
    );
  return k;
}
