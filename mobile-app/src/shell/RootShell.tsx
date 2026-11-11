import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isBelow } from '@/core/app-version';
import { createNotificationChannels } from '@/core/notifications/channels';
import { useSpaceStore } from '@/core/space/useSpaceStore';

import { fetchMinVersion } from './min-version';
import { RootProviders } from './RootProviders';
import { UpdateRequiredPage } from './UpdateRequiredPage';

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
  const [updateRequired, setUpdateRequired] = useState<{ message?: string } | null>(null);

  useEffect(() => {
    void createNotificationChannels();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchMinVersion().then((info) => {
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
      {updateRequired ? (
        <UpdateRequiredPage message={updateRequired.message} />
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Protected guard={activeSpace === null}>
            <Stack.Screen name="welcome" />
          </Stack.Protected>
          <Stack.Protected guard={activeSpace === 'staff'}>
            <Stack.Screen name="(staff)" />
          </Stack.Protected>
          <Stack.Protected guard={activeSpace === 'patient'}>
            <Stack.Screen name="(patient)" />
          </Stack.Protected>
        </Stack>
      )}
    </RootProviders>
  );
}
