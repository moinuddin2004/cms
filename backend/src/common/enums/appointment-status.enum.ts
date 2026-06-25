export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  /** Patient has arrived and a daily token has been assigned — waiting to be seen. */
  CHECKED_IN = 'checked_in',
  /** With the doctor (a.k.a. "in room"). One per doctor at a time. */
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}
