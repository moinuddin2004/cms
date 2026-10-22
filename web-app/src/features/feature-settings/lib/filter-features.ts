import type {
  FeatureFilters,
  OwnerFeature,
  OwnerFeatureModule,
} from '../types/feature-settings.types'

export const DEFAULT_FEATURE_FILTERS: FeatureFilters = {
  search: '',
  module: 'all',
  status: 'all',
}

export const isLocked = (f: OwnerFeature) => !f.entitled

function matchesStatus(f: OwnerFeature, status: FeatureFilters['status']) {
  switch (status) {
    case 'on':
      return f.active
    case 'off':
      return f.entitled && !f.enabled
    case 'locked':
      return isLocked(f)
    default:
      return true
  }
}

/** Modules with only the features that pass the filters (empty modules dropped). */
export function filterFeatureModules(
  modules: OwnerFeatureModule[],
  filters: FeatureFilters,
): OwnerFeatureModule[] {
  const q = filters.search.trim().toLowerCase()
  return modules
    .filter((m) => filters.module === 'all' || m.module === filters.module)
    .map((m) => ({
      ...m,
      features: m.features.filter(
        (f) =>
          matchesStatus(f, filters.status) &&
          (!q ||
            f.name.toLowerCase().includes(q) ||
            f.key.toLowerCase().includes(q) ||
            (f.description ?? '').toLowerCase().includes(q)),
      ),
    }))
    .filter((m) => m.features.length > 0)
}

/** How many filters are on (search counts), for the badge. */
export function activeFilterCount(filters: FeatureFilters): number {
  return (
    (filters.search.trim() ? 1 : 0) +
    (filters.module !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0)
  )
}

/** "billing" → "Billing", "dental_lab" → "Dental lab". */
export function moduleLabel(module: string): string {
  const s = module.replace(/[_.-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
