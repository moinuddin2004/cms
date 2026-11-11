import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { CircleArrowUp } from 'lucide-react-native';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { markReady } from '@/core/splash';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

interface UpdateRequiredPageProps {
  /** Optional line from the backend (`MOBILE_MIN_VERSION_MESSAGE`). */
  message?: string;
}

/**
 * Store URL for the Update button. Android uses the application id from the
 * installed build, so a `.dev` / `.preview` build links to its own listing.
 *
 * iOS has no numeric App Store id yet — decision O-01 fixes the identity, and
 * the listing URL is added with the first TestFlight build (M4).
 */
function storeUrl(): string {
  if (Platform.OS === 'ios') return 'https://apps.apple.com/';

  const applicationId = Application.applicationId ?? 'com.placeholder.clinicapp';
  return `https://play.google.com/store/apps/details?id=${applicationId}`;
}

/**
 * X-03 "Update required" (docs/06): blocking screen shown when
 * `GET /app/min-version` says this build is below the supported floor
 * (docs/02 §11). There is no way past it — the API is likely to reject this
 * build as well.
 */
export function UpdateRequiredPage({ message }: UpdateRequiredPageProps) {
  useEffect(() => {
    markReady();
  }, []);

  function openStore(): void {
    void WebBrowser.openBrowserAsync(storeUrl());
  }

  return (
    <View className="bg-background flex-1 items-center justify-center gap-4 px-6 py-safe">
      <View className="bg-primary/10 size-16 items-center justify-center rounded-full">
        <Icon as={CircleArrowUp} className="text-primary size-8" />
      </View>
      <Text variant="h2" className="border-0 pb-0 text-center">
        Update required
      </Text>
      <Text variant="muted" className="text-center">
        {message ?? 'This version of the app is no longer supported. Please update to continue.'}
      </Text>
      <Button size="lg" className="mt-2 min-w-40" onPress={openStore}>
        <Text>Update</Text>
      </Button>
    </View>
  );
}
