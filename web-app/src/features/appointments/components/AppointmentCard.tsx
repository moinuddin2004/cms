import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ConsumptionRecorder } from '@/features/inventory'
import {
  MoreVertical,
  LogIn,
  Stethoscope,
  CheckCircle,
  XCircle,
  UserX,
  Pencil,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  type Appointment,
  AppointmentStatus,
  STATUS_BG_COLORS,
} from '@/features/appointments/types'
import {
  useCancelAppointment,
  useNoShow,
  useCheckIn,
  useStartAppointment,
  useCompleteAppointment,
  useConfirmAppointment,
} from '@/features/appointments/hooks/useAppointmentActions'
import { useAppointmentStore } from '@/store/appointment-store'

interface AppointmentCardProps {
  appointment: Appointment
  style?: React.CSSProperties
  compact?: boolean
}

export function AppointmentCard({
  appointment,
  style,
  compact = false,
}: AppointmentCardProps) {
  const { openEditModal } = useAppointmentStore()
  const [recorderOpen, setRecorderOpen] = useState(false)
  const cancelMutation = useCancelAppointment()
  const noShowMutation = useNoShow()
  const checkInMutation = useCheckIn()
  const startMutation = useStartAppointment()
  const completeMutation = useCompleteAppointment()
  const confirmMutation = useConfirmAppointment()

  const startTime = new Date(appointment.startTime)
  const endTime = new Date(appointment.endTime)
  const timeLabel = `${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  const statusClass =
    STATUS_BG_COLORS[appointment.status] || STATUS_BG_COLORS.scheduled

  const handleAction = async (
    action: string,
    mutation: any,
    payload?: any,
  ) => {
    try {
      await mutation.mutateAsync(payload || appointment.id)
      toast.success(`Appointment ${action}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${action}`)
    }
  }

  const isCancelled = appointment.status === AppointmentStatus.CANCELLED
  const isCompleted = appointment.status === AppointmentStatus.COMPLETED
  const isNoShow = appointment.status === AppointmentStatus.NO_SHOW
  const isTerminal = isCancelled || isCompleted || isNoShow

  return (
    <div
      className={`group relative rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all hover:shadow-md hover:z-10 ${statusClass} ${
        isCancelled ? 'opacity-50' : ''
      }`}
      style={style}
      onClick={() => openEditModal(appointment.id)}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold truncate ${compact ? 'text-[11px]' : 'text-xs'}`}
          >
            {appointment.patient?.fullName || 'Unknown Patient'}
          </p>
          {!compact && (
            <p className="text-[10px] opacity-80 mt-0.5">{timeLabel}</p>
          )}
          {!compact && (
            <div className="flex items-center gap-1 mt-1">
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 h-3.5 capitalize"
              >
                {appointment.type.replace('_', ' ')}
              </Badge>
              {appointment.isEmergency && (
                <Badge
                  variant="destructive"
                  className="text-[9px] px-1 py-0 h-3.5"
                >
                  🚨
                </Badge>
              )}
              {appointment.isWalkIn && (
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1 py-0 h-3.5"
                >
                  🚶
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/5"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => openEditModal(appointment.id)}>
              <Pencil className="w-3.5 h-3.5 mr-2" />
              Edit
            </DropdownMenuItem>

            {!isTerminal && (
              <>
                <DropdownMenuSeparator />
                {(appointment.status === AppointmentStatus.SCHEDULED ||
                  appointment.status === AppointmentStatus.RESCHEDULED) && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAction('confirmed', confirmMutation)
                    }}
                  >
                    <ThumbsUp className="w-3.5 h-3.5 mr-2" />
                    Confirm
                  </DropdownMenuItem>
                )}
                {(appointment.status === AppointmentStatus.SCHEDULED ||
                  appointment.status === AppointmentStatus.CONFIRMED ||
                  appointment.status === AppointmentStatus.RESCHEDULED) && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAction('checked in', checkInMutation)
                    }}
                  >
                    <LogIn className="w-3.5 h-3.5 mr-2" />
                    Check In
                  </DropdownMenuItem>
                )}
                {appointment.status === AppointmentStatus.CHECKED_IN && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAction('started', startMutation)
                    }}
                  >
                    <Stethoscope className="w-3.5 h-3.5 mr-2" />
                    Start
                  </DropdownMenuItem>
                )}
                {appointment.status === AppointmentStatus.IN_PROGRESS && (
                  <DropdownMenuItem
                    onClick={async (e) => {
                      e.stopPropagation()
                      await handleAction('completed', completeMutation)
                      // Offer optional consumption recording after completing
                      setRecorderOpen(true)
                    }}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-2" />
                    Complete
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAction('marked as no-show', noShowMutation)
                  }}
                >
                  <UserX className="w-3.5 h-3.5 mr-2" />
                  No Show
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAction('cancelled', cancelMutation, {
                      id: appointment.id,
                    })
                  }}
                >
                  <XCircle className="w-3.5 h-3.5 mr-2" />
                  Cancel
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Optional inventory consumption recording after completion */}
      <Dialog open={recorderOpen} onOpenChange={setRecorderOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Record Items Used</DialogTitle>
            <DialogDescription>
              Optionally record the supplies consumed during this appointment.
              You can skip this if you don't track inventory.
            </DialogDescription>
          </DialogHeader>
          {appointment.patientId && (
            <ConsumptionRecorder
              patientId={appointment.patientId}
              appointmentId={appointment.id}
              appointmentType={appointment.type}
              onSaved={() => setRecorderOpen(false)}
              onCancel={() => setRecorderOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
