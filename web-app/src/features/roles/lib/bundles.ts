import {
  BUNDLES,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSIONS,
  SCOPES,
} from '@/features/access/generated/catalog'
import type {
  BundleLevel,
  Grant,
  Permission,
  PermissionGroup,
  PermissionMap,
  Scope,
} from '@/features/access/generated/catalog'
import type { ModuleLevel } from '../types/roles.types'

export const BUNDLE_LEVELS: readonly BundleLevel[] = ['none', 'basic', 'full']

export const LEVEL_LABEL: Record<ModuleLevel, string> = {
  none: 'None',
  basic: 'Basic',
  full: 'Full',
  custom: 'Custom',
}

export const SCOPE_LABEL: Record<Scope, string> = {
  own: 'Own',
  location: 'Location',
  org: 'Whole clinic',
}

const SCOPE_RANK: Record<Scope, number> = { own: 1, location: 2, org: 3 }

/** Permissions listed under a module, in catalog order. */
export function permissionsOf(group: PermissionGroup): Permission[] {
  return PERMISSION_KEYS.filter((k) => PERMISSIONS[k].group === group)
}

function inGroup(group: PermissionGroup, grants: PermissionMap): Permission[] {
  return (Object.keys(grants) as Permission[]).filter(
    (k) => PERMISSIONS[k].group === group,
  )
}

/** The bundle a module's grants match exactly, else `custom` (mirrors the backend's matchBundle). */
export function moduleLevel(
  group: PermissionGroup,
  grants: PermissionMap,
): ModuleLevel {
  const held = inGroup(group, grants)
  for (const level of BUNDLE_LEVELS) {
    const bundle = BUNDLES[group][level]
    const keys = Object.keys(bundle) as Permission[]
    if (
      keys.length === held.length &&
      keys.every((k) => grants[k] === bundle[k])
    ) {
      return level
    }
  }
  return 'custom'
}

/** Replaces a module's grants with a bundle; other modules are untouched. */
export function applyLevel(
  group: PermissionGroup,
  grants: PermissionMap,
  level: BundleLevel,
): PermissionMap {
  const out: PermissionMap = { ...grants }
  for (const k of inGroup(group, out)) delete out[k]
  return { ...out, ...BUNDLES[group][level] }
}

/** Sets (or, with `undefined`, removes) one grant. */
export function setGrant(
  grants: PermissionMap,
  key: Permission,
  grant: Grant | undefined,
): PermissionMap {
  const out: PermissionMap = { ...grants }
  if (grant === undefined) delete out[key]
  else out[key] = grant
  return out
}

/** Scopes a permission supports (empty for unscoped ones). */
export function scopesOf(key: Permission): readonly Scope[] {
  return PERMISSIONS[key].scopes ?? []
}

/** The grant a freshly ticked checkbox gets: narrowest scope, or `true`. */
export function defaultGrant(key: Permission): Grant {
  const scopes = scopesOf(key)
  if (!scopes.length) return true
  return [...scopes].sort((a, b) => SCOPE_RANK[a] - SCOPE_RANK[b])[0]
}

function reach(grant: Grant): number {
  return grant === true ? SCOPE_RANK.org : SCOPE_RANK[grant]
}

/** High-risk permissions `after` grants that `before` did not (or grants wider). */
export function highRiskAdded(
  before: PermissionMap,
  after: PermissionMap,
): Permission[] {
  return (Object.entries(after) as [Permission, Grant][])
    .filter(([key, grant]) => {
      if (PERMISSIONS[key].risk !== 'high') return false
      const prev = before[key]
      return prev === undefined || reach(grant) > reach(prev)
    })
    .map(([key]) => key)
}

/** Same grants, key for key. */
export function sameGrants(a: PermissionMap, b: PermissionMap): boolean {
  const ka = Object.keys(a) as Permission[]
  const kb = Object.keys(b) as Permission[]
  return ka.length === kb.length && ka.every((k) => a[k] === b[k])
}

/** Permission whose feature is off for the org (shown greyed out). */
export function isFeatureOff(
  key: Permission,
  hasFeature: (feature: string) => boolean,
): boolean {
  const feature = PERMISSIONS[key].feature
  return feature !== 'core' && !hasFeature(feature)
}

/**
 * Short per-module summary, e.g. "Billing: Basic · Patients: Full".
 * Modules at None are left out; at most `max` modules, then "+N more".
 */
export function bundleSummaryText(grants: PermissionMap, max = 3): string {
  const parts = PERMISSION_GROUPS.map(
    (g) => [g, moduleLevel(g, grants)] as const,
  )
    .filter(([, level]) => level !== 'none')
    .map(([g, level]) => `${g}: ${LEVEL_LABEL[level]}`)
  if (!parts.length) return 'No access'
  const shown = parts.slice(0, max).join(' · ')
  return parts.length > max ? `${shown} · +${parts.length - max} more` : shown
}

const TONES = ['bg-primary', 'bg-emerald', 'bg-amber', 'bg-violet', 'bg-danger']

/** Stable color dot for a role (derived from its id; roles have no color column yet). */
export function roleTone(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}

export { SCOPES }
