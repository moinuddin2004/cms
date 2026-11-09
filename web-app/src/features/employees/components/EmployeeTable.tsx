import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@/components/shared/table-features'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { DataTable } from '@/components/shared/DataTable'
import type { ServerPagination } from '@/components/shared/DataTable'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Employee } from '../types'
import { EmployeeAvatar } from './EmployeeAvatar'
import { getEmploymentTypeLabel, formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EmployeeTableProps {
  employees: Employee[]
  isLoading?: boolean
  onToggleStatus: (employee: Employee, isActive: boolean) => void
  onDelete: (employee: Employee) => void
  /** id of the employee whose status change is in flight */
  pendingStatusId?: string | null
  onEdit?: (employee: Employee) => void
  serverPagination?: ServerPagination
}

const employmentTypeStyles: Record<string, string> = {
  full_time: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  part_time: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
  visiting: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  contract: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
}

export function EmployeeTable({
  employees,
  isLoading,
  onToggleStatus,
  onDelete,
  pendingStatusId,
  onEdit,
  serverPagination,
}: EmployeeTableProps) {
  const columns = useMemo<ColumnDef<Employee, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Employee',
        cell: ({ row }) => {
          const e = row.original
          return (
            <div className="flex items-center gap-3">
              <EmployeeAvatar name={e.fullName} className="w-8 h-8" />
              <div>
                <Link
                  to="/employees/$employeeId"
                  params={{ employeeId: e.id }}
                  className="font-medium text-sm text-foreground hover:text-primary transition-colors"
                >
                  {e.fullName}
                </Link>
                <p className="text-xs text-muted-foreground">{e.designation}</p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'employeeCode',
        header: 'Code',
        cell: ({ getValue }) => (
          <span className="text-sm font-mono">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'employmentType',
        header: 'Type',
        enableSorting: false,
        cell: ({ getValue }) => {
          const type = getValue<string>()
          return (
            <Badge className={cn('font-normal', employmentTypeStyles[type])}>
              {getEmploymentTypeLabel(type)}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'currentSalary',
        header: 'Salary',
        enableSorting: false,
        cell: ({ row }) => {
          const salary = row.original.currentSalary
          return salary ? (
            <span className="text-sm font-medium">
              {formatCurrency(salary.grossSalary)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        enableSorting: false,
        cell: ({ getValue }) => {
          const active = getValue<boolean>()
          return (
            <Badge
              variant={active ? 'default' : 'secondary'}
              className={
                active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  : 'bg-muted text-muted-foreground'
              }
            >
              {active ? 'Active' : 'Inactive'}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const e = row.original
          return (
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center justify-end gap-2">
                <TooltipButton
                  tooltip="View employee"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  asChild
                >
                  <Link
                    to="/employees/$employeeId"
                    params={{ employeeId: e.id }}
                  >
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </TooltipButton>
                <TooltipButton
                  tooltip="Edit employee"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onEdit?.(e)}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </TooltipButton>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Switch
                        size="sm"
                        checked={e.isActive}
                        disabled={pendingStatusId === e.id}
                        onCheckedChange={(v) => onToggleStatus(e, v)}
                        aria-label={
                          e.isActive
                            ? 'Deactivate employee'
                            : 'Activate employee'
                        }
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {e.isActive ? 'Deactivate employee' : 'Activate employee'}
                  </TooltipContent>
                </Tooltip>
                <TooltipButton
                  tooltip="Delete employee permanently"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDelete(e)}
                >
                  <Trash2 className="h-4 w-4" />
                </TooltipButton>
              </div>
            </TooltipProvider>
          )
        },
      },
    ],
    [onToggleStatus, onDelete, pendingStatusId, onEdit],
  )

  return (
    <DataTable
      columns={columns}
      data={employees}
      isLoading={isLoading}
      emptyMessage="No employees found."
      serverPagination={serverPagination}
    />
  )
}
