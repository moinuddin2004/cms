import { QueryClientProvider } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useNavigate,
  useLocation,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { isLabOnlyUser, useAuthStore } from '@/store/useAuthStore'
import { FeatureFlagsProvider } from '@/context/FeatureFlagsContext'
import { AccessProvider, RouteAccessGate } from '@/features/access'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import apiClient from '@/lib/api'
import { useTheme } from '@/hooks/useTheme'
import { useTrackNavHistory } from '@/hooks/useBackNavigation'
import { ThemeProvider } from '@/features/theme'
import appCss from '../styles.css?url'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/select-location',
]

// Open to everyone, signed in or not, with no redirects (waiting-room TV,
// lab magic links — the token in the URL is the credential).
const OPEN_PATHS = ['/display/', '/lab-link/']

// Work-order QR: signed-in users of either side; the page itself decides
// between the lab portal and the clinic order, so no workspace redirects.
const QR_PATH = '/o/'

// Lab staff work here — no clinic org/location context (lab ERD §13)
const LAB_PORTAL_PATH = '/lab-portal'

// Super admins can visit these pages even without an active location context
// so they can bootstrap the system (create first org/location)
const SUPER_ADMIN_SETUP_PATHS = ['/organizations', '/locations', '/lab-directory', '/studio']

// Inline script to prevent flash of wrong theme on initial load.
// Runs synchronously before any React hydration / first paint.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var theme = localStorage.getItem('theme') || 'system';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } catch(e) {}
})();
`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'MedTrackr — Dental Clinic Management' },
      {
        name: 'description',
        content: 'Production-grade SaaS dental clinic management system',
      },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Prevent theme flash — must run before body renders */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const {
    isAuthenticated,
    setAuth,
    clearAuth,
    requiresLocationSelection,
    requiresOrgSelection,
    activeLocationId,
    activeOrganizationId,
    accessibleOrganizations,
    isSuperAdmin,
    labMemberships,
  } = useAuthStore()

  // Active org's specialty tags drive <SpecialtyGuard> across the app
  const activeSpecialtyTags =
    accessibleOrganizations.find((o) => o.id === activeOrganizationId)
      ?.specialtyTags ?? ['general']
  const navigate = useNavigate()
  const location = useLocation()
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize theme on app load — keeps dark class in sync
  useTheme()

  // Where each page came from — powers the ← back button
  useTrackNavHistory()

  // On mount, attempt silent refresh to restore session from cookie
  useEffect(() => {
    const tryRestoreSession = async () => {
      if (isAuthenticated) {
        setIsInitializing(false)
        return
      }

      try {
        const res = await apiClient.post('/auth/refresh')
        if (res.data?.isSuccess && res.data.data) {
          const {
            user,
            accessToken,
            isSuperAdmin,
            accessSource,
            requiresOrgSelection: reqOrgSel,
            requiresLocationSelection: reqLocSel,
            accessibleOrganizations,
            activeOrganizationId,
            activeLocationId: actLocId,
            labMemberships: labs,
          } = res.data.data

          setAuth({
            user,
            accessToken,
            isSuperAdmin,
            accessSource,
            requiresOrgSelection: reqOrgSel,
            requiresLocationSelection: reqLocSel,
            accessibleOrganizations,
            activeOrganizationId,
            activeLocationId: actLocId,
            labMemberships: labs,
          })
        }
      } catch {
        // No valid session — stay unauthenticated
        clearAuth()
      } finally {
        setIsInitializing(false)
      }
    }

    tryRestoreSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Route protection + location context validation
  useEffect(() => {
    if (isInitializing) return
    if (OPEN_PATHS.some((p) => location.pathname.startsWith(p))) return

    const isPublicRoute = PUBLIC_PATHS.some((path) =>
      location.pathname.startsWith(path),
    )
    const isSelectLocationPage = location.pathname === '/select-location'

    const needsSelection = requiresOrgSelection || requiresLocationSelection
    const isLabPortal = location.pathname.startsWith(LAB_PORTAL_PATH)
    const labOnly = isLabOnlyUser({
      isSuperAdmin,
      accessibleOrganizations,
      labMemberships,
    })

    if (!isAuthenticated && !isPublicRoute && location.pathname !== '/') {
      navigate({ to: '/login', replace: true })
    } else if (isAuthenticated && location.pathname.startsWith(QR_PATH)) {
      // OrderQrPage switches lab / location itself
    } else if (isAuthenticated && labOnly && !isLabPortal) {
      // Lab staff have no clinic — their home is the lab portal
      navigate({ to: LAB_PORTAL_PATH, replace: true })
    } else if (isAuthenticated && isLabPortal) {
      // The portal needs a lab membership, never a clinic location
      if (!labMemberships.length) navigate({ to: '/', replace: true })
    } else if (isAuthenticated && isPublicRoute && !isSelectLocationPage) {
      // `/` forwards to the user's home page (HomeRedirect)
      navigate({ to: '/', replace: true })
    } else if (
      isAuthenticated &&
      !isPublicRoute &&
      !activeLocationId &&
      needsSelection
    ) {
      // Super admins on setup paths (orgs/locations) can proceed without a
      // location — they need these pages to create the first org/location
      const isSuperAdminSetupPath =
        isSuperAdmin &&
        SUPER_ADMIN_SETUP_PATHS.some((p) => location.pathname.startsWith(p))

      if (!isSuperAdminSetupPath) {
        navigate({ to: '/select-location' as any, replace: true })
      }
    } else if (
      isAuthenticated &&
      isSelectLocationPage &&
      activeLocationId &&
      !needsSelection
    ) {
      // Already has a location selected — skip selector
      navigate({ to: '/', replace: true })
    }
  }, [
    isAuthenticated,
    location.pathname,
    navigate,
    isInitializing,
    activeLocationId,
    requiresLocationSelection,
    requiresOrgSelection,
    isSuperAdmin,
    accessibleOrganizations,
    labMemberships,
  ])

  // Show nothing while initializing (attempting silent refresh)
 if (isInitializing) {
    return (
      <div
        className="relative min-h-screen overflow-hidden flex items-center justify-center"
        style={{ background: 'transparent' }}
      >
        {/* Frosted glass over the app background token */}
        <div
          className="absolute inset-0 bg-background/60"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        />

        {/* Soft brand glow — subtle, themed (blue) */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full blur-[130px] bg-brand-500/15" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full blur-[130px] bg-brand-600/10" />

        {/* Spinner dots — brand ramp */}
        <div className="animate-loading-juggle relative z-10 h-12 w-12">
          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-400 shadow-[0_0_10px_3px_var(--ring-soft)]" />
          <span className="absolute bottom-0 left-0 h-3 w-3 rounded-full bg-brand-500 shadow-[0_0_10px_3px_var(--ring-soft)]" />
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-brand-600 shadow-[0_0_10px_3px_var(--ring-soft)]" />
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider
        specialtyTags={activeSpecialtyTags}
        enabled={isAuthenticated && !!activeLocationId}
      >
        <AccessProvider enabled={isAuthenticated && !!activeLocationId}>
          <RouteAccessGate>
            <Outlet />
          </RouteAccessGate>
        </AccessProvider>
      </FeatureFlagsProvider>
      <ThemeProvider />
      <Toaster
        position="top-right"
        closeButton
        theme="system"
        gap={8}
        toastOptions={{ duration: 4000 }}
      />
    </QueryClientProvider>
  )
}
