import { AlertCircle, FileClock, PiggyBank, Wallet } from 'lucide-react'
import { StatCard } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { PatientBillingSummary } from '../../types/billing.types'

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
 * uses the project's StatCard; `compact` is a slim strip for the sheet.
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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map((c) => (
        <StatCard
          key={c.key}
          label={c.label}
          icon={c.icon}
          iconTone={c.tone}
          value={
            isLoading || !summary ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <span className="tabular-nums">
                {formatCurrency(summary[c.key])}
              </span>
            )
          }
        />
      ))}
    </div>
  )
}
