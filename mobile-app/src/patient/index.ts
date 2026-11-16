/**
 * Public surface of the patient space for `src/shell` only (docs/02 §1). The
 * shell may import this barrel — never a deep `@/patient/...` path.
 */
export { PatientLayout } from '@/patient/navigation/PatientLayout';
export { signOutPatient } from '@/patient/features/auth/lib/sign-out';
export { patientQueryClient } from '@/patient/lib/query-client';
export {
  handlePatientNotificationRoute,
  isPatientSignedIn,
} from '@/patient/features/devices/lib/handle-patient-notification-route';
