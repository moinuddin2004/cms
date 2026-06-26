import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'muted'

/**
 * Maps a free-form status string to a MedTrackr soft-chip tone.
 * Centralizes status colors so every feature renders badges identically.
 */
const STATUS_TONE: Record<string, Tone> = {
  // positive / done
  active: 'success',
  completed: 'success',
  paid: 'success',
  approved: 'success',
  confirmed: 'success',
  available: 'success',
  'in stock': 'success',
  // in progress / info
  'in progress': 'info',
  'in chair': 'info',
  inprogress: 'info',
  scheduled: 'info',
  pending: 'info',
  draft: 'info',
  sent: 'info',
  processing: 'info',
  // warning
  waiting: 'warning',
  partial: 'warning',
  'low stock': 'warning',
  'on leave': 'warning',
  overdue: 'warning',
  due: 'warning',
  // danger
  cancelled: 'danger',
  canceled: 'danger',
  'no show': 'danger',
  'no-show': 'danger',
  noshow: 'danger',
  expired: 'danger',
  'out of stock': 'danger',
  failed: 'danger',
  rejected: 'danger',
  // neutral
  inactive: 'muted',
  closed: 'muted',
  archived: 'muted',
}

function toneFor(status: string): Tone {
  return STATUS_TONE[status.trim().toLowerCase()] ?? 'muted'
}

function humanize(status: string): string {
  return status
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

interface StatusBadgeProps {
  status: string
  /** Override the auto-detected tone. */
  tone?: Tone
  label?: string
  className?: string
}

export function StatusBadge({ status, tone, label, className }: StatusBadgeProps) {
  return (
    <Badge variant={tone ?? toneFor(status)} className={cn(className)}>
      {label ?? humanize(status)}
    </Badge>
  )
}
