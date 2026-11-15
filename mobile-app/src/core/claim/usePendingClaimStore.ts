import { create } from 'zustand';

interface PendingClaimState {
  /** The claim token waiting for a signed-in patient. Memory only — it is a bearer secret. */
  token: string | null;
  set: (token: string) => void;
  clear: () => void;
}

/**
 * Survives the sign-in detour (docs/06 P-01): the deep link stores the token, the
 * patient signs in, then the main layout sends them to the confirm page. Never
 * persisted: a killed app simply asks for a new QR (it lives 15 minutes anyway).
 */
export const usePendingClaimStore = create<PendingClaimState>()((set) => ({
  token: null,
  set: (token) => set({ token }),
  clear: () => set({ token: null }),
}));
