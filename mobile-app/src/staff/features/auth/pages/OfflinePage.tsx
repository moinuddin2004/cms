import { ErrorState } from '@/core/components/feedback/ErrorState';

import { useRestoreSession } from '../hooks/useRestoreSession';

/** A saved session exists but the API can't be reached: keep it, offer a retry. */
export function OfflinePage() {
  const restore = useRestoreSession();
  return (
    <ErrorState
      title="Can't reach the server"
      message="Your session is saved. Check your connection and try again."
      onRetry={() => void restore()}
    />
  );
}
