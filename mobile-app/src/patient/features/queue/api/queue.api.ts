import type { ApiResponse } from '@/core/types';
import { patientApi } from '@/patient/lib/api';

import type { ActiveQueueEntry } from '../types/queue.types';

/** `GET /patient-api/queue/active` — today's active queue entries of every linked profile. */
export async function fetchActiveQueue(): Promise<ActiveQueueEntry[]> {
  const res = await patientApi.get<ApiResponse<ActiveQueueEntry[]>>('/patient-api/queue/active');
  return res.data.data;
}
