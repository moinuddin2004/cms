import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { getPermissionState, requestPermission, type PermissionState } from '@/core/notifications/permissions';

/**
 * One shared copy of the OS notification permission: the Today card, the settings screen and the
 * reminder scheduler all read it, so the plan is re-synced the moment it is granted anywhere.
 */
interface PermissionStore {
  state: PermissionState | null;
  refresh: () => Promise<void>;
  request: () => Promise<void>;
}

const usePermissionStore = create<PermissionStore>((set) => ({
  state: null,
  refresh: async () => set({ state: await getPermissionState() }),
  /** Shows the OS prompt (only ever from a deliberate tap, docs/02 §8). */
  request: async () => set({ state: await requestPermission() }),
}));

/** The OS notification permission, re-read whenever the app returns to the foreground (it may have been changed in settings). */
export function useNotificationPermission() {
  const state = usePermissionStore((s) => s.state);
  const refresh = usePermissionStore((s) => s.refresh);
  const request = usePermissionStore((s) => s.request);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { state, request, refresh };
}
