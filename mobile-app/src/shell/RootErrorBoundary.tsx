import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/core/components';
import { translate, UrduFontScope, useT } from '@/core/i18n';
import { reportError } from '@/core/observability';
import { useSpaceStore } from '@/core/space/useSpaceStore';

/**
 * Expo Router's root error boundary: a render crash anywhere below shows a
 * retry screen instead of a white screen, and is reported through the PHI-safe
 * seam (A-24) — the error's name/message pass the scrubber, never props or state.
 */
export function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { locale } = useT();
  const patient = useSpaceStore((s) => s.activeSpace) === 'patient';
  // Staff and the pre-space picker stay English; only the patient space follows the phone locale.
  const t = (key: 'common.crashTitle' | 'common.crashBody' | 'common.retry') =>
    translate(key, undefined, patient ? locale : 'en');

  useEffect(() => {
    reportError(error, { source: 'boundary' });
  }, [error]);

  const body = (
    <View className="bg-background flex-1 justify-center">
      <ErrorState
        title={t('common.crashTitle')}
        message={t('common.crashBody')}
        retryLabel={t('common.retry')}
        onRetry={() => void retry()}
      />
    </View>
  );
  return patient ? <UrduFontScope>{body}</UrduFontScope> : body;
}
