import { UnprocessableEntityException } from '@nestjs/common';
import { AppointmentStatus as S } from 'src/common/enums/appointment-status.enum';

/**
 * The only allowed appointment status changes. Every status endpoint checks
 * this map before writing; anything else is 422 INVALID_TRANSITION.
 *
 * A reschedule keeps the same row and status (scheduled / confirmed). After
 * check-in the queue entry drives the rest: the appointment ends as
 * `completed` (entry completed) or `cancelled` (patient left / aborted).
 */
export const APPOINTMENT_TRANSITIONS: Readonly<Record<S, readonly S[]>> = {
  [S.SCHEDULED]: [S.CONFIRMED, S.CHECKED_IN, S.CANCELLED, S.NO_SHOW],
  [S.CONFIRMED]: [S.CHECKED_IN, S.CANCELLED, S.NO_SHOW],
  [S.CHECKED_IN]: [S.COMPLETED, S.CANCELLED],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
  [S.NO_SHOW]: [],
};

/** Statuses in which the booking itself (time, doctor, patient) may change. */
export const EDITABLE_STATUSES: readonly S[] = [S.SCHEDULED, S.CONFIRMED];

export function canTransition(from: S, to: S): boolean {
  return APPOINTMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: S, to: S): void {
  if (!canTransition(from, to)) {
    throw new UnprocessableEntityException({
      message: `Cannot change an appointment from ${from} to ${to}`,
      code: 'INVALID_TRANSITION',
      from,
      to,
    });
  }
}

export function assertEditable(status: S): void {
  if (!EDITABLE_STATUSES.includes(status)) {
    throw new UnprocessableEntityException({
      message: `A ${status} appointment can no longer be edited; only scheduled or confirmed bookings can`,
      code: 'APPOINTMENT_LOCKED',
      status,
    });
  }
}
