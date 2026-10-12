import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';

/**
 * Error codes from the architecture doc (section 8). The global exception
 * filter returns them under `error.code`, next to a human `message`.
 */
export const QueueErrors = {
  notFound: (what: string) =>
    new NotFoundException({ message: `${what} not found`, code: 'NOT_FOUND' }),

  forbidden: (message: string) =>
    new ForbiddenException({ message, code: 'FORBIDDEN' }),

  invalidTransition: (message: string, extra: Record<string, unknown> = {}) =>
    new UnprocessableEntityException({
      message,
      code: 'INVALID_TRANSITION',
      ...extra,
    }),

  sessionNotOpen: (status: string) =>
    new UnprocessableEntityException({
      message:
        status === 'closed'
          ? 'This queue is closed for the day'
          : status === 'paused'
            ? 'The doctor has paused this queue'
            : 'The doctor has not started this queue yet',
      code: 'SESSION_NOT_OPEN',
      sessionStatus: status,
    }),

  doctorBusy: () =>
    new ConflictException({
      message:
        'The doctor already has a patient. Finish or undo that call first.',
      code: 'DOCTOR_BUSY',
    }),

  versionConflict: (current: unknown) =>
    new ConflictException({
      message: 'This was changed by someone else. The latest state is shown.',
      code: 'VERSION_CONFLICT',
      current,
    }),

  alreadyCheckedIn: (entry: unknown) =>
    new ConflictException({
      message: 'This patient already has an active token in this queue',
      code: 'ALREADY_CHECKED_IN',
      entry,
    }),

  activeElsewhere: (entries: unknown) =>
    new ConflictException({
      message: "This patient is already in another doctor's queue today",
      code: 'ACTIVE_WITH_OTHER_DOCTOR',
      entries,
    }),

  lateLimitExceeded: (maxLateMin: number) =>
    new UnprocessableEntityException({
      message: `More than ${maxLateMin} minutes late — convert to a walk-in or reschedule`,
      code: 'LATE_LIMIT_EXCEEDED',
      maxLateMin,
    }),

  notToday: () =>
    new UnprocessableEntityException({
      message:
        'This appointment is not for today; reschedule it or register a walk-in',
      code: 'NOT_TODAY',
    }),

  lockTimeout: () =>
    new ServiceUnavailableException({
      message: 'The queue is busy, please retry',
      code: 'LOCK_TIMEOUT',
    }),

  idempotencyKeyRequired: () =>
    new BadRequestException({
      message: 'Idempotency-Key header is required for queue changes',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    }),

  idempotencyKeyReused: () =>
    new UnprocessableEntityException({
      message: 'This Idempotency-Key was already used for a different request',
      code: 'IDEMPOTENCY_KEY_REUSED',
    }),

  inFlight: () =>
    new ConflictException({
      message: 'The same request is still being processed, retry shortly',
      code: 'REQUEST_IN_FLIGHT',
    }),

  reasonRequired: (what: string) =>
    new BadRequestException({
      message: `A reason is required to ${what}`,
      code: 'REASON_REQUIRED',
    }),
};
