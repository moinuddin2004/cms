import type { PatientQuery } from '../types/patients.types';

type Id = string | null;

/**
 * Staff query keys: every key carries the active organization AND location —
 * patient scope and several sub-resources depend on both (docs/04 §7).
 */
export const patientKeys = {
  all: ['patients'] as const,
  list: (orgId: Id, locationId: Id, query: PatientQuery) =>
    ['patients', 'list', orgId, locationId, query] as const,
  detail: (orgId: Id, locationId: Id, patientId: string) =>
    ['patients', 'detail', orgId, locationId, patientId] as const,
  checkPhone: (orgId: Id, locationId: Id, phone: string) =>
    ['patients', 'check-phone', orgId, locationId, phone] as const,
  history: (orgId: Id, locationId: Id, patientId: string) =>
    ['patients', 'history', orgId, locationId, patientId] as const,
  vitals: (orgId: Id, locationId: Id, patientId: string) =>
    ['patients', 'vitals', orgId, locationId, patientId] as const,
  teethCharts: (orgId: Id, locationId: Id, patientId: string) =>
    ['patients', 'teeth-charts', orgId, locationId, patientId] as const,
  prescriptions: (orgId: Id, locationId: Id, patientId: string, page: number) =>
    ['patients', 'prescriptions', orgId, locationId, patientId, page] as const,
};
