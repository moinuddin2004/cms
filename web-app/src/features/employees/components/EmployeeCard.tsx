import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmployeeAvatar } from './EmployeeAvatar'
import { getEmploymentTypeLabel, formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Phone, Calendar, MapPin } from 'lucide-react'
import type { Employee } from '../types'

interface EmployeeCardProps {
  employee: Employee
  onDeactivate: (id: string) => void
}

const employmentTypeStyles: Record<string, string> = {
  full_time: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  part_time: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
  visiting: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  contract: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
}

export function EmployeeCard({ employee, onDeactivate }: EmployeeCardProps) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <EmployeeAvatar name={employee.fullName} className="w-11 h-11" />
          <div className="flex-1 min-w-0">
            <Link
              to="/employees/$id"
              params={{ id: employee.id }}
              className="font-semibold text-sm text-foreground hover:text-brand-600 transition-colors block truncate"
            >
              {employee.fullName}
            </Link>
            <p className="text-xs text-muted-foreground truncate">
              {employee.designation}
            </p>
          </div>
          <Badge
            variant={employee.isActive ? 'default' : 'secondary'}
            className={cn(
              'text-[10px] px-1.5 shrink-0',
              employee.isActive
                ? 'bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/10'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {employee.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Phone size={12} />
            <span>{employee.phone}</span>
          </div>
          {employee.primaryLocation && (
            <div className="flex items-center gap-2">
              <MapPin size={12} />
              <span className="truncate">{employee.primaryLocation.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar size={12} />
            <span className="font-mono">{employee.employeeCode}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <Badge
            className={cn(
              'font-normal text-[10px]',
              employmentTypeStyles[employee.employmentType],
            )}
          >
            {getEmploymentTypeLabel(employee.employmentType)}
          </Badge>
          {employee.currentSalary && (
            <span className="text-xs font-semibold text-foreground">
              {formatCurrency(employee.currentSalary.grossSalary)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
