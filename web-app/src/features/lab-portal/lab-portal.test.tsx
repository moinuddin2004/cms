import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { InternalAxiosRequestConfig } from 'axios'
import { AxiosHeaders } from 'axios'

import type * as ApiModule from '@/lib/api'

import { isLabOnlyUser, useAuthStore } from '@/store/useAuthStore'
import type { LabMembership } from '@/store/useAuthStore'
import { LabSwitcher } from './components/LabSwitcher'
import { LabClinicsPage } from './pages/LabClinicsPage'
import { LabPortalDashboardPage } from './pages/LabPortalDashboardPage'
import { LabTeamPage } from './pages/LabTeamPage'
import { labContactSchema } from './schemas/lab-portal.schema'
import type { LabMember, PortalClinic } from './types'

// ── Mocks: API transport, router, toasts ─────────────────────────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>()
  return { ...actual, default: api }
})
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: () => '/lab-portal',
}))
vi.mock('@/hooks/useBackNavigation', () => ({
  SIDEBAR_NAV_STATE: { fromSidebar: true },
  usePageTitle: () => undefined,
  useBackNavigation: (to?: string, label?: string) =>
    to ? { label: label ?? 'Back', href: to, goBack: vi.fn() } : null,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const LAB_A: LabMembership = {
  labId: 'lab-a',
  labName: 'Precision Dental Lab',
  labType: 'external',
  city: 'Karachi',
  role: 'lab_admin',
}
const LAB_B: LabMembership = {
  labId: 'lab-b',
  labName: 'Smile Lab',
  labType: 'external',
  city: 'Lahore',
  role: 'lab_technician',
}

function signIn(labs: LabMembership[], orgs = 0) {
  useAuthStore.getState().setAuth({
    user: { uuid: 'me', email: 'me@lab.test', name: 'Me', globalRole: null },
    accessToken: 'token',
    accessibleOrganizations: Array.from({ length: orgs }, (_, i) => ({
      id: `org-${i}`,
      name: 'Clinic',
      slug: 'clinic',
      accessSource: 'owner' as const,
      specialtyTags: [],
      locations: [],
    })),
    activeOrganizationId: orgs ? 'org-0' : null,
    activeLocationId: orgs ? 'loc-0' : null,
    labMemberships: labs,
  })
}

const clinic = (over: Partial<PortalClinic> = {}): PortalClinic => ({
  id: 'link-1',
  status: 'invited',
  paymentTermsDays: 30,
  version: 1,
  clinic: { name: 'Bright Smiles Clinic', city: 'Lahore' },
  ...over,
})

const member = (over: Partial<LabMember> = {}): LabMember => ({
  id: 'm-1',
  labId: 'lab-a',
  role: 'lab_technician',
  isActive: true,
  user: { id: 'u-1', name: 'Ali Tech', email: 'ali@lab.test', phone: null },
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
})

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
})

describe('auth store lab context', () => {
  it('treats lab staff without a clinic as lab-only', () => {
    signIn([LAB_A])
    expect(isLabOnlyUser(useAuthStore.getState())).toBe(true)
    expect(useAuthStore.getState().activeLabId).toBe('lab-a')

    signIn([LAB_A], 1)
    expect(isLabOnlyUser(useAuthStore.getState())).toBe(false)

    signIn([])
    expect(isLabOnlyUser(useAuthStore.getState())).toBe(false)
  })

  it('keeps the chosen lab across refreshes while it is still valid', () => {
    signIn([LAB_A, LAB_B])
    useAuthStore.getState().setActiveLab('lab-b')
    signIn([LAB_A, LAB_B])
    expect(useAuthStore.getState().activeLabId).toBe('lab-b')
    signIn([LAB_A])
    expect(useAuthStore.getState().activeLabId).toBe('lab-a')
  })
})

describe('axios tenant headers', () => {
  const run = async (url: string) => {
    const { apiClient, isLabPortalUrl } = await import('@/lib/api')
    expect(typeof isLabPortalUrl).toBe('function')
    const handler = (
      apiClient.interceptors.request as unknown as {
        handlers: Array<{
          fulfilled: (
            c: InternalAxiosRequestConfig,
          ) => InternalAxiosRequestConfig
        }>
      }
    ).handlers[0]
    return handler.fulfilled({ url, headers: new AxiosHeaders() }).headers
  }

  it('sends x-lab-id and no clinic headers on /lab-portal routes', async () => {
    signIn([LAB_A], 1)
    const headers = await run('/lab-portal/clinics')
    expect(headers['x-lab-id']).toBe('lab-a')
    expect(headers['x-organization-id']).toBeUndefined()
    expect(headers['x-location-id']).toBeUndefined()
  })

  it('sends clinic headers and no x-lab-id elsewhere', async () => {
    signIn([LAB_A], 1)
    const headers = await run('/lab-links')
    expect(headers['x-organization-id']).toBe('org-0')
    expect(headers['x-location-id']).toBe('loc-0')
    expect(headers['x-lab-id']).toBeUndefined()
  })

  it('recognises portal paths only', async () => {
    const { isLabPortalUrl } = await import('@/lib/api')
    expect(isLabPortalUrl('/lab-portal')).toBe(true)
    expect(isLabPortalUrl('lab-portal/me')).toBe(true)
    expect(isLabPortalUrl('http://api.test/lab-portal/lab?x=1')).toBe(true)
    expect(isLabPortalUrl('/lab-portals')).toBe(false)
    expect(isLabPortalUrl('/lab-links')).toBe(false)
  })
})

describe('lab portal pages', () => {
  it('dashboard counts the orders waiting for the lab', async () => {
    signIn([LAB_A])
    api.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: {
          data:
            url === '/lab-portal/orders'
              ? { data: [], total: 4, page: 1, limit: 1 }
              : {
                  id: 'lab-a',
                  name: 'Precision Dental Lab',
                  memberCount: 3,
                  activeLinkCount: 2,
                },
        },
      }),
    )
    renderWithClient(<LabPortalDashboardPage />)
    expect(await screen.findByText('Active clinics')).toBeTruthy()
    expect(screen.getByText('Orders waiting for you')).toBeTruthy()
    expect(await screen.findByText('4')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/lab-portal/lab', {
      params: undefined,
    })
    expect(api.get).toHaveBeenCalledWith('/lab-portal/orders', {
      params: { page: 1, limit: 1, status: 'submitted' },
    })
  })

  it('lists clinics and lets a lab admin accept an invitation', async () => {
    signIn([LAB_A])
    api.get.mockResolvedValue({ data: { data: [clinic()] } })
    api.post.mockResolvedValue({
      data: { data: clinic({ status: 'active', version: 2 }) },
    })
    renderWithClient(<LabClinicsPage />)

    expect(await screen.findByText('Bright Smiles Clinic')).toBeTruthy()
    expect(screen.getByText('30 days')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Accept Bright Smiles Clinic' }),
    )
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-portal/clinics/link-1/transitions',
        { action: 'activate', version: 1, reason: undefined },
      ),
    )
  })

  it('shows technicians the clinics without actions', async () => {
    signIn([{ ...LAB_A, role: 'lab_technician' }])
    api.get.mockResolvedValue({ data: { data: [clinic()] } })
    renderWithClient(<LabClinicsPage />)
    expect(await screen.findByText('Bright Smiles Clinic')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /accept bright smiles/i }),
    ).toBeNull()
  })

  it('shows the empty state when no clinic is linked', async () => {
    signIn([LAB_A])
    api.get.mockResolvedValue({ data: { data: [] } })
    renderWithClient(<LabClinicsPage />)
    expect(await screen.findByText('No clinics yet')).toBeTruthy()
  })

  it('keeps the team page for lab admins', () => {
    signIn([{ ...LAB_A, role: 'lab_technician' }])
    renderWithClient(<LabTeamPage />)
    expect(screen.getByText('Lab admins only')).toBeTruthy()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('locks your own row on the team page', async () => {
    signIn([LAB_A])
    api.get.mockResolvedValue({
      data: {
        data: [
          member({
            id: 'm-me',
            role: 'lab_admin',
            user: { id: 'me', name: 'Me', email: 'me@lab.test', phone: null },
          }),
          member(),
        ],
      },
    })
    renderWithClient(<LabTeamPage />)
    const mine = await screen.findByRole('switch', {
      name: 'me@lab.test is active',
    })
    const theirs = screen.getByRole('switch', {
      name: 'ali@lab.test is active',
    })
    expect((mine as HTMLButtonElement).disabled).toBe(true)
    expect((theirs as HTMLButtonElement).disabled).toBe(false)

    api.patch.mockResolvedValue({
      data: { data: member({ isActive: false, version: 2 }) },
    })
    fireEvent.click(theirs)
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/lab-portal/members/m-1', {
        isActive: false,
        version: 1,
      }),
    )
  })
})

describe('LabSwitcher', () => {
  it('shows the lab name for a single lab', () => {
    signIn([LAB_A])
    renderWithClient(<LabSwitcher />)
    expect(screen.getByText('Precision Dental Lab')).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Switch lab' })).toBeNull()
  })

  it('offers a picker when the user works in several labs', () => {
    signIn([LAB_A, LAB_B])
    renderWithClient(<LabSwitcher />)
    expect(screen.getByRole('combobox', { name: 'Switch lab' })).toBeTruthy()
  })
})

describe('lab contact schema', () => {
  it('accepts blanks and rejects bad phone / email', () => {
    const blank = {
      phone: '',
      whatsappPhone: '',
      email: '',
      city: '',
      address: '',
    }
    expect(labContactSchema.safeParse(blank).success).toBe(true)
    expect(labContactSchema.safeParse({ ...blank, phone: 'abc' }).success).toBe(
      false,
    )
    expect(
      labContactSchema.safeParse({ ...blank, email: 'nope' }).success,
    ).toBe(false)
  })
})
