import { Stack } from 'expo-router';

import { AccessProvider } from '@/staff/features/access';

/**
 * Everything behind sign-in and a chosen location (docs/02 §4). The access
 * query (and later realtime + push) lives here, never in the root: an
 * inactive space must not run them.
 */
export function StaffMainLayout() {
  return (
    <AccessProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AccessProvider>
  );
}
