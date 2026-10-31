import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BackButton } from '@/components/shared/BackButton'
import { usePageTitle } from '@/hooks/useBackNavigation'
import { AccountBanner } from '@/features/account/components/AccountBanner'

/**
 * Set by a shell that already draws the sidebar + topbar (the settings
 * pages). A `DashboardLayout` inside it renders only its page header, so a
 * page works the same on its own route and embedded in the shell.
 */
export const EmbeddedLayoutContext = createContext<{ home: string } | null>(
  null,
)

interface DashboardLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  /** Shows a ← back button before the title (nested/detail pages). */
  backTo?: string
  backLabel?: string
  /** false = never draw the history ← (a shell with its own navigation). */
  showBack?: boolean
}

export function DashboardLayout(props: DashboardLayoutProps) {
  const embedded = useContext(EmbeddedLayoutContext)
  usePageTitle(props.title)
  if (embedded) return <EmbeddedPage {...props} home={embedded.home} />
  return <FullPage {...props} />
}

function FullPage({
  children,
  title,
  subtitle,
  actions,
  backTo,
  backLabel,
  showBack = true,
}: DashboardLayoutProps) {
  const { sidebarCollapsed } = useUIStore()
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
          {!hasHeader && showBack && (
            <BackButton
              variant="link"
              className="mb-1 [main:has([data-page-back])_&]:hidden"
            />
          )}
          {hasHeader && (
            <PageHeader
              title={title}
              subtitle={subtitle}
              actions={actions}
              back={<BackButton to={backTo} label={backLabel} />}
            />
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

/**
 * Inside a shell: header + content only. The shell's own navigation replaces
 * the ← on top-level pages; nested pages (role detail…) keep theirs.
 */
function EmbeddedPage({
  children,
  title,
  subtitle,
  actions,
  backTo,
  backLabel,
  home,
}: DashboardLayoutProps & { home: string }) {
  const nested = !!backTo && backTo !== home
  if (!(title || subtitle || actions)) return <>{children}</>
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={actions}
        back={nested ? <BackButton to={backTo} label={backLabel} /> : null}
      />
      {children}
    </>
  )
}

function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  back: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-3">
        {back}
        <div>
          {title && (
            <h1 className="text-lg font-semibold text-foreground leading-tight">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
