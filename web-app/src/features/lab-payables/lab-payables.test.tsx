import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LabStatementDetailPage } from './pages/LabStatementDetailPage'
import { VendorBillDetailPage } from './pages/VendorBillDetailPage'
import { VendorBillsPage } from './pages/VendorBillsPage'
import {
  parseStatementLines,
  payLabSchema,
  percentToBp,
} from './schemas/lab-payables.schema'
import type { VendorBill, VendorBillDetail } from './types'

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
const paged = <T,>(rows: T[]) =>
  ok({ data: rows, total: rows.length, page: 1, limit: 20, totalPages: 1 })

const bill = (over: Partial<VendorBill> = {}): VendorBill => ({
  id: 'b1',
  billNo: 'VB-0001',
  vendorInvoiceNo: null,
  labId: 'lab1',
  labName: 'Smile Lab',
  labOrderId: 'o1',
  orderNo: 'LAB-0001',
  statementId: null,
  status: 'draft',
  billDate: '2026-10-20',
  dueOn: null,
  subtotalMinor: 1_000_000,
  taxBp: 0,
  taxMinor: 0,
  totalMinor: 1_000_000,
  paidMinor: 0,
  balanceMinor: 0,
  currency: 'PKR',
  approvedAt: null,
  voidedAt: null,
  voidReason: null,
  createdAt: '2026-10-20T10:00:00Z',
  version: 3,
  ...over,
})
const detail = (over: Partial<VendorBill> = {}): VendorBillDetail => ({
  ...bill(over),
  lines: [
    {
      id: 'l1',
      lineKind: 'service',
      labOrderId: 'o1',
      orderItemId: 'i1',
      chargeRequestId: null,
      remakeRequestId: null,
      description: 'Zirconia crown',
      quantity: 2,
      unitCostMinor: 500_000,
      lineTotalMinor: 1_000_000,
      isManual: false,
    },
  ],
  allocations: [],
})

function serve(routes: Record<string, unknown>) {
  api.get.mockImplementation((url: string) =>
    Promise.resolve(url in routes ? routes[url] : paged([])),
  )
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

describe('schemas', () => {
  it('percent → basis points', () => {
    expect(percentToBp('0')).toBe(0)
    expect(percentToBp('17')).toBe(1700)
    expect(percentToBp('12.5')).toBe(1250)
    expect(percentToBp('101')).toBeNull()
    expect(percentToBp('abc')).toBeNull()
  })

  it('parses pasted statement lines', () => {
    expect(
      parseStatementLines('LAB-0001, 5000\nLAB-0002\t1,250.50\n\n'),
    ).toEqual({
      lines: [
        {
          labReference: 'LAB-0001',
          amountMinor: 500_000,
          lineDate: undefined,
          description: undefined,
        },
        {
          labReference: 'LAB-0002',
          amountMinor: 125_050,
          lineDate: undefined,
          description: undefined,
        },
      ],
      errors: [],
    })
    expect(parseStatementLines('LAB-1, abc').errors[0]).toMatch(/not an amount/)
    expect(parseStatementLines('LAB-1, 10, 20/10/2026').errors[0]).toMatch(
      /YYYY-MM-DD/,
    )
  })

  it('payment: not over a bill balance, not over the payment', () => {
    const base = {
      method: 'cash' as const,
      reference: '',
      paidOn: '2026-10-20',
    }
    const alloc = (amount: string) => [
      { billId: 'b1', billNo: 'VB-0001', balanceMinor: 400_000, amount },
    ]
    expect(
      payLabSchema.safeParse({
        ...base,
        amount: '4000',
        allocations: alloc('4000'),
      }).success,
    ).toBe(true)
    expect(
      payLabSchema.safeParse({
        ...base,
        amount: '5000',
        allocations: alloc('4500'),
      }).success,
    ).toBe(false)
    expect(
      payLabSchema.safeParse({
        ...base,
        amount: '1000',
        allocations: alloc('2000'),
      }).success,
    ).toBe(false)
    // An unallocated rest is fine (an advance).
    expect(
      payLabSchema.safeParse({
        ...base,
        amount: '9000',
        allocations: alloc(''),
      }).success,
    ).toBe(true)
  })
})

describe('VendorBillsPage', () => {
  it('lists bills and shows the empty state without filters', async () => {
    serve({
      '/lab-payables/bills': paged([
        bill(),
        bill({
          id: 'b2',
          billNo: 'VB-0002',
          status: 'approved',
          balanceMinor: 200_000,
          totalMinor: 200_000,
        }),
      ]),
    })
    wrap(<VendorBillsPage />)
    expect(await screen.findByText('VB-0002')).toBeTruthy()
    expect(screen.getByText('VB-0001')).toBeTruthy()
    expect(screen.getAllByText('PKR 2,000').length).toBeGreaterThan(0)
  })

  it('empty → the explanation of where bills come from', async () => {
    serve({})
    wrap(<VendorBillsPage />)
    expect(await screen.findByText('No vendor bills yet')).toBeTruthy()
  })
})

describe('VendorBillDetailPage', () => {
  it('draft: approve sends the version, invoice no. and tax in basis points', async () => {
    serve({ '/lab-payables/bills/b1': ok(detail()) })
    api.post.mockResolvedValue(ok(detail({ status: 'approved', version: 4 })))
    wrap(<VendorBillDetailPage billId="b1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Approve/ }))
    fireEvent.change(await screen.findByLabelText("Lab's invoice no."), {
      target: { value: 'INV-9' },
    })
    fireEvent.change(screen.getByLabelText('Tax %'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve bill' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-payables/bills/b1/approve',
        { version: 3, vendorInvoiceNo: 'INV-9', dueOn: undefined, taxBp: 500 },
        expect.anything(),
      ),
    )
  })

  it('approved: pay instead of approve, nothing paid yet', async () => {
    serve({
      '/lab-payables/bills/b1': ok(
        detail({ status: 'approved', balanceMinor: 1_000_000 }),
      ),
    })
    wrap(<VendorBillDetailPage billId="b1" />)
    expect(await screen.findByRole('button', { name: /Pay/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull()
    expect(screen.getByText('Nothing paid on this bill yet.')).toBeTruthy()
  })
})

describe('LabStatementDetailPage', () => {
  it('shows each line with its match result', async () => {
    serve({
      '/lab-payables/statements/s1': ok({
        id: 's1',
        labId: 'lab1',
        labName: 'Smile Lab',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        statementRef: 'OCT',
        totalMinor: 700_000,
        status: 'reconciling',
        counts: { matched: 1, amount_mismatch: 1, missing_in_statement: 1 },
        createdAt: '2026-10-20T10:00:00Z',
        version: 1,
        lines: [
          {
            id: 'x1',
            labReference: 'LAB-0001',
            lineDate: null,
            description: null,
            amountMinor: 500_000,
            systemAmountMinor: 500_000,
            matchedBillId: 'b1',
            matchedBillLineId: 'l1',
            matchStatus: 'matched',
            billNo: 'VB-0001',
            orderNo: 'LAB-0001',
          },
          {
            id: 'x2',
            labReference: 'LAB-0002',
            lineDate: null,
            description: null,
            amountMinor: 200_000,
            systemAmountMinor: 150_000,
            matchedBillId: 'b2',
            matchedBillLineId: 'l2',
            matchStatus: 'amount_mismatch',
            billNo: 'VB-0002',
            orderNo: 'LAB-0002',
          },
          {
            id: 'x3',
            labReference: null,
            lineDate: null,
            description: 'Not on the statement: VB-0003',
            amountMinor: 0,
            systemAmountMinor: 90_000,
            matchedBillId: 'b3',
            matchedBillLineId: 'l3',
            matchStatus: 'missing_in_statement',
            billNo: 'VB-0003',
            orderNo: null,
          },
        ],
      }),
    })
    api.post.mockResolvedValue(ok({}))
    wrap(<LabStatementDetailPage statementId="s1" />)
    expect(
      (await screen.findAllByText('Amount differs')).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Not on statement').length).toBeGreaterThan(0)
    expect(screen.getByText('PKR 1,500')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Mark reconciled/ }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/lab-payables/statements/s1/status',
        { version: 1, status: 'reconciled' },
        expect.anything(),
      ),
    )
  })
})
