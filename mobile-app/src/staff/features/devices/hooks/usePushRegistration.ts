import { useCallback, useEffect, useState } from 'react';

import { getPermissionState, requestPermission } from '@/core/notifications/permissions';
import { getPref, setPref } from '@/core/storage/prefs';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { registerThisDevice } from '../lib/device-registration';

/**
 * Push opt-in for the signed-in staff layout (card M1-05 step 3):
 * - permission already granted → register this phone (every mount; the API upserts by token)
 * - never asked → open our explanation sheet ONCE; only its "Turn on" button shows the OS prompt
 * - denied → nothing (the user can re-enable in the phone's settings)
 *
 * Re-runs when a different user signs in, so the new account registers the phone too.
 */
export function usePushRegistration() {
  const userId = useStaffAuthStore((s) => s.user?.uuid ?? null);
  const offlineSnapshot = useStaffAuthStore((s) => s.offlineSnapshot);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    // Saved-data mode has no session: register when it recovers (flag is a dep).
    if (!userId || offlineSnapshot) return;
    let live = true;
    void (async () => {
      const state = await getPermissionState();
      if (!live) return;
      if (state === 'granted') {
        await registerThisDevice();
      } else if (state === 'undetermined' && getPref('staff.push.asked') === undefined) {
        setSheetOpen(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId, offlineSnapshot]);

  const dismiss = useCallback(() => {
    setPref('staff.push.asked', '1');
    setSheetOpen(false);
  }, []);

  const enable = useCallback(async () => {
    dismiss();
    if ((await requestPermission()) === 'granted') await registerThisDevice();
  }, [dismiss]);

  return { sheetOpen, enable, dismiss };
}
