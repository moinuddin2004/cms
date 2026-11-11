export { patientKeys } from './api/patients.keys';
export {
  checkPatientPhone,
  createPatient,
  fetchPatient,
  fetchPatientHistory,
  fetchPatientPrescriptions,
  fetchPatientTeethCharts,
  fetchPatientVitals,
  fetchPatients,
} from './api/patients.api';
export { maskPhone } from './lib/mask-phone';
export { patientAlerts, splitAllergies } from './lib/patient-alerts';
export { quickRegisterSchema } from './schemas/quick-register.schema';
export type { QuickRegisterOutput, QuickRegisterValues } from './schemas/quick-register.schema';
export type * from './types/patients.types';
