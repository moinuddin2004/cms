import { Badge } from '@/components/ui/badge'
import { PayrollStatus } from '@/types/employee.types'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, PauseCircle } from 'lucide-react'

interface PayrollStatusBadgeProps {
  status: PayrollStatus
}

export function PayrollStatusBadge({ status }: PayrollStatusBadgeProps) {
  switch (status) {
    case 'paid':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1.5 font-medium">
          <CheckCircle2 size={14} />
          Paid
        </Badge>
      )
    case 'pending':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1.5 font-medium">
          <Clock size={14} />
          Pending
        </Badge>
      )
    case 'on_hold':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1.5 font-medium">
          <PauseCircle size={14} />
          On Hold
        </Badge>
      )
    default:
      return <Badge>{status}</Badge>
  }
}
