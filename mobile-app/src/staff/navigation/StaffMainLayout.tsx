import { Stack } from 'expo-router';

import { AccessProvider } from '@/staff/features/access';
import { PushRegistration, PushRoutePrompt } from '@/staff/features/devices';
import { BrandTheme } from '@/staff/features/theme';
import { StaffRealtimeProvider } from '@/staff/lib/realtime-provider';

/**
 * Everything behind sign-in and a chosen location (docs/02 §4). The access
 * query and the realtime socket (later push) live here, never in the root: an
 * inactive space must not run them. `BrandTheme` fetches the clinic colour
 * here too, so it applies only to signed-in screens.
 */
export function StaffMainLayout() {
  return (
    <AccessProvider>
      <StaffRealtimeProvider>
        <BrandTheme />
        <PushRegistration />
        <PushRoutePrompt />
        <Stack screenOptions={{ headerShown: false }} />
      </StaffRealtimeProvider>
    </AccessProvider>
  );
}
