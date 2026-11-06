import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Notification error codes. The global exception filter passes the response
 * object through as `error`, so clients read `error.code`.
 */
const STATUS_BY_CODE = {
  NOTIFICATION_EVENT_UNKNOWN: HttpStatus.UNPROCESSABLE_ENTITY,
  NOTIFICATION_AUDIENCE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  NOTIFICATION_CHANNEL_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  NOTIFICATION_RULE_LOCKED: HttpStatus.UNPROCESSABLE_ENTITY,
  NOTIFICATION_TEMPLATE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  NOTIFICATION_TEMPLATE_NOT_FOUND: HttpStatus.NOT_FOUND,
  NOTIFICATION_QUIET_HOURS_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  NOTIFICATION_NOT_FOUND: HttpStatus.NOT_FOUND,
  PATIENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  NOTIFICATION_EMAIL_UNVERIFIED: HttpStatus.UNPROCESSABLE_ENTITY,
  NOTIFICATION_EMAIL_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  NOTIFICATION_EMAIL_SEND_FAILED: HttpStatus.BAD_GATEWAY,
} as const;

export type NotificationErrorCode = keyof typeof STATUS_BY_CODE;

export class NotificationException extends HttpException {
  constructor(
    readonly code: NotificationErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, STATUS_BY_CODE[code]);
  }
}

export const notificationError = (
  code: NotificationErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): NotificationException => new NotificationException(code, message, extra);
