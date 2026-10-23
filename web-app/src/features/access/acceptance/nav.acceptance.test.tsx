import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { Sidebar } from '@/components/layout/Sidebar'
import { useUIStore } from '@/store/ui-store'
import { useAuthStore } from '@/store/useAuthStore'
import { AccessContext } from '../lib/access-context'
import { HomeRedirect } from '../components/HomeRedirect'
import { RouteAccessGate } from '../components/RouteAccessGate'
import type { NavLayout } from '../nav/nav.registry'
import { accessValue, meFor, renderAs } from './actors'
import type { ActorName } from './actors'

// ── Mocks: router, API, brand, page shell ───────────────────────────────────
const router = vi.hoisted(() => ({
  path: '/dashboard',
  navigatedTo: null as string | null,
  routes: {} as Partial<Record<string, { staticData?: { can?: unknown } }[]>>,
  matches: [] as { staticData: { can?: unknown } }[],
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
  useMatches: () => router.matches,
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

beforeEach(() => {
  router.path = '/dashboard'
  router.navigatedTo = null
  router.routes = {}
  router.matches = []
  useUIStore.setState({ sidebarCollapsed: false })
  useAuthStore.setState({ labMemberships: [] } as never)
})

const hrefs = () =>
  [...document.querySelectorAll('nav[aria-label="Main"] a')].map((a) =>
    a.getAttribute('href'),
  )
const nav = () => screen.getByRole('navigation', { name: 'Main' })

/** `staticData.can` of a route file, read from source (routes are the contract). */
function routeCan(file: string): string | string[] {
  const src = readFileSync(join(__dirname, '../../../routes', file), 'utf8')
  const m = /staticData:\s*\{\s*can:\s*(\[[^\]]*\]|'[^']*')/.exec(src)
  if (!m) throw new Error(`${file} declares no staticData.can`)
  return (JSON.parse(m[1].replace(/'/g, '"')) as string | string[]) ?? ''
}

describe('NAV — sidebar', () => {
  it('NAV-01 default sidebar per role: only items whose `can` passes; empty groups/sections hidden; "Clinic setup" only for admin/owner', () => {
    const seen: Record<string, (string | null)[]> = {}
    const sections: Record<string, boolean> = {}
    for (const actor of ['Doc1', 'RecU', 'AcctU', 'OwnerA', 'AdminU'] as ActorName[]) {
      const { unmount } = renderAs(actor, <Sidebar />)
      seen[actor] = hrefs()
      sections[actor] = !!within(nav()).queryByText('Clinic setup')
      unmount()
    }
    // Doctor: own queue, patients, appointments; no billing, no setup.
    expect(seen.Doc1).toEqual(
      expect.arrayContaining(['/queue/doctor', '/patients', '/my-earnings']),
    )
    expect(seen.Doc1).not.toContain('/billing')
    expect(seen.Doc1).not.toContain('/payroll')
    expect(seen.Doc1).not.toContain('/admin/roles')
    // Receptionist: billing desk yes; payroll / finance / roles no.
    expect(seen.RecU).toEqual(
      expect.arrayContaining(['/billing', '/patients', '/appointments']),
    )
    for (const h of ['/payroll', '/finance', '/admin/roles', '/queue/doctor'])
      expect(seen.RecU).not.toContain(h)
    // Accountant: finance + invoices; no clinical queue.
    expect(seen.AcctU).toEqual(
      expect.arrayContaining(['/finance', '/invoices', '/billing']),
    )
    expect(seen.AcctU).not.toContain('/queue/doctor')
    // Clinic setup: admin + owner only.
    expect(sections).toEqual({
      Doc1: false,
      RecU: false,
      AcctU: false,
      OwnerA: true,
      AdminU: true,
    })
    // Empty sections are not rendered at all (Doctor has no Finance billing items).
    renderAs('Doc1', <Sidebar />)
    expect(within(nav()).queryByText('Team')).toBeNull()
    expect(within(nav()).queryByText('Billing')).toBeNull()
  })

  it('NAV-02 super-admin-only items: hidden for a non-SA owner, visible for SA', () => {
    const owner = renderAs('OwnerA', <Sidebar />)
    for (const h of ['/organizations', '/lab-directory', '/studio/forms'])
      expect(hrefs()).not.toContain(h)
    owner.unmount()
    renderAs('SA', <Sidebar />)
    for (const h of ['/organizations', '/lab-directory', '/studio/forms'])
      expect(hrefs()).toContain(h)
  })

  it('NAV-03 lab portal item: visible with labMemberships', () => {
    renderAs('RecU', <Sidebar />)
    expect(hrefs()).not.toContain('/lab-portal')
    document.body.innerHTML = ''
    useAuthStore.setState({
      labMemberships: [{ labId: 'lab1', labName: 'Lab', role: 'lab_admin' }],
    } as never)
    renderAs('RecU', <Sidebar />)
    expect(hrefs()).toContain('/lab-portal')
  })

  it('NAV-08 layout never grants: nav.payroll in the layout without payroll.manage → not shown; direct URL → NoAccess', () => {
    const layout: NavLayout = {
      sections: [{ label: 'Money', items: [{ key: 'nav.payroll' }] }],
    }
    const { unmount } = renderAs(meFor('RecU', { nav: layout }), <Sidebar />)
    expect(hrefs()).not.toContain('/payroll')
    expect(screen.queryByText('Money')).toBeNull()
    unmount()

    router.matches = [{ staticData: { can: routeCan('payroll.tsx') } }]
    renderAs(
      meFor('RecU', { nav: layout }),
      <RouteAccessGate>
        <span>payroll page</span>
      </RouteAccessGate>,
    )
    expect(screen.queryByText('payroll page')).toBeNull()
    expect(screen.getByText('Aapke paas is page ki permission nahi')).toBeTruthy()
  })

  it('NAV-09 unknown keys in the server layout are ignored without a crash', () => {
    const layout = {
      sections: [
        {
          label: 'Front',
          items: [{ key: 'nav.ghost' }, { key: 'nav.patients' }, null, 42],
        },
        null,
      ],
      hidden: ['nav.also.ghost', null],
    } as unknown as NavLayout
    renderAs(meFor('RecU', { nav: layout }), <Sidebar />)
    expect(hrefs()).toContain('/patients')
    expect(document.body.textContent).not.toContain('nav.ghost')
  })

  it('NAV-10 pages the layout omits go under "More"', () => {
    const layout: NavLayout = {
      sections: [{ label: 'Front desk', items: [{ key: 'nav.patients' }] }],
    }
    renderAs(meFor('RecU', { nav: layout }), <Sidebar />)
    const more = within(nav()).getByText('More')
    expect(more).toBeTruthy()
    // Billing desk and appointments are visible to the receptionist but not in the layout.
    expect(hrefs()).toEqual(
      expect.arrayContaining(['/patients', '/billing', '/appointments']),
    )
    const links = [...nav().querySelectorAll('a')].map((a) => a.textContent)
    expect(links.indexOf('Patients')).toBeLessThan(
      links.indexOf('Appointments'),
    )
  })

  it('NAV-11 renamed label shows in the sidebar, the collapsed tooltip and the active link', async () => {
    const layout: NavLayout = {
      sections: [
        {
          label: 'Front desk',
          items: [{ key: 'nav.billing.desk', label: 'Cash counter' }],
        },
      ],
    }
    router.path = '/billing'
    const { unmount } = renderAs(meFor('RecU', { nav: layout }), <Sidebar />)
    expect(within(nav()).getByText('Cash counter')).toBeTruthy()
    expect(within(nav()).queryByText('Billing desk')).toBeNull()
    expect(
      document.querySelector('a[aria-current="page"]')?.textContent,
    ).toBe('Cash counter')
    unmount()

    useUIStore.setState({ sidebarCollapsed: true })
    renderAs(meFor('RecU', { nav: layout }), <Sidebar />)
    const link = document.querySelector('a[href="/billing"]')!
    expect(link.textContent).toBe('')
    fireEvent.focus(link)
    expect((await screen.findByRole('tooltip')).textContent).toBe('Cash counter')
  })
})

describe('NAV — builder access', () => {
  it('NAV-13 RecU opens /admin/navigation → NoAccess page; the owner gets the page', () => {
    router.matches = [{ staticData: { can: routeCan('admin.navigation.tsx') } }]
    const rec = renderAs(
      'RecU',
      <RouteAccessGate>
        <span>sidebar builder</span>
      </RouteAccessGate>,
    )
    expect(screen.queryByText('sidebar builder')).toBeNull()
    expect(screen.getByText('Aapke paas is page ki permission nahi')).toBeTruthy()
    rec.unmount()
    renderAs(
      'OwnerA',
      <RouteAccessGate>
        <span>sidebar builder</span>
      </RouteAccessGate>,
    )
    expect(screen.getByText('sidebar builder')).toBeTruthy()
  })
})

describe('NAV — home redirect', () => {
  beforeEach(() => {
    router.routes = {
      '/queue/doctor': [{ staticData: { can: 'queue.doctor.own' } }],
      '/appointments': [
        { staticData: { can: ['appointments.view', 'queue.board.view'] } },
      ],
      '/billing': [{ staticData: { can: 'billing.desk.use' } }],
    }
  })

  it('NAV-14 Doc1 visiting / lands on /queue/doctor (Doctor template home)', () => {
    renderAs('Doc1', <HomeRedirect />)
    expect(router.navigatedTo).toBe('/queue/doctor')
  })

  it("NAV-15 a role home the user can't see falls back to /dashboard", () => {
    // Receptionist whose role home points at the doctor queue.
    renderAs(meFor('RecU', { homeRoute: '/queue/doctor' }), <HomeRedirect />)
    expect(router.navigatedTo).toBe('/dashboard')
  })

  it('NAV-16 visiting /dashboard directly stays there (no forced redirect)', () => {
    const route = readFileSync(
      join(__dirname, '../../../routes/dashboard.tsx'),
      'utf8',
    )
    // The dashboard route renders the page; its only redirect is to /login without a token.
    expect(route).not.toMatch(/HomeRedirect|resolveHomeRoute|to="\/"/)
    expect(route).toMatch(/<Navigate to="\/login"/)
    // The root guard forwards to `/` only from public paths (login, register…), never from /dashboard.
    const root = readFileSync(
      join(__dirname, '../../../routes/__root.tsx'),
      'utf8',
    )
    expect(root).toMatch(/isAuthenticated && isPublicRoute && !isSelectLocationPage/)
    expect(root).not.toMatch(/pathname === '\/dashboard'/)
    // And a Doc1 whose home is the queue is still shown the dashboard at /dashboard: it has no staticData gate.
    const ctx = accessValue(meFor('Doc1'))
    router.matches = [{ staticData: {} }]
    render(
      <AccessContext.Provider value={ctx}>
        <RouteAccessGate>
          <span>dashboard page</span>
        </RouteAccessGate>
      </AccessContext.Provider>,
    )
    expect(screen.getByText('dashboard page')).toBeTruthy()
    expect(router.navigatedTo).toBeNull()
  })
})
