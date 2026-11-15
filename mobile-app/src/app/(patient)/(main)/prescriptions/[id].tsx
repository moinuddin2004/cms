import { useLocalSearchParams } from 'expo-router';

import { PrescriptionDetailPage } from '@/patient/features/records';

export default function PrescriptionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrescriptionDetailPage id={id ?? ''} />;
}
