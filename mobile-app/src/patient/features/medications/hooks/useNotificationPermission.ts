import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getPermissionState, requestPermission, type PermissionState } from '@/core/notifications/permissions';

/** The OS notification permission, re-read whenever the app returns to the foreground (the user may have changed it in settings). */
export function useNotificationPermission() {
  const [state, setState] = useState<PermissionState | null>(null);

  const refresh = useCallback(() => getPermissionState().then(setState), []);

  useEffect(() => {
    let alive = true;
    void getPermissionState().then((s) => {
      if (alive) setState(s);
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [refresh]);

  /** Shows the OS prompt (only ever from a deliberate tap, docs/02 §8). */
  const request = useCallback(async () => setState(await requestPermission()), []);

  return { state, request, refresh };
}
