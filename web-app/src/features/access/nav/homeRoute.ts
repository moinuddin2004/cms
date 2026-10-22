import type { PermissionRequirement } from '../types/access.types'
import { NAV_ITEMS } from './nav.registry'
import type { NavItemDef } from './nav.registry'
import { canSeeNavItem } from './resolveNav'
import type { NavViewer } from './resolveNav'

/** Where everyone lands when no (allowed) home page is set. */
export const DEFAULT_HOME_ROUTE = '/dashboard'

/**
 * The `staticData.can` of every route matching `path`, or null when no route
 * matches. Built from the router (see `useHomeRoute`); injectable for tests.
 */
export type RouteRequirementsFn = (
  path: string,
) => PermissionRequirement[] | null

/** In-app path only — never `//host` or a URL with a scheme. */
const IN_APP_PATH = /^\/(?!\/)[A-Za-z0-9/_.-]*$/

/**
 * The page to open when the user gave no destination (after login, or `/`):
 * the role's / clinic's home page if it is a real page the user may open,
 * else the dashboard. Layouts and roles never widen access, so the home page
 * passes the same checks as the sidebar item and the route gate.
 */
export function resolveHomeRoute(
  candidate: string | null | undefined,
  viewer: NavViewer,
  routeRequirements: RouteRequirementsFn,
): string {
  if (!candidate) return DEFAULT_HOME_ROUTE
  const path = candidate.split(/[?#]/)[0].replace(/(.)\/+$/, '$1')
  if (!IN_APP_PATH.test(path) || path === '/') return DEFAULT_HOME_ROUTE

  const item = (Object.values(NAV_ITEMS) as NavItemDef[]).find(
    (i) => i.href === path,
  )
  if (item && !canSeeNavItem(item, viewer)) return DEFAULT_HOME_ROUTE

  const required = routeRequirements(path)
  if (!required) return DEFAULT_HOME_ROUTE
  if (!required.every((perm) => viewer.can(perm))) return DEFAULT_HOME_ROUTE
  return path
}
