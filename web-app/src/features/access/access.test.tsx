import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useAuthStore } from '@/store/useAuthStore'
import { createAccessChecks } from './lib/access'
import { AccessContext, DISABLED_ACCESS } from './lib/access-context'
import type { AccessContextValue } from './lib/access-context'
import { AccessProvider } from './components/AccessProvider'
import { Can, CanAll } from './components/Can'
import { useAccess } from './hooks/useAccess'
import { RouteAccessGate } from './components/RouteAccessGate'
import { accessKeys, useMyAccess } from './hooks/useMyAccess'
import { DEFAULT_NAV_LAYOUT, NAV_ITEMS } from './nav/nav.registry'
import type { NavLayout } from './nav/nav.registry'
import { isNavGroup, resolveNav } from './nav/resolveNav'
import type { NavViewer } from './nav/resolveNav'
import type { MeAccess } from './types/access.types'

// ── Mocks: API transport, router hooks, page shell ───────────────────────
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
const matches = vi.hoisted(() => ({
  current: [] as { staticData: { can?: string | string[] } }[],
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useMatches: () => matches.current,
}))
const socket = vi.hoisted(() => ({
  onChange: null as
    | null
    | ((e: { organizationId: string; version: number } | null) => void),
}))
vi.mock('./hooks/useAccessSocket', () => ({
  useAccessSocket: (_org: string, onChange: typeof socket.onChange) => {
    socket.onChange = onChange
  },
}))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}))

function me(over: Partial<MeAccess> = {}): MeAccess {
  return {
    version: 3,
    organizationId: 'org1',
    locationId: 'loc1',
    isSuperAdmin: false,
    isOwner: false,
    features: ['billing.invoices'],
    permissions: {
      'patients.view': 'own',
      'billing.invoice.void': true,
      'appointments.view': 'location',
    },
    roles: [],
    employeeId: 'emp1',
    homeRoute: null,
    nav: null,
    ...over,
  }
}

function ctx(
  data: MeAccess | undefined,
  over: Partial<AccessContextValue> = {},
): AccessContextValue {
  return {
    ...DISABLED_ACCESS,
    ...createAccessChecks(data),
    status: data ? 'ready' : 'loading',
    isSuperAdmin: data?.isSuperAdmin ?? false,
    isOwner: data?.isOwner ?? false,
    ...over,
  }
}

const withAccess = (value: AccessContextValue) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
    )
  }

// ── can / canAll / scope ─────────────────────────────────────────────────
describe('createAccessChecks', () => {
  const a = createAccessChecks(me())

  it('can() is true for a granted key and false for a missing one', () => {
    expect(a.can('patients.view')).toBe(true)
    expect(a.can('billing.invoice.void')).toBe(true)
    expect(a.can('payroll.manage')).toBe(false)
  })

  it('can() with an array is any-of; no requirement passes', () => {
    expect(a.can(['payroll.manage', 'patients.view'])).toBe(true)
    expect(a.can(['payroll.manage', 'finance.overview.view'])).toBe(false)
    expect(a.can(undefined)).toBe(true)
    expect(a.can([])).toBe(true)
  })

  it('canAll() needs every permission', () => {
    expect(a.canAll(['patients.view', 'appointments.view'])).toBe(true)
    expect(a.canAll(['patients.view', 'payroll.manage'])).toBe(false)
  })

  it('scope() returns the granted scope; unscoped grants read as org', () => {
    expect(a.scope('patients.view')).toBe('own')
    expect(a.scope('appointments.view')).toBe('location')
    expect(a.scope('billing.invoice.void')).toBe('org')
    expect(a.scope('payroll.manage')).toBeNull()
  })

  it('features / hasFeature come from the payload', () => {
    expect(a.hasFeature('billing.invoices')).toBe(true)
    expect(a.hasFeature('hr.payroll')).toBe(false)
  })

  it('denies everything without a payload unless the super-admin fallback is on', () => {
    expect(createAccessChecks(undefined).can('patients.view')).toBe(false)
    const sa = createAccessChecks(undefined, { allowAll: true })
    expect(sa.can('patients.view')).toBe(true)
    expect(sa.scope('patients.view')).toBe('org')
  })

  it('a loaded payload wins over the fallback', () => {
    const b = createAccessChecks(me({ permissions: {} }), { allowAll: true })
    expect(b.can('patients.view')).toBe(false)
  })
})

// ── <Can> / <CanAll> ─────────────────────────────────────────────────────
describe('<Can>', () => {
  it('renders children when allowed, fallback otherwise', () => {
    const Wrapper = withAccess(ctx(me()))
    render(
      <Wrapper>
        <Can perm="billing.invoice.void">
          <button>Void</button>
        </Can>
        <Can perm="payroll.manage" fallback={<span>locked</span>}>
          <button>Run payroll</button>
        </Can>
        <Can perm={['payroll.manage', 'patients.view']}>
          <span>any-of ok</span>
        </Can>
        <CanAll perms={['patients.view', 'payroll.manage']}>
          <span>all-of</span>
        </CanAll>
      </Wrapper>,
    )
    expect(screen.getByText('Void')).toBeTruthy()
    expect(screen.queryByText('Run payroll')).toBeNull()
    expect(screen.getByText('locked')).toBeTruthy()
    expect(screen.getByText('any-of ok')).toBeTruthy()
    expect(screen.queryByText('all-of')).toBeNull()
  })

  it('renders nothing outside a provider (disabled access)', () => {
    render(
      <Can perm="patients.view">
        <span>secret</span>
      </Can>,
    )
    expect(screen.queryByText('secret')).toBeNull()
  })
})

// ── Central route check ──────────────────────────────────────────────────
describe('<RouteAccessGate>', () => {
  afterEach(() => {
    matches.current = []
  })

  const page = <span>finance page</span>

  it('passes routes without staticData.can straight through', () => {
    matches.current = [{ staticData: {} }]
    const Wrapper = withAccess(ctx(undefined))
    render(<RouteAccessGate>{page}</RouteAccessGate>, { wrapper: Wrapper })
    expect(screen.getByText('finance page')).toBeTruthy()
  })

  it('renders the page when every matched requirement is met', () => {
    matches.current = [
      { staticData: {} },
      { staticData: { can: ['finance.overview.view', 'patients.view'] } },
    ]
    const Wrapper = withAccess(ctx(me()))
    render(<RouteAccessGate>{page}</RouteAccessGate>, { wrapper: Wrapper })
    expect(screen.getByText('finance page')).toBeTruthy()
  })

  it('renders <NoAccess/> when a requirement is missing', () => {
    matches.current = [
      { staticData: { can: 'patients.view' } },
      { staticData: { can: 'finance.overview.view' } },
    ]
    const Wrapper = withAccess(ctx(me()))
    render(<RouteAccessGate>{page}</RouteAccessGate>, { wrapper: Wrapper })
    expect(screen.queryByText('finance page')).toBeNull()
    expect(
      screen.getByText('Aapke paas is page ki permission nahi'),
    ).toBeTruthy()
  })

  it('shows a skeleton (not the page, not NoAccess) while loading', () => {
    matches.current = [{ staticData: { can: 'finance.overview.view' } }]
    const Wrapper = withAccess(ctx(undefined, { isLoading: true }))
    const { container } = render(<RouteAccessGate>{page}</RouteAccessGate>, {
      wrapper: Wrapper,
    })
    expect(screen.queryByText('finance page')).toBeNull()
    expect(screen.queryByText(/permission nahi/)).toBeNull()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy()
  })

  it('shows an error with retry when access fails to load', () => {
    matches.current = [{ staticData: { can: 'finance.overview.view' } }]
    const refetch = vi.fn()
    const Wrapper = withAccess(
      ctx(undefined, { status: 'error', isError: true, refetch }),
    )
    render(<RouteAccessGate>{page}</RouteAccessGate>, { wrapper: Wrapper })
    screen.getByRole('button', { name: /try again|retry/i }).click()
    expect(refetch).toHaveBeenCalled()
  })
})

// ── Nav filtering ────────────────────────────────────────────────────────
describe('resolveNav', () => {
  const viewer = (
    perms: string[],
    over: Partial<NavViewer> = {},
  ): NavViewer => {
    const checks = createAccessChecks(
      me({ permissions: Object.fromEntries(perms.map((p) => [p, true])) }),
    )
    return {
      can: checks.can,
      isSuperAdmin: false,
      isOwner: false,
      isLabMember: false,
      ...over,
    }
  }
  const hrefs = (layout: NavLayout, v: NavViewer) =>
    resolveNav(layout, v).flatMap((s) =>
      s.items.flatMap((e) =>
        isNavGroup(e) ? e.children.map((c) => c.href) : [e.href],
      ),
    )

  it('default layout places every registry item except the footer', () => {
    const all = viewer([], {
      can: () => true,
      isSuperAdmin: true,
      isLabMember: true,
    })
    const shown = hrefs(DEFAULT_NAV_LAYOUT, all)
    const expected = Object.entries(NAV_ITEMS)
      .filter(([k]) => k !== 'nav.settings')
      .map(([, d]) => d.href)
    expect(shown.sort()).toEqual(expected.sort())
    // No "More" section: the default layout forgets nothing.
    expect(resolveNav(DEFAULT_NAV_LAYOUT, all).map((s) => s.label)).toEqual([
      undefined,
      'Clinic',
      'Finance',
      'Team',
      'Admin',
    ])
  })

  it('superAdminOnly items need a super admin', () => {
    const owner = viewer([], { can: () => true, isOwner: true })
    expect(hrefs(DEFAULT_NAV_LAYOUT, owner)).not.toContain('/organizations')
    expect(hrefs(DEFAULT_NAV_LAYOUT, owner)).not.toContain('/studio/forms')
    const sa = viewer([], { can: () => true, isSuperAdmin: true })
    expect(hrefs(DEFAULT_NAV_LAYOUT, sa)).toContain('/organizations')
    expect(hrefs(DEFAULT_NAV_LAYOUT, sa)).toContain('/studio/forms')
  })

  it('Lab portal shows only for lab members', () => {
    expect(hrefs(DEFAULT_NAV_LAYOUT, viewer([]))).not.toContain('/lab-portal')
    expect(
      hrefs(DEFAULT_NAV_LAYOUT, viewer([], { isLabMember: true })),
    ).toContain('/lab-portal')
  })

  it('any-of items show with either permission', () => {
    expect(
      hrefs(DEFAULT_NAV_LAYOUT, viewer(['reports.clinical.view'])),
    ).toEqual(expect.arrayContaining(['/reports', '/clinic-overview']))
    expect(
      hrefs(DEFAULT_NAV_LAYOUT, viewer(['reports.financial.view'])),
    ).toEqual(expect.arrayContaining(['/reports', '/billing/doctor-revenue']))
    expect(hrefs(DEFAULT_NAV_LAYOUT, viewer([]))).not.toContain('/reports')
  })

  it('drops empty groups and sections', () => {
    // Receptionist-like: billing desk only → Finance keeps just the Billing group.
    const sections = resolveNav(
      DEFAULT_NAV_LAYOUT,
      viewer(['billing.desk.use']),
    )
    expect(sections.map((s) => s.label)).toEqual([undefined, 'Finance'])
    const finance = sections[1]
    expect(finance.items).toHaveLength(1)
    const billing = finance.items[0]
    expect(isNavGroup(billing) && billing.label).toBe('Billing')
    expect(isNavGroup(billing) && billing.children.map((c) => c.href)).toEqual([
      '/billing',
    ])
  })

  it('applies renames and hidden keys, and never lets the layout grant access', () => {
    const layout: NavLayout = {
      sections: [
        {
          label: 'Front desk',
          items: [
            { key: 'nav.billing.desk', label: 'Cash counter' },
            { key: 'nav.payroll' },
            { key: 'nav.unknown' },
          ],
        },
        {
          label: 'Paisa',
          group: true,
          icon: 'Wallet',
          items: [{ key: 'nav.invoices' }, { key: 'nav.payments' }],
        },
      ],
      hidden: ['nav.payments'],
    }
    const sections = resolveNav(
      layout,
      viewer([
        'billing.desk.use',
        'billing.invoice.view',
        'billing.payment.collect',
      ]),
    )
    expect(sections[0].items).toEqual([
      expect.objectContaining({ label: 'Cash counter', href: '/billing' }),
    ])
    const paisa = sections[1].items[0]
    expect(isNavGroup(paisa) && paisa.label).toBe('Paisa')
    expect(isNavGroup(paisa) && paisa.children.map((c) => c.href)).toEqual([
      '/invoices',
    ])
  })

  it('puts permitted items the layout forgot into "More"', () => {
    const layout: NavLayout = {
      sections: [{ items: [{ key: 'nav.dashboard' }] }],
    }
    const sections = resolveNav(layout, viewer(['payroll.manage']))
    const more = sections.find((s) => s.label === 'More')
    expect(more?.items.map((e) => !isNavGroup(e) && e.href)).toEqual([
      '/payroll',
    ])
  })
})

// ── Query key ────────────────────────────────────────────────────────────
describe('useMyAccess', () => {
  beforeEach(() => {
    api.get.mockReset()
    useAuthStore.setState({
      activeOrganizationId: 'org1',
      activeLocationId: 'loc1',
    })
  })

  it('caches under org AND location and refetches on switch', async () => {
    api.get.mockResolvedValue({ data: { data: me() } })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useMyAccess(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api.get).toHaveBeenCalledWith('/me/access')
    expect(accessKeys.me('org1', 'loc1')).toEqual([
      'access',
      'me',
      'org1',
      'loc1',
    ])
    expect(client.getQueryData(['access', 'me', 'org1', 'loc1'])).toEqual(me())

    act(() => useAuthStore.setState({ activeLocationId: 'loc2' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(client.getQueryData(['access', 'me', 'org1', 'loc2'])).toBeTruthy()
  })
})

// ── Realtime refetch ─────────────────────────────────────────────────────
describe('<AccessProvider>', () => {
  beforeEach(() => {
    api.get.mockReset()
    useAuthStore.setState({
      activeOrganizationId: 'org1',
      activeLocationId: 'loc1',
    })
  })

  it('refetches on a newer access.changed version and ignores stale ones', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: me({ version: 3 }) } })
      .mockResolvedValue({
        data: {
          data: me({ version: 4, permissions: { 'payroll.manage': true } }),
        },
      })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function Probe() {
      const { can, status } = useAccess()
      return (
        <span>
          {status}:{String(can('payroll.manage'))}
        </span>
      )
    }
    render(
      <QueryClientProvider client={client}>
        <AccessProvider>
          <Probe />
        </AccessProvider>
      </QueryClientProvider>,
    )
    await screen.findByText('ready:false')

    act(() => socket.onChange?.({ organizationId: 'org1', version: 3 }))
    expect(api.get).toHaveBeenCalledTimes(1)

    act(() => socket.onChange?.({ organizationId: 'org1', version: 4 }))
    await screen.findByText('ready:true')
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
