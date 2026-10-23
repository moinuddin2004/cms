import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { ProfitLoss, ReportRow } from '../types/reports.types'

interface Line {
  kind: 'section' | 'line' | 'subtotal' | 'total'
  label: string
  amount?: number
  /** Cost lines show as "− PKR x". */
  cost?: boolean
}

function linesOf(p: ProfitLoss): Line[] {
  return [
    { kind: 'section', label: 'Revenue' },
    { kind: 'line', label: 'Clinic services', amount: p.revenue.clinic },
    { kind: 'line', label: 'Lab work', amount: p.revenue.lab },
    { kind: 'subtotal', label: 'Total revenue', amount: p.revenue.total },
    { kind: 'section', label: 'Direct costs' },
    {
      kind: 'line',
      label: 'Lab bills',
      amount: p.directCosts.labBills,
      cost: true,
    },
    {
      kind: 'line',
      label: 'Doctor commissions',
      amount: p.directCosts.commissions,
      cost: true,
    },
    { kind: 'subtotal', label: 'Gross profit', amount: p.grossProfit },
    { kind: 'section', label: 'Operating expenses' },
    {
      kind: 'line',
      label: 'Salaries (payroll)',
      amount: p.operating.salaries,
      cost: true,
    },
    ...p.operating.expenses.map<Line>((e) => ({
      kind: 'line',
      label: e.label,
      amount: e.amount,
      cost: true,
    })),
    {
      kind: 'subtotal',
      label: 'Total operating expenses',
      amount: p.operating.total,
    },
    {
      kind: 'total',
      label: p.netProfit < 0 ? 'Net loss' : 'Net profit',
      amount: p.netProfit,
    },
  ]
}

/** P&L report rows (`_kind` + line + amount) → statement lines. */
function linesOfRows(rows: ReportRow[]): Line[] {
  let section = ''
  return rows.map((r) => {
    const kind = r._kind ?? 'line'
    const label = String(r.line ?? '')
    if (kind === 'section') section = label
    return {
      kind,
      label,
      amount: r.amount == null ? undefined : Number(r.amount),
      cost: kind === 'line' && section !== 'Revenue',
    }
  })
}

function Statement({ lines }: { lines: Line[] }) {
  const revenue = lines.find((l) => l.label === 'Total revenue')?.amount ?? 0
  return (
    <div className="divide-y divide-border-soft text-sm">
      {lines.map((l, i) => {
        if (l.kind === 'section') {
          return (
            <div
              key={i}
              className={cn(
                'pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3',
                i === 0 && 'pt-0',
              )}
            >
              {l.label}
            </div>
          )
        }
        const amount = l.amount ?? 0
        const share = revenue
          ? Math.round((amount / revenue) * 1000) / 10
          : null
        return (
          <div
            key={i}
            className={cn(
              'flex items-center justify-between gap-3 py-2',
              l.kind === 'line' && 'pl-3 text-text-2',
              l.kind === 'subtotal' && 'font-semibold',
              l.kind === 'total' &&
                cn(
                  'mt-1 rounded-lg border-0 px-3 py-2.5 text-base font-bold',
                  amount < 0
                    ? 'bg-danger-soft text-danger'
                    : 'bg-emerald-soft text-emerald',
                ),
            )}
          >
            <span className="min-w-0 truncate">{l.label}</span>
            <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
              {share !== null && l.kind !== 'total' && (
                <span className="w-12 text-right text-[11px] font-normal text-text-3">
                  {share}%
                </span>
              )}
              <span>
                {l.cost && amount > 0
                  ? `− ${formatCurrency(amount)}`
                  : formatCurrency(amount)}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** The profit & loss as an accountant's statement: sections, subtotals, net. */
export function PnlStatement({ pnl }: { pnl: ProfitLoss }) {
  return <Statement lines={linesOf(pnl)} />
}

/** The same statement from the `profit-loss` report's rows. */
export function PnlStatementRows({ rows }: { rows: ReportRow[] }) {
  return <Statement lines={linesOfRows(rows)} />
}
