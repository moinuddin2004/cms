import { cn } from '@/lib/utils'
import {
  chartStats,
  chartedTeeth,
  findingLabel,
  findingsOf,
} from '../../utils/teethChart'
import type { ChartData } from '../../utils/teethChart'
import { ConditionDot } from './ChartToolbar'

/** Every finding on the chart as a chip; clicking one selects its tooth. */
export function FindingsSummary({
  data,
  selected,
  onSelect,
  action,
}: {
  data: ChartData
  selected: number | null
  onSelect: (tooth: number) => void
  action?: React.ReactNode
}) {
  const teeth = chartedTeeth(data)
  const stats = chartStats(data)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {stats.findings === 0 ? (
            'No findings yet — every tooth is healthy.'
          ) : (
            <>
              <span className="font-medium text-foreground">
                {stats.teeth} {stats.teeth === 1 ? 'tooth' : 'teeth'}
              </span>{' '}
              · {stats.findings} {stats.findings === 1 ? 'finding' : 'findings'}
              {stats.planned > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {stats.planned} planned
                  </span>
                </>
              )}
            </>
          )}
        </p>
        {action}
      </div>
      {teeth.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {teeth.flatMap((t) =>
            findingsOf(data[t]).map((f) => (
              <button
                key={`${t}-${f.id}`}
                type="button"
                onClick={() => onSelect(t)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted',
                  selected === t && 'border-primary ring-1 ring-primary/40',
                )}
              >
                <ConditionDot condition={f.condition} planned={f.planned} />
                <span className="font-semibold tabular-nums">{t}</span>
                <span className="text-muted-foreground">{findingLabel(f)}</span>
                {f.planned && (
                  <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    Planned
                  </span>
                )}
              </button>
            )),
          )}
        </div>
      )}
    </div>
  )
}
