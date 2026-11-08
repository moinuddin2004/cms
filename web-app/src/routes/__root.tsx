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
import {
  activeClinicBlock,
  isLabOnlyUser,
  useAuthStore,
} from '@/store/useAuthStore'
import { FeatureFlagsProvider } from '@/context/FeatureFlagsContext'
import { AccessProvider, RouteAccessGate } from '@/features/access'
import { AppToaster } from '@/components/shared/AppToaster'
import { queryClient } from '@/lib/query-client'
import { requestRefresh } from '@/lib/api'
import { clearRefreshToken, saveRefreshToken } from '@/lib/desktop-session'
import { initDesktopLinks } from '@/lib/desktop-links'
import { useTheme } from '@/hooks/useTheme'
import { useTrackNavHistory } from '@/hooks/useBackNavigation'
import { ThemeProvider, THEME_CSS_CACHE_KEY } from '@/features/theme'
import { AppLoadingScreen } from '@/components/shared/AppLoadingScreen'
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
// `/join/` = a clinic's invite link (sign in with Google there).
const OPEN_PATHS = [
  '/display/',
  '/lab-link/',
  '/verify-email',
  '/join/',
  '/lab-email/', // a lab confirms its contact address (often no login)
  '/desktop-google', // browser half of desktop Google sign-in (no session here)
]

// Work-order QR: signed-in users of either side; the page itself decides
// between the lab portal and the clinic order, so no workspace redirects.
const QR_PATH = '/o/'

// Lab staff work here — no clinic org/location context (lab ERD §13)
const LAB_PORTAL_PATH = '/lab-portal'

// Signed in but no usable clinic: awaiting approval, rejected, blocked by
// the clinic's sign-in policy, or no clinic at all (join request pending).
const CLINIC_ACCESS_PATH = '/clinic-access'

// Signed in, but the API refuses the account until its email is verified
// (EMAIL_NOT_VERIFIED: an unverified password account past its grace date).
const VERIFY_REQUIRED_PATH = '/confirm-email'

// Super admins can visit these pages even without an active location context
// so they can bootstrap the system (create first org/location)
const SUPER_ADMIN_SETUP_PATHS = [
  '/organizations',
  '/settings/locations',
  '/lab-directory',
  '/studio',
  '/subscriptions',
]

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
    // Last clinic brand colours, so the loading screen is already on-brand.
    // ThemeProvider later reuses this same <style id="clinic-theme">.
    var brandCss = localStorage.getItem(${JSON.stringify(THEME_CSS_CACHE_KEY)});
    if (brandCss) {
      var style = document.createElement('style');
      style.id = 'clinic-theme';
      style.textContent = brandCss;
      document.head.appendChild(style);
    }
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
      { title: 'Clinic Management' },
      {
        name: 'description',
        content:
          'Clinic management — appointments, patients, billing and staff',
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
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Instrument+Serif:ital@0;1&display=swap',
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
    emailVerificationRequired,
  } = useAuthStore()

  // Active org's specialty tags drive <SpecialtyGuard> across the app
  const clinicBlock = activeClinicBlock({
    accessibleOrganizations,
    activeOrganizationId,
  })
  const activeSpecialtyTags = accessibleOrganizations.find(
    (o) => o.id === activeOrganizationId,
  )?.specialtyTags ?? ['general']
  const navigate = useNavigate()
  const location = useLocation()
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize theme on app load — keeps dark class in sync
  useTheme()

  // Where each page came from — powers the ← back button
  useTrackNavHistory()

  // Desktop shell: listen for `clinic://` callbacks (Google sign-in), including
  // a link that launched the app. No-op in a browser.
  useEffect(() => {
    void initDesktopLinks()
  }, [])

  // On mount, attempt silent refresh to restore session from cookie
  useEffect(() => {
    const tryRestoreSession = async () => {
      if (isAuthenticated) {
        setIsInitializing(false)
        return
      }

      try {
        // Cookie on the web, stored token on desktop — same call.
        const res = await requestRefresh()
        if (res.data?.isSuccess && res.data.data) {
          const {
            user,
            accessToken,
            refreshToken,
            isSuperAdmin,
            accessSource,
            requiresOrgSelection: reqOrgSel,
            requiresLocationSelection: reqLocSel,
            accessibleOrganizations,
            activeOrganizationId,
            activeLocationId: actLocId,
            labMemberships: labs,
          } = res.data.data

          // The API rotates the refresh token: keep the new one on desktop,
          // otherwise the next cold start would present a spent token.
          void saveRefreshToken(refreshToken)

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
      } catch (err) {
        // Only drop the desktop's stored token when the server actually
        // rejected it — a network blip must not sign the user out for good.
        const status = (err as { response?: { status?: number } }).response
          ?.status
        if (status === 401 || status === 403) {
          void clearRefreshToken()
        }
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
    const isClinicAccessPage = location.pathname === CLINIC_ACCESS_PATH
    // No clinic to work in, or the active one can't be opened right now
    const needsClinicAccess =
      !isSuperAdmin &&
      !labOnly &&
      (accessibleOrganizations.length === 0 ||
        (!!clinicBlock && !needsSelection))

    const isVerifyRequiredPage = location.pathname === VERIFY_REQUIRED_PATH
    const needsEmailVerification = isAuthenticated && emailVerificationRequired

    if (!isAuthenticated && !isPublicRoute && location.pathname !== '/') {
      navigate({ to: '/login', replace: true })
    } else if (needsEmailVerification && !isVerifyRequiredPage) {
      // Nothing else works until the email is verified
      navigate({ to: VERIFY_REQUIRED_PATH as any, replace: true })
    } else if (isVerifyRequiredPage && !needsEmailVerification) {
      navigate({ to: isAuthenticated ? '/' : '/login', replace: true })
    } else if (isVerifyRequiredPage) {
      // Stay: the page offers resend / continue / sign out
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
    } else if (isAuthenticated && needsClinicAccess && !isClinicAccessPage) {
      navigate({ to: CLINIC_ACCESS_PATH as any, replace: true })
    } else if (isAuthenticated && isClinicAccessPage && !needsClinicAccess) {
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
    clinicBlock,
    emailVerificationRequired,
  ])

  // Show the loader while initializing (attempting silent refresh)
  if (isInitializing) return <AppLoadingScreen />

  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider
        specialtyTags={activeSpecialtyTags}
        enabled={
          isAuthenticated &&
          !!activeLocationId &&
          !clinicBlock &&
          !emailVerificationRequired
        }
      >
        <AccessProvider
          enabled={
            isAuthenticated &&
            !!activeLocationId &&
            !clinicBlock &&
            !emailVerificationRequired
          }
        >
          <RouteAccessGate>
            <Outlet />
          </RouteAccessGate>
        </AccessProvider>
      </FeatureFlagsProvider>
      <ThemeProvider />
      <AppToaster />
    </QueryClientProvider>
  )
}
