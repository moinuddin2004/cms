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
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
