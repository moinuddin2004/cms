import { cn } from '@/lib/utils'
import type { ClinicOverview } from '../types/reports.types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) =>
  `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`

/** Check-ins summed by weekday and by hour. */
export function busiest(cells: ClinicOverview['heatmap']) {
  const byDay = DAYS.map((_, i) =>
    cells.filter((c) => c.dow === i + 1).reduce((a, c) => a + c.count, 0),
  )
  const byHour = new Map<number, number>()
  for (const c of cells) byHour.set(c.hour, (byHour.get(c.hour) ?? 0) + c.count)
  const peakDay = byDay.indexOf(Math.max(...byDay))
  const top = [...byHour.entries()].sort((a, b) => b[1] - a[1]).at(0)
  const peakHour = top ? top[0] : null
  return { byDay, peakDay, peakHour }
}

/** Busiest weekday and hour, with a small bar per weekday. */
export function BusiestTimes({ cells }: { cells: ClinicOverview['heatmap'] }) {
  if (!cells.length) {
    return (
      <p className="py-6 text-center text-sm text-text-3">
        No check-ins in this period.
      </p>
    )
  }
  const { byDay, peakDay, peakHour } = busiest(cells)
  const max = Math.max(...byDay, 1)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-panel px-3 py-2">
          <p className="text-[11px] text-text-3">Busiest day</p>
          <p className="text-base font-bold">{DAYS[peakDay]}</p>
        </div>
        <div className="rounded-lg bg-panel px-3 py-2">
          <p className="text-[11px] text-text-3">Busiest hour</p>
          <p className="text-base font-bold tabular-nums">
            {peakHour == null ? '—' : hourLabel(peakHour)}
          </p>
        </div>
      </div>
      <div className="flex h-24 items-end gap-2">
        {byDay.map((n, i) => (
          <div
            key={DAYS[i]}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <span className="text-[10px] tabular-nums text-text-3">
              {n || ''}
            </span>
            <div
              title={`${DAYS[i]}: ${n} check-ins`}
              className={cn(
                'w-full rounded-t-[4px]',
                i === peakDay ? 'bg-primary' : n ? 'bg-primary/35' : 'bg-panel',
              )}
              style={{ height: `${Math.max(4, (n / max) * 64)}px` }}
            />
            <span className="text-[11px] text-text-2">{DAYS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
