// Shapes of `/reports` (backend `src/reports`). Money is rupees.

export type ReportCategory =
  | 'finance'
  | 'revenue'
  | 'expenses'
  | 'staff'
  | 'lab'
  | 'patients'
  | 'appointments'
  | 'operations'
  | 'clinical'
export type ReportColumnType =
  | 'text'
  | 'money'
  | 'number'
  | 'decimal'
  | 'date'
  | 'percent'
export type RevenueBasis = 'collected' | 'billed'
export type ReportScopeKind = 'location' | 'organization'
export type ExportFormat = 'xlsx' | 'pdf'

export interface ReportFilterSpec {
  dates: 'range' | 'asOf'
  doctor?: boolean
  expenseCategory?: boolean
  basis?: boolean
}

export interface ReportCatalogItem {
  key: string
  title: string
  description: string
  category: ReportCategory
  filters: ReportFilterSpec
}

export interface ReportColumn {
  key: string
  header: string
  type: ReportColumnType
  total?: boolean
}

/** A row; `_kind` styles statement lines (the P&L). */
export type ReportRow = Record<string, string | number | null> & {
  _kind?: 'section' | 'line' | 'subtotal' | 'total'
}

export interface ReportSummaryItem {
  label: string
  value: number
  type: ReportColumnType
}

export interface ReportView {
  key: string
  title: string
  description: string
  columns: ReportColumn[]
  rows: ReportRow[]
  totals: ReportRow | null
  summary: ReportSummaryItem[]
  notes: string[]
  truncated: boolean
  totalRows: number
  meta: {
    organizationName: string
    scopeLabel: string
    from: string
    to: string
    asOf: boolean
    basis: RevenueBasis
    generatedAt: string
    generatedLabel: string
  }
}

export interface ReportQuery {
  from?: string
  to?: string
  scope?: ReportScopeKind
  basis?: RevenueBasis
  doctorId?: string
  category?: string
}

export interface Kpi {
  value: number
  previous: number
  changePct: number | null
}

export interface ProfitLoss {
  basis: RevenueBasis
  revenue: { clinic: number; lab: number; total: number }
  collected: number
  billed: number
  directCosts: { labBills: number; commissions: number; total: number }
  grossProfit: number
  operating: {
    salaries: number
    expenses: Array<{ category: string; label: string; amount: number }>
    total: number
  }
  totalCosts: number
  netProfit: number
  marginPct: number | null
}

export interface FinanceOverview {
  period: { from: string; to: string }
  previousPeriod: { from: string; to: string }
  scope: { label: string; locationCount: number }
  basis: RevenueBasis
  kpis: {
    revenue: Kpi
    costs: Kpi
    netProfit: Kpi
    collected: Kpi
    billed: Kpi
    marginPct: number | null
    previousMarginPct: number | null
  }
  pnl: ProfitLoss
  trend: Array<{
    month: string
    label: string
    revenue: number
    costs: number
    profit: number
  }>
  costBreakdown: Array<{ key: string; label: string; amount: number }>
  balances: {
    receivable: number
    openInvoices: number
    aging: Array<{ bucket: string; amount: number }>
    payable: number
    payableOverdue: number
    advances: number
  }
  topDoctors: Array<{ doctorId: string | null; name: string; amount: number }>
  topServices: Array<{ name: string; count: number; amount: number }>
  collectionsByAccount: Array<{ account: string; amount: number }>
  counts: {
    invoices: number
    avgInvoice: number
    patientsBilled: number
    receipts: number
    discounts: number
  }
  warnings: string[]
}

export interface NumberKpi {
  value: number | null
  previous: number | null
  changePct: number | null
}

export interface CountItem {
  label: string
  count: number
}

export interface ClinicOverview {
  period: { from: string; to: string }
  previousPeriod: { from: string; to: string }
  scope: { label: string; locationCount: number }
  kpis: {
    patientsSeen: NumberKpi
    visits: NumberKpi
    newPatients: NumberKpi
    appointments: NumberKpi
    noShowPct: NumberKpi
    showUpPct: NumberKpi
    avgWaitMin: NumberKpi
    avgConsultMin: NumberKpi
    walkInPct: NumberKpi
  }
  trend: {
    unit: 'day' | 'week' | 'month'
    points: Array<{
      key: string
      label: string
      visits: number
      /** First-ever visit of the patient at these locations. */
      newVisits: number
      returningVisits: number
      newPatients: number
      appointments: number
      showUpPct: number | null
      avgWaitMin: number | null
    }>
  }
  /** Check-ins by ISO weekday (1 = Mon) and hour. */
  heatmap: Array<{ dow: number; hour: number; count: number }>
  sources: CountItem[]
  doctors: Array<{
    doctorId: string | null
    name: string
    visits: number
    patients: number
    avgWaitMin: number | null
    avgConsultMin: number | null
  }>
  appointmentStatus: Array<CountItem & { key: string }>
  demographics: { gender: CountItem[]; age: CountItem[] }
  topDiagnoses: CountItem[]
  topTreatments: CountItem[]
  attention: {
    missedFollowUps: number
    upcomingFollowUps: number
    lapsedPatients: number
    noShowsToCall: number
    lateLabOrders: number
  }
}
