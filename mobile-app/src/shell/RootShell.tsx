import { Stack } from 'expo-router';

import { useSpaceStore } from '@/core/space/useSpaceStore';

import { RootProviders } from './RootProviders';

/**
 * The composition root (docs/02 §1–2): every global provider plus the root
 * Stack. The root only decides *which space* is active — `welcome` when none
 * has been picked, otherwise that space's group. Each space layout decides its
 * own signed-in state (docs/02 §4), so the shell never reads a space session.
 *
 * `index` and `claim/[token]` stay reachable in every state. `claim` arrives in
 * M2-14; until its route file exists the router includes it on its own, so it
 * must not be declared here.
 */
export function RootShell() {
  const activeSpace = useSpaceStore((s) => s.activeSpace);

  return (
    <RootProviders>
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
    </RootProviders>
  );
}
