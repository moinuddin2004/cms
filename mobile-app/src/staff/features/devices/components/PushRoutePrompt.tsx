import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { ConfirmDialog } from '@/core/components';
import { useAccess } from '@/staff/features/access';
import { useSwitchLocation } from '@/staff/features/more';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { decidePushRoute } from '../lib/push-route';
import { isFresh, usePushRouteStore } from '../store/usePushRouteStore';

/**
 * Acts on a tapped push (warm or cold start) once the signed-in layout is up: navigates, or asks
 * "Switch to <location>?" first when the push is for another location (docs/02 §8). Taps that go
 * stale (> 2 min) or that the user cannot open are dropped silently.
 */
export function PushRoutePrompt() {
  const router = useRouter();
  const switchLocation = useSwitchLocation();
  const pending = usePushRouteStore((s) => s.pending);
  const ask = usePushRouteStore((s) => s.ask);
  const accessReady = useAccess().status === 'ready';
  const status = useStaffAuthStore((s) => s.status);
  const organizations = useStaffAuthStore((s) => s.accessibleOrganizations);
  const activeOrganizationId = useStaffAuthStore((s) => s.activeOrganizationId);
  const activeLocationId = useStaffAuthStore((s) => s.activeLocationId);

  useEffect(() => {
    if (!pending) return;
    const { clear, consume, setAsk } = usePushRouteStore.getState();
    if (!isFresh(pending)) {
      clear();
      return;
    }
    const decision = decidePushRoute(pending.data, {
      status,
      accessReady,
      organizations,
      activeOrganizationId,
      activeLocationId,
    });
    if (decision.kind === 'wait') return;
    if (decision.kind === 'ignore') {
      clear();
      return;
    }
    consume();
    if (decision.kind === 'navigate') {
      router.navigate(decision.route as Href);
    } else if (decision.kind === 'switch') {
      setAsk(decision);
    }
  }, [pending, status, accessReady, organizations, activeOrganizationId, activeLocationId, router]);

  const confirm = async () => {
    if (!ask) return;
    // Rejects on failure (the hook already toasted) so the dialog stays open for a retry.
    await switchLocation.mutateAsync({
      organizationId: ask.organizationId,
      locationId: ask.locationId,
    });
    router.navigate(ask.route as Href);
  };

  return (
    <ConfirmDialog
      open={ask !== null}
      onClose={() => usePushRouteStore.getState().setAsk(null)}
      title={ask ? `Switch to ${ask.locationName}?` : 'Switch location?'}
      description="This alert is for another location. Switching changes the place you are working in."
      confirmLabel="Switch"
      cancelLabel="Cancel"
      onConfirm={confirm}
    />
  );
}
