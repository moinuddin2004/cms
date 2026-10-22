import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import { createAccessChecks } from '@/features/access/lib/access'
import {
  AccessContext,
  DISABLED_ACCESS,
} from '@/features/access/lib/access-context'
import type { AccessContextValue } from '@/features/access/lib/access-context'
import type { MeAccess } from '@/features/access'
import { SettingsPage } from './pages/SettingsPage'

// ── Mocks: API transport, router ─────────────────────────────────────────
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('@/components/layout/DashboardLayout', () => ({
  // breaks the access barrel → NoAccess → DashboardLayout → Sidebar cycle
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
function accessOf(over: Partial<MeAccess>): AccessContextValue {
  const data: MeAccess = {
    version: 1,
    organizationId: 'o1',
    locationId: 'l1',
    isSuperAdmin: false,
    isOwner: false,
    features: [],
    permissions: {},
    roles: [],
    employeeId: null,
    homeRoute: null,
    nav: null,
    ...over,
  }
  return {
    ...DISABLED_ACCESS,
    ...createAccessChecks(data),
    status: 'ready',
    isOwner: data.isOwner,
    version: 1,
  }
}

function renderSettings(access: AccessContextValue) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AccessContext.Provider value={access}>
        <SettingsPage />
      </AccessContext.Provider>
    </QueryClientProvider>,
  )
}

const link = (name: string) => screen.queryByRole('link', { name })

beforeEach(() => {
  api.get.mockReset()
  // No active org: the /me/access role lookup stays idle.
  useAuthStore.setState({ activeOrganizationId: null, activeLocationId: null })
})

describe('SettingsPage admin links', () => {
  it('shows none of them to staff without admin permissions', () => {
    renderSettings(accessOf({ features: ['billing.invoices'] }))
    expect(link('Billing')).toBeNull()
    expect(link('Notifications')).toBeNull()
    expect(link('Branding & theme')).toBeNull()
    // personal sections stay
    expect(screen.getByRole('button', { name: 'Profile' })).toBeTruthy()
  })

  it('shows each link for its own permission only', () => {
    renderSettings(
      accessOf({
        permissions: { 'notifications.settings.manage': true },
        features: ['billing.invoices'],
      }),
    )
    expect(link('Notifications')).toBeTruthy()
    expect(link('Billing')).toBeNull()
    expect(link('Branding & theme')).toBeNull()
  })

  it('gates theme on admin.theme.manage', () => {
    renderSettings(accessOf({ permissions: { 'admin.theme.manage': true } }))
    expect(link('Branding & theme')?.getAttribute('href')).toBe('/admin/theme')
  })

  it('needs the billing feature as well as admin.settings.manage', () => {
    const perms = { 'admin.settings.manage': true } as const
    const { unmount } = renderSettings(accessOf({ permissions: perms }))
    expect(link('Billing')).toBeNull()
    unmount()
    renderSettings(
      accessOf({ permissions: perms, features: ['billing.invoices'] }),
    )
    expect(link('Billing')?.getAttribute('href')).toBe('/settings/billing')
  })

  it('labels an owner as Owner (no legacy role names)', () => {
    renderSettings(accessOf({ isOwner: true }))
    expect(screen.getByDisplayValue('Owner')).toBeTruthy()
  })
})
