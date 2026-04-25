import { useMemo } from 'react'
import {
  type Appointment,
  type Doctor,
  HOURS,
  HOUR_HEIGHT,
  MINUTE_HEIGHT,
} from '@/features/appointments/types'
import { AppointmentCard } from './AppointmentCard'
import { useAppointmentStore } from '@/store/appointment-store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface TimelineGridProps {
  appointments: Appointment[]
  doctors: Doctor[]
  selectedDate: Date
}

export function TimelineGrid({
  appointments,
  doctors,
  selectedDate,
}: TimelineGridProps) {
  const { openCreateModal } = useAppointmentStore()

  // Group appointments by doctor
  const appointmentsByDoctor = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    doctors.forEach((d) => map.set(d.id, []))
    appointments.forEach((a) => {
      if (a.doctorId && map.has(a.doctorId)) {
        map.get(a.doctorId)!.push(a)
      }
    })
    return map
  }, [appointments, doctors])

  // Current time indicator
  const now = new Date()
  const isToday = selectedDate.toDateString() === now.toDateString()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const firstHour = HOURS[0]
  const nowOffset = (nowMinutes - firstHour * 60) * MINUTE_HEIGHT

  const handleGridClick = (
    doctorId: string,
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutesFromTop = y / MINUTE_HEIGHT
    const totalMinutes = firstHour * 60 + minutesFromTop

    // Snap to 15 minute intervals
    const snappedMinutes = Math.round(totalMinutes / 15) * 15
    const hour = Math.floor(snappedMinutes / 60)
    const minute = snappedMinutes % 60

    const clickDate = new Date(selectedDate)
    clickDate.setHours(hour, minute, 0, 0)

    openCreateModal(doctorId, clickDate.toISOString().slice(0, 16))
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const colWidth = doctors.length <= 3 ? 'minmax(220px, 1fr)' : 'minmax(180px, 1fr)'

  return (
    <div className="flex-1 overflow-auto border rounded-xl bg-white">
      {/* Doctor Header Columns */}
      <div
        className="sticky top-0 z-20 bg-white border-b grid"
        style={{
          gridTemplateColumns: `64px repeat(${doctors.length}, ${colWidth})`,
        }}
      >
        <div className="p-3 border-r bg-gray-50/80" />
        {doctors.map((doc) => (
          <div
            key={doc.id}
            className="px-3 py-3 border-r last:border-r-0 flex items-center gap-2.5 bg-gray-50/80"
          >
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(doc.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {doc.fullName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {doc.designation}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `64px repeat(${doctors.length}, ${colWidth})`,
        }}
      >
        {/* Time Labels */}
        <div className="relative border-r bg-gray-50/50">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="border-b border-dashed border-gray-100 flex items-start justify-end pr-2 pt-0.5"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {hour === 0
                  ? '12 AM'
                  : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                      ? '12 PM'
                      : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Doctor Columns */}
        {doctors.map((doc) => (
          <div
            key={doc.id}
            className="relative border-r last:border-r-0 cursor-crosshair"
            onClick={(e) => handleGridClick(doc.id, e)}
          >
            {/* Hour gridlines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-b border-dashed border-gray-100"
                style={{ height: HOUR_HEIGHT }}
              >
                {/* Half-hour line */}
                <div
                  className="border-b border-dotted border-gray-50"
                  style={{ height: HOUR_HEIGHT / 2 }}
                />
              </div>
            ))}

            {/* Appointments */}
            {(appointmentsByDoctor.get(doc.id) || []).map((appt) => {
              const apptStart = new Date(appt.startTime)
              const apptMinutesFromTop =
                (apptStart.getHours() * 60 +
                  apptStart.getMinutes() -
                  firstHour * 60) *
                MINUTE_HEIGHT
              const apptHeight = appt.durationMinutes * MINUTE_HEIGHT

              return (
                <div
                  key={appt.id}
                  className="absolute left-1 right-1"
                  style={{
                    top: apptMinutesFromTop,
                    height: Math.max(apptHeight, 24),
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <AppointmentCard
                    appointment={appt}
                    compact={appt.durationMinutes <= 15}
                    style={{ height: '100%' }}
                  />
                </div>
              )
            })}
          </div>
        ))}

        {/* Current time indicator */}
        {isToday && nowOffset > 0 && nowOffset < HOURS.length * HOUR_HEIGHT && (
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: nowOffset }}
          >
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-red-500 ml-[58px] -mr-1 z-10" />
              <div className="flex-1 border-t-2 border-red-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
