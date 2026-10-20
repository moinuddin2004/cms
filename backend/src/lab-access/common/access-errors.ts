import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lab access error codes (Sprint 7). The global exception filter passes the
 * response object through as `error`, so clients read `error.code`.
 */
const STATUS_BY_CODE = {
  /** Unknown token, or a token for another order. */
  MAGIC_LINK_INVALID: HttpStatus.NOT_FOUND,
  MAGIC_LINK_EXPIRED: HttpStatus.GONE,
  MAGIC_LINK_REVOKED: HttpStatus.GONE,
  /** A view-only link, or an action the link's purpose doesn't cover. */
  MAGIC_LINK_FORBIDDEN: HttpStatus.FORBIDDEN,
  MAGIC_LINK_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_ACTION_NOT_ALLOWED: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_EXPECTED_DATE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  ORDER_LINK_NOT_FOUND: HttpStatus.NOT_FOUND,
} as const;

export type AccessErrorCode = keyof typeof STATUS_BY_CODE;

export class AccessException extends HttpException {
  constructor(
    readonly code: AccessErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const accessError = (
  code: AccessErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): AccessException => new AccessException(code, message, extra);
