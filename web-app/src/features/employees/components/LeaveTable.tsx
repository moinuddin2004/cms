import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
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
import { formatDate } from '@/lib/formatters'
import {
  CalendarOff,
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  X,
  Ban,
} from 'lucide-react'
import {
  useLeaves,
  useLeaveBalance,
  useApproveLeave,
  useRejectLeave,
  useCancelLeave,
} from '../hooks/useLeave'
import { LeaveFormDialog } from './LeaveFormDialog'
import {
  LEAVE_TYPE_OPTIONS,
  LeaveStatus,
  type EmployeeLeave,
} from '../types'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<LeaveStatus, string> = {
  [LeaveStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
  [LeaveStatus.APPROVED]: 'bg-green-100 text-green-800 border-green-200',
  [LeaveStatus.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
  [LeaveStatus.CANCELLED]: 'bg-slate-100 text-slate-600 border-slate-200',
}

function leaveTypeLabel(value: string): string {
  return LEAVE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

interface LeaveTableProps {
  employeeId: string
}

export function LeaveTable({ employeeId }: LeaveTableProps) {
  const { data: leaves, isLoading } = useLeaves({ employeeId })
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
          <span className="font-medium">{leaveTypeLabel(getValue<string>())}</span>
        ),
      },
      {
        accessorKey: 'startDate',
        header: 'From',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>
        ),
      },
      {
        accessorKey: 'endDate',
        header: 'To',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>
        ),
      },
      {
        accessorKey: 'totalDays',
        header: 'Days',
        cell: ({ getValue }) => (
          <span className="font-medium text-center block">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ getValue }) => {
          const status = getValue<LeaveStatus>()
          return (
            <Badge
              variant="outline"
              className={cn('capitalize', STATUS_STYLES[status])}
            >
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
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isPending && (
                  <>
                    <DropdownMenuItem
                      onClick={() => approveMutation.mutate({ id: leave.id })}
                    >
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => rejectMutation.mutate({ id: leave.id })}
                    >
                      <X className="mr-2 h-4 w-4 text-red-600" />
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
      {/* Leave balance summary */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BalanceCard
            label={`Approved Days (${balance.year})`}
            value={balance.totalApprovedDays}
          />
          <BalanceCard label="Pending Requests" value={balance.pendingRequests} />
          <BalanceCard label="Annual" value={balance.byType['annual'] ?? 0} />
          <BalanceCard label="Sick" value={balance.byType['sick'] ?? 0} />
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Leave Requests</CardTitle>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={leaves ?? []}
            isLoading={isLoading}
            emptyMessage="No leave requests yet."
            pagination={false}
          />
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

function BalanceCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}
