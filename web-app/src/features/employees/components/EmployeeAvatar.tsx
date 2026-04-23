import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/formatters'

interface EmployeeAvatarProps {
  name: string
  className?: string
}

export function EmployeeAvatar({ name, className }: EmployeeAvatarProps) {
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-brand-100 text-brand-700 text-xs font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
