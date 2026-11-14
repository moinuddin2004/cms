import { useLocalSearchParams } from 'expo-router';

import { PatientDetailPage } from '@/staff/features/patients';

export default function PatientDetailRoute() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  return <PatientDetailPage patientId={patientId ?? ''} />;
}
