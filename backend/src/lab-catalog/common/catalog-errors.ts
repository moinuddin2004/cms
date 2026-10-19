import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Catalog error codes. The global exception filter passes the response
 * object through as `error`, so clients read `error.code`.
 */
const STATUS_BY_CODE = {
  LAB_NOT_FOUND: HttpStatus.NOT_FOUND,
  SPECIALTY_NOT_FOUND: HttpStatus.UNPROCESSABLE_ENTITY,
  SERVICE_CATEGORY_NOT_FOUND: HttpStatus.NOT_FOUND,
  SERVICE_CATEGORY_EXISTS: HttpStatus.CONFLICT,
  SERVICE_CATEGORY_MISMATCH: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_SERVICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_SERVICE_EXISTS: HttpStatus.CONFLICT,
  LAB_SERVICE_INACTIVE: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_SERVICE_DEFINITION_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_SERVICE_OPTION_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_SERVICE_OPTION_EXISTS: HttpStatus.CONFLICT,
  LAB_PRICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  LAB_PRICE_OVERLAP: HttpStatus.CONFLICT,
  LAB_PRICE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_PRICE_LOCKED: HttpStatus.CONFLICT,
  LAB_PRICE_MISSING: HttpStatus.UNPROCESSABLE_ENTITY,
  LAB_NOT_LINKED: HttpStatus.UNPROCESSABLE_ENTITY,
  CLINIC_TREATMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  CLINIC_TREATMENT_INACTIVE: HttpStatus.UNPROCESSABLE_ENTITY,
  SERVICE_MAPPING_NOT_FOUND: HttpStatus.NOT_FOUND,
  SERVICE_MAPPING_EXISTS: HttpStatus.CONFLICT,
  LAB_SERVICE_ALREADY_MAPPED: HttpStatus.CONFLICT,
  ORDER_TEMPLATE_NOT_FOUND: HttpStatus.NOT_FOUND,
  ORDER_TEMPLATE_FORBIDDEN: HttpStatus.FORBIDDEN,
  ORDER_TEMPLATE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;

export type CatalogErrorCode = keyof typeof STATUS_BY_CODE;

export class CatalogException extends HttpException {
  constructor(
    readonly code: CatalogErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const catalogError = (
  code: CatalogErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): CatalogException => new CatalogException(code, message, extra);
