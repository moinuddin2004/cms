import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { toast } from 'sonner-native';

import {
  deriveConnectionState,
  type ConnectionState,
} from '@/core/components/feedback/connection-state';
import { useOnline } from '@/core/network';
import { refreshSession } from '@/staff/lib/api';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { StaffRealtime } from './realtime';
import { createRealtimeInvalidator } from './realtime-invalidation';

const RealtimeContext = createContext<StaffRealtime | null>(null);

/** The notifications screen shows new items itself, so no toast there. */
export function isNotificationsPath(pathname: string): boolean {
  return /(^|\/)notifications(\/|$)/.test(pathname);
}

/** Org-wide room: always joined while signed in to a clinic. */
export const orgRoom = (orgId: string) => `org:${orgId}`;

/**
 * Owns the staff `/realtime` socket for the signed-in, location-selected
 * part of the app (mounted by `StaffMainLayout`, so an inactive space or a
 * signed-out user holds no socket). Realtime only invalidates queries.
 */
export function StaffRealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [client] = useState(() => {
    const invalidator = createRealtimeInvalidator(queryClient);
    const realtime = new StaffRealtime({
      getToken: () => useStaffAuthStore.getState().accessToken,
      refreshSession,
      invalidator,
    });
    return { realtime, invalidator };
  });

  // Re-bound when the route changes so the toast knows whether the inbox is open.
  useEffect(() => {
    client.realtime.setOnNotification((e) => {
      if (AppState.currentState !== 'active') return;
      if (isNotificationsPath(pathname)) return;
      // Title only: the body can carry patient details (docs/03).
      const active = useStaffAuthStore.getState().activeOrganizationId;
      const otherClinic = Boolean(e.organizationId && active && e.organizationId !== active);
      toast(e.title || 'New notification', {
        ...(e.id ? { id: `notification-${e.id}` } : {}),
        ...(otherClinic ? { description: 'Another clinic' } : {}),
      });
    });
  }, [client, pathname]);

  useEffect(() => {
    const { realtime, invalidator } = client;
    realtime.connect();
    const detachLifecycle = realtime.attachAppLifecycle();
    // No token-driven reconnect: the socket's `auth` callback reads the fresh token on
    // every handshake, and `auth_error` refreshes + reconnects once.
    return () => {
      detachLifecycle();
      realtime.dispose();
      invalidator.dispose();
    };
  }, [client]);

  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  return (
    <RealtimeContext.Provider value={client.realtime}>
      <OrgRoom orgId={orgId} />
      {children}
    </RealtimeContext.Provider>
  );
}

function OrgRoom({ orgId }: { orgId: string | null }) {
  useRoomSubscription(orgId ? orgRoom(orgId) : null);
  return null;
}

function useRealtime(): StaffRealtime {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime* must be used inside StaffRealtimeProvider');
  return ctx;
}

/** `live | reconnecting | offline` — no network is "offline", a down socket "reconnecting". */
export function useRealtimeStatus(): ConnectionState {
  const realtime = useRealtime();
  const online = useOnline();
  const realtimeConnected = useSyncExternalStore(realtime.subscribe, realtime.isConnected);
  return deriveConnectionState({ online, realtimeConnected });
}

/**
 * Join `room` while the caller is mounted (`null` = none). Rooms are
 * re-joined after a reconnect, and left + re-joined whenever the active
 * organization or location changes (the server authorises a room per
 * org/location at subscribe time).
 */
export function useRoomSubscription(room: string | null): void {
  const realtime = useRealtime();
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);

  useEffect(() => {
    if (!room) return;
    return realtime.joinRoom(room);
    // orgId / locationId are deliberate re-run triggers (see above).
  }, [realtime, room, orgId, locationId]);
}
