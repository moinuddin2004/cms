import { useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { format, formatDistanceToNow } from 'date-fns'
import { Eye, Stethoscope } from 'lucide-react'
import { DataTable, type ServerPagination } from '@/components/shared/DataTable'
import { InitialsAvatar } from '@/components/shared'
import { TooltipButton } from '@/components/shared/TooltipButton'
import type { Prescription, PrescriptionStatus } from '../types'
import { PrescriptionStatusBadge } from './PrescriptionStatusBadge'
import { MedicineChips } from './MedicineChips'

interface PrescriptionTableProps {
  prescriptions: Prescription[]
  isLoading?: boolean
  serverPagination: ServerPagination
}

export function PrescriptionTable({
  prescriptions,
  isLoading,
  serverPagination,
}: PrescriptionTableProps) {
  const navigate = useNavigate()

  const columns = useMemo<ColumnDef<Prescription, unknown>[]>(
    () => [
      {
        id: 'patient',
        header: 'Patient',
        enableSorting: false,
        cell: ({ row }) => {
          const rx = row.original
          const name = rx.patient?.fullName ?? 'Unknown patient'
          return (
            <div className="flex items-center gap-3">
              <InitialsAvatar name={name} seed={rx.patientId} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {name}
                </p>
                <p className="font-mono text-[11px] text-text-3">
                  {rx.prescriptionNumber}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'doctor',
        header: 'Doctor',
        enableSorting: false,
        cell: ({ row }) => {
          const doctor = row.original.doctor
          if (!doctor?.fullName) {
            return <span className="text-sm text-text-3">—</span>
          }
          return (
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-emerald">
                <Stethoscope className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Dr. {doctor.fullName}</p>
                {doctor.designation && (
                  <p className="truncate text-[11px] text-text-3">
                    {doctor.designation}
                  </p>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'medicines',
        header: 'Medicines',
        enableSorting: false,
        cell: ({ row }) => <MedicineChips medicines={row.original.medicines} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ getValue }) => (
          <PrescriptionStatusBadge status={getValue<PrescriptionStatus>()} />
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ getValue }) => {
          const d = new Date(getValue<string>())
          return (
            <div>
              <p className="text-sm">{format(d, 'dd MMM yyyy')}</p>
              <p className="text-[11px] text-text-3">
                {formatDistanceToNow(d, { addSuffix: true })}
              </p>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div
            className="flex justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <TooltipButton
              tooltip="Open prescription"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              asChild
            >
              <Link
                to={'/prescriptions/$prescriptionId' as any}
                params={{ prescriptionId: row.original.id } as any}
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
              </Link>
            </TooltipButton>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <DataTable
      columns={columns}
      data={prescriptions}
      isLoading={isLoading}
      emptyMessage="No prescriptions found."
      onRowClick={(rx) =>
        navigate({
          to: '/prescriptions/$prescriptionId' as any,
          params: { prescriptionId: rx.id } as any,
        })
      }
      getRowClassName={() => 'cursor-pointer'}
      serverPagination={serverPagination}
    />
  )
}
