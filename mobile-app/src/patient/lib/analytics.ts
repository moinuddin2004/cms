import { createTracker } from '@/core/analytics';
import { patientApi } from '@/patient/lib/api';

/** Patient product events (M2-13): names/props are the allow-list in docs/analytics-events.md. */
export type PatientEventName = 'patient_signed_in' | 'claim_accepted' | 'records_opened';

const tracker = createTracker<PatientEventName>({
  send: async (events) => {
    await patientApi.post('/patient-api/events', { events });
  },
});

export const trackPatient = tracker.track;
export const flushPatientEvents = tracker.flush;
