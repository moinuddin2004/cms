import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { encodeQr, formatBits, gfMul, rsDivisor, rsRemainder } from './lib/qr'
import { orderError } from './lib/order-errors'
import { LabOrderDetailPage } from './pages/LabOrderDetailPage'
import { LabOrdersPage } from './pages/LabOrdersPage'
import { labOrderSchema } from './schemas/lab-order.schema'
import type { LabOrderDetail, LabOrderRow } from './types'

// ── Mocks: API transport, router, toasts, page chrome ────────────────────
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
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

const ok = <T,>(data: T) => ({ data: { data } })
const paged = <T,>(data: T[]) =>
  ok({ data, total: data.length, page: 1, limit: 20 })

const row: LabOrderRow = {
  id: 'o1',
  orderNo: 'LAB-0001',
  status: 'submitted',
  priority: 'normal',
  patient: { id: 'p1', fullName: 'Ali Raza', patientNumber: 'P-1' },
  doctor: { id: 'd1', fullName: 'Dr Sana' },
  lab: { id: 'l1', name: 'Smile Lab' },
  itemCount: 1,
  labCostPaisa: 1_000_000,
  patientPricePaisa: 3_000_000,
  requestedOn: null,
  labExpectedOn: '2026-10-25',
  submittedAt: '2026-10-20T10:00:00Z',
  createdAt: '2026-10-20T09:00:00Z',
  version: 3,
}

const detail: LabOrderDetail = {
  id: 'o1',
  orderNo: 'LAB-0001',
  status: 'clarification_needed',
  priority: 'urgent',
  requestedOn: null,
  labExpectedOn: '2026-10-25',
  notes: 'Handle with care',
  currentRevisionNo: 1,
  appointmentId: null,
  orderTemplateId: null,
  submittedAt: '2026-10-20T10:00:00Z',
  createdAt: '2026-10-20T09:00:00Z',
  version: 4,
  patient: row.patient,
  doctor: row.doctor,
  lab: { id: 'l1', name: 'Smile Lab', city: 'Lahore' },
  totals: { labCostPaisa: 1_000_000, patientPricePaisa: 3_000_000 },
  items: [
    {
      id: 'i1',
      lineNo: 1,
      labServiceId: 's1',
      serviceCode: 'ZR_CROWN',
      serviceName: 'Zirconia crown',
      unitType: 'per_tooth',
      quantity: 2,
      rush: false,
      optionIds: [],
      options: [],
      clinicTreatmentId: 't1',
      prices: {
        currency: 'PKR',
        labUnitCostPaisa: 500_000,
        labLineCostPaisa: 1_000_000,
        patientUnitPricePaisa: 1_500_000,
        patientLinePricePaisa: 3_000_000,
        pricedOn: '2026-10-20',
      },
      status: 'pending_acceptance',
      form: null,
      answers: {},
      validatedAt: '2026-10-20T10:00:00Z',
      teeth: [
        { tooth: '11', dentition: 'permanent', role: 'crown', surfaces: [] },
        { tooth: '21', dentition: 'permanent', role: 'crown', surfaces: [] },
      ],
      details: { shade: 'A2' },
      version: 2,
    },
  ],
  revisions: [
    {
      id: 'r1',
      revisionNo: 1,
      reason: null,
      createdBy: { id: 'u1', name: 'Dr Sana' },
      createdAt: '2026-10-20T10:00:00Z',
      labAcknowledgedAt: null,
    },
  ],
  messages: [
    {
      id: 'm1',
      itemId: null,
      kind: 'clarification_request',
      authorSide: 'lab',
      author: { id: 'u2', name: 'Lab admin' },
      body: 'Which shade for 21?',
      resolvedAt: null,
      createdAt: '2026-10-20T11:00:00Z',
    },
  ],
  charges: [
    {
      id: 'c1',
      itemId: 'i1',
      kind: 'material',
      amountPaisa: 50_000,
      currency: 'PKR',
      reason: 'Extra layering',
      status: 'pending',
      requestedBy: null,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: '2026-10-20T11:00:00Z',
      version: 1,
    },
  ],
  attachments: [],
  history: [],
  availableActions: ['cancel'],
  warnings: [
    {
      code: 'LAB_DUE_AFTER_NEXT_APPOINTMENT',
      message:
        'The lab work is due 2026-10-25, after the patient’s next appointment on 2026-10-22',
      appointmentId: 'a1',
      appointmentOn: '2026-10-22',
      labExpectedOn: '2026-10-25',
    },
  ],
}

/** GET by URL: the page under test plus the lookups its sheets make. */
function serve(routes: Record<string, unknown>) {
  api.get.mockImplementation((url: string) => {
    if (url in routes) return Promise.resolve(routes[url])
    if (url.endsWith('/production'))
      return Promise.resolve(
        ok({ items: [], shipments: [], remakeRequests: [] }),
      )
    if (url === '/appointments/doctors' || url === '/form-schemas')
      return Promise.resolve(ok([]))
    return Promise.resolve(paged([]))
  })
}

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
})

describe('QR encoder', () => {
  it('computes Reed–Solomon codewords (ISO 18004 “HELLO WORLD” 1-M)', () => {
    const data = [
      32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17,
    ]
    expect(rsRemainder(data, rsDivisor(10))).toEqual([
      196, 35, 39, 119, 235, 215, 231, 226, 93, 23,
    ])
    expect(gfMul(0x80, 0x02)).toBe(0x1d)
  })

  it('formats level-M mask bits as the standard table', () => {
    expect(formatBits(0).toString(2).padStart(15, '0')).toBe('101010000010010')
    expect(formatBits(4).toString(2).padStart(15, '0')).toBe('100010111111001')
    expect(formatBits(7).toString(2).padStart(15, '0')).toBe('100101010100000')
  })

  it('draws a version-sized symbol with the three finder patterns', () => {
    const short = encodeQr('LAB-0001')
    expect(short).toHaveLength(21)
    const url = encodeQr(
      `https://clinic.example.com/lab-portal/orders/${'0'.repeat(36)}`,
    )
    expect(url.length).toBeGreaterThan(21)
    const n = url.length
    for (const [x, y] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ]) {
      expect(url[y][x]).toBe(true)
      expect(url[y + 1][x + 1]).toBe(false)
      expect(url[y + 3][x + 3]).toBe(true)
    }
    expect(url[n - 8][8]).toBe(true) // dark module
  })
})

describe('order form schema and errors', () => {
  it('needs a patient, a lab and at least one serviced item', () => {
    const base = {
      patientId: 'p1',
      labId: 'l1',
      doctorId: '',
      priority: 'normal' as const,
      requestedOn: '',
      notes: '',
      items: [
        {
          labServiceId: 's1',
          optionIds: [],
          quantity: '1',
          rush: false,
          answers: {},
        },
      ],
    }
    expect(labOrderSchema.safeParse(base).success).toBe(true)
    expect(labOrderSchema.safeParse({ ...base, items: [] }).success).toBe(false)
    expect(labOrderSchema.safeParse({ ...base, patientId: '' }).success).toBe(
      false,
    )
  })

  it('reads per-line issues from a refused submit', () => {
    const e = orderError({
      response: {
        data: {
          error: {
            code: 'LAB_ORDER_INVALID',
            message: 'Some lines need attention',
            issues: [
              { line: 1, path: 'teeth', code: 'required', message: 'Required' },
            ],
          },
        },
      },
    })
    expect(e.code).toBe('LAB_ORDER_INVALID')
    expect(e.issues).toHaveLength(1)
  })
})

describe('LabOrdersPage', () => {
  it('lists orders with status and lab cost', async () => {
    serve({ '/lab-orders': paged([row]) })
    wrap(<LabOrdersPage />)
    expect(await screen.findByText('LAB-0001')).toBeTruthy()
    expect(screen.getByText('Ali Raza')).toBeTruthy()
    expect(screen.getByText('Submitted')).toBeTruthy()
    expect(screen.getByText('PKR 10,000')).toBeTruthy()
  })

  it('shows the empty state without filters', async () => {
    serve({})
    wrap(<LabOrdersPage />)
    expect(await screen.findByText('No lab orders yet')).toBeTruthy()
  })
})

describe('LabOrderDetailPage', () => {
  it('shows items, the appointment warning and asks for a reply', async () => {
    serve({ '/lab-orders/o1': ok(detail) })
    wrap(<LabOrderDetailPage orderId="o1" />)
    expect(await screen.findByText('Lab order LAB-0001')).toBeTruthy()
    expect(
      screen.getByText(/after the patient’s next appointment/),
    ).toBeTruthy()
    expect(screen.getByText(/Teeth: 11, 21/)).toBeTruthy()
    expect(screen.getByText(/needs your reply/)).toBeTruthy()

    api.post.mockResolvedValue(ok({ ...detail, status: 'submitted' }))
    fireEvent.change(screen.getByLabelText('Reply to the lab'), {
      target: { value: 'A2 for both' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Reply/ }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-orders/o1/messages',
        { kind: 'reply', body: 'A2 for both' },
        { headers: undefined },
      ),
    )
  })

  it('approves a pending charge with its version', async () => {
    serve({ '/lab-orders/o1': ok(detail) })
    wrap(<LabOrderDetailPage orderId="o1" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve charge' }),
    )
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-orders/o1/charge-requests/c1/decision',
        { decision: 'approve', version: 1 },
        { headers: undefined },
      ),
    )
  })

  it('submits a draft with an Idempotency-Key', async () => {
    serve({
      '/lab-orders/o1': ok({
        ...detail,
        status: 'draft',
        orderNo: null,
        totals: null,
      }),
    })
    api.post.mockResolvedValue(ok(detail))
    wrap(<LabOrderDetailPage orderId="o1" />)
    fireEvent.click(
      await screen.findByRole('button', { name: /Submit to lab/ }),
    )
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body, config] = api.post.mock.calls[0] as [
      string,
      object,
      { headers: Record<string, string> },
    ]
    expect(url).toBe('/lab-orders/o1/submit')
    expect(body).toEqual({ version: 4 })
    expect(config.headers['Idempotency-Key']).toMatch(/.{8,}/)
  })
})
