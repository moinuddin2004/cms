import { HttpException, HttpStatus } from '@nestjs/common';

/** Lab production error codes; clients read `error.code`. */
const STATUS_BY_CODE = {
  PRODUCTION_ITEM_NOT_FOUND: HttpStatus.NOT_FOUND,
  PRODUCTION_STAGE_NOT_FOUND: HttpStatus.NOT_FOUND,
  PRODUCTION_SHIPMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PRODUCTION_REMAKE_NOT_FOUND: HttpStatus.NOT_FOUND,
  PRODUCTION_MEMBER_NOT_FOUND: HttpStatus.NOT_FOUND,
  /** The item / stage / shipment is not in a state that allows this. */
  PRODUCTION_NOT_ALLOWED: HttpStatus.CONFLICT,
  PRODUCTION_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;

export type ProductionErrorCode = keyof typeof STATUS_BY_CODE;

export class ProductionException extends HttpException {
  constructor(
    readonly code: ProductionErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const productionError = (
  code: ProductionErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): ProductionException => new ProductionException(code, message, extra);
