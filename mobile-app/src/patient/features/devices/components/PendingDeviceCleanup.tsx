import { useEffect } from 'react';

import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { finishPendingUnregister } from '../lib/device-registration';

/** Mounted in the patient layout: once signed out on start, finishes an unregister that was left pending. */
export function PendingDeviceCleanup() {
  const signedOut = usePatientAuthStore((s) => s.status === 'signedOut');
  useEffect(() => {
    if (signedOut) void finishPendingUnregister();
  }, [signedOut]);
  return null;
}
