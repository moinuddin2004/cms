import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useAuthStore } from '@/store/useAuthStore'
import { EntitlementRow } from '@/features/feature-flags/components/EntitlementRow'
import type { OrgFeature } from '@/features/feature-flags/services/feature-flags.api'
import { FeatureSettings } from './pages/FeatureSettingsPage'
import { useFeatureSettingsStore } from './hooks/useFeatureSettingsStore'
import {
  DEFAULT_FEATURE_FILTERS,
  filterFeatureModules,
} from './lib/filter-features'
import { LOCKED_MESSAGE } from './components/FeatureSwitchRow'
import type {
  OwnerFeature,
  OwnerFeaturesView,
} from './types/feature-settings.types'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function feature(over: Partial<OwnerFeature>): OwnerFeature {
  return {
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
  }
}

const VIEW: OwnerFeaturesView = {
  modules: [
    {
      module: 'billing',
      features: [
        feature({
          key: 'billing.discounts',
          name: 'Discounts',
          permissionCount: 2,
        }),
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

const ok = (data: unknown) => Promise.resolve({ data: { data } })

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ activeOrganizationId: 'org1' } as never)
  useFeatureSettingsStore.setState({
    filters: DEFAULT_FEATURE_FILTERS,
    confirmOffKey: null,
    locationsKey: null,
  })
  api.get.mockImplementation((url: string) => {
    if (url === '/admin/features') return ok(VIEW)
    if (url === '/admin/features/billing.discounts/impact') {
      return ok({
        featureKey: 'billing.discounts',
        name: 'Discounts',
        permissions: [
          {
            key: 'billing.discount.apply',
            label: 'Apply preset discounts',
            group: 'Discounts',
          },
          {
            key: 'billing.discount.custom',
            label: 'Give custom discounts',
            group: 'Discounts',
          },
        ],
        roles: [
          {
            id: 'r1',
            name: 'Front desk',
            permissions: ['billing.discount.apply'],
          },
        ],
      })
    }
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
  api.patch.mockImplementation(() => ok({ key: 'x', enabled: false }))
})

describe('owner Features page', () => {
  it('shows a not-entitled feature locked, with the contact message', async () => {
    renderWithClient(<FeatureSettings />)
    const row = await screen.findByTestId('feature-row-dental.lab_orders')
    expect(row.textContent).toContain('Locked')
    expect(row.textContent).toContain(LOCKED_MESSAGE)
    const lockedSwitch = screen.getByRole('switch', { name: LOCKED_MESSAGE })
    expect((lockedSwitch as HTMLButtonElement).disabled).toBe(true)
    expect(lockedSwitch.getAttribute('aria-checked')).toBe('false')

    // The entitled one can be switched.
    const open = screen.getByRole('switch', {
      name: 'Turn Discounts off for the clinic',
    })
    expect((open as HTMLButtonElement).disabled).toBe(false)
  })

  it('confirms turning off with the affected permissions and roles', async () => {
    renderWithClient(<FeatureSettings />)
    fireEvent.click(
      await screen.findByRole('switch', {
        name: 'Turn Discounts off for the clinic',
      }),
    )
    // Not sent until confirmed.
    expect(api.patch).not.toHaveBeenCalled()

    const impact = await screen.findByTestId('feature-impact')
    expect(impact.textContent).toContain('Apply preset discounts')
    expect(impact.textContent).toContain('Give custom discounts')
    expect(impact.textContent).toContain('Front desk')

    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/admin/features/billing.discounts',
        { enabled: false },
      ),
    )
  })

  it('turns a feature on without a confirm', async () => {
    api.get.mockImplementation((url: string) =>
      url === '/admin/features'
        ? ok({
            ...VIEW,
            modules: [
              {
                module: 'billing',
                features: [
                  feature({
                    key: 'billing.discounts',
                    name: 'Discounts',
                    enabled: false,
                    active: false,
                  }),
                ],
              },
            ],
          })
        : Promise.reject(new Error(url)),
    )
    renderWithClient(<FeatureSettings />)
    fireEvent.click(
      await screen.findByRole('switch', {
        name: 'Turn Discounts on for the clinic',
      }),
    )
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/admin/features/billing.discounts',
        { enabled: true },
      ),
    )
    expect(screen.queryByTestId('feature-impact')).toBeNull()
  })

  it('filters on/off/locked and search', () => {
    const locked = filterFeatureModules(VIEW.modules, {
      ...DEFAULT_FEATURE_FILTERS,
      status: 'locked',
    })
    expect(locked.flatMap((m) => m.features.map((f) => f.key))).toEqual([
      'dental.lab_orders',
    ])
    const on = filterFeatureModules(VIEW.modules, {
      ...DEFAULT_FEATURE_FILTERS,
      status: 'on',
      search: 'disc',
    })
    expect(on.flatMap((m) => m.features.map((f) => f.key))).toEqual([
      'billing.discounts',
    ])
  })
})

describe('super admin entitlement row', () => {
  const orgFeature = (over: Partial<OrgFeature> = {}): OrgFeature => ({
    key: 'billing.discounts',
    name: 'Discounts',
    module: 'billing',
    description: null,
    specialtyTags: ['general'],
    enabledByDefault: false,
    sortOrder: 0,
    isEnabled: true,
    enabled: true,
    entitled: true,
    active: true,
    entitledUntil: null,
    lockedReason: null,
    ...over,
  })

  it('has separate Entitled and Enabled switches', () => {
    const onEntitle = vi.fn()
    const onEnable = vi.fn()
    render(
      <EntitlementRow
        feature={orgFeature()}
        onEntitle={onEntitle}
        onEnable={onEnable}
      />,
    )
    const entitled = screen.getByRole('switch', {
      name: "Withdraw Discounts from this clinic's plan",
    })
    const enabled = screen.getByRole('switch', {
      name: "Turn Discounts off for the clinic (owner's switch)",
    })
    expect(entitled.getAttribute('aria-checked')).toBe('true')
    expect(enabled.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(entitled)
    expect(onEntitle).toHaveBeenCalledWith(false, null)
    expect(onEnable).not.toHaveBeenCalled()

    fireEvent.click(enabled)
    expect(onEnable).toHaveBeenCalledWith(false)
  })

  it('shows "Not entitled" and no trial date when withdrawn', () => {
    render(
      <EntitlementRow
        feature={orgFeature({
          entitled: false,
          active: false,
          lockedReason: 'not_entitled',
        })}
        onEntitle={vi.fn()}
        onEnable={vi.fn()}
      />,
    )
    const row = screen.getByTestId('entitlement-row-billing.discounts')
    expect(row.textContent).toContain('Not entitled')
    expect(screen.queryByText('No trial end')).toBeNull()
    expect(
      screen
        .getByRole('switch', { name: 'Entitle this clinic to Discounts' })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('re-entitling an ended trial drops the old expiry', () => {
    const onEntitle = vi.fn()
    render(
      <EntitlementRow
        feature={orgFeature({
          entitled: false,
          active: false,
          lockedReason: 'trial_expired',
          entitledUntil: '2026-01-01T00:00:00.000Z',
        })}
        onEntitle={onEntitle}
        onEnable={vi.fn()}
      />,
    )
    expect(screen.getByText('Trial ended')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('switch', { name: 'Entitle this clinic to Discounts' }),
    )
    expect(onEntitle).toHaveBeenCalledWith(true, null)
  })
})
