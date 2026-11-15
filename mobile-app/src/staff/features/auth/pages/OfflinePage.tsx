import { View } from 'react-native';

import { ErrorState } from '@/core/components/feedback/ErrorState';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { useRestoreStaffSession } from '../hooks/useRestoreStaffSession';

/**
 * A saved session exists but the API can't be reached: keep it, offer a retry.
 * When the encrypted cache holds saved data for this phone (and the failure was a
 * network error, never a rejected session) it can also be opened read-only.
 */
export function OfflinePage() {
  const restore = useRestoreStaffSession();
  const hint = useStaffAuthStore((s) => s.offlineHint);
  const openSavedData = useStaffAuthStore((s) => s.openSavedData);
  return (
    <View className="flex-1 justify-center">
      <ErrorState
        title="Can't reach the server"
        message="Your session is saved. Check your connection and try again."
        onRetry={() => void restore()}
      />
      {hint ? (
        <View className="items-center px-6">
          <Button variant="ghost" className="min-h-11" onPress={() => openSavedData(hint)}>
            <Text>Open saved data</Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}
