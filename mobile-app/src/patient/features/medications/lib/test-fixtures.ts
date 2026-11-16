import type { DoseEvent, MedicationSchedule } from '../types/medications.types';

/** A local-clock instant — dose times are phone wall-clock, so tests build them the same way. */
export const at = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

export function schedule(overrides: Partial<MedicationSchedule> = {}): MedicationSchedule {
  return {
    id: 's1',
    profileId: 'p1',
    source: 'prescription',
    clinic: null,
    prescriptionId: 'rx1',
    prescriptionMedicineId: 'm1',
    name: 'Amoxicillin',
    nameUrdu: null,
    doseText: '500 mg',
    mealRelation: 'AFTER_MEAL',
    times: ['08:00', '20:00'],
    startDate: '2026-11-01',
    endDate: null,
    endDateSource: 'unknown',
    status: 'active',
    instructions: null,
    instructionsUrdu: null,
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

export const event = (
  scheduleId: string,
  dueMs: number,
  action: 'taken' | 'skipped' = 'taken',
  actedMs = dueMs,
): DoseEvent => ({
  scheduleId,
  dueAt: new Date(dueMs).toISOString(),
  action,
  actedAt: new Date(actedMs).toISOString(),
});
