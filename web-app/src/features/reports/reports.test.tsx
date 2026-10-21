import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'

import { periodRange, useReportsStore } from './hooks/use-reports-store'
import { compactMoney, formatReportValue } from './lib/report-format'
import { FinanceDashboardPage } from './pages/FinanceDashboardPage'
import { ReportsHubPage } from './pages/ReportsHubPage'
import { ReportViewerPage } from './pages/ReportViewerPage'
import { ClinicOverviewPage } from './pages/ClinicOverviewPage'
import { BusiestTimes } from './components/BusiestTimes'
import type {
  ClinicOverview,
  FinanceOverview,
  ReportCatalogItem,
  ReportView,
} from './types/reports.types'

// ── Mocks: API transport, router, toasts, feature flags ──────────────────
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode
    to: string
    params?: Record<string, string>
  }) => (
    <a
      href={params?.reportKey ? to.replace('$reportKey', params.reportKey) : to}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/context/FeatureFlagsContext', () => ({
  useFeatures: () => ({
    features: new Set(['reports.financial', 'reports.exports']),
    isLoading: false,
  }),
}))
vi.mock('@/features/appointments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDoctors: () => ({ data: [{ id: 'd1', fullName: 'Nouman' }] }),
}))

const ok = <T,>(data: T) => ({ data: { data } })

const catalog: ReportCatalogItem[] = [
  {
    key: 'profit-loss',
    title: 'Profit & loss',
    description: 'Revenue, costs and net profit.',
    category: 'finance',
    filters: { dates: 'range', basis: true },
  },
  {
    key: 'collections',
    title: 'Payments received',
    description: 'Every receipt.',
    category: 'revenue',
    filters: { dates: 'range' },
  },
  {
    key: 'outstanding',
    title: 'Outstanding balances',
    description: 'Who owes money.',
    category: 'revenue',
    filters: { dates: 'asOf' },
  },
  {
    key: 'expenses',
    title: 'Expense register',
    description: 'Every expense.',
    category: 'expenses',
    filters: { dates: 'range', expenseCategory: true },
  },
]

const meta: ReportView['meta'] = {
  organizationName: 'Smile Dental',
  scopeLabel: 'Main branch',
  from: '2026-10-01',
  to: '2026-10-21',
  asOf: false,
  basis: 'collected',
  generatedAt: '2026-10-21T09:00:00.000Z',
  generatedLabel: '21 Oct 2026, 14:00',
}

const collections: ReportView = {
  key: 'collections',
  title: 'Payments received',
  description: 'Every receipt.',
  columns: [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'patient', header: 'Patient', type: 'text' },
    { key: 'amount', header: 'Amount', type: 'money', total: true },
  ],
  rows: [
    { date: '2026-10-17', patient: 'QA One', amount: 900 },
    { date: '2026-10-16', patient: 'علی خان', amount: 3000 },
  ],
  totals: { amount: 3900 },
  summary: [],
  notes: ['A note about this report.'],
  truncated: false,
  totalRows: 2,
  meta,
}

const pnlView: ReportView = {
  ...collections,
  key: 'profit-loss',
  title: 'Profit & loss',
  columns: [
    { key: 'line', header: 'Item', type: 'text' },
    { key: 'amount', header: 'Amount', type: 'money' },
    { key: 'share', header: '% of revenue', type: 'percent' },
  ],
  rows: [
    { _kind: 'section', line: 'Revenue', amount: null, share: null },
    { _kind: 'line', line: 'Clinic services', amount: 17200, share: 100 },
    { _kind: 'subtotal', line: 'Total revenue', amount: 17200, share: 100 },
    { _kind: 'section', line: 'Operating expenses', amount: null, share: null },
    { _kind: 'line', line: 'Salaries (payroll)', amount: 333, share: 1.9 },
    { _kind: 'total', line: 'Net profit', amount: 16867, share: 98.1 },
  ],
  totals: null,
  summary: [
    { label: 'Revenue', value: 17200, type: 'money' },
    { label: 'Net profit', value: 16867, type: 'money' },
  ],
}

const overview: FinanceOverview = {
  period: { from: '2026-10-01', to: '2026-10-21' },
  previousPeriod: { from: '2026-09-01', to: '2026-09-21' },
  scope: { label: 'Main branch', locationCount: 1 },
  basis: 'collected',
  kpis: {
    revenue: { value: 17200, previous: 10000, changePct: 72 },
    costs: { value: 333, previous: 0, changePct: null },
    netProfit: { value: 16867, previous: 10000, changePct: 68.7 },
    collected: { value: 17200, previous: 10000, changePct: 72 },
    billed: { value: 21500, previous: 0, changePct: null },
    marginPct: 98.1,
    previousMarginPct: 100,
  },
  pnl: {
    basis: 'collected',
    revenue: { clinic: 17200, lab: 0, total: 17200 },
    collected: 17200,
    billed: 21500,
    directCosts: { labBills: 0, commissions: 0, total: 0 },
    grossProfit: 17200,
    operating: {
      salaries: 333,
      expenses: [{ category: 'RENT', label: 'Rent', amount: 0 }],
      total: 333,
    },
    totalCosts: 333,
    netProfit: 16867,
    marginPct: 98.1,
  },
  trend: [
    {
      month: '2026-10',
      label: 'Oct 26',
      revenue: 17200,
      costs: 333,
      profit: 16867,
    },
  ],
  costBreakdown: [{ key: 'salaries', label: 'Salaries', amount: 333 }],
  balances: {
    receivable: 5800,
    openInvoices: 1,
    aging: [
      { bucket: 'Not due', amount: 5800 },
      { bucket: '90+ days', amount: 0 },
    ],
    payable: 0,
    payableOverdue: 0,
    advances: 1500,
  },
  topDoctors: [{ doctorId: 'd1', name: 'nouman', amount: 3000 }],
  topServices: [{ name: 'Filling', count: 4, amount: 7200 }],
  collectionsByAccount: [{ account: 'Cash', amount: 16200 }],
  counts: {
    invoices: 6,
    avgInvoice: 3583.33,
    patientsBilled: 5,
    receipts: 8,
    discounts: 500,
  },
  warnings: [
    "Payroll for Oct 2026 isn't generated yet, so those salaries are not in these numbers.",
  ],
}

const kpi = (
  value: number | null,
  previous: number | null,
  changePct: number | null,
) => ({
  value,
  previous,
  changePct,
})

const clinic: ClinicOverview = {
  period: { from: '2026-10-01', to: '2026-10-21' },
  previousPeriod: { from: '2026-09-01', to: '2026-09-21' },
  scope: { label: 'Main branch', locationCount: 1 },
  kpis: {
    patientsSeen: kpi(5, 4, 25),
    visits: kpi(9, 6, 50),
    newPatients: kpi(9, 0, null),
    appointments: kpi(7, 7, 0),
    noShowPct: kpi(50, 20, 150),
    showUpPct: kpi(50, 80, -37.5),
    avgWaitMin: kpi(9.4, 12, -21.7),
    avgConsultMin: kpi(1.7, null, null),
    walkInPct: kpi(90.9, 80, 13.6),
  },
  trend: {
    unit: 'week',
    points: [
      {
        key: '2026-10-13',
        label: '13 Oct',
        visits: 5,
        newVisits: 3,
        returningVisits: 2,
        newPatients: 3,
        appointments: 1,
        showUpPct: 50,
        avgWaitMin: 9.4,
      },
    ],
  },
  heatmap: [
    { dow: 6, hour: 12, count: 5 },
    { dow: 1, hour: 20, count: 3 },
  ],
  sources: [{ label: 'Walk In', count: 9 }],
  doctors: [
    {
      doctorId: 'd1',
      name: 'aliyan',
      visits: 6,
      patients: 3,
      avgWaitMin: 0.5,
      avgConsultMin: 2,
    },
    {
      doctorId: 'd2',
      name: 'nouman',
      visits: 3,
      patients: 3,
      avgWaitMin: 37.1,
      avgConsultMin: 0.4,
    },
  ],
  appointmentStatus: [
    { key: 'completed', label: 'Completed', count: 3 },
    { key: 'no_show', label: 'No-show', count: 3 },
  ],
  demographics: {
    gender: [{ label: 'Female', count: 2 }],
    age: [{ label: '18–29', count: 2 }],
  },
  topDiagnoses: [{ label: 'Dental caries', count: 1 }],
  topTreatments: [{ label: 'Filling', count: 1 }],
  attention: {
    missedFollowUps: 2,
    upcomingFollowUps: 1,
    lapsedPatients: 0,
    noShowsToCall: 3,
    lateLabOrders: 0,
  },
}

function routeApi() {
  api.get.mockImplementation((url: string) => {
    if (url === '/reports') return Promise.resolve(ok(catalog))
    if (url === '/reports/finance/overview')
      return Promise.resolve(ok(overview))
    if (url === '/reports/profit-loss') return Promise.resolve(ok(pnlView))
    if (url === '/reports/clinic/overview') return Promise.resolve(ok(clinic))
    if (url.startsWith('/reports/') && !url.endsWith('/export'))
      return Promise.resolve(ok(collections))
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  api.get.mockReset()
  routeApi()
  useReportsStore.setState({
    preset: 'month',
    custom: {},
    scope: 'location',
    basis: 'collected',
  })
  useAuthStore.setState({
    activeLocationId: 'l1',
    activeOrganizationId: 'o1',
    accessibleOrganizations: [
      {
        id: 'o1',
        name: 'Smile Dental',
        slug: 'smile',
        accessSource: 'owner',
        specialtyTags: [],
        locations: [
          {
            id: 'l1',
            name: 'Main',
            code: 'M',
            isMainBranch: true,
            accessSource: 'owner',
            isPrimary: true,
          },
          {
            id: 'l2',
            name: 'DHA',
            code: 'D',
            isMainBranch: false,
            accessSource: 'owner',
            isPrimary: false,
          },
        ],
      },
    ],
  })
})

describe('report periods and formatting', () => {
  const today = new Date(2026, 9, 21) // 21 Oct 2026

  it('resolves presets to clinic days', () => {
    expect(periodRange('month', {}, today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-21',
    })
    expect(periodRange('lastMonth', {}, today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(periodRange('quarter', {}, today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-21',
    })
    expect(periodRange('year', {}, today)).toEqual({
      from: '2026-01-01',
      to: '2026-10-21',
    })
    expect(periodRange('lastYear', {}, today)).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    })
    expect(periodRange('custom', { from: '2026-05-03' }, today)).toEqual({
      from: '2026-05-03',
      to: '2026-05-03',
    })
  })

  it('formats cells and compact amounts', () => {
    expect(formatReportValue(12.5, 'percent')).toBe('12.5%')
    expect(formatReportValue('2026-10-05', 'date')).toBe('05 Oct 2026')
    expect(formatReportValue(null, 'money')).toBe('—')
    expect(compactMoney(250_000)).toBe('2.5 L')
    expect(compactMoney(-4_500)).toBe('-4.5k')
    expect(compactMoney(5_800)).toBe('5.8k')
    expect(compactMoney(16_200)).toBe('16k')
  })
})

describe('FinanceDashboardPage', () => {
  it('shows profit, costs, receivables, warnings and the P&L', async () => {
    renderWithQuery(<FinanceDashboardPage />)
    expect(await screen.findByText('Revenue (collected)')).toBeTruthy()
    expect(screen.getAllByText('PKR 16,867').length).toBeGreaterThan(0)
    expect(screen.getByText('98.1% margin')).toBeTruthy()
    expect(screen.getByText('+72%')).toBeTruthy()
    expect(screen.getByText(/Payroll for Oct 2026/)).toBeTruthy()
    expect(screen.getByText('Gross profit')).toBeTruthy()
    expect(screen.getByText('Dr. nouman')).toBeTruthy()
    // zero expense lines are still listed in the statement
    expect(screen.getByText('Rent')).toBeTruthy()
  })

  it('lets an owner switch to all locations and to billed revenue', async () => {
    renderWithQuery(<FinanceDashboardPage />)
    await screen.findByText('Revenue (collected)')
    fireEvent.click(screen.getByRole('button', { name: /All locations/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Billed' }))
    await waitFor(() => {
      const calls = api.get.mock.calls.filter(
        ([u]) => u === '/reports/finance/overview',
      )
      const last = calls[calls.length - 1][1] as {
        params: Record<string, string>
      }
      expect(last.params).toMatchObject({
        scope: 'organization',
        basis: 'billed',
        from: expect.any(String),
      })
    })
  })

  it('shows a retry state when the overview fails', async () => {
    api.get.mockImplementation((url: string) =>
      url === '/reports/finance/overview'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(ok(catalog)),
    )
    renderWithQuery(<FinanceDashboardPage />)
    expect(
      await screen.findByText("Couldn't load the finance overview"),
    ).toBeTruthy()
  })
})

describe('ReportsHubPage', () => {
  it('groups reports and filters them by search', async () => {
    renderWithQuery(<ReportsHubPage />)
    expect(await screen.findByText('Payments received')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Profit & cash' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search reports'), {
      target: { value: 'nothing-like-this' },
    })
    expect(
      await screen.findByText('No reports match your filters.'),
    ).toBeTruthy()
  })
})

describe('ReportViewerPage', () => {
  it('renders a register with its totals and notes', async () => {
    renderWithQuery(<ReportViewerPage reportKey="collections" />)
    expect(await screen.findByText('QA One')).toBeTruthy()
    expect(screen.getByText('علی خان')).toBeTruthy()
    expect(screen.getByText('Total amount')).toBeTruthy()
    expect(screen.getByText('PKR 3,900')).toBeTruthy()
    expect(screen.getByText('A note about this report.')).toBeTruthy()
    expect(screen.getByText('Download')).toBeTruthy()
  })

  it('renders the P&L as a statement and sends the basis', async () => {
    renderWithQuery(<ReportViewerPage reportKey="profit-loss" />)
    expect(await screen.findByText('Salaries (payroll)')).toBeTruthy()
    expect(screen.getByText('− PKR 333')).toBeTruthy()
    const call = api.get.mock.calls.find(([u]) => u === '/reports/profit-loss')
    expect((call?.[1] as { params: Record<string, string> }).params.basis).toBe(
      'collected',
    )
  })

  it('sends no dates for a snapshot report', async () => {
    renderWithQuery(<ReportViewerPage reportKey="outstanding" />)
    await screen.findByText('Balances as of today')
    await waitFor(() => {
      const call = api.get.mock.calls.find(
        ([u]) => u === '/reports/outstanding',
      )
      expect(call).toBeTruthy()
      expect(
        (call?.[1] as { params: Record<string, string> }).params.from,
      ).toBeUndefined()
    })
  })
})

describe('ClinicOverviewPage', () => {
  it('shows headline numbers, the call lists, outcomes and doctors', async () => {
    renderWithQuery(<ClinicOverviewPage />)
    expect(await screen.findByText('Patients seen')).toBeTruthy()
    expect(screen.getByText('9 visits · 6 returning')).toBeTruthy()
    // show-up fell 30 points (bad); waiting fell 2.6 min (good)
    expect(screen.getByText('−30 pts')).toBeTruthy()
    expect(screen.getByText('−2.6 min')).toBeTruthy()
    expect(screen.getByText('Visits per week')).toBeTruthy()
    expect(screen.getByText('Missed follow-ups (last 30 days)')).toBeTruthy()
    expect(screen.getByText('No-shows to call back')).toBeTruthy()
    expect(screen.getByText('Late lab orders: none')).toBeTruthy()
    expect(screen.getByText('Dr. aliyan')).toBeTruthy()
    expect(screen.getByText('37 min')).toBeTruthy()
    expect(screen.getByText('Dental caries')).toBeTruthy()
    const call = api.get.mock.calls.find(
      ([u]) => u === '/reports/clinic/overview',
    )
    expect(
      (call?.[1] as { params: Record<string, string> }).params.basis,
    ).toBeUndefined()
  })

  it('switches the patient mix and flags missing profiles', async () => {
    api.get.mockImplementation((url: string) =>
      url === '/reports/clinic/overview'
        ? Promise.resolve(
            ok({
              ...clinic,
              demographics: {
                gender: [
                  { label: 'Not recorded', count: 4 },
                  { label: 'Female', count: 1 },
                ],
                age: [],
              },
            }),
          )
        : Promise.resolve(ok(catalog)),
    )
    renderWithQuery(<ClinicOverviewPage />)
    await screen.findByText('Patient mix')
    expect(screen.getByText('Walk In')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Gender' }))
    expect(screen.getByText('Female')).toBeTruthy()
    expect(
      screen.getByText(/4 of 5 patients have no gender recorded/),
    ).toBeTruthy()
  })
})

describe('BusiestTimes', () => {
  it('names the busiest day and hour', () => {
    render(<BusiestTimes cells={clinic.heatmap} />)
    expect(screen.getAllByText('Sat').length).toBe(2) // the tile and the bar label
    expect(screen.getByText('12:00–13:00')).toBeTruthy()
    expect(screen.getByTitle('Mon: 3 check-ins')).toBeTruthy()
  })

  it('says so when nobody checked in', () => {
    render(<BusiestTimes cells={[]} />)
    expect(screen.getByText('No check-ins in this period.')).toBeTruthy()
  })
})
