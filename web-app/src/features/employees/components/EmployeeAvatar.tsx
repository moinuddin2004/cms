import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/formatters'

interface EmployeeAvatarProps {
  name: string
  className?: string
}

export function EmployeeAvatar({ name, className }: EmployeeAvatarProps) {
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-primary-soft text-primary-text text-xs font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
