import { useLocalSearchParams } from 'expo-router';

import { ProfileDetailPage } from '@/patient/features/profiles';

export default function ProfileDetailRoute() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <ProfileDetailPage profileId={profileId ?? ''} />;
}
