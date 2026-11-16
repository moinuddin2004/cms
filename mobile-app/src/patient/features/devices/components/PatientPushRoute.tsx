import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { hrefOf, resolvePatientPushRoute } from '../lib/push-route';
import {
  PENDING_TAP_MAX_AGE_MS,
  usePatientPushRouteStore,
} from '../store/usePatientPushRouteStore';

/** Mounted in the signed-in patient layout: opens the screen of a tapped push, once. */
export function PatientPushRoute() {
  const router = useRouter();
  const pending = usePatientPushRouteStore((s) => s.pending);

  useEffect(() => {
    if (!pending) return;
    usePatientPushRouteStore.getState().clear();
    if (Date.now() - pending.at > PENDING_TAP_MAX_AGE_MS) return;
    const route = resolvePatientPushRoute(pending.data);
    if (route) router.push(hrefOf(route) as Href);
  }, [pending, router]);

  return null;
}
