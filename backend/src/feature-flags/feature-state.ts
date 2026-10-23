import type { FeatureCatalog } from './entities/feature-catalog.entity';
import type { OrgFeatureFlag } from './entities/org-feature-flag.entity';

/** Why the owner cannot switch a feature on. */
export type FeatureLockedReason = 'not_entitled' | 'trial_expired';

/** One feature's resolved state for an org. */
export interface FeatureState {
  entitled: boolean;
  enabled: boolean;
  /** entitled ∧ enabled (the catalog entry is active by construction). */
  active: boolean;
  entitledUntil: Date | null;
  lockedReason: FeatureLockedReason | null;
}

export type FlagRow = Pick<OrgFeatureFlag, 'featureKey' | 'isEnabled'> &
  Partial<Pick<OrgFeatureFlag, 'isEntitled' | 'entitledUntil'>>;

export type CatalogRow = Pick<FeatureCatalog, 'key' | 'enabledByDefault'>;

/**
 * State of one active catalog feature for an org. A missing row means
 * entitled (so orgs that predate entitlement keep working) and enabled per
 * the catalog default. A passed `entitledUntil` (trial expiry) means not
 * entitled.
 */
export function featureState(
  item: CatalogRow,
  flag: FlagRow | undefined,
  now: Date = new Date(),
): FeatureState {
  const until = flag?.entitledUntil ? new Date(flag.entitledUntil) : null;
  const expired = !!until && until.getTime() <= now.getTime();
  const entitledFlag = flag?.isEntitled ?? true;
  const entitled = entitledFlag && !expired;
  const enabled = flag ? flag.isEnabled : item.enabledByDefault;
  return {
    entitled,
    enabled,
    active: entitled && enabled,
    entitledUntil: until,
    lockedReason: entitled
      ? null
      : entitledFlag && expired
        ? 'trial_expired'
        : 'not_entitled',
  };
}

/**
 * Active keys of an org: every active catalog feature that is entitled
 * (not expired) and enabled. Rows for keys outside the active catalog
 * never count.
 */
export function resolveEnabledFeatures(
  flags: FlagRow[],
  catalog: CatalogRow[],
  now: Date = new Date(),
): Set<string> {
  const byKey = new Map(flags.map((f) => [f.featureKey, f]));
  const keys = new Set<string>();
  for (const item of catalog) {
    if (featureState(item, byKey.get(item.key), now).active) keys.add(item.key);
  }
  return keys;
}

/** Location set = org set minus the features the location switched off. */
export function narrowByLocation(
  orgKeys: ReadonlySet<string>,
  disabledAtLocation: Iterable<string>,
): Set<string> {
  const keys = new Set(orgKeys);
  for (const key of disabledAtLocation) keys.delete(key);
  return keys;
}
