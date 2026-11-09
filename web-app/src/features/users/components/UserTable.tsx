import { useMemo } from 'react'
import type {ColumnDef} from '@/components/shared/table-features';
import type {User} from '../types';
import { Badge } from '@/components/ui/badge'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { DataTable  } from '@/components/shared/DataTable'
import type {ServerPagination} from '@/components/shared/DataTable';
import {
  BadgeCheck,
  Edit,
  MailWarning,
  MoreHorizontal,
  Send,
  ShieldAlert,
  Trash,
  User as UserIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatDate, formatInClinic } from '@/lib/datetime'

interface UserTableProps {
  users: User[]
  isLoading?: boolean
  onEdit: (user: User) => void
  onDelete: (user: User) => void
  /** Email a fresh verification link (unverified password accounts). */
  onResendVerification?: (user: User) => void
  /** Super admin only: mark the email verified without the link. */
  onMarkVerified?: (user: User) => void
  /** Hide the edit / delete actions (e.g. owner accounts for non-owners). */
  readOnly?: boolean
  serverPagination?: ServerPagination
}

export function UserTable({
  users,
  isLoading,
  onEdit,
  onDelete,
  onResendVerification,
  onMarkVerified,
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
        id: 'emailVerification',
        header: 'Email',
        enableSorting: false,
        cell: ({ row }) => <EmailVerificationBadge user={row.original} />,
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        cell: ({ getValue }) => {
          const val = getValue<string | null>()
          return (
            <span className="text-sm text-muted-foreground">
              {val ? formatInClinic(val, 'MMM dd, yyyy') : 'N/A'}
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
          const unverified = needsVerification(user)
          const canResend = unverified && !!onResendVerification && !readOnly
          const canMark = unverified && !!onMarkVerified
          if (readOnly && !canMark) return null
          if (!canResend && !canMark) {
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
          }
          return (
            <div className="flex items-center justify-end">
              <DropdownMenu>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Actions for ${user.email}`}
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Actions</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="end" className="w-52">
                  {!readOnly && (
                    <DropdownMenuItem onClick={() => onEdit(user)}>
                      <Edit className="w-3.5 h-3.5 mr-2" />
                      Edit user
                    </DropdownMenuItem>
                  )}
                  {canResend && (
                    <DropdownMenuItem
                      onClick={() => onResendVerification(user)}
                    >
                      <Send className="w-3.5 h-3.5 mr-2" />
                      Resend verification email
                    </DropdownMenuItem>
                  )}
                  {canMark && (
                    <DropdownMenuItem onClick={() => onMarkVerified(user)}>
                      <BadgeCheck className="w-3.5 h-3.5 mr-2" />
                      Mark email verified
                    </DropdownMenuItem>
                  )}
                  {!readOnly && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(user)}
                      >
                        <Trash className="w-3.5 h-3.5 mr-2" />
                        Delete user
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [onEdit, onDelete, onResendVerification, onMarkVerified, readOnly],
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

/** A password account whose email is not verified (Google-only accounts verify on sign-in). */
function needsVerification(user: User) {
  return !user.emailVerifiedAt && user.hasPassword !== false
}

function EmailVerificationBadge({ user }: { user: User }) {
  if (user.emailVerifiedAt) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <BadgeCheck className="size-3" />
        Verified
      </Badge>
    )
  }
  if (user.hasPassword === false) {
    return (
      <span className="text-xs text-muted-foreground">
        Verified on Google sign-in
      </span>
    )
  }
  const due = user.emailVerificationDueAt
  const overdue = !!due && new Date(due).getTime() <= Date.now()
  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant="outline"
        className="w-fit gap-1 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <MailWarning className="size-3" />
        Unverified
      </Badge>
      <span className="text-[11px] text-muted-foreground">
        {overdue
          ? 'Blocked until verified'
          : due
            ? `Must verify by ${formatDate(due)}`
            : 'Link sent on next sign-in'}
      </span>
    </div>
  )
}
