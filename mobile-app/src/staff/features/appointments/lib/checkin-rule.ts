import { formatInZone } from '@/core/datetime';

import type { AppointmentListItem } from '../types/appointments.types';

export interface CheckInContext {
  /** `can('queue.checkin')`. */
  permitted: boolean;
  /** The clinic's calendar date now, "YYYY-MM-DD" (`useClinicToday()`). */
  today: string;
  /** The clinic's IANA zone. */
  zone: string;
}

/**
 * When the schedule sheet offers [Check in] (docs/06 S-06, S-03): the user has
 * `queue.checkin`, the booking is today on the clinic clock, its status is
 * `scheduled | confirmed`, it has no queue entry yet, and it is a real booking
 * (a walk-in row is already in the queue). The server stays the authority.
 */
export function canCheckIn(row: AppointmentListItem, ctx: CheckInContext): boolean {
  if (!ctx.permitted || row.kind === 'walk_in' || row.queueEntry !== null) return false;
  if (row.status !== 'scheduled' && row.status !== 'confirmed') return false;
  return formatInZone(row.startTime, ctx.zone, 'yyyy-MM-dd') === ctx.today;
}
