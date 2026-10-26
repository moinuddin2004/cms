import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { Lock, Plus, Users } from 'lucide-react'
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
  InitialsAvatar,
  LoadingSkeleton,
  NoResultsState,
  StatusBadge,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { useDebounce } from '@/hooks/useDebounce'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { PortalMemberSheet } from '../components/PortalMemberSheet'
import {
  useActiveLab,
  usePortalMembers,
  useUpdatePortalMember,
} from '../hooks/useLabPortal'
import { LAB_ROLE_LABEL } from '../types'
import type { LabMember, LabMemberRole } from '../types'

type RoleFilter = LabMemberRole | 'all'

/** Role picker + active switch for one member; locked on your own row. */
function MemberControls({
  member,
  isSelf,
  pending,
  onChange,
}: {
  member: LabMember
  isSelf: boolean
  pending: boolean
  onChange: (change: { role?: LabMemberRole; isActive?: boolean }) => void
}) {
  const locked = isSelf || pending
  return (
    <TooltipProvider>
      <div className="flex items-center gap-3">
        <Select
          value={member.role}
          disabled={locked}
          onValueChange={(role) =>
            role !== member.role && onChange({ role: role as LabMemberRole })
          }
        >
          <SelectTrigger
            className="h-8 w-36"
            aria-label={`Role of ${member.user.email}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LAB_ROLE_LABEL) as LabMemberRole[]).map((r) => (
              <SelectItem key={r} value={r}>
                {LAB_ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Switch
                size="sm"
                checked={member.isActive}
                disabled={locked}
                aria-label={`${member.user.email} is active`}
                onCheckedChange={(isActive) => onChange({ isActive })}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isSelf
              ? 'You can’t change your own access — ask another lab admin'
              : member.isActive
                ? 'Can work for this lab — click to deactivate'
                : 'Deactivated — click to reactivate'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

/** The lab's team — lab admins add people, change roles and deactivate. */
export function LabTeamPage() {
  const { isLabAdmin, userId } = useActiveLab()
  const { data, isLoading, isError, refetch } = usePortalMembers(isLabAdmin)
  const update = useUpdatePortalMember()
  const pendingId = update.isPending ? update.variables.member.id : null

  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<RoleFilter>('all')
  const [adding, setAdding] = useState(false)
  const query = useDebounce(search, 300).trim().toLowerCase()

  const activeFilters = (query ? 1 : 0) + (role !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setRole('all')
  }

  const all = data ?? []
  const rows = all.filter(
    (m) =>
      (role === 'all' || m.role === role) &&
      (!query ||
        m.user.email.toLowerCase().includes(query) ||
        (m.user.name ?? '').toLowerCase().includes(query)),
  )

  const columns = useMemo<ColumnDef<LabMember, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Member',
        accessorFn: (m) => m.user.name ?? m.user.email,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <InitialsAvatar
              size="sm"
              name={row.original.user.name ?? row.original.user.email}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {row.original.user.name ?? '—'}
                {row.original.user.id === userId && (
                  <span className="ml-1.5 text-xs font-normal text-text-3">
                    (you)
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-text-3">
                {row.original.user.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'isActive',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.isActive ? 'active' : 'inactive'}
            tone={row.original.isActive ? 'success' : 'muted'}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Role & access',
        enableSorting: false,
        cell: ({ row }) => (
          <MemberControls
            member={row.original}
            isSelf={row.original.user.id === userId}
            pending={pendingId === row.original.id}
            onChange={(change) =>
              update.mutate({ member: row.original, ...change })
            }
          />
        ),
      },
    ],
    [pendingId, userId],
  )

  if (!isLabAdmin) {
    return (
      <LabPortalLayout title="Team">
        <EmptyState
          icon={Lock}
          title="Lab admins only"
          description="Ask your lab admin to add or change team members."
        />
      </LabPortalLayout>
    )
  }

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus className="size-4" /> Add member
    </Button>
  )

  return (
    <LabPortalLayout
      title="Team"
      subtitle="People who work at your lab."
      actions={addButton}
    >
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search by name or email…"
          activeFilters={activeFilters}
          onClear={clearFilters}
          resultLabel={`${rows.length} member${rows.length === 1 ? '' : 's'}`}
          viewMode={viewMode}
          onViewMode={setViewMode}
          filters={
            <Select
              value={role}
              onValueChange={(v) => setRole(v as RoleFilter)}
            >
              <SelectTrigger className="h-9 w-40" aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {(Object.keys(LAB_ROLE_LABEL) as LabMemberRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {LAB_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {isLoading ? (
          <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : all.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Add the people who work at your lab."
            action={addButton}
          />
        ) : rows.length === 0 ? (
          <NoResultsState
            message="No members match your filters."
            onClear={clearFilters}
          />
        ) : viewMode === 'table' ? (
          <DataTable columns={columns} data={rows} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((m) => (
              <article
                key={m.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
              >
                <div className="flex items-center gap-2.5">
                  <InitialsAvatar
                    size="sm"
                    name={m.user.name ?? m.user.email}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">
                      {m.user.name ?? m.user.email}
                    </h2>
                    <p className="truncate text-xs text-text-3">
                      {m.user.email}
                    </p>
                  </div>
                  <StatusBadge
                    status={m.isActive ? 'active' : 'inactive'}
                    tone={m.isActive ? 'success' : 'muted'}
                  />
                </div>
                <div className="border-t border-border/60 pt-3">
                  <MemberControls
                    member={m}
                    isSelf={m.user.id === userId}
                    pending={pendingId === m.id}
                    onChange={(change) =>
                      update.mutate({ member: m, ...change })
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <PortalMemberSheet open={adding} onOpenChange={setAdding} />
    </LabPortalLayout>
  )
}
