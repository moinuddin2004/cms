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
import { InitialsAvatar, StatusBadge } from '@/components/shared'
import { Eye, Pencil, UserX } from 'lucide-react'
import type { Patient } from '../types'

interface PatientTableProps {
  patients: Patient[]
  onDeactivate: (id: string) => void
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
              <InitialsAvatar name={p.fullName} seed={p.id} size="sm" />
              <div>
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: p.id }}
                  className="text-sm font-semibold text-foreground transition-colors hover:text-primary-text"
                >
                  {p.fullName}
                </Link>
                <p className="font-mono text-[11px] text-text-3">
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
        cell: ({ getValue }) => (
          <StatusBadge status={getValue<boolean>() ? 'active' : 'inactive'} />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                <Link to="/patients/$patientId" params={{ patientId: p.id }}>
                  <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                <Link to="/patients/$patientId/edit" params={{ patientId: p.id }}>
                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Link>
              </Button>
              {p.isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (confirm('Deactivate this patient?')) onDeactivate(p.id)
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
    [onDeactivate],
  )

  const table = useReactTable({
    data: patients,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-border-soft bg-panel hover:bg-panel"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3"
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
                className="border-border-soft transition-colors hover:bg-panel"
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
