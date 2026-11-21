import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { isBelow } from '@/core/app-version';
import { createNotificationChannels } from '@/core/notifications/channels';
import { installForegroundHandler } from '@/core/notifications/foreground';
import { useSpaceStore } from '@/core/space/useSpaceStore';
import { replanPatientReminders } from '@/patient';

import { DevRouteTrace } from './DevRouteTrace';
import { entryHref } from './EntryRedirect';
import { fetchMinVersion } from './min-version';
import { useNotificationTaps } from './notification-router';
import { RootProviders } from './RootProviders';
import { UpdateRequiredPage } from './UpdateRequiredPage';

/** One check per cold start, shared by every mount (StrictMode mounts twice). */
let minVersionCheck: ReturnType<typeof fetchMinVersion> | undefined;

function checkMinVersion(): ReturnType<typeof fetchMinVersion> {
  minVersionCheck ??= fetchMinVersion();
  return minVersionCheck;
}

/**
 * The composition root (docs/02 §1–2): every global provider plus the root
 * Stack. The root only decides *which space* is active — `welcome` when none
 * has been picked, otherwise that space's group. Each space layout decides its
 * own signed-in state (docs/02 §4), so the shell never reads a space session.
 *
 * `index` and `claim/[token]` stay reachable in every state. `claim` arrives in
 * M2-14; until its route file exists the router includes it on its own, so it
 * must not be declared here.
 *
 * On every cold start it also (a) creates the Android notification channels and
 * (b) asks `GET /app/min-version`; a build below the floor is replaced by the
 * blocking X-03 screen. Both are fire-and-forget: a network error fails open.
 */
export function RootShell() {
  const activeSpace = useSpaceStore((s) => s.activeSpace);
  const entry = entryHref(activeSpace);
  useNotificationTaps();
  const [updateRequired, setUpdateRequired] = useState<{ message?: string } | null>(null);

  useEffect(() => {
    installForegroundHandler();
    void createNotificationChannels();
  }, []);

  // Keep the patient's 72 h reminder window topped up while the patient space is NOT mounted (a
  // clinician who is also a patient, or the welcome screen). It reads only the encrypted cache and
  // does nothing without a patient session; the patient space's own `ReminderSync` takes over there.
  useEffect(() => {
    if (activeSpace === 'patient') return;
    void replanPatientReminders();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void replanPatientReminders();
    });
    return () => sub.remove();
  }, [activeSpace]);

  useEffect(() => {
    let cancelled = false;

    void checkMinVersion().then((info) => {
      if (cancelled || !info) return;

      const minimum = Platform.OS === 'ios' ? info.ios : info.android;
      if (isBelow(minimum)) setUpdateRequired({ message: info.message });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RootProviders>
      {__DEV__ ? <DevRouteTrace /> : null}
      {updateRequired ? (
        <UpdateRequiredPage message={updateRequired.message} />
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          {/* `redirectTo`: a space that just closed goes straight to the new entry screen. Without
              it the router falls back to "/", which the patient home tab `(tabs)/index` also
              matches; while the patient space is guarded that bounced "/" → "/" forever
              ("Maximum update depth" on the Back button of staff login / patient sign-in). */}
          <Stack.Protected guard={activeSpace === null} redirectTo={entry}>
            <Stack.Screen name="welcome" />
          </Stack.Protected>
          <Stack.Protected guard={activeSpace === 'staff'} redirectTo={entry}>
            <Stack.Screen name="(staff)" />
          </Stack.Protected>
          <Stack.Protected guard={activeSpace === 'patient'} redirectTo={entry}>
            <Stack.Screen name="(patient)" />
          </Stack.Protected>
        </Stack>
      )}
    </RootProviders>
  );
}
