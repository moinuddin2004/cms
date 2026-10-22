import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'
import { Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  NoResultsState,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { useDebounce } from '@/hooks/useDebounce'
import { CloneRoleSheet } from '../components/CloneRoleSheet'
import { RoleCard } from '../components/RoleCard'
import { RoleRowActions } from '../components/RoleRowActions'
import { RoleSheet } from '../components/RoleSheet'
import { RoleDot, RoleKindBadge } from '../components/role-badges'
import { useDeleteRole, useRoles } from '../hooks/useRoles'
import { bundleSummaryText } from '../lib/bundles'
import { toastRoleError } from '../lib/role-errors'
import type {
  RoleDetail,
  RoleKindFilter,
  RoleSummary,
} from '../types/roles.types'

/** Clinic setup → Roles: system templates + the clinic's own roles. */
export function RolesPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<RoleKindFilter>('all')
  const [creating, setCreating] = useState(false)
  const [cloning, setCloning] = useState<RoleSummary | null>(null)
  const [deleting, setDeleting] = useState<RoleSummary | null>(null)
  const query = useDebounce(search, 300).trim().toLowerCase()

  const { data, isLoading, isError, refetch } = useRoles()
  const remove = useDeleteRole()

  const roles = data ?? []
  const rows = roles.filter(
    (r) =>
      (kind === 'all' || (kind === 'system') === r.isSystemRole) &&
      (!query ||
        r.name.toLowerCase().includes(query) ||
        (r.description ?? '').toLowerCase().includes(query)),
  )

  const activeFilters = (query ? 1 : 0) + (kind !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setKind('all')
  }

  const open = (role: { id: string }) =>
    void navigate({ to: '/admin/roles/$roleId', params: { roleId: role.id } })

  const columns = useMemo<ColumnDef<RoleSummary, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Role',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <RoleDot seed={row.original.id} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {row.original.name}
              </p>
              {row.original.description && (
                <p className="truncate text-xs text-text-3">
                  {row.original.description}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'kind',
        header: 'Type',
        accessorFn: (r) => (r.isSystemRole ? 'system' : 'custom'),
        cell: ({ row }) => (
          <RoleKindBadge isSystemRole={row.original.isSystemRole} />
        ),
      },
      {
        id: 'access',
        header: 'Access',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-text-2">
            {bundleSummaryText(row.original.permissions)}
          </span>
        ),
      },
      {
        id: 'members',
        header: 'Members',
        accessorKey: 'memberCount',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.memberCount}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <RoleRowActions
            role={row.original}
            onClone={setCloning}
            onDelete={setDeleting}
          />
        ),
      },
    ],
    [],
  )

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" /> New role
    </Button>
  )

  const confirmDelete = () => {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => setDeleting(null),
      onError: (err) => {
        toastRoleError(err)
        setDeleting(null)
      },
    })
  }

  return (
    <DashboardLayout
      title="Roles"
      subtitle="What each role can see and do. System roles are templates — clone one to customise it."
      actions={addButton}
    >
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search roles…"
          activeFilters={activeFilters}
          onClear={clearFilters}
          resultLabel={`${rows.length} role${rows.length === 1 ? '' : 's'}`}
          viewMode={viewMode}
          onViewMode={setViewMode}
          filters={
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as RoleKindFilter)}
            >
              <SelectTrigger className="h-9 w-36" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        {isLoading ? (
          <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : roles.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No roles yet"
            description="Create a role and pick what it can do, module by module."
            action={addButton}
          />
        ) : rows.length === 0 ? (
          <NoResultsState
            message="No roles match your filters."
            onClear={clearFilters}
          />
        ) : viewMode === 'table' ? (
          <DataTable columns={columns} data={rows} onRowClick={open} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onOpen={open}
                onClone={setCloning}
                onDelete={setDeleting}
              />
            ))}
          </div>
        )}
      </div>

      <RoleSheet
        open={creating}
        onOpenChange={setCreating}
        onCreated={(role: RoleDetail) => open(role)}
      />
      <CloneRoleSheet
        source={cloning}
        onOpenChange={(o) => !o && setCloning(null)}
        onCloned={(role) => open(role)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && !remove.isPending && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'role'}?`}
        description={
          deleting && deleting.memberCount > 0
            ? `${deleting.memberCount} active member${deleting.memberCount === 1 ? '' : 's'} still use this role — move them to another role first.`
            : 'This permanently deletes the role. This cannot be undone.'
        }
        confirmLabel="Delete role"
        destructive
        isLoading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </DashboardLayout>
  )
}
