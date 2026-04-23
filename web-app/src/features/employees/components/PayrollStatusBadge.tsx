import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PayrollStatus } from '../types'

const statusConfig: Record<
  PayrollStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  },
  paid: {
    label: 'Paid',
    className: 'bg-green-100 text-green-700 hover:bg-green-100',
  },
  on_hold: {
    label: 'On Hold',
    className: 'bg-red-100 text-red-700 hover:bg-red-100',
  },
}

interface PayrollStatusBadgeProps {
  status: PayrollStatus
}

export function PayrollStatusBadge({ status }: PayrollStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: '' }

  return (
    <Badge className={cn('font-normal', config.className)}>
      {config.label}
    </Badge>
  )
}
