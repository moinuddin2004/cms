import type { PatientTeethChart } from '../types/patients.types';

/** Chart with the newest `recordedAt` (UTC instants compare as strings); never trusts the server order. */
export function latestTeethChart(charts: PatientTeethChart[]): PatientTeethChart | null {
  let best: PatientTeethChart | null = null;
  for (const chart of charts) {
    if (!best || chart.recordedAt > best.recordedAt) best = chart;
  }
  return best;
}
