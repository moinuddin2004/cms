import { useCallback, useEffect, useState } from 'react';

import { getPermissionState, requestPermission } from '@/core/notifications/permissions';
import { getPref, setPref } from '@/core/storage/prefs';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { registerThisDevice } from '../lib/device-registration';

/**
 * Push opt-in for the signed-in patient layout (same flow as staff M1-05):
 * - permission granted → register this phone (every mount; the API upserts by token)
 * - never asked → open our explanation sheet ONCE; only its "Turn on" button shows the OS prompt
 * - denied → nothing (the phone's settings can re-enable it)
 * Re-runs when a different account signs in.
 */
export function usePatientPushRegistration() {
  const accountId = usePatientAuthStore((s) => s.account?.id ?? null);
  const signedIn = usePatientAuthStore((s) => s.status === 'signedIn');
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!accountId || !signedIn) return;
    let live = true;
    void (async () => {
      const state = await getPermissionState();
      if (!live) return;
      if (state === 'granted') {
        await registerThisDevice();
      } else if (state === 'undetermined' && getPref('patient.push.asked') === undefined) {
        setSheetOpen(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [accountId, signedIn]);

  const dismiss = useCallback(() => {
    setPref('patient.push.asked', '1');
    setSheetOpen(false);
  }, []);

  const enable = useCallback(async () => {
    dismiss();
    if ((await requestPermission()) === 'granted') await registerThisDevice();
  }, [dismiss]);

  return { sheetOpen, enable, dismiss };
}
