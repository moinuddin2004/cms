import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BackButton } from '@/components/shared/BackButton'

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
  const hasHeader = !!(title || subtitle || actions)

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300',
          sidebarCollapsed
            ? 'ml-[var(--spacing-sidebar-collapsed)]'
            : 'ml-[var(--spacing-sidebar)]',
        )}
      >
        <Topbar />
        <main className="px-6 py-4">
          {hasHeader && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3">
                {backTo && <BackButton to={backTo} label={backLabel} />}
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
