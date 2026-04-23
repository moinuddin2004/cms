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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Eye, Pencil, UserX, MoreHorizontal } from 'lucide-react'
import type { Patient } from '../types'

interface PatientTableProps {
  patients: Patient[]
  onDeactivate: (id: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAge(dob: string | null): string {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return `${Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))}`
}

export function PatientTable({ patients, onDeactivate }: PatientTableProps) {
  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Patient',
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-brand-100 text-brand-700 text-xs font-semibold">
                  {getInitials(p.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: p.id }}
                  className="font-medium text-sm text-foreground hover:text-brand-600 transition-colors"
                >
                  {p.fullName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.patientNumber}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'dob',
        header: 'Age',
        cell: ({ getValue }) => (
          <span className="text-sm">{getAge(getValue<string | null>())}</span>
        ),
      },
      {
        accessorKey: 'gender',
        header: 'Gender',
        cell: ({ getValue }) => {
          const v = getValue<string | null>()
          return v ? (
            <span className="text-sm capitalize">{v}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: 'bloodGroup',
        header: 'Blood',
        cell: ({ getValue }) => {
          const v = getValue<string | null>()
          return v ? (
            <Badge variant="outline" className="text-xs font-medium">
              {v}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: 'city',
        header: 'City',
        cell: ({ getValue }) => {
          const v = getValue<string | null>()
          return (
            <span className="text-sm">
              {v || <span className="text-muted-foreground">—</span>}
            </span>
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
          const p = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  aria-label={`Actions for ${p.fullName}`}
                >
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/patients/$patientId" params={{ patientId: p.id }}>
                    <Eye size={14} className="mr-2" /> View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/patients/$patientId/edit"
                    params={{ patientId: p.id }}
                  >
                    <Pencil size={14} className="mr-2" /> Edit
                  </Link>
                </DropdownMenuItem>
                {p.isActive && (
                  <DropdownMenuItem
                    onClick={() => onDeactivate(p.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserX size={14} className="mr-2" /> Deactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [onDeactivate],
  )

  const table = useReactTable({
    data: patients,
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
                No patients found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
