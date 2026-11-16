import type { ApiResponse } from '@/core/types';
import { patientApi } from '@/patient/lib/api';

import type { DoseEvent, MedicationSchedule, MedicationsPage } from '../types/medications.types';

/** Safety stop for the cursor loop (500 per page → 5000 schedules is far beyond any family). */
const MAX_PAGES = 10;

/** `GET /patient-api/medications` — one page, oldest change first. */
export async function fetchMedicationsPage(updatedSince?: string): Promise<MedicationsPage> {
  const res = await patientApi.get<ApiResponse<MedicationsPage>>('/patient-api/medications', {
    params: updatedSince ? { updatedSince } : {},
  });
  return res.data.data;
}

/**
 * Every schedule of the account (all statuses): follows `nextUpdatedSince` (inclusive, so rows
 * can repeat — later pages replace earlier ones by id).
 */
export async function fetchAllMedications(): Promise<MedicationSchedule[]> {
  const byId = new Map<string, MedicationSchedule>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await fetchMedicationsPage(cursor);
    for (const item of res.items) byId.set(item.id, item);
    if (!res.nextUpdatedSince || res.nextUpdatedSince === cursor) break;
    cursor = res.nextUpdatedSince;
  }
  return [...byId.values()];
}

/** `GET /patient-api/medications/dose-events` — UTC instants, window ≤ 92 days. */
export async function fetchDoseEvents(from: string, to: string): Promise<DoseEvent[]> {
  const res = await patientApi.get<ApiResponse<DoseEvent[]>>('/patient-api/medications/dose-events', {
    params: { from, to },
  });
  return res.data.data;
}

/** `POST /patient-api/medications/dose-events` — 1–200 events, idempotent per `(scheduleId, dueAt)`. */
export async function postDoseEvents(events: DoseEvent[]): Promise<number> {
  const res = await patientApi.post<ApiResponse<{ accepted: number }>>(
    '/patient-api/medications/dose-events',
    { events },
  );
  return res.data.data.accepted;
}
