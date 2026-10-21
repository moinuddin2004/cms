// Access feature barrel — import from here across features.
import './types/router'

export * from './types/access.types'
export type { AccessChecks } from './lib/access'
export type { AccessContextValue, AccessStatus } from './lib/access-context'
export { fetchMyAccess } from './services/access.api'
export { accessKeys, useMyAccess } from './hooks/useMyAccess'
export { useAccess } from './hooks/useAccess'
export { AccessProvider } from './components/AccessProvider'
export { Can, CanAll } from './components/Can'
export { NoAccess } from './components/NoAccess'
export { RouteAccessGate } from './components/RouteAccessGate'
export {
  NAV_ITEMS,
  NAV_ICONS,
  DEFAULT_NAV_LAYOUT,
  FOOTER_NAV_KEYS,
  type NavKey,
  type NavItemDef,
  type NavLayout,
  type NavLayoutGroup,
  type NavLayoutItem,
  type NavLayoutSection,
} from './nav/nav.registry'
export {
  resolveNav,
  canSeeNavItem,
  isNavGroup,
  type NavLink,
  type NavGroupView,
  type NavEntryView,
  type NavSectionView,
  type NavViewer,
} from './nav/resolveNav'
