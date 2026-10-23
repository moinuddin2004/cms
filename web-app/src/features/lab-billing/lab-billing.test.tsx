import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { LabBillingPanel } from './components/LabBillingPanel'
import { previewInvoice, spreadDiscount } from './lib/invoice-math'
import { LabInvoiceDetailPage } from './pages/LabInvoiceDetailPage'
import {
  creditNoteSchema,
  paymentSchema,
  percentToBp,
} from './schemas/lab-billing.schema'
import type { LabInvoiceDetail, LabInvoiceRow, OrderBilling } from './types'

// ── Mocks: API transport, router, toasts, access, page chrome ─────────────
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
vi.mock('@/features/access', () => ({
  useAccess: () => ({
    isLoading: false,
    can: () => true,
    canAll: () => true,
  }),
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
const patient = { id: 'p1', fullName: 'Ali Ahmed', patientNumber: 'P-001' }
const summary = {
  patientId: 'p1',
  invoicedPaisa: 2_800_000,
  creditedPaisa: 0,
  paidPaisa: 1_000_000,
  receivablePaisa: 1_800_000,
  collectedPaisa: 1_000_000,
  refundedPaisa: 0,
  advancePaisa: 0,
}
const row: LabInvoiceRow = {
  id: 'inv1',
  invoiceNo: 'LINV-0001',
  status: 'partially_paid',
  overdue: false,
  patient,
  order: { id: 'o1', orderNo: 'LAB-0001' },
  issuedOn: '2026-10-20',
  dueOn: '2026-10-20',
  subtotalPaisa: 3_000_000,
  discountPaisa: 200_000,
  taxPaisa: 0,
  totalPaisa: 2_800_000,
  creditedPaisa: 0,
  paidPaisa: 1_000_000,
  balancePaisa: 1_800_000,
  createdAt: '2026-10-20T10:00:00Z',
  version: 3,
}

function renderWith(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('lab billing math (mirrors the server)', () => {
  it('§15 Ali: 2 × 15,000 − 2,000 = 28,000, discount spread exactly', () => {
    expect(spreadDiscount([1_500_000, 1_500_000], 200_000)).toEqual([
      100_000, 100_000,
    ])
    expect(previewInvoice([1_500_000, 1_500_000], 200_000, 0)).toEqual({
      subtotalPaisa: 3_000_000,
      discountPaisa: 200_000,
      taxPaisa: 0,
      totalPaisa: 2_800_000,
    })
  })

  it('tax is basis points, half-up per line', () => {
    expect(previewInvoice([1_005], 0, 1_700).taxPaisa).toBe(171)
    expect(percentToBp('17')).toBe(1_700)
    expect(percentToBp('17.5')).toBe(1_750)
    expect(percentToBp('101')).toBeNull()
  })

  it('validates amounts as whole paisa and caps a credit note', () => {
    const pay = (amount: string) =>
      paymentSchema.safeParse({
        amount,
        method: 'cash',
        reference: '',
        notes: '',
        target: 'auto',
      }).success
    expect(pay('10000')).toBe(true)
    expect(pay('0')).toBe(false)
    expect(pay('10.505')).toBe(false)
    expect(
      creditNoteSchema(500_000).safeParse({
        amount: '5000.01',
        reason: 'x y z',
      }).success,
    ).toBe(false)
  })
})

describe('LabBillingPanel', () => {
  const billing: OrderBilling = {
    orderId: 'o1',
    patientId: 'p1',
    invoices: [row],
    unbilledItems: [
      {
        id: 'it3',
        description: 'Zirconia crown — teeth 36',
        quantity: 1,
        patientLinePricePaisa: 1_500_000,
        status: 'accepted',
      },
    ],
    unbilledCharges: [],
    totals: {
      billedPaisa: 2_800_000,
      creditedPaisa: 0,
      paidPaisa: 1_000_000,
      balancePaisa: 1_800_000,
    },
    patientSummary: summary,
  }

  it('shows the order’s invoices and balance, and bills unbilled work as an estimate', async () => {
    api.get.mockImplementation((url: string) =>
      Promise.resolve(
        ok(url.endsWith('/settings') ? { taxRateBp: 0, dueDays: 0 } : billing),
      ),
    )
    api.post.mockResolvedValue(ok({ ...row, id: 'inv2', status: 'draft' }))
    renderWith(<LabBillingPanel orderId="o1" patient={patient} />)

    expect(await screen.findByText('LINV-0001')).toBeTruthy()
    expect(screen.getByText('Partly paid')).toBeTruthy()
    expect(screen.getAllByText('PKR 18,000').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Bill 1 item/ }))
    expect(await screen.findByText('Zirconia crown — teeth 36')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save estimate' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = api.post.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(url).toBe('/lab-billing/invoices')
    expect(body).toMatchObject({
      orderId: 'o1',
      lines: [{ kind: 'lab_item', itemId: 'it3' }],
      discountPaisa: 0,
      taxRateBp: 0,
      issue: false,
    })
  })
})

describe('LabInvoiceDetailPage', () => {
  const detail: LabInvoiceDetail = {
    ...row,
    notes: null,
    voidReason: null,
    voidedAt: null,
    issuedAt: '2026-10-20T10:00:00Z',
    lines: [
      {
        id: 'l1',
        lineNo: 1,
        kind: 'lab_item',
        labOrderItemId: 'it1',
        chargeRequestId: null,
        description: 'Zirconia crown — teeth 16',
        quantity: 1,
        unitPricePaisa: 1_500_000,
        discountPaisa: 100_000,
        taxRateBp: 0,
        taxPaisa: 0,
        lineTotalPaisa: 1_400_000,
        doctor: null,
      },
    ],
    allocations: [
      {
        id: 'a1',
        paymentId: 'pay1',
        receiptNo: 'LRC-0001',
        method: 'cash',
        receivedAt: '2026-10-20T10:00:00Z',
        paymentStatus: 'posted',
        amountPaisa: 1_000_000,
        createdAt: '2026-10-20T10:00:00Z',
        reversedAt: null,
        releaseReason: null,
      },
      {
        id: 'a2',
        paymentId: 'pay2',
        receiptNo: 'LRC-0002',
        method: 'card',
        receivedAt: '2026-10-20T11:00:00Z',
        paymentStatus: 'reversed',
        amountPaisa: 1_800_000,
        createdAt: '2026-10-20T11:00:00Z',
        reversedAt: '2026-10-20T12:00:00Z',
        releaseReason: 'payment_reversed',
      },
    ],
    creditNotes: [],
    refunds: [],
    patientSummary: summary,
    history: [],
  }

  it('marks reversed payments and collects the balance with an Idempotency-Key', async () => {
    api.get.mockResolvedValue(ok(detail))
    api.post.mockResolvedValue(ok({ id: 'pay3', receiptNo: 'LRC-0003' }))
    renderWith(<LabInvoiceDetailPage invoiceId="inv1" />)

    expect(await screen.findByText('Invoice LINV-0001')).toBeTruthy()
    expect(screen.getByText('Reversed')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Collect payment/ }))
    const amount = await screen.findByLabelText(/Amount \(PKR\)/)
    expect((amount as HTMLInputElement).value).toBe('18000')
    fireEvent.click(screen.getByRole('button', { name: 'Collect' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body, config] = api.post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers?: Record<string, string> },
    ]
    expect(url).toBe('/lab-billing/payments')
    expect(body).toMatchObject({
      patientId: 'p1',
      amountPaisa: 1_800_000,
      method: 'cash',
      allocations: [{ invoiceId: 'inv1', amountPaisa: 1_800_000 }],
    })
    expect(config.headers?.['Idempotency-Key']).toBeTruthy()
  })
})
