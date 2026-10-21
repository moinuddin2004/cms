import type { ReactNode } from 'react'
import { Building2, MapPin } from 'lucide-react'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { ListToolbar, LiveDot, Segmented } from '@/features/billing'
import { cn } from '@/lib/utils'
import { useCanSeeAllLocations } from '../hooks/use-reports'
import { PERIOD_LABEL, useReportsStore } from '../hooks/use-reports-store'
import type { PeriodPreset } from '../hooks/use-reports-store'

const PRESETS = Object.keys(PERIOD_LABEL) as Array<
  Exclude<PeriodPreset, 'custom'>
>

const BASIS_HINT = {
  collected: 'Revenue = money received (minus refunds)',
  billed: 'Revenue = invoices issued',
}

/**
 * Period presets + custom range, "this location / all locations" for
 * owners, and the revenue basis — the shared filters of the finance
 * dashboard and the reports. `dates={false}` hides the period (snapshot
 * reports such as outstanding balances).
 */
export function ReportFilters({
  dates = true,
  basis = false,
  fetching = false,
  extra,
  right,
}: {
  dates?: boolean
  basis?: boolean
  fetching?: boolean
  extra?: ReactNode
  right?: ReactNode
}) {
  const store = useReportsStore()
  const canSeeAll = useCanSeeAllLocations()

  return (
    <ListToolbar
      left={
        <>
          {dates ? (
            <>
              <div className="flex flex-wrap items-center gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => store.setPeriod(p)}
                    className={cn(
                      'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                      store.preset === p
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {PERIOD_LABEL[p]}
                  </button>
                ))}
              </div>
              <DateRangePicker
                aria-label="Custom date range"
                className={cn(
                  'h-8 w-[240px] text-xs',
                  store.preset === 'custom' && 'border-primary',
                )}
                value={
                  store.preset === 'custom'
                    ? {
                        from: store.custom.from ?? '',
                        to: store.custom.to ?? '',
                      }
                    : { from: '', to: '' }
                }
                onChange={(r) =>
                  r.from
                    ? store.setPeriod('custom', {
                        from: r.from,
                        to: r.to || r.from,
                      })
                    : store.setPeriod('month')
                }
                placeholder="Custom range"
              />
            </>
          ) : (
            <span className="text-xs font-medium text-text-2">
              Balances as of today
            </span>
          )}
          <LiveDot show={fetching} />
        </>
      }
      right={right}
      filters={
        canSeeAll || basis || extra ? (
          <>
            {canSeeAll && (
              <Segmented
                value={store.scope}
                onChange={store.setScope}
                options={[
                  { value: 'location', label: 'This location', icon: MapPin },
                  {
                    value: 'organization',
                    label: 'All locations',
                    icon: Building2,
                  },
                ]}
              />
            )}
            {basis && (
              <div className="flex items-center gap-2">
                <Segmented
                  value={store.basis}
                  onChange={store.setBasis}
                  options={[
                    { value: 'collected', label: 'Collected' },
                    { value: 'billed', label: 'Billed' },
                  ]}
                />
                <span className="hidden text-[11px] text-text-3 md:inline">
                  {BASIS_HINT[store.basis]}
                </span>
              </div>
            )}
            {extra}
          </>
        ) : undefined
      }
    />
  )
}
