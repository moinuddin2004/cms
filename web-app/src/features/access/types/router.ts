import type { PermissionRequirement } from './access.types'

// `staticData: { can }` on a route is checked once in __root (RouteAccessGate).
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Permission(s) needed to open the route — any-of when an array. */
    can?: PermissionRequirement
  }
}
