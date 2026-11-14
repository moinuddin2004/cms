import type { HourGroup } from './group-by-hour';
import type { AppointmentListItem, AppointmentStatus, AppointmentType } from '../types/appointments.types';

/** Flat FlashList data: an hour header, then that hour's rows (FlashList v2 has no sections). */
export type ScheduleItem =
  | { type: 'header'; key: string; label: string; count: number }
  | { type: 'row'; key: string; row: AppointmentListItem };

export interface ScheduleList {
  items: ScheduleItem[];
  /** Indexes of the header items, for `stickyHeaderIndices`. */
  headerIndices: number[];
}

/** Hour groups → one flat list with sticky-header indexes. Pure. */
export function buildScheduleList(groups: readonly HourGroup[]): ScheduleList {
  const items: ScheduleItem[] = [];
  const headerIndices: number[] = [];
  for (const group of groups) {
    headerIndices.push(items.length);
    items.push({
      type: 'header',
      key: `h-${group.hour}`,
      label: group.label,
      count: group.items.length,
    });
    for (const row of group.items) items.push({ type: 'row', key: `r-${row.id}`, row });
  }
  return { items, headerIndices };
}

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType | 'walk_in', string> = {
  consultation: 'Consultation',
  follow_up: 'Follow-up',
  treatment: 'Treatment',
  checkup: 'Check-up',
  emergency: 'Emergency',
  cleaning: 'Cleaning',
  walk_in: 'Walk-in',
};

export const typeLabel = (type: AppointmentType | 'walk_in') =>
  APPOINTMENT_TYPE_LABELS[type] ?? 'Appointment';

/** Status filter chips (docs/06 S-06). Labels match the status badge copy. */
export const STATUS_FILTER_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'completed', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
];
