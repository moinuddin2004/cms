import { useMemo } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { formatInClinic } from '@/lib/datetime'
import { Building2 } from 'lucide-react'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from '@/components/shared'
import { useLabClinicLinks } from '../hooks/useLabDirectory'
import { PATIENT_DATA_LABEL } from '../types'
import type { LabLinkAdmin } from '../types'
import { LinkStatusBadge } from './lab-badges'

/** Clinics that have this lab on their list (read-only for the platform). */
export function LabClinicsPanel({ labId }: { labId: string }) {
  const { data, isLoading, isError, refetch } = useLabClinicLinks(labId)

  const columns = useMemo<ColumnDef<LabLinkAdmin, unknown>[]>(
    () => [
      {
        id: 'clinic',
        header: 'Clinic',
        accessorFn: (l) => l.organization.name,
        cell: ({ row }) => (
          <span className="text-sm font-semibold">
            {row.original.organization.name}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <LinkStatusBadge status={row.original.status} />,
      },
      {
        id: 'terms',
        header: 'Payment terms',
        accessorKey: 'paymentTermsDays',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.paymentTermsDays} days
          </span>
        ),
      },
      {
        id: 'patientData',
        header: 'Patient details shared',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-text-2">
            {PATIENT_DATA_LABEL[row.original.patientDataLevel]}
          </span>
        ),
      },
      {
        id: 'since',
        header: 'Active since',
        accessorKey: 'activatedAt',
        cell: ({ row }) => (
          <span className="text-sm text-text-2">
            {formatInClinic(row.original.activatedAt, 'd MMM yyyy')}
          </span>
        ),
      },
    ],
    [],
  )

  if (isLoading) return <LoadingSkeleton variant="table" rows={3} />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (!data?.length) {
    return (
      <EmptyState
        icon={Building2}
        title="No clinics yet"
        description="Clinics add this lab from their Labs page."
      />
    )
  }
  return <DataTable columns={columns} data={data} pagination={false} />
}
