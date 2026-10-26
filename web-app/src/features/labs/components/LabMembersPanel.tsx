import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from '@/components/shared'
import { useLabMembers, useUpdateLabMember } from '../hooks/useLabDirectory'
import { MEMBER_ROLE_LABEL } from '../types'
import type { LabMember, LabMemberRole } from '../types'
import { LabMemberSheet } from './LabMemberSheet'

/** The lab's staff: role and active toggle per member. */
export function LabMembersPanel({ labId }: { labId: string }) {
  const { data, isLoading, isError, refetch } = useLabMembers(labId)
  const update = useUpdateLabMember(labId)
  const [adding, setAdding] = useState(false)
  const pendingId = update.isPending ? update.variables.member.id : null

  const columns = useMemo<ColumnDef<LabMember, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Member',
        accessorFn: (m) => m.user.name ?? m.user.email,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.user.name ?? '—'}
            </p>
            <p className="truncate text-xs text-text-3">
              {row.original.user.email}
            </p>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        accessorKey: 'role',
        cell: ({ row }) => (
          <Select
            value={row.original.role}
            disabled={pendingId === row.original.id}
            onValueChange={(role) =>
              role !== row.original.role &&
              update.mutate({
                member: row.original,
                role: role as LabMemberRole,
              })
            }
          >
            <SelectTrigger
              className="h-8 w-36"
              aria-label={`Role of ${row.original.user.email}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MEMBER_ROLE_LABEL) as LabMemberRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {MEMBER_ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        id: 'active',
        header: 'Active',
        accessorKey: 'isActive',
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Switch
                    size="sm"
                    checked={row.original.isActive}
                    disabled={pendingId === row.original.id}
                    aria-label={`${row.original.user.email} is active`}
                    onCheckedChange={(isActive) =>
                      update.mutate({ member: row.original, isActive })
                    }
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {row.original.isActive
                  ? 'Can work for this lab — click to deactivate'
                  : 'Deactivated — click to reactivate'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
    ],
    [pendingId],
  )

  const addButton = (
    <Button size="sm" onClick={() => setAdding(true)}>
      <Plus className="size-3.5" /> Add member
    </Button>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-3">
          Lab staff accept orders and update case progress from the lab portal.
        </p>
        {addButton}
      </div>
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <EmptyState
          icon={Users}
          title="No staff yet"
          description="Add the people who work at this lab."
          action={addButton}
        />
      ) : (
        <DataTable columns={columns} data={data} pagination={false} />
      )}
      <LabMemberSheet open={adding} onOpenChange={setAdding} labId={labId} />
    </div>
  )
}
