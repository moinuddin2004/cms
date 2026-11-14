import { formatInZone } from '@/core/datetime';

import type { AppointmentListItem } from '../types/appointments.types';

export interface HourGroup {
  /** Clinic hour 0–23. */
  hour: number;
  /** "9 AM" on the clinic clock. */
  label: string;
  items: AppointmentListItem[];
}

/**
 * Groups a day's rows by the hour they start on the CLINIC clock (`zone`),
 * hours ascending, rows inside an hour by start time. Pure: the screen passes
 * `clinicTimezone()`.
 */
export function groupByHour(rows: readonly AppointmentListItem[], zone: string): HourGroup[] {
  const sorted = [...rows].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const groups = new Map<number, HourGroup>();
  for (const row of sorted) {
    const hour = Number(formatInZone(row.startTime, zone, 'H'));
    if (Number.isNaN(hour)) continue;
    let group = groups.get(hour);
    if (!group) {
      group = { hour, label: formatInZone(row.startTime, zone, 'h a'), items: [] };
      groups.set(hour, group);
    }
    group.items.push(row);
  }
  return [...groups.values()].sort((a, b) => a.hour - b.hour);
}
