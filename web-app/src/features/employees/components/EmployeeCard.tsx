import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EmployeeAvatar } from './EmployeeAvatar'
import { getEmploymentTypeLabel, formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Phone, Hash, MapPin, Eye, Pencil, UserX, Banknote } from 'lucide-react'
import type { Employee } from '../types'

interface EmployeeCardProps {
  employee: Employee
  onDeactivate: (id: string) => void
  onEdit?: (employee: Employee) => void
}

const employmentTypeStyles: Record<string, string> = {
  full_time: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  part_time: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  visiting: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  contract: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export function EmployeeCard({ employee, onDeactivate, onEdit }: EmployeeCardProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Card className="group relative overflow-hidden border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        {/* Top accent bar on hover */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <EmployeeAvatar name={employee.fullName} className="w-10 h-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to="/employees/$employeeId"
                    params={{ employeeId: employee.id }}
                    className="block truncate text-sm font-semibold text-foreground leading-tight transition-colors hover:text-primary"
                  >
                    {employee.fullName}
                  </Link>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {employee.designation || '—'}
                  </p>
                </div>
                <Badge
                  variant={employee.isActive ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] px-1.5 py-0 shrink-0',
                    employee.isActive
                      ? 'bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/10'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {employee.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-2 text-xs text-muted-foreground mb-4">
            {employee.phone && (
              <div className="flex items-center gap-2.5">
                <Phone size={12} className="shrink-0 text-muted-foreground/50" />
                <span>{employee.phone}</span>
              </div>
            )}
            {employee.primaryLocation && (
              <div className="flex items-center gap-2.5">
                <MapPin size={12} className="shrink-0 text-muted-foreground/50" />
                <span className="truncate">{employee.primaryLocation.name}</span>
              </div>
            )}
            {employee.employeeCode && (
              <div className="flex items-center gap-2.5">
                <Hash size={12} className="shrink-0 text-muted-foreground/50" />
                <span className="font-mono">{employee.employeeCode}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  'font-normal text-[10px] px-1.5 py-0 border',
                  employmentTypeStyles[employee.employmentType] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {getEmploymentTypeLabel(employee.employmentType)}
              </Badge>
              {employee.currentSalary && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                  <Banknote size={11} className="text-muted-foreground/50" />
                  {formatCurrency(employee.currentSalary.grossSalary)}
                </span>
              )}
            </div>

            {/* Action buttons — always visible */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                    asChild
                  >
                    <Link to="/employees/$employeeId" params={{ employeeId: employee.id }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">View employee</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                    onClick={() => onEdit?.(employee)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Edit employee</TooltipContent>
              </Tooltip>

              {employee.isActive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm('Deactivate this employee?')) onDeactivate(employee.id)
                      }}
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Deactivate employee</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
