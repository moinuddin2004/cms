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
  AppointmentStatus,
  NOT_ARRIVED_STATUSES,
} from '@/features/appointments/types'
import type { Appointment, Doctor } from '@/features/appointments/types'
import type { AvailabilityBlock } from '@/features/appointments/services/appointments.api'
import { useAppointmentStore } from '@/store/appointment-store'
import { useUpdateAppointment } from '@/features/appointments/hooks/useUpdateAppointment'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  calendarDateToYmd,
  fromCalendarDate,
  toCalendarTime,
} from '@/features/appointments/utils/datetime'
import {
  clinicInputToUtc,
  dateToYmd,
  formatInClinic,
  useClinicTimezone,
  ymdToDate,
} from '@/lib/datetime'

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

function getCssVar(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

function getStatusColors(status: AppointmentStatus) {
  const map: Record<
    AppointmentStatus,
    { bg: string; border: string; text: string }
  > = {
    [AppointmentStatus.SCHEDULED]: {
      bg: getCssVar('--primary-soft') || '#dbeafe',
      border: getCssVar('--primary') || '#3b82f6',
      text: getCssVar('--primary-text') || '#1e40af',
    },
    [AppointmentStatus.CONFIRMED]: {
      bg: getCssVar('--violet-soft') || '#ede9fe',
      border: getCssVar('--violet') || '#8b5cf6',
      text: getCssVar('--violet') || '#5b21b6',
    },
    [AppointmentStatus.CHECKED_IN]: {
      bg: getCssVar('--amber-soft') || '#fef9c3',
      border: getCssVar('--amber') || '#eab308',
      text: getCssVar('--amber') || '#854d0e',
    },
    [AppointmentStatus.COMPLETED]: {
      bg: getCssVar('--emerald-soft') || '#dcfce7',
      border: getCssVar('--emerald') || '#22c55e',
      text: getCssVar('--emerald') || '#166534',
    },
    [AppointmentStatus.CANCELLED]: {
      bg: getCssVar('--danger-soft') || '#fee2e2',
      border: getCssVar('--danger') || '#ef4444',
      text: getCssVar('--danger') || '#991b1b',
    },
    [AppointmentStatus.NO_SHOW]: {
      bg: getCssVar('--panel-2') || '#f3f4f6',
      border: getCssVar('--border') || '#6b7280',
      text: getCssVar('--text-3') || '#374151',
    },
  }
  return map[status]
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.CONFIRMED]: 'Confirmed',
  [AppointmentStatus.CHECKED_IN]: 'Checked in',
  [AppointmentStatus.COMPLETED]: 'Completed',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.NO_SHOW]: 'No Show',
}

function getDoctorColors(): string[] {
  return [
    getCssVar('--primary') || '#3b82f6',
    getCssVar('--violet') || '#8b5cf6',
    getCssVar('--danger') || '#ec4899',
    getCssVar('--amber') || '#f59e0b',
    getCssVar('--emerald') || '#10b981',
    getCssVar('--primary') || '#06b6d4',
    getCssVar('--danger') || '#ef4444',
    getCssVar('--violet') || '#6366f1',
  ]
}

/** "Now" on the clinic clock (drives the now-indicator and today highlight). */
const calendarNow = () => toCalendarTime(Date.now())

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
  const { openCreateModal, openDetailModal } = useAppointmentStore()
  const updateMutation = useUpdateAppointment()
  // Event times are clinic wall times — rebuild them if the zone changes.
  const clinicTz = useClinicTimezone()

  // ─── Is this a resource view? ─────────────────────────────────────
  const isResourceView =
    currentView === 'resourceTimeGridDay' ||
    currentView === 'resourceTimeGridWeek'

  // ─── Sync selectedDate → FullCalendar ─────────────────────────────

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      const target = dateToYmd(selectedDate)
      if (calendarDateToYmd(api.getDate()) !== target) {
        api.gotoDate(target)
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
    const docColors = getDoctorColors()
    return doctors.map((doc, idx) => ({
      id: doc.id,
      title: doc.fullName,
      designation: doc.designation,
      color: docColors[idx % docColors.length],
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
      const colors = getStatusColors(appt.status)
      const isCancelled = appt.status === AppointmentStatus.CANCELLED
      // Only bookings not yet checked in can be dragged or resized; a
      // checked-in patient is locked to their queue position.
      const isMovable = NOT_ARRIVED_STATUSES.includes(appt.status)

      return {
        id: appt.id,
        title: appt.patient?.fullName || 'Unknown Patient',
        start: toCalendarTime(appt.startTime),
        end: toCalendarTime(appt.endTime),
        resourceId: appt.doctorId || undefined, // Assign to doctor column
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        editable: isMovable,
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
          durationMinutes: appt.durationMinutes,
          notes: appt.notes,
        },
      }
    })
  }, [appointments, clinicTz])

  // ─── Map availability → background events ─────────────────────────

  const backgroundEvents = useMemo(() => {
    return availability.map((block, idx) => ({
      id: `avail-${idx}`,
      start: toCalendarTime(block.start),
      end: toCalendarTime(block.end),
      resourceId: block.doctorId, // Tie to doctor column
      display: 'background' as const,
      backgroundColor: getCssVar('--emerald-soft') || '#f0fdf4',
      borderColor: getCssVar('--emerald') || '#bbf7d0',
      extendedProps: {
        isAvailability: true,
        doctorName: block.doctorName,
      },
    }))
  }, [availability, clinicTz])

  const allEvents = useMemo(
    () => [...calendarEvents, ...backgroundEvents],
    [calendarEvents, backgroundEvents],
  )

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleDateSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      const startTime = fromCalendarDate(selectInfo.start)
      // If resource view, pre-fill the doctor
      const doctorId = (selectInfo as any).resource?.id || undefined
      openCreateModal(doctorId, startTime)
      selectInfo.view.calendar.unselect()
    },
    [openCreateModal],
  )

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const appt = clickInfo.event.extendedProps.appointment as
        | Appointment
        | undefined
      if (appt) {
        // Open the read-only detail modal first; doctors can jump to Edit
        // or the patient record from there.
        openDetailModal(appt.id)
      }
    },
    [openDetailModal],
  )

  const handleEventDrop = useCallback(
    async (dropInfo: EventDropArg) => {
      const appt = dropInfo.event.extendedProps.appointment as
        | Appointment
        | undefined
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
          startTime: clinicInputToUtc(fromCalendarDate(newStart)),
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
        toast.error(err?.response?.data?.message || 'Failed to reschedule')
      }
    },
    [updateMutation],
  )

  const handleEventResize = useCallback(
    async (resizeInfo: any) => {
      const appt = resizeInfo.event.extendedProps.appointment as
        | Appointment
        | undefined
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
          startTime: clinicInputToUtc(fromCalendarDate(newStart)),
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
    const color =
      resource.extendedProps?.color || getCssVar('--primary') || '#3b82f6'
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

      const isTimeGrid =
        eventInfo.view.type.includes('timeGrid') ||
        eventInfo.view.type.includes('TimeGrid')
      const statusLabel = STATUS_LABELS[appt.status] || appt.status
      const colors = getStatusColors(appt.status)

      if (isTimeGrid) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full h-full px-1.5 py-1 overflow-hidden cursor-pointer">
                  <div className="flex items-center gap-1">
                    {appt.queueEntry && (
                      <span className="text-[9px] font-bold bg-black/10 rounded px-1 tabular-nums leading-tight">
                        {appt.queueEntry.token}
                      </span>
                    )}
                    <span className="font-semibold text-[11px] truncate leading-tight">
                      {appt.patient?.fullName || 'Unknown'}
                    </span>
                    {appt.isEmergency && (
                      <span className="text-[10px]">🚨</span>
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
                    {formatInClinic(appt.startTime, 'hh:mm a')}
                    {' — '}
                    {formatInClinic(appt.endTime, 'hh:mm a')} (
                    {appt.durationMinutes} min)
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
                  {formatInClinic(appt.startTime, 'hh:mm a')}
                  {' — '}
                  {formatInClinic(appt.endTime, 'hh:mm a')}
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
    <div className="flex-1 bg-card border rounded-xl overflow-hidden fc-wrapper">
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
        /* 30-min slot at 28px → ~1344px for 24h, manageable inside a scroll
           container without overwhelming the page. */
        .fc-wrapper .fc .fc-timegrid-slot {
          height: 28px;
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
          border-color: var(--danger);
          border-width: 2px;
        }
        .fc-wrapper .fc .fc-timegrid-now-indicator-arrow {
          border-color: var(--danger);
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
        initialDate={dateToYmd(selectedDate)}
        // Fed clinic wall times (see utils/datetime) — shows the clinic clock.
        timeZone="UTC"
        now={calendarNow}
        events={allEvents}
        resources={resources}
        headerToolbar={false}
        // Fixed height so the grid has its own scroll container — required
        // for `scrollTime` to land at 8 AM instead of midnight when the user
        // opens a 24-hour day/week view.
        height={720}
        // ─── Resource settings ──────────────────────────
        resourceLabelContent={renderResourceLabel}
        resourceOrder="title"
        datesAboveResources={true}
        // ─── Time grid settings ─────────────────────────
        // Full 24-hour grid — appointments outside clinic hours (late-night
        // emergencies, early-morning slots) must still be visible.
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        scrollTime="08:00:00"
        scrollTimeReset={false}
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
        // Use `view.currentStart` (actual first day of the month / week / day)
        // — NOT `dateInfo.start`, which in month view is the first cell of the
        // visible 6-week grid and usually sits in the previous month. Writing
        // that back into selectedDate and re-syncing was pulling the calendar
        // a month backwards, making forward navigation feel stuck.
        datesSet={(dateInfo) => {
          onDateChange(ymdToDate(calendarDateToYmd(dateInfo.view.currentStart)))
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
