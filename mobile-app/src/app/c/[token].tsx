import { useLocalSearchParams } from 'expo-router';

import { ClaimLinkPage } from '@/patient/features/claims';

/** The clinic's web link shape (`/c/<token>`), for when it is opened as a universal link. Same page as `claim/[token]`. */
export default function ClaimShortTokenRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <ClaimLinkPage token={token} />;
}
