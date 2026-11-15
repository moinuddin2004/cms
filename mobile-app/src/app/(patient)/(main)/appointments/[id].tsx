import { useLocalSearchParams } from 'expo-router';

import { AppointmentDetailPage } from '@/patient/features/records';

export default function AppointmentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AppointmentDetailPage id={id ?? ''} />;
}
