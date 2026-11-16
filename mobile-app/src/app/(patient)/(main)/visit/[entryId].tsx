import { useLocalSearchParams } from 'expo-router';

import { VisitPage } from '@/patient/features/queue';

export default function VisitRoute() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return <VisitPage entryId={entryId ?? ''} />;
}
