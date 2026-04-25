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
import { useAuthStore } from '@/store/useAuthStore'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import apiClient from '@/lib/api'
import { useTheme } from '@/hooks/useTheme'
import appCss from '../styles.css?url'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/select-location',
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
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
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
  } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize theme on app load — keeps dark class in sync
  useTheme()

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

    const isPublicRoute = PUBLIC_PATHS.some((path) =>
      location.pathname.startsWith(path),
    )
    const isSelectLocationPage = location.pathname === '/select-location'

    const needsSelection = requiresOrgSelection || requiresLocationSelection

    if (!isAuthenticated && !isPublicRoute && location.pathname !== '/') {
      navigate({ to: '/login', replace: true })
    } else if (isAuthenticated && isPublicRoute && !isSelectLocationPage) {
      navigate({ to: '/dashboard', replace: true })
    } else if (
      isAuthenticated &&
      !isPublicRoute &&
      !activeLocationId &&
      needsSelection
    ) {
      // Authenticated but no location selected — redirect to selector
      navigate({ to: '/select-location' as any, replace: true })
    } else if (
      isAuthenticated &&
      isSelectLocationPage &&
      activeLocationId &&
      !needsSelection
    ) {
      // Already has a location selected — skip selector
      navigate({ to: '/dashboard', replace: true })
    }
  }, [
    isAuthenticated,
    location.pathname,
    navigate,
    isInitializing,
    activeLocationId,
    requiresLocationSelection,
    requiresOrgSelection,
  ])

  // Show nothing while initializing (attempting silent refresh)
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster
        position="top-right"
        richColors
        closeButton
        theme="system"
        toastOptions={{
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  )
}
