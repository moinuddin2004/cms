import { HttpException, HttpStatus } from '@nestjs/common';
import type { FormIssue } from '../forms/form-definition.types';

/**
 * Engine error codes. The global exception filter passes the response object
 * through as `error`, so clients read `error.code` (and `error.issues`).
 */
const STATUS_BY_CODE = {
  SPECIALTY_NOT_FOUND: HttpStatus.NOT_FOUND,
  SPECIALTY_EXISTS: HttpStatus.CONFLICT,
  SPECIALTY_NOT_ENABLED: HttpStatus.FORBIDDEN,
  ORGANIZATION_NOT_FOUND: HttpStatus.NOT_FOUND,
  FORM_SCHEMA_NOT_FOUND: HttpStatus.NOT_FOUND,
  FORM_SCHEMA_EXISTS: HttpStatus.CONFLICT,
  FORM_VERSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  FORM_VERSION_NOT_DRAFT: HttpStatus.CONFLICT,
  FORM_VERSION_NOT_PUBLISHED: HttpStatus.CONFLICT,
  FORM_DRAFT_EXISTS: HttpStatus.CONFLICT,
  FORM_DEFINITION_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  FORM_DATA_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  WORKFLOW_TEMPLATE_NOT_FOUND: HttpStatus.NOT_FOUND,
  WORKFLOW_TEMPLATE_EXISTS: HttpStatus.CONFLICT,
  WORKFLOW_VERSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  WORKFLOW_VERSION_NOT_DRAFT: HttpStatus.CONFLICT,
  WORKFLOW_VERSION_NOT_PUBLISHED: HttpStatus.CONFLICT,
  WORKFLOW_DRAFT_EXISTS: HttpStatus.CONFLICT,
  WORKFLOW_DEFINITION_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  STAGE_TEMPLATE_NOT_FOUND: HttpStatus.NOT_FOUND,
  STAGE_TEMPLATE_EXISTS: HttpStatus.CONFLICT,
  STAGE_TEMPLATE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  // transition() runtime (lab ERD §17)
  WORKFLOW_SUBJECT_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_TRANSITION: HttpStatus.UNPROCESSABLE_ENTITY,
  TRANSITION_FORBIDDEN: HttpStatus.FORBIDDEN,
  TRANSITION_INPUT_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  TRANSITION_REASON_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  WORKFLOW_MISCONFIGURED: HttpStatus.INTERNAL_SERVER_ERROR,
  IDEMPOTENCY_KEY_REUSED: HttpStatus.UNPROCESSABLE_ENTITY,
  REQUEST_IN_FLIGHT: HttpStatus.CONFLICT,
} as const;

export type EngineErrorCode = keyof typeof STATUS_BY_CODE;

export class EngineException extends HttpException {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const engineError = (
  code: EngineErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): EngineException => new EngineException(code, message, extra);

export const definitionInvalid = (issues: FormIssue[]): EngineException =>
  engineError(
    'FORM_DEFINITION_INVALID',
    `The form has ${issues.length} problem${issues.length === 1 ? '' : 's'} to fix before publishing`,
    { issues },
  );
