import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ClipboardList, LayoutTemplate, Pill } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { cn } from '@/lib/utils'

const TABS = [
  {
    to: '/prescription-presets',
    label: 'Presets',
    hint: 'Ready-made medicine sets',
    icon: ClipboardList,
  },
  {
    to: '/medicine-directory',
    label: 'Medicines',
    hint: 'Drug catalogue',
    icon: Pill,
  },
  {
    to: '/prescription-templates',
    label: 'Print layouts',
    hint: 'Letterhead and paper',
    icon: LayoutTemplate,
  },
] as const

/**
 * One home for everything behind prescriptions — presets, the medicine
 * catalogue and print layouts — so moving between them is a tap on a tab, not
 * a trip through menus. Each tab is its own page/URL.
 */
export function LibraryShell({
  subtitle,
  actions,
  children,
}: {
  subtitle: string
  actions?: ReactNode
  children: ReactNode
}) {
  const path = useRouterState({ select: (s) => s.location.pathname })

  return (
    <DashboardLayout
      title="Prescription Library"
      subtitle={subtitle}
      backTo="/prescriptions"
      backLabel="Back to prescriptions"
      actions={actions}
    >
      <div className="space-y-4">
        <nav
          aria-label="Prescription library"
          className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] border border-border bg-panel p-[3px]"
        >
          {TABS.map((tab) => {
            const active = path === tab.to
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                title={tab.hint}
                className={cn(
                  'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[8px] px-3.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-text-2 hover:text-foreground',
                )}
              >
                <tab.icon
                  className={cn(
                    'size-4',
                    active ? 'text-primary-text' : 'text-text-3',
                  )}
                />
                {tab.label}
              </Link>
            )
          })}
        </nav>
        {children}
      </div>
    </DashboardLayout>
  )
}
