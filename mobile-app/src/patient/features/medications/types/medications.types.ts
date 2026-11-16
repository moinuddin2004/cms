import type { ClinicRef } from '@/patient/features/records';

/** Shapes of `/patient-api/medications` (docs/07 §6.3 + §6.5, as built in backend `patient-app/medications`). */
export type MealRelation = 'BEFORE_MEAL' | 'AFTER_MEAL' | 'WITH_MEAL' | 'EMPTY_STOMACH' | 'NONE';
export type ScheduleStatus = 'active' | 'paused' | 'completed' | 'stopped';
export type DoseAction = 'taken' | 'skipped';

export interface MedicationSchedule {
  id: string;
  profileId: string;
  source: 'prescription' | 'manual';
  clinic: ClinicRef | null;
  prescriptionId: string | null;
  prescriptionMedicineId: string | null;
  name: string;
  nameUrdu: string | null;
  doseText: string;
  mealRelation: MealRelation;
  /** Wall-clock `HH:mm` on the PHONE's clock (docs/07 A-10). */
  times: string[];
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** `null` = unknown. */
  endDate: string | null;
  endDateSource: 'parsed' | 'patient' | 'unknown';
  status: ScheduleStatus;
  instructions: string | null;
  instructionsUrdu: string | null;
  updatedAt: string;
}

export interface MedicationsPage {
  items: MedicationSchedule[];
  nextUpdatedSince: string | null;
}

/** A recorded dose decision. `dueAt` is the UTC instant of the scheduled dose. */
export interface DoseEvent {
  scheduleId: string;
  dueAt: string;
  action: DoseAction;
  actedAt: string;
}
