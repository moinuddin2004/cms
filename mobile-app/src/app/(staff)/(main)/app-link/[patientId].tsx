import { useLocalSearchParams } from 'expo-router';

import { AppLinkPage } from '@/staff/features/app-link';

export default function AppLinkRoute() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  return <AppLinkPage patientId={patientId ?? ''} />;
}
