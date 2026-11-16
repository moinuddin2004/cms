import type { ClinicRef } from '@/patient/features/records/types/records.types';

/** `GET /patient-api/queue/active` item (docs/07 §6.2, backend `patient-app/queue`). */
export type QueueEntryStatus = 'waiting' | 'called' | 'in_consultation' | 'on_hold' | 'skipped';

export interface ActiveQueueEntry {
  entryId: string;
  profileId: string;
  clinic: ClinicRef;
  location: { id: string; name: string; timezone: string };
  token: string;
  status: QueueEntryStatus | string;
  doctorName: string | null;
  /** Waiting patients before this one; 0 with the doctor; null on hold / skipped. */
  peopleAhead: number | null;
  nowServingToken: string | null;
  serviceDate: string;
}
