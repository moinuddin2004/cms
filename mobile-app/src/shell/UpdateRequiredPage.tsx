import * as Application from 'expo-application';
import { CircleArrowUp } from 'lucide-react-native';
import { useEffect } from 'react';
import { Linking, Platform, View } from 'react-native';

import { markReady } from '@/core/splash';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

interface UpdateRequiredPageProps {
  /** Optional line from the backend (`MOBILE_MIN_VERSION_MESSAGE`). */
  message?: string;
}

/** iOS App Store listing. Placeholder until O-01 / M4 (first TestFlight build). */
const IOS_APP_STORE_URL = 'https://apps.apple.com/';

/**
 * Store targets for the Update button, preferred first. Android uses the
 * application id of the installed build, so a `.dev` / `.preview` build points
 * at its own listing; `market://` opens the Play app, https is the fallback.
 */
function storeUrls(): string[] {
  if (Platform.OS === 'ios') return [IOS_APP_STORE_URL];

  const applicationId = Application.applicationId ?? 'com.placeholder.clinicapp';
  return [
    `market://details?id=${applicationId}`,
    `https://play.google.com/store/apps/details?id=${applicationId}`,
  ];
}

async function openStore(): Promise<void> {
  for (const url of storeUrls()) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try the next target
    }
  }
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
      <Button size="lg" className="mt-2 min-w-40" onPress={() => void openStore()}>
        <Text>Update</Text>
      </Button>
    </View>
  );
}
