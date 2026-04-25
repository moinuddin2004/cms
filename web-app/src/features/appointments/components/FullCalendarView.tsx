import { useRef, useMemo, useCallback, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid'
import resourceDayGridPlugin from '@fullcalendar/resource-daygrid'
import type {
  EventClickArg,
  DateSelectArg,
  EventDropArg,
  EventContentArg,
} from '@fullcalendar/core'
import { toast } from 'sonner'
import {
  type Appointment,
  type Doctor,
  AppointmentStatus,
} from '@/features/appointments/types'
import type { AvailabilityBlock } from '@/features/appointments/services/appointments.api'
import { useAppointmentStore } from '@/store/appointment-store'
import { useUpdateAppointment } from '@/features/appointments/hooks/useUpdateAppointment'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ─── Props ──────────────────────────────────────────────────────────

interface FullCalendarViewProps {
  appointments: Appointment[]
  doctors: Doctor[]
  availability: AvailabilityBlock[]
  selectedDate: Date
  onDateChange: (date: Date) => void
  onViewChange: (view: string) => void
  currentView: string
}

// ─── Status → Color Mapping ─────────────────────────────────────────

const STATUS_FC_COLORS: Record<
  AppointmentStatus,
  { bg: string; border: string; text: string }
> = {
  [AppointmentStatus.SCHEDULED]: {
    bg: '#dbeafe',
    border: '#3b82f6',
    text: '#1e40af',
  },
  [AppointmentStatus.CONFIRMED]: {
    bg: '#ede9fe',
    border: '#8b5cf6',
    text: '#5b21b6',
  },
  [AppointmentStatus.IN_PROGRESS]: {
    bg: '#fef3c7',
    border: '#f59e0b',
    text: '#92400e',
  },
  [AppointmentStatus.COMPLETED]: {
    bg: '#dcfce7',
    border: '#22c55e',
    text: '#166534',
  },
  [AppointmentStatus.CANCELLED]: {
    bg: '#fee2e2',
    border: '#ef4444',
    text: '#991b1b',
  },
  [AppointmentStatus.NO_SHOW]: {
    bg: '#f3f4f6',
    border: '#6b7280',
    text: '#374151',
  },
  [AppointmentStatus.RESCHEDULED]: {
    bg: '#cffafe',
    border: '#06b6d4',
    text: '#155e75',
  },
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.CONFIRMED]: 'Confirmed',
  [AppointmentStatus.IN_PROGRESS]: 'In Progress',
  [AppointmentStatus.COMPLETED]: 'Completed',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.NO_SHOW]: 'No Show',
  [AppointmentStatus.RESCHEDULED]: 'Rescheduled',
}

// Doctor avatar colors for the header
const DOCTOR_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#ef4444',
  '#6366f1',
]

// ─── Component ──────────────────────────────────────────────────────

export function FullCalendarView({
  appointments,
  doctors,
  availability,
  selectedDate,
  onDateChange,
  onViewChange,
  currentView,
}: FullCalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const { openCreateModal, openEditModal } = useAppointmentStore()
  const updateMutation = useUpdateAppointment()

  // ─── Is this a resource view? ─────────────────────────────────────
  const isResourceView =
    currentView === 'resourceTimeGridDay' ||
    currentView === 'resourceTimeGridWeek'

  // ─── Sync selectedDate → FullCalendar ─────────────────────────────

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      const currentCalDate = api.getDate()
      if (currentCalDate.toDateString() !== selectedDate.toDateString()) {
        api.gotoDate(selectedDate)
      }
    }
  }, [selectedDate])

  // ─── Sync currentView → FullCalendar ──────────────────────────────

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (api && api.view.type !== currentView) {
      api.changeView(currentView)
    }
  }, [currentView])

  // ─── Map doctors → FullCalendar resources ─────────────────────────

  const resources = useMemo(() => {
    return doctors.map((doc, idx) => ({
      id: doc.id,
      title: doc.fullName,
      designation: doc.designation,
      color: DOCTOR_COLORS[idx % DOCTOR_COLORS.length],
      initials: doc.fullName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    }))
  }, [doctors])

  // ─── Map appointments → FullCalendar events ───────────────────────

  const calendarEvents = useMemo(() => {
    return appointments.map((appt) => {
      const colors =
        STATUS_FC_COLORS[appt.status] || STATUS_FC_COLORS.scheduled
      const isCancelled = appt.status === AppointmentStatus.CANCELLED
      const isNoShow = appt.status === AppointmentStatus.NO_SHOW
      const isTerminal =
        isCancelled ||
        isNoShow ||
        appt.status === AppointmentStatus.COMPLETED

      return {
        id: appt.id,
        title: appt.patient?.fullName || 'Unknown Patient',
        start: appt.startTime,
        end: appt.endTime,
        resourceId: appt.doctorId || undefined, // Assign to doctor column
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        editable: !isTerminal,
        classNames: [
          isCancelled ? 'fc-event-cancelled' : '',
          appt.isEmergency ? 'fc-event-emergency' : '',
        ].filter(Boolean),
        extendedProps: {
          appointment: appt,
          doctorId: appt.doctorId,
          patientId: appt.patientId,
          status: appt.status,
          type: appt.type,
          doctorName: appt.doctor?.fullName || 'Unassigned',
          isEmergency: appt.isEmergency,
          isWalkIn: appt.isWalkIn,
          durationMinutes: appt.durationMinutes,
          notes: appt.notes,
        },
      }
    })
  }, [appointments])

  // ─── Map availability → background events ─────────────────────────

  const backgroundEvents = useMemo(() => {
    return availability.map((block, idx) => ({
      id: `avail-${idx}`,
      start: block.start,
      end: block.end,
      resourceId: block.doctorId, // Tie to doctor column
      display: 'background' as const,
      backgroundColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      extendedProps: {
        isAvailability: true,
        doctorName: block.doctorName,
      },
    }))
  }, [availability])

  const allEvents = useMemo(
    () => [...calendarEvents, ...backgroundEvents],
    [calendarEvents, backgroundEvents],
  )

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleDateSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      const startTime = selectInfo.start.toISOString().slice(0, 16)
      // If resource view, pre-fill the doctor
      const doctorId = (selectInfo as any).resource?.id || undefined
      openCreateModal(doctorId, startTime)
      selectInfo.view.calendar.unselect()
    },
    [openCreateModal],
  )

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const appt = clickInfo.event.extendedProps.appointment as Appointment
      if (appt) {
        openEditModal(appt.id)
      }
    },
    [openEditModal],
  )

  const handleEventDrop = useCallback(
    async (dropInfo: EventDropArg) => {
      const appt = dropInfo.event.extendedProps.appointment as Appointment
      if (!appt) return

      const newStart = dropInfo.event.start
      if (!newStart) {
        dropInfo.revert()
        return
      }

      // If dropped to a different doctor column
      const newResource = (dropInfo as any).newResource
      const newDoctorId = newResource?.id || appt.doctorId

      try {
        await updateMutation.mutateAsync({
          id: appt.id,
          startTime: newStart.toISOString(),
          duration: appt.durationMinutes,
          doctorId: newDoctorId,
        })
        toast.success(
          newResource
            ? `Reassigned to Dr. ${newResource.title}`
            : 'Appointment rescheduled',
        )
      } catch (err: any) {
        dropInfo.revert()
        toast.error(
          err?.response?.data?.message || 'Failed to reschedule',
        )
      }
    },
    [updateMutation],
  )

  const handleEventResize = useCallback(
    async (resizeInfo: any) => {
      const appt = resizeInfo.event.extendedProps.appointment as Appointment
      if (!appt) return

      const newStart = resizeInfo.event.start
      const newEnd = resizeInfo.event.end
      if (!newStart || !newEnd) {
        resizeInfo.revert()
        return
      }

      const newDuration = Math.round(
        (newEnd.getTime() - newStart.getTime()) / 60000,
      )

      try {
        await updateMutation.mutateAsync({
          id: appt.id,
          startTime: newStart.toISOString(),
          duration: newDuration,
        })
        toast.success(`Duration updated to ${newDuration} min`)
      } catch (err: any) {
        resizeInfo.revert()
        toast.error(err?.response?.data?.message || 'Failed to update')
      }
    },
    [updateMutation],
  )

  // ─── Custom Resource Header ───────────────────────────────────────

  const renderResourceLabel = useCallback((info: any) => {
    const resource = info.resource
    const color = resource.extendedProps?.color || '#3b82f6'
    const initials = resource.extendedProps?.initials || '?'
    const designation = resource.extendedProps?.designation || ''

    return (
      <div className="flex items-center gap-2.5 py-1.5 px-1">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {resource.title}
          </p>
          {designation && (
            <p className="text-[10px] text-muted-foreground truncate leading-tight">
              {designation}
            </p>
          )}
        </div>
      </div>
    )
  }, [])

  // ─── Custom Event Content ─────────────────────────────────────────

  const renderEventContent = useCallback(
    (eventInfo: EventContentArg) => {
      const props = eventInfo.event.extendedProps
      if (props.isAvailability) return null

      const appt = props.appointment as Appointment | undefined
      if (!appt) return null

      const isTimeGrid = eventInfo.view.type.includes('timeGrid') || eventInfo.view.type.includes('TimeGrid')
      const statusLabel =
        STATUS_LABELS[appt.status as AppointmentStatus] || appt.status
      const colors =
        STATUS_FC_COLORS[appt.status as AppointmentStatus] ||
        STATUS_FC_COLORS.scheduled

      if (isTimeGrid) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full h-full px-1.5 py-1 overflow-hidden cursor-pointer">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[11px] truncate leading-tight">
                      {appt.patient?.fullName || 'Unknown'}
                    </span>
                    {appt.isEmergency && (
                      <span className="text-[10px]">🚨</span>
                    )}
                    {appt.isWalkIn && (
                      <span className="text-[10px]">🚶</span>
                    )}
                  </div>
                  {/* In resource view, don't show doctor name (it's the column) */}
                  {!isResourceView && (
                    <div className="text-[10px] opacity-75 truncate mt-0.5">
                      Dr. {props.doctorName}
                    </div>
                  )}
                  {appt.durationMinutes >= 30 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: colors.border }}
                      />
                      <span className="text-[9px] opacity-60 capitalize">
                        {statusLabel}
                      </span>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[280px]">
                <div className="space-y-1.5 text-xs">
                  <p className="font-semibold text-sm">
                    {appt.patient?.fullName}
                  </p>
                  <p className="text-muted-foreground">
                    Dr. {props.doctorName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: colors.border }}
                    />
                    <span className="capitalize">{statusLabel}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="capitalize">
                      {appt.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {new Date(appt.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' — '}
                    {new Date(appt.endTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' '}({appt.durationMinutes} min)
                  </p>
                  {appt.notes && (
                    <p className="text-muted-foreground italic border-t pt-1 mt-1">
                      {appt.notes}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }

      // Month / daygrid → compact
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-1 py-0.5 truncate cursor-pointer">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colors.border }}
                />
                <span className="text-[10px] font-medium truncate">
                  {eventInfo.timeText} {appt.patient?.fullName}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px]">
              <div className="space-y-1 text-xs">
                <p className="font-semibold">{appt.patient?.fullName}</p>
                <p>
                  Dr. {props.doctorName} • {statusLabel}
                </p>
                <p className="text-muted-foreground">
                  {new Date(appt.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' — '}
                  {new Date(appt.endTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
    [isResourceView],
  )

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div
      className="flex-1 bg-card border rounded-xl overflow-hidden fc-wrapper"
      style={{ minHeight: 600 }}
    >
      <style>{`
        .fc-wrapper .fc {
          --fc-border-color: var(--border);
          --fc-today-bg-color: var(--accent);
          --fc-page-bg-color: var(--background);
          --fc-neutral-bg-color: var(--muted);
          --fc-event-border-color: transparent;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .fc-wrapper .fc .fc-toolbar {
          display: none !important;
        }
        .fc-wrapper .fc .fc-col-header-cell {
          padding: 10px 4px;
          background: var(--muted);
          font-size: 12px;
          font-weight: 600;
          color: var(--muted-foreground);
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        /* ─── Resource column header ─── */
        .fc-wrapper .fc .fc-resource-header {
          background: var(--muted) !important;
        }
        .fc-wrapper .fc .fc-datagrid-cell-frame {
          padding: 4px 8px;
        }
        .fc-wrapper .fc .fc-resource-group {
          background: var(--muted);
        }
        .fc-wrapper .fc .fc-col-header-cell.fc-resource {
          padding: 8px 4px;
          background: var(--muted);
          border-bottom: 2px solid var(--border);
        }
        /* ─── Time grid slots ─── */
        .fc-wrapper .fc .fc-timegrid-slot {
          height: 48px;
        }
        .fc-wrapper .fc .fc-timegrid-slot-label {
          font-size: 10px;
          color: var(--muted-foreground);
          font-weight: 500;
          vertical-align: top;
          padding-top: 2px;
        }
        /* ─── Events ─── */
        .fc-wrapper .fc .fc-timegrid-event {
          border-radius: 6px;
          border-width: 2px;
          border-left-width: 3px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .fc-wrapper .fc .fc-timegrid-event:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transform: translateY(-1px);
          z-index: 10 !important;
        }
        .fc-wrapper .fc .fc-daygrid-event {
          border-radius: 4px;
          border-width: 0;
          margin: 1px 2px;
        }
        .fc-wrapper .fc .fc-daygrid-day-number {
          font-size: 13px;
          font-weight: 500;
          padding: 6px 8px;
        }
        .fc-wrapper .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          background: var(--primary);
          color: var(--primary-foreground);
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 4px;
        }
        .fc-wrapper .fc .fc-event-cancelled {
          opacity: 0.45;
          text-decoration: line-through;
        }
        .fc-wrapper .fc .fc-event-emergency {
          animation: emergency-pulse 2s ease-in-out infinite;
        }
        @keyframes emergency-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        .fc-wrapper .fc .fc-timegrid-now-indicator-line {
          border-color: #ef4444;
          border-width: 2px;
        }
        .fc-wrapper .fc .fc-timegrid-now-indicator-arrow {
          border-color: #ef4444;
        }
        .fc-wrapper .fc .fc-bg-event {
          opacity: 0.12;
        }
        .fc-wrapper .fc .fc-scrollgrid {
          border: none;
        }
        .fc-wrapper .fc td, .fc-wrapper .fc th {
          border-color: var(--border);
        }
        .fc-wrapper .fc .fc-timegrid-event .fc-event-main {
          padding: 0;
        }
        /* Resource column borders */
        .fc-wrapper .fc .fc-timegrid-col {
          border-right: 1px solid var(--border);
        }
        .fc-wrapper .fc .fc-timegrid-col:last-child {
          border-right: none;
        }
      `}</style>
      <FullCalendar
        ref={calendarRef}
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin,
          resourceTimeGridPlugin,
          resourceDayGridPlugin,
        ]}
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        initialView={currentView}
        initialDate={selectedDate}
        events={allEvents}
        resources={resources}
        headerToolbar={false}
        height="auto"
        contentHeight="auto"
        // ─── Resource settings ──────────────────────────
        resourceLabelContent={renderResourceLabel}
        resourceOrder="title"
        datesAboveResources={true}
        // ─── Time grid settings ─────────────────────────
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        slotDuration="00:15:00"
        slotLabelInterval="01:00:00"
        allDaySlot={false}
        nowIndicator={true}
        // ─── Interaction ────────────────────────────────
        editable={true}
        selectable={true}
        selectMirror={true}
        eventResizableFromStart={false}
        snapDuration="00:15:00"
        select={handleDateSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        // ─── Custom rendering ───────────────────────────
        eventContent={renderEventContent}
        // ─── Date change sync ───────────────────────────
        datesSet={(dateInfo) => {
          onDateChange(dateInfo.start)
          onViewChange(dateInfo.view.type)
        }}
        // ─── Other ──────────────────────────────────────
        dayMaxEvents={4}
        moreLinkText={(n) => `+${n} more`}
        eventMaxStack={3}
        weekNumbers={false}
        fixedWeekCount={false}
      />
    </div>
  )
}
