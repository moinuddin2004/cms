import { useState } from 'react'
import { Can, useAccess } from '@/features/access'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Badge } from '@/components/ui/badge'

import {
  MoreVertical,
  LogIn,
  XCircle,
  UserX,
  Pencil,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  
  AppointmentStatus,
  NOT_ARRIVED_STATUSES,
  STATUS_BG_COLORS
} from '@/features/appointments/types'
import type {Appointment} from '@/features/appointments/types';
import {
  useCancelAppointment,
  useNoShow,
  useConfirmAppointment,
} from '@/features/appointments/hooks/useAppointmentActions'
import { CheckInDialog } from '@/features/queue'
import { useAppointmentStore } from '@/store/appointment-store'
import { formatInClinic } from '@/lib/datetime'

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
  const { openEditModal, openDetailModal } = useAppointmentStore()
  const { can } = useAccess()
  const canEdit = can('appointments.reschedule')
  const cancelMutation = useCancelAppointment()
  const noShowMutation = useNoShow()
  const confirmMutation = useConfirmAppointment()
  const [checkingIn, setCheckingIn] = useState(false)

  const timeLabel = `${formatInClinic(appointment.startTime, 'hh:mm a')} — ${formatInClinic(appointment.endTime, 'hh:mm a')}`

  const statusClass =
    STATUS_BG_COLORS[appointment.status] || STATUS_BG_COLORS.scheduled

  const handleAction = async (action: string, mutation: any, payload?: any) => {
    try {
      await mutation.mutateAsync(payload || appointment.id)
      toast.success(`Appointment ${action}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${action}`)
    }
  }

  const isCancelled = appointment.status === AppointmentStatus.CANCELLED
  const isNotArrived = NOT_ARRIVED_STATUSES.includes(appointment.status)

  return (
    <div
      className={`group relative rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all hover:shadow-md hover:z-10 ${statusClass} ${
        isCancelled ? 'opacity-50' : ''
      }`}
      style={style}
      onClick={() =>
        isNotArrived && canEdit
          ? openEditModal(appointment.id)
          : openDetailModal(appointment.id)
      }
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
              {appointment.queueEntry && (
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1 py-0 h-3.5 tabular-nums"
                >
                  {appointment.queueEntry.token}
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
            {(!isNotArrived || !canEdit) && (
              <DropdownMenuItem onClick={() => openDetailModal(appointment.id)}>
                View details
              </DropdownMenuItem>
            )}
            {isNotArrived && (
              <>
                <Can perm="appointments.reschedule">
                  <DropdownMenuItem
                    onClick={() => openEditModal(appointment.id)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                </Can>
                <DropdownMenuSeparator />
                <Can perm="appointments.book">
                  {appointment.status === AppointmentStatus.SCHEDULED && (
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
                </Can>
                <Can perm="queue.checkin">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      setCheckingIn(true)
                    }}
                  >
                    <LogIn className="w-3.5 h-3.5 mr-2" />
                    Check In
                  </DropdownMenuItem>
                </Can>
                <DropdownMenuSeparator />
                <Can perm="appointments.cancel">
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
                </Can>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <CheckInDialog
          target={
            checkingIn
              ? {
                  id: appointment.id,
                  patientName: appointment.patient?.fullName,
                  doctorName: appointment.doctor?.fullName,
                  startTime: appointment.startTime,
                  isEmergency: appointment.isEmergency,
                }
              : null
          }
          onOpenChange={(o) => !o && setCheckingIn(false)}
        />
      </div>
    </div>
  )
}
