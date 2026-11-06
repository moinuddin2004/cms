import { Stack } from 'expo-router';

import { AccessProvider } from '@/features/access';

/** Everything behind sign-in + a chosen location. */
export default function AppLayout() {
  return (
    <AccessProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AccessProvider>
  );
}
