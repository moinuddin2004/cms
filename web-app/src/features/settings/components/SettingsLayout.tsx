import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import {
  DashboardLayout,
  EmbeddedLayoutContext,
} from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { SettingsRail } from './SettingsRail'

const HOME = { home: '/settings' }

/**
 * Shell for every /settings page: grouped rail on the left (desktop), the
 * page on the right. On phones the overview is the menu, and each page gets
 * a "← All settings" link instead of the rail.
 */
export function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isHome = pathname.replace(/\/+$/, '') === '/settings'

  return (
    <DashboardLayout showBack={false}>
      <EmbeddedLayoutContext.Provider value={HOME}>
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden md:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-4 pr-1">
              <SettingsRail />
            </div>
          </aside>
          <div className="min-w-0">
            {!isHome && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                // Nested pages (role, location) have their own ←.
                className="-ml-2 mb-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground md:hidden [div:has([data-page-back])>&]:hidden"
              >
                <Link to="/settings">
                  <ArrowLeft className="size-3.5" />
                  All settings
                </Link>
              </Button>
            )}
            <Outlet />
          </div>
        </div>
      </EmbeddedLayoutContext.Provider>
    </DashboardLayout>
  )
}
