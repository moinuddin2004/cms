import { EntryStatus as E, SessionStatus as S } from './enums/queue.enums';
import { QueueErrors } from './queue.errors';

/**
 * The only allowed queue-entry status changes (architecture doc, section 6).
 * The orchestrator checks this map before every update; anything else is
 * 422 INVALID_TRANSITION.
 */
export const ENTRY_TRANSITIONS: Readonly<Record<E, readonly E[]>> = {
  [E.WAITING]: [E.CALLED, E.CANCELLED, E.TRANSFERRED],
  [E.CALLED]: [E.WAITING, E.IN_CONSULTATION, E.SKIPPED],
  [E.SKIPPED]: [E.WAITING, E.CANCELLED],
  [E.IN_CONSULTATION]: [E.ON_HOLD, E.COMPLETED, E.ABORTED, E.TRANSFERRED],
  [E.ON_HOLD]: [E.WAITING, E.CANCELLED],
  [E.COMPLETED]: [],
  [E.CANCELLED]: [],
  [E.TRANSFERRED]: [],
  [E.ABORTED]: [],
};

export const SESSION_TRANSITIONS: Readonly<Record<S, readonly S[]>> = {
  [S.WAITING_FOR_DOCTOR]: [S.OPEN, S.CLOSED],
  [S.OPEN]: [S.PAUSED, S.CLOSED],
  [S.PAUSED]: [S.OPEN, S.CLOSED],
  [S.CLOSED]: [],
};

export function assertEntryTransition(from: E, to: E): void {
  if (!ENTRY_TRANSITIONS[from]?.includes(to)) {
    throw QueueErrors.invalidTransition(
      `Cannot move a ${from} entry to ${to}`,
      { from, to },
    );
  }
}

export function assertSessionTransition(from: S, to: S): void {
  if (!SESSION_TRANSITIONS[from]?.includes(to)) {
    throw QueueErrors.invalidTransition(
      `Cannot move a ${from} session to ${to}`,
      { from, to },
    );
  }
}

/** Check-in is allowed until the session is closed. */
export const CHECK_IN_SESSION_STATUSES: readonly S[] = [
  S.WAITING_FOR_DOCTOR,
  S.OPEN,
  S.PAUSED,
];
