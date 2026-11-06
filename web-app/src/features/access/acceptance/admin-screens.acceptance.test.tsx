import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useAuthStore } from '@/store/useAuthStore'
import { BUNDLES } from '@/features/access/generated/catalog'
import { RoleDetailPage } from '@/features/roles/pages/RoleDetailPage'
import type { RoleDetail } from '@/features/roles/types/roles.types'
import { FeatureSettings } from '@/features/feature-settings/pages/FeatureSettingsPage'
import { useFeatureSettingsStore } from '@/features/feature-settings/hooks/useFeatureSettingsStore'
import { DEFAULT_FEATURE_FILTERS } from '@/features/feature-settings/lib/filter-features'
import { LOCKED_MESSAGE } from '@/features/feature-settings/components/FeatureSwitchRow'
import type {
  OwnerFeature,
  OwnerFeaturesView,
} from '@/features/feature-settings/types/feature-settings.types'
import { OrgFeatureEntitlements } from '@/features/feature-flags/components/OrgFeatureEntitlements'

vi.setConfig({ testTimeout: 60_000 })

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: 'idle' }),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({
    title,
    actions,
    children,
  }: {
    title?: string
    actions?: ReactNode
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
}))
const features = vi.hoisted(() => ({
  has: (_k: string): boolean => true,
}))
vi.mock('@/features/access', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAccess: () => ({ hasFeature: (k: string) => features.has(k) }),
}))

const ok = (data: unknown) => Promise.resolve({ data: { data } })
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={client()}>{ui}</QueryClientProvider>
)

function role(over: Partial<RoleDetail> = {}): RoleDetail {
  return {
    id: 'role-1',
    name: 'Front desk',
    slug: 'front_desk',
    description: null,
    templateKey: null,
    homeRoute: null,
    isSystemRole: false,
    isActive: true,
    permissions: {},
    bundles: {} as RoleDetail['bundles'],
    memberCount: 0,
    members: [],
    createdAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    ...over,
  }
}
const levelControl = (group: string) =>
  screen.getByRole('radiogroup', { name: `${group} level` })
const radio = (group: string, name: string) =>
  within(levelControl(group)).getByRole('radio', { name })
const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled

beforeEach(() => {
  vi.clearAllMocks()
  features.has = () => true
  useAuthStore.setState({ activeOrganizationId: 'org1' } as never)
  useFeatureSettingsStore.setState({
    filters: DEFAULT_FEATURE_FILTERS,
    confirmOffKey: null,
    locationsKey: null,
  })
})

describe('ROLE — role detail screen', () => {
  it('ROLE-14 bundle control round trip: Basic → Full → None give BUNDLES.Billing.<level>; one Advanced checkbox shows Custom', async () => {
    for (const level of ['basic', 'full', 'none'] as const) {
      api.get.mockResolvedValue({ data: { data: role() } })
      api.patch.mockReset()
      api.patch.mockResolvedValue({ data: { data: role() } })
      // Start each step from a role that holds a different level so the click is a change.
      const start = level === 'none' ? BUNDLES.Billing.full : {}
      api.get.mockResolvedValue({
        data: { data: role({ permissions: start }) },
      })
      const { unmount } = render(wrap(<RoleDetailPage roleId="role-1" />))
      await screen.findByRole('heading', { name: 'Front desk' })
      const label = level[0].toUpperCase() + level.slice(1)
      fireEvent.click(radio('Billing', label))
      // Granting high-risk permissions (void, refund, price override…) asks for a reason first.
      if (await screen.findByText('Grant high-risk access?').catch(() => null)) {
        fireEvent.change(screen.getByLabelText(/reason/i), {
          target: { value: 'Acceptance run' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Grant access' }))
      }
      fireEvent.click(await screen.findByRole('button', { name: /save changes/i }))
      await waitFor(() => expect(api.patch).toHaveBeenCalled())
      const body = api.patch.mock.calls[0][1] as { permissions: object }
      expect(body.permissions).toEqual(BUNDLES.Billing[level])
      unmount()
    }

    // One Advanced checkbox flips the module to "Custom".
    api.get.mockResolvedValue({
      data: { data: role({ permissions: BUNDLES.Billing.basic }) },
    })
    render(wrap(<RoleDetailPage roleId="role-1" />))
    await screen.findByRole('heading', { name: 'Front desk' })
    expect(radio('Billing', 'Basic').getAttribute('aria-checked')).toBe('true')
    const section = levelControl('Billing').closest('section')!
    fireEvent.click(within(section).getByRole('button', { name: /Advanced/ }))
    const boxes = within(section).getAllByRole('checkbox')
    fireEvent.click(boxes[0])
    expect(
      within(levelControl('Billing'))
        .getByRole('radio', { name: 'Custom' })
        .getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('ROLE-15 system role UI is read-only: controls disabled, "Clone to edit" CTA visible', async () => {
    api.get.mockResolvedValue({
      data: {
        data: role({
          name: 'Admin',
          isSystemRole: true,
          templateKey: 'admin',
          permissions: BUNDLES.Billing.full,
        }),
      },
    })
    render(wrap(<RoleDetailPage roleId="role-1" />))
    await screen.findAllByRole('heading', { name: 'Admin' })
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull()
    expect(
      screen.getAllByRole('button', { name: /clone to edit/i }).length,
    ).toBeGreaterThan(0)
    for (const r of within(levelControl('Billing')).getAllByRole('radio'))
      expect(isDisabled(r)).toBe(true)
  })

  it('ROLE-16 permissions of a feature that is off are greyed with "Feature is off"', async () => {
    features.has = (k) => !k.startsWith('billing.')
    api.get.mockResolvedValue({
      data: { data: role({ permissions: BUNDLES.Billing.full }) },
    })
    render(wrap(<RoleDetailPage roleId="role-1" />))
    await screen.findByRole('heading', { name: 'Front desk' })
    const section = levelControl('Billing').closest('section')!
    expect(within(section).getByText('Feature is off')).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: /Advanced/ }))
    const rows = section.querySelectorAll('li.opacity-60')
    expect(rows.length).toBeGreaterThan(0)
    expect(within(section).getAllByText('Feature is off').length).toBeGreaterThan(1)
    // An unrelated module (feature on) is not greyed.
    const patients = levelControl('Patients').closest('section')!
    expect(within(patients).queryByText('Feature is off')).toBeNull()
  })

  it('ROLE-17 a 403 ESCALATION on save lists the keys and keeps the unsaved changes', async () => {
    api.get.mockResolvedValue({ data: { data: role() } })
    api.patch.mockRejectedValue({
      response: {
        data: {
          error: { code: 'ESCALATION', permissions: ['inventory.stock.adjust'] },
        },
      },
    })
    render(wrap(<RoleDetailPage roleId="role-1" />))
    await screen.findByRole('heading', { name: 'Front desk' })
    fireEvent.click(radio('Inventory', 'Full'))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/can't grant access you don't have/i)
    expect(alert.textContent).toMatch(/stock/i)
    // Unsaved changes are kept.
    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    expect(radio('Inventory', 'Full').getAttribute('aria-checked')).toBe('true')
  })
})

describe('FEAT — feature screens', () => {
  const feature = (over: Partial<OwnerFeature>): OwnerFeature => ({
    key: 'x',
    name: 'X',
    module: 'billing',
    description: null,
    specialtyTags: ['general'],
    enabledByDefault: true,
    sortOrder: 0,
    entitled: true,
    enabled: true,
    active: true,
    entitledUntil: null,
    lockedReason: null,
    permissionCount: 0,
    disabledLocationIds: [],
    ...over,
  })
  const VIEW: OwnerFeaturesView = {
    modules: [
      {
        module: 'billing',
        features: [
          feature({ key: 'billing.discounts', name: 'Discounts', permissionCount: 2 }),
        ],
      },
      {
        module: 'dental',
        features: [
          feature({
            key: 'dental.lab_orders',
            name: 'Lab orders',
            module: 'dental',
            entitled: false,
            enabled: false,
            active: false,
            lockedReason: 'not_entitled',
          }),
        ],
      },
    ],
    locations: [{ id: 'loc1', name: 'Main' }],
  }

  it('FEAT-13 owner Features page: locked rows show the contact message and a disabled switch; turning a feature off opens the impact confirm', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/features') return ok(VIEW)
      if (url === '/admin/features/billing.discounts/impact')
        return ok({
          featureKey: 'billing.discounts',
          name: 'Discounts',
          permissions: [
            { key: 'billing.discount.apply', label: 'Apply preset discounts', group: 'Discounts' },
          ],
          roles: [{ id: 'r1', name: 'Receptionist', permissions: ['billing.discount.apply'] }],
        })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    api.patch.mockImplementation(() => ok({ key: 'x', enabled: false }))
    render(wrap(<FeatureSettings />))

    const row = await screen.findByTestId('feature-row-dental.lab_orders')
    expect(row.textContent).toContain(LOCKED_MESSAGE)
    expect(LOCKED_MESSAGE).toBe('Not in your plan — contact your super admin')
    const locked = screen.getByRole('switch', { name: LOCKED_MESSAGE })
    expect(isDisabled(locked)).toBe(true)

    fireEvent.click(
      screen.getByRole('switch', { name: 'Turn Discounts off for the clinic' }),
    )
    expect(api.patch).not.toHaveBeenCalled()
    const impact = await screen.findByTestId('feature-impact')
    expect(impact.textContent).toContain('Apply preset discounts')
    expect(impact.textContent).toContain('Receptionist')
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/features/billing.discounts', {
        enabled: false,
      }),
    )
  })

  it('FEAT-14 SA page: Entitled + Enabled switches per feature, trial DatePicker, bulk by module', async () => {
    const group = [
      {
        module: 'billing',
        features: [
          {
            key: 'billing.discounts',
            name: 'Discounts',
            module: 'billing',
            description: null,
            specialtyTags: ['general'],
            enabledByDefault: false,
            sortOrder: 0,
            isEnabled: true,
            entitled: true,
            enabled: true,
            active: true,
            entitledUntil: null,
            lockedReason: null,
          },
        ],
      },
    ]
    api.get.mockImplementation(() => ok(group))
    api.post.mockImplementation(() => ok({ updated: 1 }))
    render(wrap(<OrgFeatureEntitlements orgId="org1" />))

    const row = await screen.findByTestId('entitlement-row-billing.discounts')
    const switches = within(row).getAllByRole('switch')
    expect(switches).toHaveLength(2) // Entitled + Enabled
    expect(
      within(row).getByRole('switch', {
        name: "Withdraw Discounts from this clinic's plan",
      }),
    ).toBeTruthy()
    expect(
      within(row).getByRole('switch', {
        name: "Turn Discounts off for the clinic (owner's switch)",
      }),
    ).toBeTruthy()
    // Trial date picker.
    expect(within(row).getByText('No trial end')).toBeTruthy()
    // Bulk by module.
    fireEvent.click(screen.getByRole('button', { name: 'Entitle module' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/feature-flags/org/org1/entitlement/bulk',
        expect.objectContaining({ module: 'billing', entitled: true }),
      ),
    )
    expect(screen.getByRole('button', { name: 'Withdraw module' })).toBeTruthy()
  })
})
