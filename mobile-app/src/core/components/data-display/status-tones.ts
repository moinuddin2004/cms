/**
 * Single source for status → colour (docs/05 §2, "Queue status → colour").
 *
 * The UI never picks a colour for a status inline: `StatusBadge` (M1-01)
 * looks the status up here, so a status means the same thing on every screen
 * and colour is never the only signal (the badge also shows `label`,
 * docs/04 §14).
 */

/** The semantic tone tokens defined in `src/global.css`. */
export type StatusTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'destructive';

/** How the badge paints the tone; `soft` is the badge's default. */
export type StatusToneVariant = 'solid' | 'soft' | 'outline';

export interface StatusToneSpec {
  /** Short label inside the badge (docs/05 §2). */
  label: string;
  tone: StatusTone;
  /** Unset = the badge's default (`soft`); `outline` marks a finished/negative state. */
  variant?: StatusToneVariant;
}

/** `EntryStatus` (docs/07 §2.3). */
export type QueueEntryStatus =
  | 'waiting'
  | 'called'
  | 'in_consultation'
  | 'on_hold'
  | 'skipped'
  | 'completed'
  | 'cancelled'
  | 'transferred'
  | 'aborted';

export const QUEUE_STATUS_TONES: Record<QueueEntryStatus, StatusToneSpec> = {
  waiting: { label: 'Waiting', tone: 'neutral' },
  called: { label: 'Called', tone: 'info' },
  in_consultation: { label: 'With doctor', tone: 'primary' },
  on_hold: { label: 'Sent for test', tone: 'warning' },
  skipped: { label: 'Skipped', tone: 'warning', variant: 'outline' },
  completed: { label: 'Done', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'destructive', variant: 'outline' },
  aborted: { label: 'Cancelled', tone: 'destructive', variant: 'outline' },
  transferred: { label: 'Transferred', tone: 'neutral', variant: 'outline' },
};

/** Urgent priority adds this badge to any queue status (docs/05 §2). */
export const URGENT_BADGE: StatusToneSpec = {
  label: 'Urgent',
  tone: 'destructive',
  variant: 'solid',
};

/** `AppointmentStatus` (docs/07 §2.4). */
export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, StatusToneSpec> = {
  scheduled: { label: 'Scheduled', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  checked_in: { label: 'Checked in', tone: 'primary' },
  completed: { label: 'Done', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'destructive', variant: 'outline' },
  no_show: { label: 'No-show', tone: 'warning' },
};

/** Dose status on the patient "Today" list (docs/05 §2). */
export type DoseStatus = 'due' | 'taken' | 'skipped' | 'missed';

export const DOSE_STATUS_TONES: Record<DoseStatus, StatusToneSpec> = {
  due: { label: 'Due', tone: 'primary' },
  taken: { label: 'Taken', tone: 'success' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  missed: { label: 'Missed', tone: 'warning' },
};
