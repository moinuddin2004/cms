import { useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { resolveHomeRoute } from '../nav/homeRoute'
import type { RouteRequirementsFn } from '../nav/homeRoute'
import type { PermissionRequirement } from '../types/access.types'
import { useAccess } from './useAccess'
import { useNavViewer } from './useNavViewer'

/**
 * The user's landing page: the role's home page, else the clinic layout's,
 * when the user may open it; otherwise `/dashboard`.
 */
export function useHomeRoute(): string {
  const router = useRouter()
  const access = useAccess()
  const viewer = useNavViewer()

  const routeRequirements = useCallback<RouteRequirementsFn>(
    (path) => {
      const { foundRoute, matchedRoutes } = router.getMatchedRoutes(path)
      if (!foundRoute) return null
      return matchedRoutes
        .map((r) => r.options.staticData?.can)
        .filter((c): c is PermissionRequirement => c != null)
    },
    [router],
  )

  return resolveHomeRoute(
    access.homeRoute ?? access.nav?.homeRoute,
    viewer,
    routeRequirements,
  )
}
