import { create } from 'zustand';

import type { PushData } from '@/core/notifications/push-data';
import type { StaffRoute } from '@/staff/lib/link-router';

/** A tap older than this is dropped: the user has moved on (or another person signed in). */
export const PENDING_TAP_MAX_AGE_MS = 2 * 60_000;

export interface PendingTap {
  data: PushData;
  at: number;
}

/** A tap for another location, waiting for the user's "Switch to <location>?" answer. */
export interface PendingSwitch {
  organizationId: string;
  locationId: string;
  locationName: string;
  route: StaffRoute;
}

interface PushRouteState {
  pending: PendingTap | null;
  /** A tap was acted on this launch; StaffTabs reads it once to skip its first-tab placement. */
  handled: boolean;
  ask: PendingSwitch | null;
  setAsk: (ask: PendingSwitch | null) => void;
  /** Remember a tapped push until the signed-in staff layout can act on it. */
  setPending: (data: PushData, now?: number) => void;
  clear: () => void;
  /** Drop the pending tap AND remember it was acted on (navigated or asked). */
  consume: () => void;
}

/**
 * Bridge between "a push was tapped" (any time, even before the staff session is restored) and
 * the component that acts on it (`PushRoutePrompt`, mounted in the signed-in layout). Holds only the
 * routing ids from the push payload; memory only.
 */
export const usePushRouteStore = create<PushRouteState>()((set) => ({
  pending: null,
  handled: false,
  ask: null,
  setAsk: (ask) => set({ ask }),
  setPending: (data, now = Date.now()) => set({ pending: { data, at: now } }),
  clear: () => set({ pending: null }),
  consume: () => set({ pending: null, handled: true }),
}));

export function isFresh(tap: PendingTap, now = Date.now()): boolean {
  return now - tap.at <= PENDING_TAP_MAX_AGE_MS;
}

/**
 * For StaffTabs, once access is ready: true when a push route is waiting or was just handled, so the
 * tabs must not jump to the first allowed tab over it. Resets the handled flag (one read per launch).
 */
export function takePushRouteHandled(): boolean {
  const { pending, handled } = usePushRouteStore.getState();
  if (handled) usePushRouteStore.setState({ handled: false });
  return handled || pending !== null;
}
