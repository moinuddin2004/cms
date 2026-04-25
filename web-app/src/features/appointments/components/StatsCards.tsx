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
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    key: 'scheduled',
    label: 'Upcoming',
    icon: Clock,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    key: 'noShow',
    label: 'No-Show',
    icon: UserX,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
  },
  {
    key: 'completionRate',
    label: 'Completion',
    icon: TrendingUp,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    suffix: '%',
  },
] as const

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_ITEMS.map((item) => (
          <Card key={item.key} className="p-3">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-7 w-10" />
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon
        const value = stats[item.key as keyof AppointmentStats]
        return (
          <Card
            key={item.key}
            className="p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
          >
            <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4.5 h-4.5 ${item.color}`} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">
                {item.label}
              </p>
              <p className="text-lg font-bold text-foreground leading-tight">
                {value}
                {'suffix' in item ? item.suffix : ''}
              </p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
