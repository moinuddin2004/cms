import { useState } from 'react'
import type { ElementType, ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  Building2,
  Factory,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  LogOut,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/layout/Topbar'
import { BackButton } from '@/components/shared/BackButton'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import apiClient from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { useActiveLab } from '../hooks/useLabPortal'
import { LAB_ROLE_LABEL } from '../types'
import { LabSwitcher } from './LabSwitcher'

interface NavItem {
  label: string
  icon: ElementType
  href: string
  adminOnly?: boolean
}

export const LAB_PORTAL_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/lab-portal' },
  { label: 'Lab profile', icon: FlaskConical, href: '/lab-portal/profile' },
  { label: 'Team', icon: Users, href: '/lab-portal/team', adminOnly: true },
  { label: 'Clinics', icon: Building2, href: '/lab-portal/clinics' },
  { label: 'Production', icon: Factory, href: '/lab-portal/production' },
]

const initials = (name?: string) =>
  (name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

/**
 * The lab portal shell — its own sidebar and top bar, no clinic context.
 * Lab staff never see the clinic navigation; staff of an in-house lab who
 * also work at the clinic get a link back to the clinic workspace.
 */
export function LabPortalLayout({
  children,
  title,
  subtitle,
  actions,
  backTo,
  backLabel,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  const { isLabAdmin, membership } = useActiveLab()
  const user = useAuthStore((s) => s.user)
  const hasClinic = useAuthStore((s) => s.accessibleOrganizations.length > 0)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const path = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const items = LAB_PORTAL_NAV.filter((i) => !i.adminOnly || isLabAdmin)
  const activeHref = items
    .filter(
      (i) =>
        path === i.href ||
        path === `${i.href}/` ||
        (i.href !== '/lab-portal' && path.startsWith(`${i.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  const logout = async () => {
    setLoggingOut(true)
    try {
      await apiClient.post('/auth/logout')
      toast.success('Signed out successfully')
    } finally {
      clearAuth()
      void navigate({ to: '/login' })
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[var(--spacing-sidebar)] flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-600">
            <FlaskConical className="size-4 text-white" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-foreground">
              Lab portal
            </p>
            <p className="truncate text-[11px] text-text-3">
              {membership?.labName ?? 'MedTrackr'}
            </p>
          </div>
        </div>

        <nav
          className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3"
          aria-label="Lab portal"
        >
          {items.map((item) => {
            const active = item.href === activeHref
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-[9px] px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-soft font-semibold text-primary-text'
                    : 'text-text-2 hover:bg-panel hover:text-foreground',
                )}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-border px-3 py-3">
          {hasClinic && (
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-[9px] px-3 py-2 text-sm font-medium text-text-2 transition-colors hover:bg-panel hover:text-foreground"
            >
              <ArrowLeftRight size={18} className="shrink-0" />
              Clinic workspace
            </Link>
          )}
          <div className="flex items-center gap-2 rounded-[9px] bg-panel/60 p-2">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-foreground">
                {user?.name || user?.email || 'User'}
              </p>
              <p className="truncate text-[11px] text-text-3">
                {membership ? LAB_ROLE_LABEL[membership.role] : 'Lab staff'}
              </p>
            </div>
            <TooltipButton
              tooltip="Sign out"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void logout()}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
            </TooltipButton>
          </div>
        </div>
      </aside>

      <div className="ml-[var(--spacing-sidebar)]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-2.5 border-b border-border bg-surface/80 px-6 backdrop-blur-md">
          <ThemeToggle />
          <LabSwitcher />
        </header>
        <main className="px-6 py-4">
          {(title || subtitle || actions) && (
            <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                {backTo && <BackButton to={backTo} label={backLabel} />}
                <div>
                  {title && (
                    <h1 className="text-lg font-semibold leading-tight text-foreground">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
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
