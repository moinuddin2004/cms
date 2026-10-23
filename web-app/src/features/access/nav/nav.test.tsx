import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { Sidebar } from '@/components/layout/Sidebar'
import { useUIStore } from '@/store/ui-store'
import { createAccessChecks } from '../lib/access'
import { AccessContext, DISABLED_ACCESS } from '../lib/access-context'
import type { AccessContextValue } from '../lib/access-context'
import { HomeRedirect } from '../components/HomeRedirect'
import type { MeAccess, PermissionRequirement } from '../types/access.types'
import { DEFAULT_HOME_ROUTE, resolveHomeRoute } from './homeRoute'
import type { RouteRequirementsFn } from './homeRoute'
import type { NavLayout } from './nav.registry'
import type { NavViewer } from './resolveNav'

// ── Mocks: router, API, brand ────────────────────────────────────────────
const router = vi.hoisted(() => ({
  path: '/dashboard',
  navigatedTo: null as string | null,
  routes: {} as Partial<Record<string, { staticData?: { can?: string } }[]>>,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: ReactNode
    to: string
    [k: string]: unknown
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  Navigate: ({ to }: { to: string }) => {
    router.navigatedTo = to
    return null
  },
  useNavigate: () => vi.fn(),
  useRouterState: ({
    select,
  }: {
    select: (s: { location: { pathname: string } }) => unknown
  }) => select({ location: { pathname: router.path } }),
  useRouter: () => ({
    getMatchedRoutes: (path: string) => {
      const matched = router.routes[path]
      return {
        foundRoute: matched ? {} : undefined,
        matchedRoutes: (matched ?? []).map((r) => ({ options: r })),
      }
    },
  }),
}))
vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }))
vi.mock('@/components/layout/BrandMark', () => ({ BrandMark: () => null }))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

function me(over: Partial<MeAccess> = {}): MeAccess {
  return {
    version: 1,
    organizationId: 'org1',
    locationId: 'loc1',
    isSuperAdmin: false,
    isOwner: false,
    features: [],
    permissions: {
      'patients.view': 'location',
      'appointments.view': 'location',
      'billing.desk.use': true,
    },
    roles: [],
    employeeId: 'emp1',
    homeRoute: null,
    nav: null,
    ...over,
  }
}

function ctx(data: MeAccess): AccessContextValue {
  return {
    ...DISABLED_ACCESS,
    ...createAccessChecks(data),
    status: 'ready',
    homeRoute: data.homeRoute,
    nav: data.nav,
    version: data.version,
  }
}

const renderWith = (value: AccessContextValue, ui: ReactNode) =>
  render(<AccessContext.Provider value={value}>{ui}</AccessContext.Provider>)

const SERVER_LAYOUT: NavLayout = {
  sections: [
    {
      label: 'Front desk',
      items: [
        { key: 'nav.not.in.this.build' },
        { key: 'nav.patients', label: 'Clients' },
        { key: 'nav.appointments' },
        { key: 'nav.billing.desk', label: 'Cash counter' },
      ],
    },
  ],
  hidden: ['nav.appointments'],
}

beforeEach(() => {
  router.path = '/dashboard'
  router.navigatedTo = null
  router.routes = {}
  useUIStore.setState({ sidebarCollapsed: false })
})

// ── Sidebar from the server layout ───────────────────────────────────────
describe('Sidebar with a clinic layout', () => {
  it('uses the server layout, ignores unknown keys, unplaced pages go to More', () => {
    renderWith(ctx(me({ nav: SERVER_LAYOUT })), <Sidebar />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByText('Front desk')).toBeTruthy()
    expect(within(nav).queryByText('Clinic')).toBeNull() // default section gone
    expect(nav.querySelector('a[href="/patients"]')).toBeTruthy()
    // Not in the layout → trailing "More" section (Dashboard has no permission).
    expect(within(nav).getByText('More')).toBeTruthy()
    expect(nav.querySelector('a[href="/dashboard"]')).toBeTruthy()
    expect(within(nav).queryByText(/not\.in\.this\.build/)).toBeNull()
  })

  it('shows renamed labels', () => {
    renderWith(ctx(me({ nav: SERVER_LAYOUT })), <Sidebar />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByText('Clients')).toBeTruthy()
    expect(within(nav).getByText('Cash counter')).toBeTruthy()
    expect(within(nav).queryByText('Patients')).toBeNull()
    expect(within(nav).queryByText('Billing desk')).toBeNull()
  })

  it('the active link carries the renamed label', () => {
    router.path = '/patients/123'
    renderWith(ctx(me({ nav: SERVER_LAYOUT })), <Sidebar />)
    const active = document.querySelector('a[aria-current="page"]')
    expect(active?.getAttribute('href')).toBe('/patients')
    expect(active?.textContent).toBe('Clients')
  })

  it('collapsed tooltips use the renamed label', async () => {
    useUIStore.setState({ sidebarCollapsed: true })
    renderWith(ctx(me({ nav: SERVER_LAYOUT })), <Sidebar />)
    const link = document.querySelector('a[href="/patients"]')!
    expect(link.textContent).toBe('') // icon only
    fireEvent.focus(link)
    expect((await screen.findByRole('tooltip')).textContent).toBe('Clients')
  })

  it('drops hidden items', () => {
    renderWith(ctx(me({ nav: SERVER_LAYOUT })), <Sidebar />)
    expect(document.querySelector('a[href="/appointments"]')).toBeNull()
  })

  it('never shows a layout item the user has no permission for', () => {
    const layout: NavLayout = {
      sections: [{ label: 'Money', items: [{ key: 'nav.payroll' }] }],
    }
    renderWith(ctx(me({ nav: layout })), <Sidebar />)
    expect(document.querySelector('a[href="/payroll"]')).toBeNull()
    expect(screen.queryByText('Money')).toBeNull()
  })

  it('falls back to the code default without a server layout', () => {
    renderWith(ctx(me()), <Sidebar />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByText('Clinic')).toBeTruthy()
    expect(within(nav).getByText('Patients')).toBeTruthy()
  })
})

// ── Home page ────────────────────────────────────────────────────────────
describe('resolveHomeRoute', () => {
  const viewer = (perms: string[]): NavViewer => ({
    can: (p) =>
      p == null ||
      (typeof p === 'string'
        ? perms.includes(p)
        : p.some((x) => perms.includes(x))),
    isSuperAdmin: false,
    isOwner: false,
    isLabMember: false,
  })
  const ROUTES: Partial<Record<string, PermissionRequirement[]>> = {
    '/queue/doctor': ['queue.doctor.own'],
    '/billing': ['billing.desk.use'],
    '/patients': [],
  }
  const routes: RouteRequirementsFn = (path) => ROUTES[path] ?? null

  it('goes to the home page when the user may open it', () => {
    expect(
      resolveHomeRoute('/queue/doctor', viewer(['queue.doctor.own']), routes),
    ).toBe('/queue/doctor')
    expect(
      resolveHomeRoute(
        '/billing?tab=desk',
        viewer(['billing.desk.use']),
        routes,
      ),
    ).toBe('/billing')
  })

  it('falls back to the dashboard when not permitted', () => {
    expect(resolveHomeRoute('/queue/doctor', viewer([]), routes)).toBe(
      DEFAULT_HOME_ROUTE,
    )
    // Route itself has no staticData.can, but the nav item needs patients.view.
    expect(resolveHomeRoute('/patients', viewer([]), routes)).toBe(
      DEFAULT_HOME_ROUTE,
    )
  })

  it('falls back for unknown or off-site routes and when none is set', () => {
    const v = viewer(['queue.doctor.own'])
    expect(resolveHomeRoute('/no-such-page', v, routes)).toBe(
      DEFAULT_HOME_ROUTE,
    )
    expect(resolveHomeRoute('//evil.test', v, routes)).toBe(DEFAULT_HOME_ROUTE)
    expect(resolveHomeRoute('https://evil.test', v, routes)).toBe(
      DEFAULT_HOME_ROUTE,
    )
    expect(resolveHomeRoute(null, v, routes)).toBe(DEFAULT_HOME_ROUTE)
  })
})

describe('HomeRedirect (/)', () => {
  beforeEach(() => {
    router.routes = {
      '/queue/doctor': [{ staticData: { can: 'queue.doctor.own' } }],
      '/billing': [{}],
    }
  })

  it("redirects to the role's home page when allowed", () => {
    const data = me({
      homeRoute: '/queue/doctor',
      permissions: { 'queue.doctor.own': true },
    })
    renderWith(ctx(data), <HomeRedirect />)
    expect(router.navigatedTo).toBe('/queue/doctor')
  })

  it('falls back to /dashboard when the role may not open it', () => {
    renderWith(ctx(me({ homeRoute: '/queue/doctor' })), <HomeRedirect />)
    expect(router.navigatedTo).toBe('/dashboard')
  })

  it("uses the clinic layout's home page when the role sets none", () => {
    const data = me({ nav: { sections: [], homeRoute: '/billing' } })
    renderWith(ctx(data), <HomeRedirect />)
    expect(router.navigatedTo).toBe('/billing')
  })

  it('waits while access loads', () => {
    renderWith(
      { ...ctx(me({ homeRoute: '/billing' })), status: 'loading' },
      <HomeRedirect />,
    )
    expect(router.navigatedTo).toBeNull()
  })
})
