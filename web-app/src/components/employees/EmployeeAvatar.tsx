import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EmployeeAvatarProps {
  name: string
  className?: string
}

export function EmployeeAvatar({ name, className }: EmployeeAvatarProps) {
  const firstLetter = name.charAt(0).toUpperCase()

  let bgColor = 'bg-blue-500'
  if (firstLetter >= 'A' && firstLetter <= 'F') bgColor = 'bg-blue-500'
  else if (firstLetter >= 'G' && firstLetter <= 'M') bgColor = 'bg-green-500'
  else if (firstLetter >= 'N' && firstLetter <= 'S') bgColor = 'bg-purple-500'
  else if (firstLetter >= 'T' && firstLetter <= 'Z') bgColor = 'bg-amber-500'

  return (
    <Avatar className={cn('h-10 w-10', className)}>
      <AvatarFallback className={cn('text-white font-medium', bgColor)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
