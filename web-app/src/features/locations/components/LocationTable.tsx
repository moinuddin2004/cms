import { useMemo } from 'react'
import { type ColumnDef } from '@/components/shared/table-features'
import { Edit2, PowerOff, Settings } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { StatusBadge } from '@/components/shared'
import type { Location } from '../LocationManagementView'

interface LocationTableProps {
  locations: Location[]
  isLoading?: boolean
  showOrganization?: boolean
  onSettings: (location: Location) => void
  onEdit: (location: Location) => void
  onDeactivate: (location: Location) => void
}

export function LocationTable({
  locations,
  isLoading,
  showOrganization,
  onSettings,
  onEdit,
  onDeactivate,
}: LocationTableProps) {
  const columns = useMemo<ColumnDef<Location, unknown>[]>(() => {
    const cols: ColumnDef<Location, unknown>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.original.name}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {row.original.code}
            </p>
          </div>
        ),
      },
    ]

    if (showOrganization) {
      cols.push({
        id: 'organization',
        header: 'Organization',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.organization?.name ?? 'Unknown'}
          </span>
        ),
      })
    }

    cols.push(
      {
        accessorKey: 'city',
        header: 'City',
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {getValue<string | undefined>() ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue<string | undefined>() ?? '—'}</span>
        ),
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
          const loc = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <TooltipButton
                tooltip="Location settings"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onSettings(loc)}
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </TooltipButton>
              <TooltipButton
                tooltip="Edit location"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onEdit(loc)}
              >
                <Edit2 className="h-4 w-4 text-muted-foreground" />
              </TooltipButton>
              {loc.isActive && (
                <TooltipButton
                  tooltip="Deactivate location"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDeactivate(loc)}
                >
                  <PowerOff className="h-4 w-4" />
                </TooltipButton>
              )}
            </div>
          )
        },
      },
    )

    return cols
  }, [showOrganization, onSettings, onEdit, onDeactivate])

  return (
    <DataTable
      columns={columns}
      data={locations}
      isLoading={isLoading}
      emptyMessage="No locations found."
      pagination
    />
  )
}
