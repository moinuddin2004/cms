import { HttpException, HttpStatus } from '@nestjs/common';

/** Lab payables error codes; clients read `error.code`. */
const STATUS_BY_CODE = {
  PAYABLES_BILL_NOT_FOUND: HttpStatus.NOT_FOUND,
  PAYABLES_PAYMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PAYABLES_STATEMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PAYABLES_LAB_NOT_FOUND: HttpStatus.NOT_FOUND,
  /** The bill / payment is not in a state that allows this. */
  PAYABLES_NOT_ALLOWED: HttpStatus.CONFLICT,
  /** The lab's invoice number is already on another bill. */
  PAYABLES_DUPLICATE_INVOICE: HttpStatus.CONFLICT,
  /** Allocation over the payment's amount or the bill's balance. */
  PAYABLES_ALLOCATION_LIMIT: HttpStatus.UNPROCESSABLE_ENTITY,
  PAYABLES_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;

export type PayablesErrorCode = keyof typeof STATUS_BY_CODE;

export class PayablesException extends HttpException {
  constructor(
    readonly code: PayablesErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const payablesError = (
  code: PayablesErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): PayablesException => new PayablesException(code, message, extra);
