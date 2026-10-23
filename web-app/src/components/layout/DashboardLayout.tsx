import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BackButton } from '@/components/shared/BackButton'
import { usePageTitle } from '@/hooks/useBackNavigation'
import { AccountBanner } from '@/features/account/components/AccountBanner'

interface DashboardLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  /** Shows a ← back button before the title (nested/detail pages). */
  backTo?: string
  backLabel?: string
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  actions,
  backTo,
  backLabel,
}: DashboardLayoutProps) {
  const { sidebarCollapsed } = useUIStore()
  usePageTitle(title)
  const hasHeader = !!(title || subtitle || actions)

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300',
          // No margin on phones/tablets: the sidebar is a drawer there.
          sidebarCollapsed
            ? 'lg:ml-[var(--spacing-sidebar-collapsed)]'
            : 'lg:ml-[var(--spacing-sidebar)]',
        )}
      >
        <Topbar />
        <main className="px-4 py-4 sm:px-6">
          <AccountBanner />
          {/* Pages that draw their own header get the ← here, only when the
              user came from inside another page; hidden if the page already
              has its own back button (patient detail, report viewer). */}
          {!hasHeader && (
            <BackButton
              variant="link"
              className="mb-1 [main:has([data-page-back])_&]:hidden"
            />
          )}
          {hasHeader && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3">
                <BackButton to={backTo} label={backLabel} />
                <div>
                  {title && (
                    <h1 className="text-lg font-semibold text-foreground leading-tight">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {actions && (
                <div className="flex items-center gap-2">{actions}</div>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
