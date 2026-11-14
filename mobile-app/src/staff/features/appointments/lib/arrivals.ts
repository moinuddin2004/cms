import type { AppointmentListItem } from '../types/appointments.types';

/**
 * S-03: bookings still waiting to arrive — `scheduled | confirmed` with no
 * queue entry (never a walk-in), earliest first. The backend `status` param
 * takes one value, so the two statuses are filtered here.
 */
export function selectArrivals(rows: readonly AppointmentListItem[]): AppointmentListItem[] {
  return rows
    .filter(
      (r) =>
        r.kind !== 'walk_in' &&
        (r.status === 'scheduled' || r.status === 'confirmed') &&
        r.queueEntry === null,
    )
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}
