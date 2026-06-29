import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { type User } from '../types'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldAlert, User as UserIcon, Edit, Trash } from 'lucide-react'
import { format } from 'date-fns'

interface UserTableProps {
  users: User[]
  isLoading: boolean
  onEdit: (user: User) => void
  onDelete: (user: User) => void
}

export function UserTable({
  users,
  isLoading,
  onEdit,
  onDelete,
}: UserTableProps) {
  const columns = useMemo<ColumnDef<User>[]>(
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
              <span className="text-xs text-muted-foreground">{user.email}</span>
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
        cell: ({ getValue }) => {
          const role = getValue<string | null>()
          return (
            <div className="flex items-center">
              {role === 'super_admin' ? (
                <ShieldAlert className="w-4 h-4 mr-1 text-destructive" />
              ) : (
                <UserIcon className="w-4 h-4 mr-1 text-primary" />
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
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(user)}
              >
                <Edit className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(user)}
              >
                <Trash className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          )
        },
      },
    ],
    [onEdit, onDelete],
  )

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-xs font-semibold uppercase tracking-wider"
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
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/20 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
