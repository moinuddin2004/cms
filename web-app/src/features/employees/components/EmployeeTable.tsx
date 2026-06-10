import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, UserX } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { Employee } from '../types'
import { EmployeeAvatar } from './EmployeeAvatar'
import { useTogglePortalAccess } from '../hooks/useTogglePortalAccess'
import { getEmploymentTypeLabel, formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EmployeeTableProps {
  employees: Employee[]
  onDeactivate: (id: string) => void
}

const employmentTypeStyles: Record<string, string> = {
  full_time: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  part_time: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
  visiting: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  contract: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
}

export function EmployeeTable({ employees, onDeactivate }: EmployeeTableProps) {
  const togglePortalMutation = useTogglePortalAccess()

  const columns = useMemo<ColumnDef<Employee>[]>(
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
                  className="font-medium text-sm text-foreground hover:text-brand-600 transition-colors"
                >
                  {e.fullName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {e.designation}
                </p>
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
        cell: ({ getValue }) => {
          const type = getValue<string>()
          return (
            <Badge
              className={cn('font-normal', employmentTypeStyles[type])}
            >
              {getEmploymentTypeLabel(type)}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'currentSalary',
        header: 'Salary',
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
        accessorKey: 'hasPortalAccess',
        header: 'Portal',
        cell: ({ row }) => {
          const e = row.original
          return (
            <Switch
              checked={e.hasPortalAccess}
              disabled={togglePortalMutation.isPending || !e.isActive}
              onCheckedChange={(val) =>
                togglePortalMutation.mutate({
                  employeeId: e.id,
                  hasPortalAccess: val,
                })
              }
              aria-label="Toggle portal access"
            />
          )
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) => {
          const active = getValue<boolean>()
          return (
            <Badge
              variant={active ? 'default' : 'secondary'}
              className={
                active
                  ? 'bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/10'
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
        cell: ({ row }) => {
          const e = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                <Link to="/employees/$employeeId" params={{ employeeId: e.id }}>
                  <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                <Link to="/employees/$employeeId/edit" params={{ employeeId: e.id }}>
                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Link>
              </Button>
              {e.isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (confirm('Deactivate this employee?')) onDeactivate(e.id)
                  }}
                >
                  <UserX className="h-4 w-4" />
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [onDeactivate, togglePortalMutation],
  )

  const table = useReactTable({
    data: employees,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-muted/40 hover:bg-muted/40"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-xs font-semibold uppercase tracking-wider"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="hover:bg-muted/20 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-muted-foreground"
              >
                No employees found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
