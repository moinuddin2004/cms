import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/core/components';
import { useT } from '@/core/i18n';
import { reportError } from '@/core/observability';

/**
 * Expo Router's root error boundary: a render crash anywhere below shows a
 * retry screen instead of a white screen, and is reported through the PHI-safe
 * seam (A-24) — the error's name/message pass the scrubber, never props or state.
 */
export function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useT();

  useEffect(() => {
    reportError(error, { source: 'boundary' });
  }, [error]);

  return (
    <View className="bg-background flex-1 justify-center">
      <ErrorState
        title={t('common.crashTitle')}
        message={t('common.crashBody')}
        retryLabel={t('common.retry')}
        onRetry={() => void retry()}
      />
    </View>
  );
}
