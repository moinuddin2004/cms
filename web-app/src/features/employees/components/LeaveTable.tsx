import { useState } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  return (
    LEAVE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
  )
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Leave balance summary */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BalanceCard
            label={`Approved Days (${balance.year})`}
            value={balance.totalApprovedDays}
          />
          <BalanceCard
            label="Pending Requests"
            value={balance.pendingRequests}
          />
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
          {!leaves || leaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="rounded-full bg-muted p-5">
                <CalendarOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium">No leave requests yet</p>
              <p className="text-sm text-muted-foreground">
                Create a leave request to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((leave) => {
                  const isPending = leave.status === LeaveStatus.PENDING
                  const isApproved = leave.status === LeaveStatus.APPROVED
                  return (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">
                        {leaveTypeLabel(leave.leaveType)}
                      </TableCell>
                      <TableCell>{formatDate(leave.startDate)}</TableCell>
                      <TableCell>{formatDate(leave.endDate)}</TableCell>
                      <TableCell className="text-center">
                        {leave.totalDays}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'capitalize',
                            STATUS_STYLES[leave.status],
                          )}
                        >
                          {leave.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {leave.reason || '—'}
                      </TableCell>
                      <TableCell>
                        {(isPending || isApproved) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isPending && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      approveMutation.mutate({ id: leave.id })
                                    }
                                  >
                                    <Check className="mr-2 h-4 w-4 text-green-600" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      rejectMutation.mutate({ id: leave.id })
                                    }
                                  >
                                    <X className="mr-2 h-4 w-4 text-red-600" />
                                    Reject
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openEdit(leave)}
                                  >
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
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
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
