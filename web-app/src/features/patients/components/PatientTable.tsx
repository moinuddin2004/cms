import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Can } from '@/features/access'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { DataTable, type ServerPagination } from '@/components/shared/DataTable'
import { InitialsAvatar, StatusBadge } from '@/components/shared'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Patient } from '../types'

interface PatientTableProps {
  patients: Patient[]
  isLoading?: boolean
  onToggleStatus: (patient: Patient, isActive: boolean) => void
  onEdit: (patient: Patient) => void
  onDelete: (patient: Patient) => void
  /** id of the patient whose status change is in flight */
  pendingStatusId?: string | null
  serverPagination?: ServerPagination
}

function getAge(dob: string | null): string {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return `${Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))}`
}

export function PatientTable({
  patients,
  isLoading,
  onToggleStatus,
  onEdit,
  onDelete,
  pendingStatusId,
  serverPagination,
}: PatientTableProps) {
  const columns = useMemo<ColumnDef<Patient, unknown>[]>(
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
                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {p.fullName}
                </Link>
                <p className="font-mono text-[11px] text-muted-foreground">
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
        enableSorting: false,
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
        enableSorting: false,
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
            <span className="text-sm text-muted-foreground">{v ?? '—'}</span>
          )
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        enableSorting: false,
        cell: ({ getValue }) => (
          <StatusBadge status={getValue<boolean>() ? 'active' : 'inactive'} />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original
          return (
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center justify-end gap-2">
                <TooltipButton
                  tooltip="View patient"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  asChild
                >
                  <Link to="/patients/$patientId" params={{ patientId: p.id }}>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </TooltipButton>
                <Can perm="patients.edit">
                  <TooltipButton
                    tooltip="Edit patient"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onEdit(p)}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </TooltipButton>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Switch
                          size="sm"
                          checked={p.isActive}
                          disabled={pendingStatusId === p.id}
                          onCheckedChange={(v) => onToggleStatus(p, v)}
                          aria-label={
                            p.isActive
                              ? 'Deactivate patient'
                              : 'Activate patient'
                          }
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {p.isActive ? 'Deactivate patient' : 'Activate patient'}
                    </TooltipContent>
                  </Tooltip>
                </Can>
                <Can perm="patients.delete">
                  <TooltipButton
                    tooltip="Delete patient permanently"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDelete(p)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </TooltipButton>
                </Can>
              </div>
            </TooltipProvider>
          )
        },
      },
    ],
    [onToggleStatus, onEdit, onDelete, pendingStatusId],
  )

  return (
    <DataTable
      columns={columns}
      data={patients}
      isLoading={isLoading}
      emptyMessage="No patients found."
      serverPagination={serverPagination}
    />
  )
}
