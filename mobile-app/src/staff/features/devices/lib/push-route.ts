import type { PushData } from '@/core/notifications/push-data';
import { resolveStaffLink, type StaffRoute } from '@/staff/lib/link-router';
import type { Organization, SessionStatus } from '@/staff/store/useStaffAuthStore';

/** Where a tap with no usable `route` lands: the Today tab. */
export const DEFAULT_PUSH_ROUTE: StaffRoute = { pathname: '/today' };

export interface PushRouteContext {
  status: SessionStatus;
  organizations: Organization[];
  activeOrganizationId: string | null;
  activeLocationId: string | null;
}

export type PushRouteDecision =
  /** Session not ready yet (restoring / unreachable / no location): keep the tap, decide again later. */
  | { kind: 'wait' }
  /** Not ours to act on: signed out, unknown clinic or location for this user, or not a staff push. */
  | { kind: 'ignore' }
  | { kind: 'navigate'; route: StaffRoute }
  /** The push is for another location: ask first (docs/02 §8). */
  | {
      kind: 'switch';
      route: StaffRoute;
      organizationId: string;
      locationId: string;
      locationName: string;
    };

/**
 * Decides what a tapped staff push does. Pure. The payload only picks a screen: the clinic and
 * location it names must be ones the signed-in user can open, and the screen itself still enforces
 * access (docs/03 §2.4).
 */
export function decidePushRoute(data: PushData, ctx: PushRouteContext): PushRouteDecision {
  if (data.space !== 'staff') return { kind: 'ignore' };
  if (ctx.status === 'signedOut') return { kind: 'ignore' };
  if (ctx.status !== 'signedIn' || !ctx.activeOrganizationId || !ctx.activeLocationId) {
    return { kind: 'wait' };
  }

  const route = resolveStaffLink(data.route) ?? DEFAULT_PUSH_ROUTE;
  const orgId = data.organizationId ?? ctx.activeOrganizationId;
  const locationId = data.locationId ?? ctx.activeLocationId;
  if (orgId === ctx.activeOrganizationId && locationId === ctx.activeLocationId) {
    return { kind: 'navigate', route };
  }

  const org = ctx.organizations.find((o) => o.id === orgId && !o.signInBlock);
  const location = org?.locations.find((l) => l.id === locationId);
  if (!org || !location) return { kind: 'ignore' };
  return {
    kind: 'switch',
    route,
    organizationId: org.id,
    locationId: location.id,
    locationName: `${org.name} – ${location.name}`,
  };
}
