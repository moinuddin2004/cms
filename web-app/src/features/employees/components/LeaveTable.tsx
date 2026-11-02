import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable } from '@/components/shared/DataTable'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ErrorState } from '@/components/shared'
import { formatDate } from '@/lib/formatters'
import {
  Ban,
  CalendarCheck,
  Check,
  Clock,
  HeartPulse,
  MoreHorizontal,
  Palmtree,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import {
  useLeaves,
  useLeaveBalance,
  useApproveLeave,
  useRejectLeave,
  useCancelLeave,
} from '../hooks/useLeave'
import { LeaveFormDialog } from './LeaveFormDialog'
import { LEAVE_TYPE_OPTIONS, LeaveStatus } from '../types'
import type { EmployeeLeave } from '../types'

const STATUS_VARIANT: Record<
  LeaveStatus,
  'warning' | 'success' | 'danger' | 'muted'
> = {
  [LeaveStatus.PENDING]: 'warning',
  [LeaveStatus.APPROVED]: 'success',
  [LeaveStatus.REJECTED]: 'danger',
  [LeaveStatus.CANCELLED]: 'muted',
}

function leaveTypeLabel(value: string): string {
  return LEAVE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

interface LeaveTableProps {
  employeeId: string
}

export function LeaveTable({ employeeId }: LeaveTableProps) {
  const {
    data: leaves,
    isLoading,
    isError,
    refetch,
  } = useLeaves({ employeeId })
  const { data: balance } = useLeaveBalance(employeeId)
  const approveMutation = useApproveLeave()
  const rejectMutation = useRejectLeave()
  const cancelMutation = useCancelLeave()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLeave, setEditingLeave] = useState<EmployeeLeave | null>(null)

  const openCreate = () => {
    setEditingLeave(null)
    setIsFormOpen(true)
  }

  const openEdit = (leave: EmployeeLeave) => {
    setEditingLeave(leave)
    setIsFormOpen(true)
  }

  const columns = useMemo<ColumnDef<EmployeeLeave, unknown>[]>(
    () => [
      {
        accessorKey: 'leaveType',
        header: 'Type',
        cell: ({ getValue }) => (
          <span className="font-medium">
            {leaveTypeLabel(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'startDate',
        header: 'From',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatDate(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'endDate',
        header: 'To',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatDate(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'totalDays',
        header: 'Days',
        cell: ({ getValue }) => (
          <span className="font-medium text-center block">
            {getValue<number>()}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ getValue }) => {
          const status = getValue<LeaveStatus>()
          return (
            <Badge variant={STATUS_VARIANT[status]} className="capitalize">
              {status}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="max-w-[200px] truncate text-muted-foreground block">
            {getValue<string>() || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const leave = row.original
          const isPending = leave.status === LeaveStatus.PENDING
          const isApproved = leave.status === LeaveStatus.APPROVED
          if (!isPending && !isApproved) return null
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TooltipButton
                  tooltip="Leave actions"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </TooltipButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isPending && (
                  <>
                    <DropdownMenuItem
                      onClick={() => approveMutation.mutate({ id: leave.id })}
                    >
                      <Check className="mr-2 h-4 w-4 text-emerald" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => rejectMutation.mutate({ id: leave.id })}
                    >
                      <X className="mr-2 h-4 w-4 text-danger" />
                      Reject
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(leave)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => cancelMutation.mutate(leave.id)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel Request
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [approveMutation, rejectMutation, cancelMutation],
  )

  return (
    <div className="space-y-6">
      {/* Leave balance summary — same compact strip as the appointments stats */}
      {balance && (
        <div className="grid grid-cols-2 divide-x divide-y rounded-xl border bg-card sm:grid-cols-4 sm:divide-y-0">
          {[
            {
              label: `Approved ${balance.year}`,
              value: balance.totalApprovedDays,
              icon: CalendarCheck,
              tone: 'bg-emerald-soft text-emerald',
            },
            {
              label: 'Pending',
              value: balance.pendingRequests,
              icon: Clock,
              tone: 'bg-amber-soft text-amber',
            },
            {
              label: 'Annual',
              value: balance.byType['annual'] ?? 0,
              icon: Palmtree,
              tone: 'bg-primary-soft text-primary-text',
            },
            {
              label: 'Sick',
              value: balance.byType['sick'] ?? 0,
              icon: HeartPulse,
              tone: 'bg-violet-soft text-violet',
            },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/40"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 leading-none">
                <p className="truncate text-[11px] font-medium text-text-3">
                  {label}
                </p>
                <p className="mt-1 text-base leading-none font-bold tabular-nums">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-lg font-medium">
              Leave requests
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Requests for this person at the current location.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New request
          </Button>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState
              description="Could not load leave requests."
              onRetry={() => void refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              data={leaves ?? []}
              isLoading={isLoading}
              emptyMessage="No leave requests yet."
              pagination={false}
            />
          )}
        </CardContent>
      </Card>

      <LeaveFormDialog
        employeeId={employeeId}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        leave={editingLeave}
      />
    </div>
  )
}
