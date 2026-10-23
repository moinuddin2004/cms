import { Stethoscope } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import type { MonthlySummary } from '@/features/billing/types'

interface Props {
  procedures: MonthlySummary['topProcedures'] | undefined
  monthLabel: string
  isLoading?: boolean
}

/** The month's best-earning procedures with a bar relative to the top one. */
export function TopProceduresList({
  procedures,
  monthLabel,
  isLoading,
}: Props) {
  const rows = (procedures ?? []).slice(0, 6)
  const max = Math.max(1, ...rows.map((r) => r.revenue))

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">Top procedures</h2>
      <p className="text-sm text-text-3">{monthLabel} · by revenue</p>

      {isLoading ? (
        <div className="mt-5 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-panel" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-sm text-text-3">
          <Stethoscope className="size-6" />
          No procedures billed this month yet.
        </div>
      ) : (
        <ol className="mt-5 space-y-4">
          {rows.map((r, i) => (
            <li key={r.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-xs text-text-3 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium">{r.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatCurrency(r.revenue)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pl-6">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(4, (r.revenue / max) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-12 text-right text-xs text-text-3 tabular-nums">
                  ×{r.count}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
