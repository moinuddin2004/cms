import {
  expandImplies,
  Grant,
  normalizeGrants,
  Permission,
  PERMISSION_GROUPS,
  PermissionGroup,
  PermissionMap,
  PERMISSIONS,
  SCOPE_RANK,
} from 'src/access/catalog/permissions';
import { BundleLevel, matchBundle } from 'src/access/catalog/bundles';

/**
 * Pure guardrails for role writes (design doc "Guardrails"): no escalation
 * and a reason for high-risk grants. Kept free of Nest so they are easy to
 * test and reuse.
 */

/** `true` (unscoped) reaches as far as `org`. */
function reach(grant: Grant): number {
  return grant === true ? SCOPE_RANK.org : SCOPE_RANK[grant];
}

/**
 * Grants `after` adds or widens over `before`, implies included (granting
 * `patients.create` also grants `patients.view`). Unchanged grants are not
 * listed, so re-saving a role never trips a rule on what it already had.
 */
export function addedGrants(
  before: PermissionMap,
  after: PermissionMap,
): PermissionMap {
  const was = expandImplies(before);
  const now = expandImplies(after);
  const out: PermissionMap = {};
  for (const [key, grant] of Object.entries(now) as [Permission, Grant][]) {
    const prev = was[key];
    if (prev === undefined || reach(grant) > reach(prev)) out[key] = grant;
  }
  return out;
}

/**
 * Permissions the actor would hand out beyond their own reach: missing from
 * `actor`, or granted wider than the actor holds. `actor` is the actor's
 * resolved (implies-expanded) access.
 */
export function findEscalations(
  actor: Readonly<PermissionMap>,
  before: PermissionMap,
  after: PermissionMap,
): Permission[] {
  const added = addedGrants(before, after);
  return (Object.entries(added) as [Permission, Grant][])
    .filter(([key, grant]) => {
      const held = actor[key];
      return held === undefined || reach(grant) > reach(held);
    })
    .map(([key]) => key);
}

/** Newly granted `risk: 'high'` permissions (these need a reason). */
export function highRiskAdded(
  before: PermissionMap,
  after: PermissionMap,
): Permission[] {
  return (Object.keys(addedGrants(before, after)) as Permission[]).filter(
    (key) => PERMISSIONS[key].risk === 'high',
  );
}

/** Per module: the bundle level the grants match exactly, or null (custom). */
export function bundleSummary(
  grants: PermissionMap,
): Record<PermissionGroup, BundleLevel | null> {
  return Object.fromEntries(
    PERMISSION_GROUPS.map((g) => [g, matchBundle(g, grants)]),
  ) as Record<PermissionGroup, BundleLevel | null>;
}

/** A stored role's granted permissions (legacy booleans dropped). */
export const grantsOf = (raw: unknown): PermissionMap => normalizeGrants(raw);

/**
 * In-app path for `home_route`: starts with one `/` (so never `//host` or a
 * full URL), app-path characters only.
 */
export const HOME_ROUTE_PATTERN = /^\/(?!\/)[A-Za-z0-9\-_/$.]*$/;
