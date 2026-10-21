import { useLayoutEffect, useRef, useState } from 'react'
import type { ElementType } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  BarChart3,
  Banknote,
  BookmarkPlus,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FileJson,
  FileText,
  FlaskConical,
  GitBranch,
  HandCoins,
  History,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Receipt,
  Settings,
  Shield,
  SlidersHorizontal,
  Stethoscope,
  Tags,
  UserCog,
  Users,
  Wallet,
  Activity,
  FileBarChart,
  PieChart,
} from 'lucide-react'
import { toast } from 'sonner'
import { useHasClinicRole } from '@/components/feature/RequireRolePage'
import type { ClinicRole } from '@/components/feature/RequireRolePage'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useFeatures } from '@/context/FeatureFlagsContext'
import apiClient from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { useAuthStore } from '@/store/useAuthStore'

type AuthState = ReturnType<typeof useAuthStore.getState>

interface NavLeaf {
  label: string
  icon: ElementType
  href: string
  show?: (auth: AuthState) => boolean
  /** Org feature key(s) — hidden when none of them is enabled. */
  feature?: string | string[]
  /** Clinic roles allowed to see the item (any of); omitted = everyone. */
  roles?: ClinicRole[]
}

/** A collapsible parent with nested links. */
interface NavGroup {
  label: string
  icon: ElementType
  children: NavLeaf[]
}

type NavEntry = NavLeaf | NavGroup

interface NavSection {
  label?: string
  items: NavEntry[]
}

const BILLING_ROLES: ClinicRole[] = ['clinic_admin', 'receptionist']
const ADMIN: ClinicRole[] = ['clinic_admin']

const isGroup = (e: NavEntry): e is NavGroup => 'children' in e

const NAV: NavSection[] = [
  {
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
  },
  {
    label: 'Clinic',
    items: [
      {
        label: 'Clinic overview',
        icon: Activity,
        href: '/clinic-overview',
        feature: 'reports.clinical',
        roles: ADMIN,
      },
      {
        label: 'Patients',
        icon: Users,
        href: '/patients',
        feature: 'patients.core',
      },
      {
        label: 'Appointments',
        icon: CalendarDays,
        href: '/appointments',
        feature: 'appointments.core',
      },
      {
        label: 'My Queue',
        icon: Stethoscope,
        href: '/queue/doctor',
        feature: 'appointments.core',
      },
      {
        label: 'My earnings',
        icon: Wallet,
        href: '/my-earnings',
        feature: 'billing.commissions',
        roles: ['doctor'],
      },
      {
        label: 'Prescriptions',
        icon: FileText,
        href: '/prescriptions',
        feature: 'patients.prescriptions',
      },
      {
        label: 'Treatment Plans',
        icon: ClipboardList,
        href: '/plan-templates',
        feature: 'patients.treatment_plans',
      },
      {
        label: 'Labs',
        icon: FlaskConical,
        href: '/labs',
        feature: 'dental.lab_orders',
        roles: ADMIN,
      },
      {
        label: 'Lab portal',
        icon: FlaskConical,
        href: '/lab-portal',
        show: (a) => a.labMemberships.length > 0,
      },
      {
        label: 'Lab orders',
        icon: FlaskConical,
        href: '/lab-orders',
        feature: 'dental.lab_orders',
      },
      {
        label: 'Lab billing',
        icon: Receipt,
        href: '/lab-billing',
        feature: 'dental.lab_orders',
        roles: ['clinic_admin', 'receptionist'],
      },
      {
        label: 'Lab price list',
        icon: Tags,
        href: '/lab-catalog',
        feature: 'dental.lab_orders',
        roles: ADMIN,
      },
      {
        label: 'Order templates',
        icon: BookmarkPlus,
        href: '/lab-order-templates',
        feature: 'dental.lab_orders',
      },
      {
        label: 'Lab payables',
        icon: Wallet,
        href: '/lab-payables',
        feature: 'dental.lab_orders',
        roles: ADMIN,
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        label: 'Finance overview',
        icon: PieChart,
        href: '/finance',
        feature: 'reports.financial',
        roles: ADMIN,
      },
      {
        label: 'Billing',
        icon: HandCoins,
        children: [
          {
            label: 'Billing desk',
            icon: HandCoins,
            href: '/billing',
            feature: 'billing.invoices',
            roles: BILLING_ROLES,
          },
          {
            label: 'Invoices',
            icon: Receipt,
            href: '/invoices',
            feature: 'billing.invoices',
            roles: BILLING_ROLES,
          },
          {
            label: 'Payments',
            icon: Banknote,
            href: '/payments',
            feature: 'billing.invoices',
            roles: BILLING_ROLES,
          },
          {
            label: 'Expenses',
            icon: Wallet,
            href: '/expenses',
            feature: 'billing.expenses',
            roles: BILLING_ROLES,
          },
        ],
      },
      {
        label: 'Reports',
        icon: BarChart3,
        children: [
          {
            label: 'All reports',
            icon: FileBarChart,
            href: '/reports',
            feature: ['reports.financial', 'reports.clinical'],
            roles: ADMIN,
          },
          {
            label: 'Doctor revenue',
            icon: BarChart3,
            href: '/billing/doctor-revenue',
            feature: 'billing.invoices',
            roles: ADMIN,
          },
          {
            label: 'Doctor earnings',
            icon: Wallet,
            href: '/billing/doctor-earnings',
            feature: 'billing.commissions',
            roles: ADMIN,
          },
          {
            label: 'Billing activity',
            icon: History,
            href: '/billing/activity',
            feature: 'billing.invoices',
            roles: ADMIN,
          },
        ],
      },
    ],
  },
  {
    label: 'Team',
    items: [
      { label: 'Employees', icon: UserCog, href: '/employees', roles: ADMIN },
      {
        label: 'Payroll',
        icon: CreditCard,
        href: '/payroll',
        feature: 'hr.payroll',
        roles: ADMIN,
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        label: 'Organizations',
        icon: Building2,
        href: '/organizations',
        show: (a) => a.isSuperAdmin,
      },
      {
        label: 'Lab Directory',
        icon: FlaskConical,
        href: '/lab-directory',
        show: (a) => a.isSuperAdmin,
      },
      {
        label: 'Config Studio',
        icon: SlidersHorizontal,
        children: [
          {
            label: 'Form schemas',
            icon: FileJson,
            href: '/studio/forms',
            show: (a) => a.isSuperAdmin,
          },
          {
            label: 'Workflows',
            icon: GitBranch,
            href: '/studio/workflows',
            show: (a) => a.isSuperAdmin,
          },
          {
            label: 'Stage templates',
            icon: Layers,
            href: '/studio/stages',
            show: (a) => a.isSuperAdmin,
          },
        ],
      },
      {
        label: 'Locations',
        icon: MapPin,
        href: '/locations',
        show: (a) => a.isSuperAdmin || a.accessSource === 'owner',
      },
      { label: 'User Admin', icon: Shield, href: '/users' },
    ],
  },
]

/**
 * Every page renders its own DashboardLayout, so the sidebar remounts on
 * each navigation. Its scroll offset lives outside React to survive that.
 */
let savedNavScroll = 0

const SETTINGS: NavLeaf = {
  label: 'Settings',
  icon: Settings,
  href: '/settings',
}

const matches = (path: string, href: string) =>
  path === href || path.startsWith(href + '/')

const getInitials = (name?: string) =>
  (name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

/** Hover label for icon-only links when the sidebar is collapsed. */
function CollapsedTip({
  label,
  enabled,
  children,
}: {
  label: string
  enabled: boolean
  children: React.ReactNode
}) {
  if (!enabled) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUIStore()
  const { features } = useFeatures()
  const roleAccess: Record<ClinicRole, boolean> = {
    clinic_admin: useHasClinicRole(['clinic_admin']).allowed,
    receptionist: useHasClinicRole(['receptionist']).allowed,
    doctor: useHasClinicRole(['doctor']).allowed,
  }
  const authStore = useAuthStore()
  const { user, clearAuth } = authStore
  const currentPath = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  // Restore before paint so the list never flashes back to the top.
  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = savedNavScroll
  }, [])

  const allowed = (leaf: NavLeaf) =>
    (!leaf.show || leaf.show(authStore)) &&
    (!leaf.feature || [leaf.feature].flat().some((f) => features.has(f))) &&
    (!leaf.roles || leaf.roles.some((r) => roleAccess[r]))

  // Visible tree: hidden leaves dropped, empty groups and sections removed.
  const sections = NAV.map((s) => ({
    ...s,
    items: s.items
      .map((e) =>
        isGroup(e) ? { ...e, children: e.children.filter(allowed) } : e,
      )
      .filter((e) => (isGroup(e) ? e.children.length > 0 : allowed(e))),
  })).filter((s) => s.items.length > 0)

  // Exactly one active link: the longest href that matches the path, so
  // /billing/activity lights "Billing activity" and not "Billing desk".
  const leaves = sections.flatMap((s) =>
    s.items.flatMap((e) => (isGroup(e) ? e.children : [e])),
  )
  const activeHref = [...leaves, SETTINGS]
    .filter((l) => matches(currentPath, l.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  const groupOf = (href?: string) =>
    sections
      .flatMap((s) => s.items)
      .find((e) => isGroup(e) && e.children.some((c) => c.href === href))?.label
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(['Billing']),
  )
  const activeGroup = groupOf(activeHref)
  const isOpen = (label: string) =>
    openGroups.has(label) || activeGroup === label
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label) || activeGroup === label) next.delete(label)
      else next.add(label)
      return next
    })

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await apiClient.post('/auth/logout')
      toast.success('Signed out successfully')
    } finally {
      clearAuth()
      void navigate({ to: '/login' })
    }
  }

  const leafLink = (leaf: NavLeaf, nested = false) => {
    const active = leaf.href === activeHref
    return (
      <CollapsedTip key={leaf.href} label={leaf.label} enabled={collapsed}>
        <Link
          to={leaf.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group relative flex items-center gap-3 rounded-[9px] text-sm font-medium transition-colors',
            nested ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2',
            active
              ? 'bg-primary-soft font-semibold text-primary-text'
              : 'text-text-2 hover:bg-panel hover:text-foreground',
            collapsed && 'justify-center px-2 py-2',
          )}
        >
          {nested && !collapsed ? (
            <span
              className={cn(
                'absolute -left-[13px] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-colors',
                active ? 'bg-primary' : 'bg-transparent',
              )}
            />
          ) : null}
          <leaf.icon size={nested ? 16 : 18} className="shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{leaf.label}</span>}
        </Link>
      </CollapsedTip>
    )
  }

  const groupBlock = (group: NavGroup) => {
    const hasActive = group.children.some((c) => c.href === activeHref)
    if (collapsed) {
      // Collapsed: the group is one icon that opens a flyout of its links.
      return (
        <DropdownMenu key={group.label}>
          <CollapsedTip label={group.label} enabled>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={group.label}
                className={cn(
                  'flex w-full items-center justify-center rounded-[9px] px-2 py-2 transition-colors',
                  hasActive
                    ? 'bg-primary-soft text-primary-text'
                    : 'text-text-2 hover:bg-panel hover:text-foreground',
                )}
              >
                <group.icon size={18} />
              </button>
            </DropdownMenuTrigger>
          </CollapsedTip>
          <DropdownMenuContent side="right" align="start" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            {group.children.map((c) => (
              <DropdownMenuItem
                key={c.href}
                asChild
                className={cn(
                  c.href === activeHref && 'font-semibold text-primary-text',
                )}
              >
                <Link to={c.href}>
                  <c.icon className="mr-2 h-3.5 w-3.5" />
                  {c.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    const open = isOpen(group.label)
    return (
      <div key={group.label}>
        <button
          type="button"
          onClick={() => toggleGroup(group.label)}
          aria-expanded={open}
          className={cn(
            'flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-sm font-medium transition-colors',
            hasActive
              ? 'text-foreground'
              : 'text-text-2 hover:bg-panel hover:text-foreground',
          )}
        >
          <group.icon
            size={18}
            className={cn('shrink-0', hasActive && 'text-primary')}
          />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            size={15}
            className={cn(
              'shrink-0 text-text-3 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <ul className="ml-[21px] space-y-0.5 overflow-hidden border-l border-sidebar-border pl-3">
            {group.children.map((c) => (
              <li key={c.href} className="first:mt-0.5 last:mb-1">
                {leafLink(c, true)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
          collapsed
            ? 'w-[var(--spacing-sidebar-collapsed)]'
            : 'w-[var(--spacing-sidebar)]',
        )}
      >
        {/* Brand + collapse toggle */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border',
            collapsed ? 'justify-center' : 'justify-between px-4',
          )}
        >
          {collapsed ? (
            <CollapsedTip label="Expand sidebar" enabled>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-600 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                M
              </button>
            </CollapsedTip>
          ) : (
            <>
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-600">
                  <span className="text-sm font-bold text-white">M</span>
                </div>
                <span className="whitespace-nowrap text-lg font-bold text-foreground">
                  MedTrackr
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    aria-label="Collapse sidebar"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Collapse sidebar
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav
          ref={navRef}
          onScroll={(e) => {
            savedNavScroll = e.currentTarget.scrollTop
          }}
          className="flex-1 overflow-y-auto px-3 py-3"
          aria-label="Main"
        >
          {sections.map((section, i) => (
            <div key={section.label ?? i} className={cn(i > 0 && 'mt-3')}>
              {section.label &&
                (collapsed ? (
                  <div className="mx-2 mb-2 border-t border-sidebar-border" />
                ) : (
                  <div className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-text-3">
                    {section.label}
                  </div>
                ))}
              <div className="space-y-0.5">
                {section.items.map((e) =>
                  isGroup(e) ? groupBlock(e) : leafLink(e),
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: settings + profile with sign out */}
        <div className="shrink-0 space-y-2 border-t border-border px-3 py-3">
          {leafLink(SETTINGS)}
          <div
            className={cn(
              'flex items-center gap-2 rounded-[9px] bg-panel/60 p-2',
              collapsed && 'flex-col bg-transparent p-0',
            )}
          >
            <CollapsedTip label={user?.name || 'Profile'} enabled={collapsed}>
              <Link
                to="/settings"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg"
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {user?.name || 'User'}
                    </p>
                    <p className="truncate text-[11px] text-text-3">
                      {user?.email ?? user?.globalRole ?? 'Member'}
                    </p>
                  </div>
                )}
              </Link>
            </CollapsedTip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                  aria-label="Sign out"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  {isLoggingOut ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <LogOut size={16} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent
                side={collapsed ? 'right' : 'top'}
                className="text-xs"
              >
                Sign out
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
