import { HttpException, HttpStatus } from '@nestjs/common';
import { pgError } from 'src/common/database/sql';

/**
 * Lab-management error codes. The global exception filter passes the
 * response object through as `error`, so clients read `error.code`.
 */
const STATUS_BY_CODE = {
  LAB_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_MEMBER_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_LINK_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_OWNER_ORG_NOT_FOUND: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_OWNER_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_SUSPENDED: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_MEMBER_USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_MEMBER_EXISTS: HttpStatus.CONFLICT,
  LAB_MEMBER_NOT_ALLOWED: HttpStatus.CONFLICT,
  LAB_MEMBER_SELF_CHANGE: HttpStatus.CONFLICT,
  LAB_LINK_EXISTS: HttpStatus.CONFLICT,
  LAB_LINK_REASON_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_LINK_SUSPENDED_BY_OTHER_SIDE: HttpStatus.FORBIDDEN,
  INVALID_TRANSITION: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;

export type LabErrorCode = keyof typeof STATUS_BY_CODE;

export class LabException extends HttpException {
  constructor(
    readonly code: LabErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const labError = (
  code: LabErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): LabException => new LabException(code, message, extra);

export function isUniqueViolation(err: unknown, constraint: string): boolean {
  const { code, constraint: name } = pgError(err);
  return code === '23505' && name === constraint;
}
