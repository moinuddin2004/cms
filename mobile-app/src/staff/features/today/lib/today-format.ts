import type { DoctorNow } from '../types/today.types';

/** "18m", or "—" when no consultation has started yet. */
export const avgWaitLabel = (minutes: number | null): string =>
  minutes === null ? '—' : `${Math.round(minutes)}m`;

/** The right-hand text of a "Doctors now" row: "A-012 · 4 waiting", "— paused", "No session". */
export function doctorNowSummary(d: DoctorNow): string {
  switch (d.status) {
    case 'no_session':
      return 'No session';
    case 'paused':
      return d.nowServing ? `${d.nowServing} · paused` : '— paused';
    case 'closed':
      return 'Closed';
    default: {
      const waiting = `${d.waitingCount} waiting`;
      return d.nowServing ? `${d.nowServing} · ${waiting}` : waiting;
    }
  }
}
