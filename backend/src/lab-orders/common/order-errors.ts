import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lab order error codes. The global exception filter passes the response
 * object through as `error`, so clients read `error.code` (and `issues`).
 */
const STATUS_BY_CODE = {
  LAB_ORDER_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_ORDER_NOT_DRAFT: HttpStatus.CONFLICT,
  LAB_ORDER_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_ORDER_ITEM_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_ORDER_PATIENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_ORDER_DOCTOR_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_ORDER_LAB_MISMATCH: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_ORDER_WORKFLOW_MISSING: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_ORDER_SNAPSHOT_FROZEN: HttpStatus.CONFLICT,
  LAB_ORDER_REVISION_NOT_ALLOWED: HttpStatus.CONFLICT,
  LAB_ORDER_REVISION_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_ORDER_MESSAGE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_ORDER_CHARGE_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_ORDER_CHARGE_DECIDED: HttpStatus.CONFLICT,
  LAB_ORDER_FORBIDDEN: HttpStatus.FORBIDDEN,
  ATTACHMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  ATTACHMENT_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  IDEMPOTENCY_KEY_REQUIRED: HttpStatus.BAD_REQUEST,
} as const;

export type OrderErrorCode = keyof typeof STATUS_BY_CODE;

export class OrderException extends HttpException {
  constructor(
    readonly code: OrderErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const orderError = (
  code: OrderErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): OrderException => new OrderException(code, message, extra);

/** One problem of an order, per line (`line` null = the order header). */
export interface OrderIssue {
  line: number | null;
  path: string;
  code: string;
  message: string;
}
