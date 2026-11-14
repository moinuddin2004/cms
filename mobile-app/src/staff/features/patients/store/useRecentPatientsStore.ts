import { create } from 'zustand';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

export const RECENT_PATIENTS_MAX = 10;

interface RecentPatientsState {
  /** Patient ids only, newest first. Memory only — never persisted (PHI rule). */
  ids: string[];
  push: (id: string) => void;
  clear: () => void;
}

export const useRecentPatientsStore = create<RecentPatientsState>()((set) => ({
  ids: [],
  push: (id) =>
    set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, RECENT_PATIENTS_MAX) })),
  clear: () => set({ ids: [] }),
}));

/**
 * Forget the list on sign-out and whenever the clinic or location changes — a
 * recently-opened id from another place must never show here.
 */
useStaffAuthStore.subscribe((state, prev) => {
  if (
    state.status !== 'signedIn' ||
    state.activeOrganizationId !== prev.activeOrganizationId ||
    state.activeLocationId !== prev.activeLocationId
  ) {
    useRecentPatientsStore.getState().clear();
  }
});
