import { AlertCircle, FileClock, PiggyBank, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { PatientBillingSummary } from '../../types/billing.types'
import { StatsStrip } from './list-toolbar'

const TONES = {
  primary: { color: 'text-primary-text', bg: 'bg-primary-soft' },
  amber: { color: 'text-amber', bg: 'bg-amber-soft' },
  danger: { color: 'text-danger', bg: 'bg-danger-soft' },
  emerald: { color: 'text-emerald', bg: 'bg-emerald-soft' },
} as const

const CARDS = [
  {
    key: 'unbilledTotal',
    label: 'Not invoiced',
    icon: FileClock,
    tone: 'primary',
  },
  {
    key: 'invoicedOutstanding',
    label: 'Outstanding',
    icon: Wallet,
    tone: 'amber',
  },
  { key: 'overdueAmount', label: 'Overdue', icon: AlertCircle, tone: 'danger' },
  { key: 'advance', label: 'Advance', icon: PiggyBank, tone: 'emerald' },
] as const

/**
 * The four numbers reception needs about a patient (plan §8.3). Full size
 * is the same compact stats strip as Appointments; `compact` is a slim
 * strip for the sheet.
 */
export function BillingSummaryCards({
  summary,
  isLoading,
  compact,
}: {
  summary: PatientBillingSummary | undefined
  isLoading?: boolean
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="grid grid-cols-4 divide-x divide-border-soft rounded-lg border border-border bg-panel">
        {CARDS.map((c) => (
          <div key={c.key} className="px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-3">
              {c.label}
            </p>
            {isLoading || !summary ? (
              <Skeleton className="mt-1 h-4 w-16" />
            ) : (
              <p
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  c.key === 'overdueAmount' &&
                    summary[c.key] > 0 &&
                    'text-danger',
                  c.key === 'advance' && summary[c.key] > 0 && 'text-emerald',
                )}
              >
                {formatCurrency(summary[c.key])}
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }
  return (
    <StatsStrip
      isLoading={isLoading || !summary}
      items={CARDS.map((c) => ({
        key: c.key,
        label: c.label,
        icon: c.icon,
        ...TONES[c.tone],
        value: formatCurrency(summary?.[c.key] ?? 0),
      }))}
    />
  )
}
