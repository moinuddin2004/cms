import { useEffect } from 'react';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { finishPendingUnregister } from '../lib/device-registration';

/** Mounted in the staff layout: once signed out, finishes an unregister that was left pending (audit M4). */
export function PendingDeviceCleanup() {
  const signedOut = useStaffAuthStore((s) => s.status === 'signedOut');
  useEffect(() => {
    if (signedOut) void finishPendingUnregister();
  }, [signedOut]);
  return null;
}
