import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import { createAccessChecks } from '@/features/access/lib/access'
import {
  AccessContext,
  DISABLED_ACCESS,
} from '@/features/access/lib/access-context'
import type { AccessContextValue } from '@/features/access/lib/access-context'
import type { MeAccess } from '@/features/access'
import { UsersPage } from './pages/UsersPage'
import type { PaginatedUsersResponse } from './types'

// ── Mocks: API transport, toasts ─────────────────────────────────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  }),
}))

vi.mock('@/components/layout/DashboardLayout', () => ({
  // breaks the access barrel → NoAccess → DashboardLayout → Sidebar cycle
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
const owners: PaginatedUsersResponse = {
  data: [
    {
      uuid: 'u1',
      email: 'owner@clinic.pk',
      name: 'Clinic Owner',
      status: 'active',
      globalRole: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      hasPassword: true,
      emailVerifiedAt: '2026-10-01T00:00:00.000Z',
      emailVerificationDueAt: null,
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
}

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
    isSuperAdmin: data.isSuperAdmin,
    isOwner: data.isOwner,
    version: 1,
  }
}

function renderUsers(access: AccessContextValue) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AccessContext.Provider value={access}>
        <UsersPage />
      </AccessContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.get.mockReset()
  api.get.mockResolvedValue({ data: owners })
  useAuthStore.setState({ activeOrganizationId: 'o1', activeLocationId: 'l1' })
})

describe('UsersPage gating', () => {
  it('refuses without admin.users.manage, even for a legacy owner flag', () => {
    useAuthStore.setState({ accessSource: 'owner' })
    renderUsers(accessOf({}))
    expect(
      screen.getByText('You do not have permission to view User Management.'),
    ).toBeTruthy()
  })

  it('lets an owner create users and edit owner accounts', async () => {
    renderUsers(
      accessOf({ isOwner: true, permissions: { 'admin.users.manage': true } }),
    )
    expect(await screen.findByText('Clinic Owner')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Create User/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit user' })).toBeTruthy()
  })

  it('shows owner accounts read-only to a non-owner user manager', async () => {
    renderUsers(accessOf({ permissions: { 'admin.users.manage': true } }))
    expect(await screen.findByText('Clinic Owner')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Create User/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit user' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete user' })).toBeNull()
  })
})

describe('email verification on the users list', () => {
  const unverified: PaginatedUsersResponse = {
    ...owners,
    data: [
      {
        ...owners.data[0],
        emailVerifiedAt: null,
        emailVerificationDueAt: '2099-01-01T00:00:00.000Z',
      },
    ],
  }

  beforeEach(() => {
    api.get.mockResolvedValue({ data: unverified })
    api.post.mockReset()
    api.post.mockResolvedValue({ data: { sent: true } })
  })

  it('shows Unverified and lets a manager resend the link', async () => {
    renderUsers(
      accessOf({ isOwner: true, permissions: { 'admin.users.manage': true } }),
    )
    expect(await screen.findByText('Unverified')).toBeTruthy()
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Actions for owner@clinic.pk' }),
      { button: 0, pointerType: 'mouse' },
    )
    fireEvent.click(await screen.findByText('Resend verification email'))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/user/u1/resend-verification',
        undefined,
        expect.anything(),
      ),
    )
    // Only a super admin may mark an address verified.
    expect(screen.queryByText('Mark email verified')).toBeNull()
  })

  it('a super admin can mark the email verified after confirming', async () => {
    renderUsers(
      accessOf({
        isSuperAdmin: true,
        permissions: { 'admin.users.manage': true },
      }),
    )
    fireEvent.pointerDown(
      await screen.findByRole('button', {
        name: 'Actions for owner@clinic.pk',
      }),
      { button: 0, pointerType: 'mouse' },
    )
    fireEvent.click(await screen.findByText('Mark email verified'))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark verified' }),
    )
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/user/u1/verify-email'),
    )
  })
})
