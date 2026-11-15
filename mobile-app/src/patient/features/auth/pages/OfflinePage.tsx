import { ErrorState } from '@/core/components/feedback/ErrorState';
import { useT } from '@/core/i18n';

import { useRestorePatientSession } from '../hooks/useRestorePatientSession';

/** A saved session exists but the API can't be reached: keep it, offer a retry. */
export function OfflinePage() {
  const { t } = useT();
  const restore = useRestorePatientSession();
  return (
    <ErrorState
      title={t('offline.title')}
      message={t('offline.body')}
      onRetry={() => void restore()}
    />
  );
}
