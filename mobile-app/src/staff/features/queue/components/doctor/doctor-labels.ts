import type { SelectionReason } from '../../types/queue.types';

/** Chip text for why the smart order suggests a patient (docs/06 S-02a). */
export function suggestionReasonLabel(reason: SelectionReason): string {
  switch (reason) {
    case 'URGENT':
      return 'Urgent';
    case 'STARVATION_GUARD':
      return 'Waited a long time';
    case 'APPOINTMENT_DUE':
      return 'Appointment due';
    case 'RETURNED_FROM_TEST':
      return 'Back from test';
    case 'FIFO':
      return 'First come';
    case 'MANUAL_SELECT':
      return 'Picked by you';
    default: {
      const _never: never = reason;
      return _never;
    }
  }
}

/** "12m" / "1h 5m" waiting time between two instants (a duration, not a clinic calendar value). */
export function waitingLabel(fromIso: string, nowIso: string): string {
  const minutes = Math.floor((Date.parse(nowIso) - Date.parse(fromIso)) / 60_000);
  if (Number.isNaN(minutes)) return '';
  const m = Math.max(0, minutes);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
