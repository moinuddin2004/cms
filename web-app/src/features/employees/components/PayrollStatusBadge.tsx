import { Badge } from '@/components/ui/badge'
import type { PayrollStatus } from '../types'

const statusConfig: Partial<
  Record<
    PayrollStatus,
    { label: string; variant: 'warning' | 'success' | 'danger' }
  >
> = {
  pending: { label: 'Pending', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  on_hold: { label: 'On Hold', variant: 'danger' },
}

interface PayrollStatusBadgeProps {
  status: PayrollStatus
}

export function PayrollStatusBadge({ status }: PayrollStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge variant={config?.variant ?? 'muted'}>
      {config?.label ?? status}
    </Badge>
  )
}
