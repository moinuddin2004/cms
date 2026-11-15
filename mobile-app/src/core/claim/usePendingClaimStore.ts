import { create } from 'zustand';

/** A claim token lives 15 minutes on the server; the app forgets it at the same age. */
export const PENDING_CLAIM_MAX_AGE_MS = 15 * 60 * 1000;

interface PendingClaimState {
  /** The claim token waiting for a signed-in patient. Memory only — it is a bearer secret. */
  token: string | null;
  /** When it was stored (epoch ms). */
  savedAt: number | null;
  set: (token: string, now?: number) => void;
  clear: () => void;
  /** Drop the token when it is older than 15 minutes. Returns whether one is still pending. */
  dropIfStale: (now?: number) => boolean;
}

/**
 * Survives the sign-in detour (docs/06 P-01): the deep link stores the token, the
 * patient signs in, then the main layout sends them to the confirm page. Never
 * persisted: a killed app simply asks for a new QR.
 */
export const usePendingClaimStore = create<PendingClaimState>()((set, get) => ({
  token: null,
  savedAt: null,
  set: (token, now = Date.now()) => set({ token, savedAt: now }),
  clear: () => set({ token: null, savedAt: null }),
  dropIfStale: (now = Date.now()) => {
    const { token, savedAt } = get();
    if (token === null) return false;
    if (savedAt === null || now - savedAt > PENDING_CLAIM_MAX_AGE_MS) {
      set({ token: null, savedAt: null });
      return false;
    }
    return true;
  },
}));

/** Selector helper: the stored token, or `null` when none or older than 15 minutes (read-time check, no write). */
export const freshPendingToken = (s: Pick<PendingClaimState, 'token' | 'savedAt'>, now = Date.now()): string | null =>
  s.token !== null && s.savedAt !== null && now - s.savedAt <= PENDING_CLAIM_MAX_AGE_MS ? s.token : null;
