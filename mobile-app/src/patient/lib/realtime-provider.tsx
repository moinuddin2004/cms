import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { PatientRealtime } from './realtime';
import { createPatientInvalidator } from './realtime-invalidation';

const RealtimeContext = createContext<PatientRealtime | null>(null);

/**
 * Owns the `/patient-realtime` socket for the signed-in patient layout. Mounted by
 * `PatientMainLayout`, so a signed-out or inactive space holds no socket.
 */
export function PatientRealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [client] = useState(() => {
    const invalidator = createPatientInvalidator(queryClient);
    const realtime = new PatientRealtime({
      getToken: () => usePatientAuthStore.getState().accessToken,
      invalidator,
    });
    return { realtime, invalidator };
  });

  useEffect(() => {
    const { realtime, invalidator } = client;
    realtime.connect();
    const detach = realtime.attachAppLifecycle();
    return () => {
      detach();
      realtime.dispose();
      invalidator.dispose();
    };
  }, [client]);

  return <RealtimeContext.Provider value={client.realtime}>{children}</RealtimeContext.Provider>;
}

/** The socket controller, or `null` outside the provider (screens then simply poll). */
function useRealtime(): PatientRealtime | null {
  return useContext(RealtimeContext);
}

const NEVER = () => () => undefined;
const FALSE = () => false;

/** True only while the socket is connected and the server accepted our subscriptions. */
export function useRealtimeLive(): boolean {
  const realtime = useRealtime();
  return useSyncExternalStore(realtime?.subscribe ?? NEVER, realtime?.isLive ?? FALSE);
}

/** Watch these queue entries while the caller is mounted. */
export function useWatchEntries(entryIds: readonly string[]): void {
  const realtime = useRealtime();
  const key = entryIds.join(',');
  useEffect(() => {
    if (!realtime || !key) return;
    const leaves = key.split(',').map((id) => realtime.watchEntry(id));
    return () => leaves.forEach((leave) => leave());
  }, [realtime, key]);
}
