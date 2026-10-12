/** Lowercase snake_case values, matching the rest of the codebase. */

export enum QueueType {
  APPOINTMENT = 'appointment',
  WALK_IN = 'walk_in',
}

export enum EntryStatus {
  WAITING = 'waiting',
  CALLED = 'called',
  IN_CONSULTATION = 'in_consultation',
  ON_HOLD = 'on_hold',
  SKIPPED = 'skipped',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  TRANSFERRED = 'transferred',
  ABORTED = 'aborted',
}

export enum SessionStatus {
  WAITING_FOR_DOCTOR = 'waiting_for_doctor',
  OPEN = 'open',
  PAUSED = 'paused',
  CLOSED = 'closed',
}

export enum PriorityClass {
  NORMAL = 'normal',
  AUTHORIZED_URGENT = 'authorized_urgent',
}

export enum RejoinPolicy {
  END = 'end',
  ORIGINAL_POSITION = 'original_position',
  MANUAL = 'manual',
}

/** Entries that still hold a place in the queue. */
export const ACTIVE_ENTRY_STATUSES: EntryStatus[] = [
  EntryStatus.WAITING,
  EntryStatus.CALLED,
  EntryStatus.IN_CONSULTATION,
  EntryStatus.ON_HOLD,
  EntryStatus.SKIPPED,
];

/** Entries currently with the doctor (at most one per session). */
export const WITH_DOCTOR_STATUSES: EntryStatus[] = [
  EntryStatus.CALLED,
  EntryStatus.IN_CONSULTATION,
];

/** Selection engine reason codes. */
export type SelectionReason =
  | 'URGENT'
  | 'STARVATION_GUARD'
  | 'APPOINTMENT_DUE'
  | 'RETURNED_FROM_TEST'
  | 'FIFO'
  | 'MANUAL_SELECT';
