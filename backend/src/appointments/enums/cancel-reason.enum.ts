/**
 * Why an appointment was cancelled. Replaces the old free-text reason for
 * structured analytics (no-show rate, walk-outs). A free-text note can still
 * accompany OTHER via the appointment's `cancelReason` column.
 */
export enum CancelReason {
  NO_SHOW = 'no_show',
  PATIENT_LEFT = 'patient_left',
  OTHER = 'other',
}
