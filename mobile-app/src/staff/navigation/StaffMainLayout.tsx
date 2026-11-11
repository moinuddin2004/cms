import { Stack } from 'expo-router';

import { AccessProvider } from '@/staff/features/access';
import { BrandTheme } from '@/staff/features/theme';

/**
 * Everything behind sign-in and a chosen location (docs/02 §4). The access
 * query (and later realtime + push) lives here, never in the root: an
 * inactive space must not run them. `BrandTheme` fetches the clinic colour
 * here too, so it applies only to signed-in screens.
 */
export function StaffMainLayout() {
  return (
    <AccessProvider>
      <BrandTheme />
      <Stack screenOptions={{ headerShown: false }} />
    </AccessProvider>
  );
}
