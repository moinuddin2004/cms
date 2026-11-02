import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ProductionPanel } from './components/production/ProductionPanel'
import { receiveDefaults, toReceiveLines } from './hooks/useProduction'
import { ReceiveShipmentPage } from './pages/ReceiveShipmentPage'
import type { ItemStage, OrderProduction, Shipment } from './production.types'
import {
  receiveLineSchema,
  remakeDecisionSchema,
} from './schemas/production.schema'
import type { LabOrderDetail } from './types'

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
// Orders + lab coordination granted; lab billing (its own suite) is not.
vi.mock('@/features/access', () => ({
  useAccess: () => ({
    isLoading: false,
    can: (p: string) => p !== 'lab.billing.manage',
    canAll: (ps: string[]) => !ps.includes('lab.billing.manage'),
  }),
}))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({
    title,
    children,
  }: {
    title?: string
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

const ok = <T,>(data: T) => ({ data: { data } })

const stage = (over: Partial<ItemStage>): ItemStage => ({
  id: 's1',
  seq: 1,
  roundNo: 1,
  code: 'metal_tryin',
  name: 'Metal try-in',
  isFinal: false,
  requiresPatientVisit: true,
  status: 'pending',
  isActive: false,
  labExpectedOn: null,
  appointmentId: null,
  outcome: null,
  tryinNotes: null,
  correctionNotes: null,
  decidedAt: null,
  decidedBy: null,
  startedAt: null,
  version: 1,
  ...over,
})

const shipment: Shipment = {
  id: 'sh1',
  shipmentNo: 'SHP-0002',
  direction: 'to_clinic',
  status: 'dispatched',
  courierName: 'TCS',
  trackingNo: '991',
  notes: null,
  dispatchedAt: '2026-10-20T10:00:00Z',
  receivedAt: null,
  lostAt: null,
  lostReason: null,
  qrToken: 'tok123',
  qrValue: 'http://localhost:3000/lab-orders/receive/tok123',
  version: 1,
  clinic: { name: 'Bright Smiles' },
  lab: { id: 'l1', name: 'Smile Lab' },
  lines: [
    {
      id: 'line1',
      orderId: 'o1',
      orderNo: 'LAB-0001',
      itemId: 'i1',
      lineNo: 1,
      serviceName: 'PFM bridge',
      itemStatus: 'at_clinic_tryin',
      stageId: 's1b',
      stageName: 'Metal try-in',
      stageRound: 2,
      contents: 'tryin',
      quantity: 2,
      receivedQty: null,
      condition: null,
      qcResult: null,
      qcNotes: null,
      receivedAt: null,
    },
  ],
}

const production: OrderProduction = {
  items: [
    {
      id: 'i1',
      lineNo: 1,
      serviceName: 'PFM bridge',
      quantity: 1,
      status: 'at_clinic_tryin',
      currentStageSeq: 1,
      remakeOfItemId: null,
      version: 5,
      assignee: { labMemberId: 'm1', name: 'Ali Tech' },
      warranty: null,
      stages: [
        stage({
          id: 's1a',
          status: 'correction',
          outcome: 'correction',
          correctionNotes: 'Margin open',
        }),
        stage({
          id: 's1b',
          roundNo: 2,
          status: 'tryin_done',
          isActive: true,
        }),
        stage({ id: 's2', seq: 2, name: 'Bisque try-in' }),
        stage({ id: 's3', seq: 3, name: 'Final', isFinal: true }),
      ],
      shipmentLines: [],
    },
  ],
  shipments: [shipment],
  remakeRequests: [],
}

const order = {
  id: 'o1',
  items: [
    {
      id: 'i1',
      prices: { labLineCostMinor: 800_000, patientLinePriceMinor: 2_500_000 },
    },
  ],
} as unknown as LabOrderDetail

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  api.get.mockReset()
  api.post.mockReset()
})

describe('production schemas', () => {
  it('a missing line receives nothing; a received one needs 1..quantity', () => {
    const base = { quantity: 2, qcResult: '' as const, qcNotes: '' }
    expect(
      receiveLineSchema.safeParse({
        ...base,
        condition: 'missing',
        receivedQty: '1',
      }).success,
    ).toBe(false)
    expect(
      receiveLineSchema.safeParse({
        ...base,
        condition: 'ok',
        receivedQty: '3',
      }).success,
    ).toBe(false)
    expect(
      receiveLineSchema.safeParse({
        ...base,
        condition: 'damaged',
        receivedQty: '1',
      }).success,
    ).toBe(true)
  })

  it('agreeing a remake needs a responsible party; closing doesn’t', () => {
    expect(
      remakeDecisionSchema.safeParse({
        decision: 'agree',
        responsibleParty: 'undetermined',
        note: '',
      }).success,
    ).toBe(false)
    expect(
      remakeDecisionSchema.safeParse({
        decision: 'close',
        responsibleParty: 'undetermined',
        note: '',
      }).success,
    ).toBe(true)
  })

  it('receiving sends only ticked lines, without QC for missing ones', () => {
    const v = receiveDefaults(shipment)
    expect(v.lines[0].line).toMatchObject({
      receivedQty: '2',
      condition: 'ok',
      qcResult: 'pass',
    })
    v.lines[0].line = {
      ...v.lines[0].line,
      condition: 'missing',
      receivedQty: '0',
    }
    expect(toReceiveLines(v)).toEqual([
      { shipmentItemId: 'line1', receivedQty: 0, condition: 'missing' },
    ])
    v.lines[0].include = false
    expect(toReceiveLines(v)).toEqual([])
  })
})

describe('ProductionPanel', () => {
  it('shows every try-in round and the incoming shipment; approves the active stage', async () => {
    api.get.mockResolvedValue(ok(production))
    api.post.mockResolvedValue(ok(production))
    wrap(<ProductionPanel order={order} />)

    expect(await screen.findByText('1. PFM bridge')).toBeTruthy()
    expect(screen.getByText('R1')).toBeTruthy()
    expect(screen.getByText('R2')).toBeTruthy()
    expect(screen.getByText('Correction')).toBeTruthy()
    expect(screen.getByText(/SHP-0002/)).toBeTruthy()
    expect(screen.getByText('Technician: Ali Tech')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: /Approve Metal try-in/ }),
    )
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-orders/o1/stages/s1b/decision',
        { decision: 'approve', notes: undefined },
      ),
    )
  })

  it('offers delivery for approved work and shows the warranty after it', async () => {
    api.get.mockResolvedValue(
      ok({
        ...production,
        shipments: [],
        items: [
          {
            ...production.items[0],
            status: 'delivered',
            stages: [],
            warranty: {
              id: 'w1',
              startsOn: '2026-10-20',
              endsOn: '2027-10-19',
              terms: 'Standard lab warranty',
              voidedAt: null,
            },
          },
        ],
      }),
    )
    wrap(<ProductionPanel order={order} />)
    expect(
      await screen.findByText(/Warranty 2026-10-20 → 2027-10-19/),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /Request remake/ })).toBeTruthy()
  })
})

describe('ReceiveShipmentPage (QR entry)', () => {
  it('loads the shipment by its token and receives it as a QR scan', async () => {
    api.get.mockResolvedValue(ok(shipment))
    api.post.mockResolvedValue(ok({ ...shipment, status: 'received' }))
    wrap(<ReceiveShipmentPage token="tok123" />)
    expect(await screen.findByText('Receive SHP-0002')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/lab-shipments/by-token/tok123')
    fireEvent.click(screen.getByRole('button', { name: /Receive shipment/ }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/lab-shipments/sh1/receive', {
        viaQr: true,
        lines: [
          {
            shipmentItemId: 'line1',
            receivedQty: 2,
            condition: 'ok',
            qcResult: 'pass',
          },
        ],
      }),
    )
  })
})
