import {
  Footprints,
  CalendarClock,
  FlaskConical,
  Zap,
  Clock,
  ArrowRightLeft,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { QueueEntry } from '../types'
import { formatClock, minutesSince } from '../utils/queueError'

/**
 * Why a patient sits where they do: Appointment 10:00, Walk-in, Back from
 * test, Emergency, transferred, and how long they've been waiting.
 */
export function EntryBadges({
  entry,
  now,
  className,
}: {
  entry: QueueEntry
  now?: Date
  className?: string
}) {
  const waited =
    entry.status === 'waiting' ? minutesSince(entry.sortAnchorAt, now) : null
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {entry.priorityClass === 'authorized_urgent' && (
        <Badge
          variant="destructive"
          className="h-5 gap-1 text-[10px]"
          title={entry.urgentReason ?? undefined}
        >
          <Zap className="size-3" /> Emergency
        </Badge>
      )}
      {entry.queueType === 'appointment' ? (
        <Badge variant="outline" className="h-5 gap-1 text-[10px]">
          <CalendarClock className="size-3" /> Appointment{' '}
          {formatClock(entry.scheduledStart)}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="h-5 gap-1 border-purple-200 bg-purple-50 text-[10px] text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300"
        >
          <Footprints className="size-3" /> Walk-in
        </Badge>
      )}
      {entry.returnedFromHoldAt && entry.status === 'waiting' && (
        <Badge
          variant="outline"
          className="h-5 gap-1 border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        >
          <FlaskConical className="size-3" /> Back from test
        </Badge>
      )}
      {entry.transferredFromId && (
        <Badge variant="outline" className="h-5 gap-1 text-[10px]">
          <ArrowRightLeft className="size-3" /> Transferred
        </Badge>
      )}
      {waited !== null && waited > 0 && (
        <Badge
          variant="secondary"
          className="h-5 gap-1 text-[10px] tabular-nums"
        >
          <Clock className="size-3" /> {waited} min
        </Badge>
      )}
    </div>
  )
}
