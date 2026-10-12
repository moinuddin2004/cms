/**
 * Booking status only. What happens after arrival (waiting, with the doctor,
 * on hold for a test…) lives on the queue entry, not here.
 */
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  /** Patient arrived and has an active queue entry (token). */
  CHECKED_IN = 'checked_in',
  /** The linked queue entry was completed. */
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}
