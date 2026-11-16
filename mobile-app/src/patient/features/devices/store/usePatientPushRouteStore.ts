import { create } from 'zustand';

import type { PushData } from '@/core/notifications/push-data';

/** A tap older than this is dropped: the user has moved on (or another person signed in). */
export const PENDING_TAP_MAX_AGE_MS = 2 * 60_000;

interface State {
  pending: { data: PushData; at: number } | null;
  setPending: (data: PushData, now?: number) => void;
  clear: () => void;
}

/**
 * Bridge between "a push was tapped" (any time, even before the patient session is restored) and
 * `PatientPushRoute`, mounted in the signed-in layout. Routing ids only; memory only.
 */
export const usePatientPushRouteStore = create<State>()((set) => ({
  pending: null,
  setPending: (data, now = Date.now()) => set({ pending: { data, at: now } }),
  clear: () => set({ pending: null }),
}));
