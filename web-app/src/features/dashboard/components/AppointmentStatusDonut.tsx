import type { AppointmentStats } from '@/features/appointments/types'

interface Props {
  stats: AppointmentStats
}

const SEGMENTS: { key: keyof AppointmentStats; label: string; cssVar: string }[] = [
  { key: 'completed', label: 'Completed', cssVar: 'var(--primary)' },
  { key: 'scheduled', label: 'Confirmed', cssVar: 'var(--emerald)' },
  { key: 'waiting', label: 'Waiting', cssVar: 'var(--amber)' },
  { key: 'noShow', label: 'No-show', cssVar: 'var(--border)' },
]

export function AppointmentStatusDonut({ stats }: Props) {
  const total = stats.total || 1
  const segments = SEGMENTS.map((s) => ({
    ...s,
    value: (stats[s.key] as number) || 0,
  }))

  let cumPct = 0
  const gradientStops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = cumPct
      cumPct += (s.value / total) * 100
      return `${s.cssVar} ${start}% ${cumPct}%`
    })
    .join(', ')

  const conicGradient = gradientStops
    ? `conic-gradient(${gradientStops})`
    : 'conic-gradient(var(--border) 0% 100%)'

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-[18px] text-[15px] font-bold">Appointment Status</div>
      <div className="flex items-center gap-[18px]">
        <div
          className="flex size-[104px] shrink-0 items-center justify-center rounded-full"
          style={{ background: conicGradient }}
        >
          <div className="flex size-[68px] flex-col items-center justify-center rounded-full bg-surface">
            <span className="text-[20px] font-extrabold leading-none">{stats.total || 0}</span>
            <span className="text-[10px] text-text-3">total</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-[9px] text-[12.5px]">
          {segments.map((s) => (
            <span key={s.key} className="flex items-center gap-[7px]">
              <span
                className="size-[9px] shrink-0 rounded-[2px]"
                style={{ background: s.cssVar }}
              />
              {s.label}
              <b className="ml-auto">{s.value}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
