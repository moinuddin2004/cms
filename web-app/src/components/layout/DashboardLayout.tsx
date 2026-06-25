import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface DashboardLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  actions,
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
        <main className="p-6">
          {hasHeader && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                {title && (
                  <h1 className="text-2xl font-bold text-foreground">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {subtitle}
                  </p>
                )}
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
