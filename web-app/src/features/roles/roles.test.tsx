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
import { BUNDLES, PERMISSION_GROUPS } from '@/features/access/generated/catalog'
import type {
  BundleLevel,
  PermissionMap,
} from '@/features/access/generated/catalog'

import {
  applyLevel,
  BUNDLE_LEVELS,
  bundleSummaryText,
  highRiskAdded,
  moduleLevel,
} from './lib/bundles'
import { RoleDetailPage } from './pages/RoleDetailPage'
import { RolesPage } from './pages/RolesPage'
import type { RoleDetail } from './types/roles.types'

// ── Mocks: API transport, router, toasts, page chrome, access ────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
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
vi.mock('@/features/access', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAccess: () => ({ hasFeature: () => true }),
}))

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

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled

const levelControl = (group: string) =>
  screen.getByRole('radiogroup', { name: `${group} level` })

beforeEach(() => {
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
  api.delete.mockReset()
})

// ── Bundle segmented control ↔ permission map ─────────────────────────────
describe('bundle levels', () => {
  it('round-trips every module level through the permission map', () => {
    for (const group of PERMISSION_GROUPS) {
      for (const level of BUNDLE_LEVELS) {
        const map = applyLevel(group, {}, level)
        expect(map).toEqual(BUNDLES[group][level])
        const detected = moduleLevel(group, map)
        expect(detected).not.toBe('custom')
        // Two levels can hold the same map in a tiny module; the map must survive.
        expect(applyLevel(group, {}, detected as BundleLevel)).toEqual(map)
      }
    }
  })

  it('keeps other modules untouched when a level is applied', () => {
    const start: PermissionMap = { 'patients.view': 'own' }
    const next = applyLevel('Billing', start, 'full')
    expect(next['patients.view']).toBe('own')
    expect(moduleLevel('Patients', next)).toBe('custom')
    expect(moduleLevel('Billing', next)).toBe('full')
    expect(moduleLevel('Billing', applyLevel('Billing', next, 'none'))).toBe(
      'none',
    )
  })

  it('detects custom when grants match no bundle (extra key or other scope)', () => {
    const basic = BUNDLES.Patients.basic
    expect(moduleLevel('Patients', basic)).toBe('basic')
    expect(moduleLevel('Patients', { ...basic, 'patients.view': 'org' })).toBe(
      'custom',
    )
    expect(moduleLevel('Patients', { ...basic, 'patients.export': true })).toBe(
      'custom',
    )
  })

  it('summarises non-empty modules', () => {
    const map = {
      ...BUNDLES.Billing.basic,
      ...BUNDLES.Patients.full,
    }
    expect(bundleSummaryText(map)).toBe('Patients: Full · Billing: Basic')
    expect(bundleSummaryText({})).toBe('No access')
  })

  it('lists only newly granted high-risk permissions', () => {
    expect(highRiskAdded({}, { 'billing.invoice.void': true })).toEqual([
      'billing.invoice.void',
    ])
    expect(
      highRiskAdded(
        { 'billing.invoice.void': true },
        { 'billing.invoice.void': true },
      ),
    ).toEqual([])
  })
})

// ── Role detail page ─────────────────────────────────────────────────────
describe('RoleDetailPage', { timeout: 60_000 }, () => {
  it('shows the escalation error from the server on save', async () => {
    api.get.mockResolvedValue({ data: { data: role() } })
    api.patch.mockRejectedValue({
      response: {
        data: {
          error: {
            code: 'ESCALATION',
            permissions: ['inventory.stock.adjust'],
          },
        },
      },
    })
    renderWithQuery(<RoleDetailPage roleId="role-1" />)

    await screen.findByRole('heading', { name: 'Front desk' })
    const save = screen.getByRole('button', { name: /save changes/i })
    expect(isDisabled(save)).toBe(true)

    fireEvent.click(
      within(levelControl('Inventory')).getByRole('radio', { name: 'Full' }),
    )
    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    expect(isDisabled(save)).toBe(false)
    fireEvent.click(save)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/can't grant access you don't have/i)
    expect(alert.textContent).toMatch(/stock/i)
    expect(api.patch).toHaveBeenCalledWith('/admin/roles/role-1', {
      permissions: BUNDLES.Inventory.full,
    })
  })

  it('shows Custom when a module matches no bundle', async () => {
    api.get.mockResolvedValue({
      data: { data: role({ permissions: { 'patients.view': 'org' } }) },
    })
    renderWithQuery(<RoleDetailPage roleId="role-1" />)
    await screen.findByRole('heading', { name: 'Front desk' })
    const custom = within(levelControl('Patients')).getByRole('radio', {
      name: 'Custom',
    })
    expect(custom.getAttribute('aria-checked')).toBe('true')
    expect(
      within(levelControl('Billing')).queryByRole('radio', { name: 'Custom' }),
    ).toBeNull()
  })

  it('asks for a reason before granting a high-risk permission', async () => {
    api.get.mockResolvedValue({ data: { data: role() } })
    renderWithQuery(<RoleDetailPage roleId="role-1" />)
    await screen.findByRole('heading', { name: 'Front desk' })

    fireEvent.click(
      within(levelControl('Team')).getByRole('radio', { name: 'Full' }),
    )
    expect(await screen.findByText('Grant high-risk access?')).toBeTruthy()
    const grant = screen.getByRole('button', { name: 'Grant access' })
    expect(isDisabled(grant)).toBe(true)
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Office manager runs payroll' },
    })
    fireEvent.click(grant)

    await waitFor(() =>
      expect(
        within(levelControl('Team'))
          .getByRole('radio', { name: 'Full' })
          .getAttribute('aria-checked'),
      ).toBe('true'),
    )
    api.patch.mockResolvedValue({ data: { data: role() } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/roles/role-1', {
        permissions: BUNDLES.Team.full,
        reason: 'Office manager runs payroll',
      }),
    )
  })

  it('is read-only for system roles, with a clone CTA', async () => {
    api.get.mockResolvedValue({
      data: {
        data: role({
          name: 'Doctor',
          isSystemRole: true,
          templateKey: 'doctor',
          permissions: { 'patients.view': 'own' },
        }),
      },
    })
    renderWithQuery(<RoleDetailPage roleId="role-1" />)
    await screen.findByRole('heading', { name: 'Doctor' })

    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull()
    expect(
      screen.getAllByRole('button', { name: /clone to edit/i }).length,
    ).toBeGreaterThan(0)
    for (const radio of within(levelControl('Billing')).getAllByRole('radio')) {
      expect(isDisabled(radio)).toBe(true)
    }
  })
})

// ── Roles listing ────────────────────────────────────────────────────────
describe('RolesPage', { timeout: 60_000 }, () => {
  it('lists roles with a bundle summary and filters system/custom', async () => {
    api.get.mockResolvedValue({
      data: {
        data: [
          role({
            id: 'a',
            name: 'Doctor',
            isSystemRole: true,
            permissions: BUNDLES.Patients.full,
          }),
          role({
            id: 'b',
            name: 'Hygienist',
            memberCount: 2,
            permissions: BUNDLES.Billing.basic,
          }),
        ],
      },
    })
    renderWithQuery(<RolesPage />)
    expect(await screen.findByText('Hygienist')).toBeTruthy()
    expect(screen.getByText('Patients: Full')).toBeTruthy()
    expect(screen.getByText('Billing: Basic')).toBeTruthy()
    // system roles have no delete action
    expect(screen.queryByRole('button', { name: 'Delete Doctor' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Delete Hygienist' }),
    ).toBeTruthy()
  })
})
