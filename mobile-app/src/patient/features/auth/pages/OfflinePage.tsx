import { View } from 'react-native';

import { ErrorState } from '@/core/components/feedback/ErrorState';
import { useT } from '@/core/i18n';
import { switchSpace } from '@/core/space/switch-space';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

import { useRestorePatientSession } from '../hooks/useRestorePatientSession';
import { useSignOutPatient } from '../hooks/useSignOutPatient';
import { useStaffSessionAvailable } from '../hooks/useStaffSessionAvailable';

/**
 * A saved session exists but the API can't be reached: keep it, offer a retry.
 * The user is never trapped here: they can switch to the staff space (only when
 * it has a session) or sign out.
 */
export function OfflinePage() {
  const { t } = useT();
  const restore = useRestorePatientSession();
  const signOut = useSignOutPatient();
  const staffAvailable = useStaffSessionAvailable();

  return (
    <View className="bg-background flex-1 justify-center py-safe">
      <ErrorState
        title={t('offline.title')}
        message={t('offline.body')}
        retryLabel={t('common.retry')}
        onRetry={() => void restore()}
      />
      <View className="items-center gap-2 px-6">
        {staffAvailable ? (
          <Button variant="ghost" onPress={() => switchSpace('staff')}>
            <Text>{t('home.switchToStaff')}</Text>
          </Button>
        ) : null}
        <Button variant="ghost" disabled={signOut.isPending} onPress={() => signOut.mutate()}>
          <Text className="text-destructive">{t('common.signOut')}</Text>
        </Button>
      </View>
    </View>
  );
}
