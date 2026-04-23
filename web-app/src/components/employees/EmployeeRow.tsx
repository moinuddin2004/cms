import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Employee } from '@/types/employee.types'
import { EmployeeAvatar } from './EmployeeAvatar'
import { getEmploymentTypeLabel } from '@/lib/formatters'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

interface EmployeeRowProps {
  employee: Employee
}

export function EmployeeRow({ employee }: EmployeeRowProps) {
  const navigate = useNavigate()

  const getEmploymentTypeVariant = (type: string) => {
    switch (type) {
      case 'full_time':
        return 'default' // blue
      case 'part_time':
        return 'secondary' // cyan
      case 'visiting':
        return 'outline' // amber
      case 'contract':
        return 'destructive' // orange
      default:
        return 'secondary'
    }
  }

  // Custom styling for badges since shadcn variants might not match exactly
  const employmentTypeStyles: Record<string, string> = {
    full_time: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    part_time: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
    visiting: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    contract: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  }

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate({ to: `/employees/${employee.id}` })}
    >
      <TableCell className="flex items-center gap-3">
        <EmployeeAvatar name={employee.fullName} />
        <div>
          <p className="font-medium text-foreground">{employee.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {employee.designation}
          </p>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">
        {employee.employeeCode}
      </TableCell>
      <TableCell>
        <Badge
          className={cn(
            'font-normal',
            employmentTypeStyles[employee.employmentType],
          )}
        >
          {getEmploymentTypeLabel(employee.employmentType)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant={employee.isActive ? 'outline' : 'secondary'}
          className={cn(
            'pl-1.5',
            employee.isActive
              ? 'border-green-200 text-green-700'
              : 'border-red-200 text-red-700',
          )}
        >
          <span
            className={cn(
              'mr-1.5 h-1.5 w-1.5 rounded-full',
              employee.isActive ? 'bg-green-500' : 'bg-red-500',
            )}
          />
          {employee.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
    </TableRow>
  )
}
