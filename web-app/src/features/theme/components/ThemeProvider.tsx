import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import { themeApi } from '../services/theme.api'
import { themeKeys } from '../hooks/useThemeQueries'
import { useThemeStore } from '../hooks/useThemeStore'
import { applyClinicTheme } from '../lib/apply-theme'
import { isHexColor } from '../lib/color'
import {
  cacheTheme,
  cachedTheme,
  preAuthOrgId,
  rememberOrgId,
} from '../lib/storage'
import { DEFAULT_THEME } from '../types'
import type { ClinicTheme } from '../types'

/** Fill gaps so a partial or odd payload can't break the UI. */
export function normalizeTheme(
  t: Partial<ClinicTheme> | null | undefined,
): ClinicTheme {
  return {
    app_name: t?.app_name || DEFAULT_THEME.app_name,
    logo_url: t?.logo_url || null,
    logo_dark_url: t?.logo_dark_url || null,
    favicon_url: t?.favicon_url || null,
    brand_color:
      t?.brand_color && isHexColor(t.brand_color)
        ? t.brand_color
        : DEFAULT_THEME.brand_color,
    sidebar_style: t?.sidebar_style ?? DEFAULT_THEME.sidebar_style,
    default_mode: t?.default_mode ?? DEFAULT_THEME.default_mode,
  }
}

const STALE_MS = 5 * 60_000

/**
 * Loads the clinic theme, applies it to the document and publishes it to
 * `useClinicTheme()`. Renders nothing — mount it once, inside the
 * QueryClientProvider.
 *
 * Signed in with an org: `GET /theme`. Before sign-in: `GET
 * /public/theme/:orgId`, the org coming from `?org=` or the last org used on
 * this device. Signed in without a clinic (lab staff): the default look.
 */
export function ThemeProvider() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const locationId = useAuthStore((s) => s.activeLocationId)
  const setTheme = useThemeStore((s) => s.setTheme)
  const withOrg = isAuthenticated && !!orgId

  // Re-read on every sign-in / sign-out: after an in-app sign-out the login
  // page must use the org remembered while signed in, not the value from
  // when the app first loaded.
  const preAuthOrg = useMemo(
    () =>
      typeof window === 'undefined' || isAuthenticated ? null : preAuthOrgId(),
    [isAuthenticated],
  )
  // `isAuthenticated` is not read inside: it only re-reads the cache on auth change.
  const cached = useMemo(
    () => (typeof window === 'undefined' ? null : cachedTheme()),
    [isAuthenticated],
  )

  const current = useQuery({
    queryKey: themeKeys.current(orgId, locationId),
    queryFn: themeApi.current,
    enabled: withOrg,
    staleTime: STALE_MS,
  })
  const publicTheme = useQuery({
    queryKey: themeKeys.public(preAuthOrg),
    queryFn: () => themeApi.public(preAuthOrg!),
    enabled: !isAuthenticated && !!preAuthOrg,
    staleTime: STALE_MS,
  })

  const fetched = withOrg
    ? current.data
    : isAuthenticated
      ? DEFAULT_THEME
      : publicTheme.data
  const theme = useMemo(
    () => normalizeTheme(fetched ?? cached),
    [fetched, cached],
  )
  const isLoading = withOrg ? current.isLoading : publicTheme.isLoading

  useEffect(() => {
    applyClinicTheme(theme)
    setTheme(theme, isLoading)
  }, [theme, isLoading, setTheme])

  useEffect(() => {
    if (withOrg && orgId) rememberOrgId(orgId)
  }, [withOrg, orgId])

  useEffect(() => {
    if (withOrg && current.data) cacheTheme(normalizeTheme(current.data))
  }, [withOrg, current.data])

  return null
}
