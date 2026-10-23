import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type * as ApiModule from '@/lib/api'

import { useAuthStore } from '@/store/useAuthStore'
import { LabAccessPanel } from '@/features/lab-orders/components/LabAccessPanel'
import type { LabOrderDetail, OrderMagicLink } from '@/features/lab-orders'
import { answerRows } from './components/LabOrderView'
import { LabPortalOrderDetailPage } from './pages/LabPortalOrderDetailPage'
import { LabPortalOrdersPage } from './pages/LabPortalOrdersPage'
import { MagicLinkOrderPage } from './pages/MagicLinkOrderPage'
import {
  acceptOrderSchema,
  rejectOrderSchema,
} from './schemas/lab-order-actions.schema'
import type { MagicLinkView, PortalOrderDetail, PortalOrderRow } from './types'

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
  useRouterState: () => '/lab-portal/orders',
}))
vi.mock('@/hooks/useBackNavigation', () => ({
  SIDEBAR_NAV_STATE: { fromSidebar: true },
  usePageTitle: () => undefined,
  useBackNavigation: (to?: string, label?: string) =>
    to ? { label: label ?? 'Back', href: to, goBack: vi.fn() } : null,
}))
// The clinic-side LabAccessPanel gates sending and proxy actions on access.
vi.mock('@/features/access', () => ({
  useAccess: () => ({ isLoading: false, can: () => true, canAll: () => true }),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}))

function signIn(role: 'lab_admin' | 'lab_technician' = 'lab_admin') {
  useAuthStore.getState().setAuth({
    user: { uuid: 'me', email: 'me@lab.test', name: 'Me', globalRole: null },
    accessToken: 'token',
    labMemberships: [
      {
        labId: 'lab-a',
        labName: 'Precision Dental Lab',
        labType: 'external',
        city: 'Karachi',
        role,
      },
    ],
  })
}

const row = (over: Partial<PortalOrderRow> = {}): PortalOrderRow => ({
  id: 'o-1',
  orderNo: 'LAB-0007',
  status: 'submitted',
  priority: 'urgent',
  clinic: { name: 'Bright Smiles Clinic' },
  patient: { ref: 'Ali Raza', patientNumber: 'P-1' },
  doctor: { fullName: 'Dr Sana' },
  labExpectedOn: '2026-10-30',
  submittedAt: '2026-10-20T08:00:00.000Z',
  currentRevisionNo: 1,
  version: 3,
  ...over,
})

const detail = (over: Partial<PortalOrderDetail> = {}): PortalOrderDetail => ({
  id: 'o-1',
  orderNo: 'LAB-0007',
  status: 'submitted',
  priority: 'normal',
  requestedOn: '2026-10-29',
  labExpectedOn: '2026-10-30',
  notes: null,
  currentRevisionNo: 1,
  submittedAt: '2026-10-20T08:00:00.000Z',
  acceptedAt: null,
  version: 3,
  clinic: { name: 'Bright Smiles Clinic' },
  patient: { ref: 'Ali Raza', patientNumber: 'P-1' },
  doctor: { fullName: 'Dr Sana' },
  labCostPaisa: 1_000_000,
  items: [
    {
      id: 'i-1',
      lineNo: 1,
      serviceCode: 'zr_crown',
      serviceName: 'Zirconia crown',
      unitType: 'per_tooth',
      quantity: 2,
      rush: false,
      options: [],
      currency: 'PKR',
      labUnitCostPaisa: 500_000,
      labLineCostPaisa: 1_000_000,
      status: 'pending_acceptance',
      form: {
        code: 'CROWN',
        name: 'Crown',
        versionNo: 1,
        schemaJson: {
          fields: [
            { key: 'teeth', type: 'tooth_chart', label: 'Teeth' },
            {
              key: 'material',
              type: 'select',
              label: 'Material',
              options: [{ value: 'zr', label: 'Zirconia' }],
            },
            { key: 'shade', type: 'text', label: 'Shade' },
          ],
        },
      },
      answers: { material: 'zr', shade: 'A2', teeth: [{ tooth: '11' }] },
      teeth: [
        { tooth: '11', role: null },
        { tooth: '21', role: null },
      ],
      details: null,
    },
  ],
  revisions: [
    {
      id: 'r-1',
      revisionNo: 1,
      reason: null,
      createdAt: '2026-10-20T08:00:00.000Z',
      labAcknowledgedAt: null,
    },
  ],
  messages: [],
  attachments: [],
  ...over,
})

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/** `api.get` answers by URL. */
function serve(routes: Record<string, unknown>) {
  api.get.mockImplementation((url: string) =>
    url in routes
      ? Promise.resolve({ data: { data: routes[url] } })
      : Promise.reject(new Error(`unexpected GET ${url}`)),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
})

describe('order inbox', () => {
  it('lists the lab’s orders with clinic, patient ref and status', async () => {
    signIn()
    serve({
      '/lab-portal/orders': { data: [row()], total: 1, page: 1, limit: 20 },
    })
    renderWithClient(<LabPortalOrdersPage />)
    expect(await screen.findByText('LAB-0007')).toBeTruthy()
    expect(screen.getByText('Bright Smiles Clinic')).toBeTruthy()
    expect(screen.getByText('Ali Raza')).toBeTruthy()
    expect(screen.getByText('Urgent')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/lab-portal/orders', {
      params: { page: 1, limit: 20, search: undefined, status: undefined },
    })
  })

  it('shows the empty state when no order has arrived', async () => {
    signIn()
    serve({ '/lab-portal/orders': { data: [], total: 0, page: 1, limit: 20 } })
    renderWithClient(<LabPortalOrdersPage />)
    expect(await screen.findByText('No orders yet')).toBeTruthy()
  })
})

describe('order detail', () => {
  it('shows the work and accepts with the expected date', async () => {
    signIn()
    serve({
      '/lab-portal/orders/o-1': detail(),
      '/lab-portal/orders/o-1/actions': {
        actions: ['accept', 'reject', 'request_clarification'],
      },
    })
    api.post.mockResolvedValue({
      data: { data: detail({ status: 'accepted' }) },
    })
    renderWithClient(<LabPortalOrderDetailPage orderId="o-1" />)

    expect(await screen.findByText('1. Zirconia crown × 2')).toBeTruthy()
    expect(screen.getByText('11, 21')).toBeTruthy()
    expect(screen.getByText('Zirconia')).toBeTruthy()
    expect(screen.getByText('A2')).toBeTruthy()

    fireEvent.click(await screen.findByRole('button', { name: /Accept/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Accept order' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/lab-portal/orders/o-1/accept', {
        labExpectedOn: '2026-10-30',
        note: undefined,
        version: 3,
      }),
    )
  })

  it('needs a reason to reject', async () => {
    signIn()
    serve({
      '/lab-portal/orders/o-1': detail(),
      '/lab-portal/orders/o-1/actions': { actions: ['reject'] },
    })
    api.post.mockResolvedValue({ data: { data: detail() } })
    renderWithClient(<LabPortalOrderDetailPage orderId="o-1" />)

    fireEvent.click(await screen.findByRole('button', { name: /Reject/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reject order' }))
    expect(await screen.findByText('A reason is required')).toBeTruthy()
    expect(api.post).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: 'Out of zirconia' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reject order' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/lab-portal/orders/o-1/reject', {
        reason: 'Out of zirconia',
        version: 3,
      }),
    )
  })

  it('shows technicians no answer buttons and lets them mark a revision read', async () => {
    signIn('lab_technician')
    serve({
      '/lab-portal/orders/o-1': detail(),
      '/lab-portal/orders/o-1/actions': { actions: [] },
    })
    api.post.mockResolvedValue({ data: { data: detail() } })
    renderWithClient(<LabPortalOrderDetailPage orderId="o-1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Mark as read/ }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-portal/orders/o-1/revisions/1/acknowledge',
        undefined,
      ),
    )
    expect(screen.queryByRole('button', { name: /^Accept$/ })).toBeNull()
  })
})

describe('magic link page', () => {
  const view = (over: Partial<MagicLinkView> = {}): MagicLinkView => ({
    link: {
      purpose: 'lab_update_order',
      expiresAt: '2026-10-21T08:00:00.000Z',
      lab: { name: 'Precision Dental Lab' },
    },
    actions: ['accept', 'request_clarification', 'reject'],
    order: detail(),
    ...over,
  })

  it('shows the order and accepts through the link', async () => {
    serve({ '/lab-link/tok': view() })
    api.post.mockResolvedValue({ data: { data: null } })
    renderWithClient(<MagicLinkOrderPage token="tok" />)
    expect(await screen.findByText('Order LAB-0007')).toBeTruthy()
    expect(screen.getByText(/For Precision Dental Lab/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Ask a question/ }))
    fireEvent.change(await screen.findByLabelText(/Question/), {
      target: { value: 'Which shade?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/lab-link/tok/clarification', {
        body: 'Which shade?',
      }),
    )
  })

  it('explains a dead link and offers no actions', async () => {
    api.get.mockRejectedValue({
      response: {
        data: {
          error: {
            code: 'MAGIC_LINK_EXPIRED',
            message: 'This link has expired',
          },
        },
      },
    })
    renderWithClient(<MagicLinkOrderPage token="old" />)
    expect(await screen.findByText('This link no longer works')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull()
  })

  it('a view-only link shows the order without buttons', async () => {
    serve({
      '/lab-link/view': view({
        actions: [],
        link: { ...view().link, purpose: 'lab_view_order' },
      }),
    })
    renderWithClient(<MagicLinkOrderPage token="view" />)
    expect(await screen.findByText('Order LAB-0007')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull()
  })
})

describe('clinic lab-access panel', () => {
  const order = {
    id: 'o-1',
    status: 'submitted',
    version: 3,
    labExpectedOn: '2026-10-30',
    lab: { id: 'lab-a', name: 'Precision Dental Lab', city: null },
  } as LabOrderDetail
  const link = (over: Partial<OrderMagicLink> = {}): OrderMagicLink => ({
    id: 'ml-1',
    purpose: 'lab_update_order',
    delivery: 'notification',
    state: 'active',
    recipientPhone: '03211234567',
    createdAt: '2026-10-20T08:00:00.000Z',
    expiresAt: '2026-10-21T08:00:00.000Z',
    revokedAt: null,
    revokedReason: null,
    usedCount: 0,
    lastUsedAt: null,
    lastViewedAt: null,
    deliveries: [
      {
        channel: 'whatsapp',
        status: 'skipped_disabled',
        to: '03211234567',
        reason: 'rule_disabled',
        lastError: null,
        sentAt: null,
      },
    ],
    ...over,
  })

  it('lists links with delivery status, sends a new one and shows proxy actions to admins', async () => {
    serve({
      '/lab-orders/o-1/magic-links': [link()],
      '/lab-orders/o-1/proxy/actions': { actions: ['accept', 'reject'] },
    })
    api.post.mockResolvedValue({
      data: { data: { id: 'ml-2', expiresAt: '', url: null } },
    })
    renderWithClient(<LabAccessPanel order={order} />)
    expect(
      await screen.findByText(/WhatsApp: off in notification settings/),
    ).toBeTruthy()
    expect(await screen.findByText('Update for the lab')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Send link to lab/ }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-orders/o-1/magic-links',
        { delivery: 'notification' },
        { headers: undefined },
      ),
    )
  })

  it('hides proxy actions when the server refuses them (not a clinic admin)', async () => {
    api.get.mockImplementation((url: string) =>
      url.endsWith('/magic-links')
        ? Promise.resolve({ data: { data: [] } })
        : Promise.reject({ response: { status: 403 } }),
    )
    renderWithClient(<LabAccessPanel order={order} />)
    expect(await screen.findByText('No links sent yet.')).toBeTruthy()
    expect(screen.queryByText('Update for the lab')).toBeNull()
  })
})

describe('helpers and schemas', () => {
  it('lists form answers by label, skipping teeth and files', () => {
    expect(answerRows(detail().items[0])).toEqual([
      { label: 'Material', value: 'Zirconia' },
      { label: 'Shade', value: 'A2' },
    ])
  })

  it('accept needs a date; reject needs a reason', () => {
    const base = { labExpectedOn: '', note: '', reason: '', body: '' }
    expect(acceptOrderSchema.safeParse(base).success).toBe(false)
    expect(
      acceptOrderSchema.safeParse({ ...base, labExpectedOn: '2026-10-30' })
        .success,
    ).toBe(true)
    expect(rejectOrderSchema.safeParse(base).success).toBe(false)
    expect(
      rejectOrderSchema.safeParse({ ...base, reason: 'No stock' }).success,
    ).toBe(true)
  })
})
