import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { parseClaimParam } from '@/core/claim/claim-token';
import { usePendingClaimStore } from '@/core/claim/usePendingClaimStore';
import { ErrorState } from '@/core/components';
import { useT } from '@/core/i18n';
import { switchSpace } from '@/core/space/switch-space';
import { useSpaceStore } from '@/core/space/useSpaceStore';

/**
 * Landing of the claim deep link (`claim/[token]`, docs/06 P-01): check the
 * token's shape, keep it in memory, make the patient space active and hand over
 * to the entry route. The patient layout then signs the patient in if needed and
 * the main layout opens the confirm page. The token never reaches a log or URL
 * beyond this one route param.
 */
export function ClaimLinkPage({ token }: { token: string | string[] | undefined }) {
  const { t } = useT();
  const valid = parseClaimParam(token);
  const stored = usePendingClaimStore((s) => s.token);
  const activeSpace = useSpaceStore((s) => s.activeSpace);

  useEffect(() => {
    if (!valid) return;
    usePendingClaimStore.getState().set(valid);
    switchSpace('patient');
  }, [valid]);

  if (!valid) {
    return (
      <View className="bg-background py-safe flex-1 justify-center px-6">
        <ErrorState
          title={t('claim.invalid.title')}
          message={t('claim.invalid.body')}
          retryLabel={t('claim.invalid.action')}
          onRetry={() => switchSpace(null)}
        />
      </View>
    );
  }

  return stored === valid && activeSpace === 'patient' ? <Redirect href="/" /> : null;
}
