import { Card } from '@/components/ui/card'
import {
  CalendarDays,
  CheckCircle,
  XCircle,
  UserX,
  Clock,
  TrendingUp,
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
  },
  {
    key: 'scheduled',
    label: 'Upcoming',
    icon: Clock,
    color: 'text-violet',
    bg: 'bg-violet-soft',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle,
    color: 'text-emerald',
    bg: 'bg-emerald-soft',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-danger',
    bg: 'bg-danger-soft',
  },
  {
    key: 'noShow',
    label: 'No-Show',
    icon: UserX,
    color: 'text-text-3',
    bg: 'bg-panel-2',
  },
  {
    key: 'completionRate',
    label: 'Completion',
    icon: TrendingUp,
    color: 'text-amber',
    bg: 'bg-amber-soft',
  },
] as const

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_ITEMS.map((item) => (
          <Card key={item.key} className="p-3">
            <Skeleton className="mb-2 h-4 w-16" />
            <Skeleton className="h-7 w-10" />
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon
        const value = stats[item.key as keyof AppointmentStats]
        return (
          <Card
            key={item.key}
            className="flex items-center gap-3 p-3 transition-shadow hover:shadow-sm"
          >
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${item.bg}`}
            >
              <Icon className={`size-[18px] ${item.color}`} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-3">
                {item.label}
              </p>
              <p className="text-lg font-bold leading-tight">
                {value}
                {'suffix' in item ? '%' : ''}
              </p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
