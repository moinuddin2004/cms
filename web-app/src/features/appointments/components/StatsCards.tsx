import {
  CalendarDays,
  CheckCircle,
  Footprints,
  UserX,
  Clock,
  Hourglass,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { AppointmentStats } from '@/features/appointments/types'

interface StatsCardsProps {
  stats?: AppointmentStats
  isLoading: boolean
}

const STAT_ITEMS = [
  {
    key: 'total',
    label: 'Total',
    icon: CalendarDays,
    color: 'text-primary-text',
    bg: 'bg-primary-soft',
    suffix: '',
  },
  {
    key: 'scheduled',
    label: 'Upcoming',
    icon: Clock,
    color: 'text-violet',
    bg: 'bg-violet-soft',
    suffix: '',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle,
    color: 'text-emerald',
    bg: 'bg-emerald-soft',
    suffix: '',
  },
  {
    key: 'walkIns',
    label: 'Walk-ins',
    icon: Footprints,
    color: 'text-violet',
    bg: 'bg-violet-soft',
    suffix: '',
  },
  {
    key: 'noShow',
    label: 'No-Show',
    icon: UserX,
    color: 'text-text-3',
    bg: 'bg-panel-2',
    suffix: '',
  },
  {
    key: 'avgWaitMinutes',
    label: 'Avg wait',
    icon: Hourglass,
    color: 'text-amber',
    bg: 'bg-amber-soft',
    suffix: ' min',
  },
] as const

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 divide-x divide-y rounded-xl border bg-card sm:grid-cols-6 sm:divide-y-0">
        {STAT_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-2.5 px-3 py-2.5">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-4 w-7" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-3 divide-x divide-y rounded-xl border bg-card sm:grid-cols-6 sm:divide-y-0">
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon
        const value = stats[item.key as keyof AppointmentStats]
        return (
          <div
            key={item.key}
            className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/40"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${item.bg}`}
            >
              <Icon className={`size-4 ${item.color}`} />
            </span>
            <div className="min-w-0 leading-none">
              <p className="truncate text-[11px] font-medium text-text-3">
                {item.label}
              </p>
              <p className="mt-1 text-base font-bold leading-none tabular-nums">
                {value ?? '—'}
                {value != null && item.suffix}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
