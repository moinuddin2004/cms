import { PG_UNIQUE_VIOLATION } from '../billing.constants';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Billing error codes (7.8). The global exception filter passes the
 * response object through as `error`, so clients read `error.code`.
 */
const STATUS_BY_CODE = {
  BILLING_NOT_FOUND: HttpStatus.NOT_FOUND,
  BILLING_LOCATION_CODE_MISSING: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_LOCATION_CODE_LOCKED: HttpStatus.CONFLICT,
  BILLING_LOCATION_CODE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_SERVICE_INACTIVE: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_SERVICE_KIND_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_DUPLICATE: HttpStatus.CONFLICT,
  BILLING_CHARGE_ALREADY_BILLED: HttpStatus.CONFLICT,
  BILLING_CHARGE_NOT_OPEN: HttpStatus.CONFLICT,
  BILLING_CHARGE_NEEDS_PRICING: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_CHARGE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_PRICE_CHANGE_NOT_ALLOWED: HttpStatus.FORBIDDEN,
  BILLING_DISCOUNT_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_DISCOUNT_VALUE_NOT_ALLOWED: HttpStatus.FORBIDDEN,
  BILLING_DISCOUNT_NOTE_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_CUSTOM_DISCOUNT_ADMIN_ONLY: HttpStatus.FORBIDDEN,
  BILLING_PAYMENT_ACCOUNT_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_PAYMENT_ACCOUNT_IS_DEFAULT: HttpStatus.CONFLICT,
  BILLING_REFERENCE_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_ALLOCATION_EXCEEDS_BALANCE: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_ALLOCATION_EXCEEDS_FUNDS: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_NOTHING_TO_APPLY: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_INVOICE_CANCELLED: HttpStatus.CONFLICT,
  BILLING_INVOICE_REVISION_CONFLICT: HttpStatus.CONFLICT,
  BILLING_INVOICE_HAS_PAYMENTS: HttpStatus.CONFLICT,
  BILLING_UNAPPLY_EXCEEDS_ALLOCATION: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_REFUND_EXCEEDS_ADVANCE: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_REFUND_EXCEEDS_INVOICE_REFUNDABLE: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_CASH_CLOSE_NOTE_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_CASH_CLOSE_COUNT_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_CASH_CLOSE_PERIOD_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  BILLING_INVARIANT_VIOLATION: HttpStatus.INTERNAL_SERVER_ERROR,
} as const;

export type BillingErrorCode = keyof typeof STATUS_BY_CODE;

export class BillingException extends HttpException {
  constructor(
    readonly code: BillingErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const billingError = (
  code: BillingErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): BillingException => new BillingException(code, message, extra);

export const notFound = (what: string): BillingException =>
  billingError('BILLING_NOT_FOUND', `${what} not found`);

export const invariant = (ok: boolean, message: string): void => {
  if (!ok) throw billingError('BILLING_INVARIANT_VIOLATION', message);
};

/** Postgres unique violation on a given constraint / index name. */
export const isUniqueViolation = (
  err: unknown,
  constraint?: string,
): boolean => {
  const e = err as {
    code?: string;
    constraint?: string;
    driverError?: { code?: string; constraint?: string };
  };
  const code = e?.code ?? e?.driverError?.code;
  const name = e?.constraint ?? e?.driverError?.constraint;
  return code === PG_UNIQUE_VIOLATION && (!constraint || name === constraint);
};
