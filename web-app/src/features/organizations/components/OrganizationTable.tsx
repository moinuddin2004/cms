import { useMemo } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { Edit2, PowerOff, Settings, ToggleRight } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { StatusBadge } from '@/components/shared'
import type { Organization } from '../OrganizationManagementView'

interface OrganizationTableProps {
  organizations: Organization[]
  isLoading?: boolean
  onFeatures: (org: Organization) => void
  onSettings: (org: Organization) => void
  onEdit: (org: Organization) => void
  onDeactivate: (org: Organization) => void
}

export function OrganizationTable({
  organizations,
  isLoading,
  onFeatures,
  onSettings,
  onEdit,
  onDeactivate,
}: OrganizationTableProps) {
  const columns = useMemo<ColumnDef<Organization, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => (
          <span className="text-sm font-medium text-foreground">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'slug',
        header: 'Slug',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'subscriptionPlan',
        header: 'Plan',
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue<string>()}</span>
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
          const org = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <TooltipButton
                tooltip="Manage features"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onFeatures(org)}
              >
                <ToggleRight className="h-4 w-4 text-muted-foreground" />
              </TooltipButton>
              <TooltipButton
                tooltip="Organization settings"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onSettings(org)}
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </TooltipButton>
              <TooltipButton
                tooltip="Edit organization"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onEdit(org)}
              >
                <Edit2 className="h-4 w-4 text-muted-foreground" />
              </TooltipButton>
              {org.isActive && (
                <TooltipButton
                  tooltip="Deactivate organization"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDeactivate(org)}
                >
                  <PowerOff className="h-4 w-4" />
                </TooltipButton>
              )}
            </div>
          )
        },
      },
    ],
    [onFeatures, onSettings, onEdit, onDeactivate],
  )

  return (
    <DataTable
      columns={columns}
      data={organizations}
      isLoading={isLoading}
      emptyMessage="No organizations found."
      pagination
    />
  )
}
