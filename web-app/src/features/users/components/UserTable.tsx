import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { type User } from '../types'
import { Badge } from '@/components/ui/badge'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { DataTable, type ServerPagination } from '@/components/shared/DataTable'
import { ShieldAlert, User as UserIcon, Edit, Trash } from 'lucide-react'
import { format } from 'date-fns'

interface UserTableProps {
  users: User[]
  isLoading?: boolean
  onEdit: (user: User) => void
  onDelete: (user: User) => void
  /** Hide the edit / delete actions (e.g. owner accounts for non-owners). */
  readOnly?: boolean
  serverPagination?: ServerPagination
}

export function UserTable({
  users,
  isLoading,
  onEdit,
  onDelete,
  readOnly = false,
  serverPagination,
}: UserTableProps) {
  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="flex flex-col">
              <span className="font-medium text-sm">
                {user.name || 'Unknown Name'}
              </span>
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
              {user.phone && (
                <span className="text-xs text-muted-foreground/60">
                  {user.phone}
                </span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'globalRole',
        header: 'Role',
        enableSorting: false,
        cell: ({ getValue }) => {
          const role = getValue<string | null>()
          return (
            <div className="flex items-center gap-1.5">
              {role === 'super_admin' ? (
                <ShieldAlert className="w-4 h-4 text-destructive" />
              ) : (
                <UserIcon className="w-4 h-4 text-primary" />
              )}
              <span className="text-sm font-medium">
                {role === 'super_admin' ? 'Super Admin' : 'User'}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return (
            <Badge
              variant={
                status === 'active'
                  ? 'default'
                  : status === 'suspended'
                    ? 'destructive'
                    : 'secondary'
              }
              className={
                status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  : undefined
              }
            >
              {status}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        cell: ({ getValue }) => {
          const val = getValue<string | null>()
          return (
            <span className="text-sm text-muted-foreground">
              {val ? format(new Date(val), 'MMM dd, yyyy') : 'N/A'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original
          if (readOnly) return null
          return (
            <div className="flex items-center justify-end gap-1">
              <TooltipButton
                tooltip="Edit user"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(user)}
              >
                <Edit className="w-4 h-4 text-muted-foreground" />
              </TooltipButton>
              <TooltipButton
                tooltip="Delete user"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(user)}
              >
                <Trash className="w-4 h-4 text-destructive" />
              </TooltipButton>
            </div>
          )
        },
      },
    ],
    [onEdit, onDelete, readOnly],
  )

  return (
    <DataTable
      columns={columns}
      data={users}
      isLoading={isLoading}
      emptyMessage="No users found."
      serverPagination={serverPagination}
    />
  )
}
