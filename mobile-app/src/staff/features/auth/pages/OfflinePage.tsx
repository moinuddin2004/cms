import { ErrorState } from '@/core/components/feedback/ErrorState';

import { useRestoreStaffSession } from '../hooks/useRestoreStaffSession';

/** A saved session exists but the API can't be reached: keep it, offer a retry. */
export function OfflinePage() {
  const restore = useRestoreStaffSession();
  return (
    <ErrorState
      title="Can't reach the server"
      message="Your session is saved. Check your connection and try again."
      onRetry={() => void restore()}
    />
  );
}
