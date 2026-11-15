import { useLocalSearchParams } from 'expo-router';

import { ClaimLinkPage } from '@/patient/features/claims';

export default function ClaimTokenRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <ClaimLinkPage token={token} />;
}
