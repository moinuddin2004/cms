import { useMemo } from 'react'
import { type Appointment, HOURS, HOUR_HEIGHT, MINUTE_HEIGHT } from '@/features/appointments/types'
import { AppointmentCard } from './AppointmentCard'
import { useAppointmentStore } from '@/store/appointment-store'
import { toDateTimeLocalValue } from '@/features/appointments/utils/datetime'
import { clinicDate, dateToYmd, nowInClinic, todayYmd } from '@/lib/datetime'

interface WeeklyGridProps {
  appointments: Appointment[]
  selectedDate: Date
}

export function WeeklyGrid({ appointments, selectedDate }: WeeklyGridProps) {
  const { openCreateModal } = useAppointmentStore()

  // Calculate the days of the week (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const days = []
    const startOfWeek = new Date(selectedDate)
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay()) // Go to Sunday
    startOfWeek.setHours(0, 0, 0, 0)
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      days.push(d)
    }
    return days
  }, [selectedDate])

  // Group appointments by day of week (0-6)
  const appointmentsByDay = useMemo(() => {
    const map = new Map<number, Appointment[]>()
    for (let i = 0; i < 7; i++) map.set(i, [])
    
    appointments.forEach((a) => {
      const day = clinicDate(a.startTime).getDay()
      map.get(day)!.push(a)
    })
    return map
  }, [appointments])

  // "Now" line and today highlight follow the clinic's clock
  const now = nowInClinic()
  const today = todayYmd()
  const firstHour = HOURS[0]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowOffset = (nowMinutes - firstHour * 60) * MINUTE_HEIGHT

  const handleGridClick = (date: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutesFromTop = y / MINUTE_HEIGHT
    const totalMinutes = firstHour * 60 + minutesFromTop

    const snappedMinutes = Math.round(totalMinutes / 15) * 15
    const hour = Math.floor(snappedMinutes / 60)
    const minute = snappedMinutes % 60

    // Cell date from local fields = clinic wall time (see toDateTimeLocalValue).
    const clickDate = new Date(date)
    clickDate.setHours(hour, minute, 0, 0)

    openCreateModal(undefined, toDateTimeLocalValue(clickDate))
  }

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="flex-1 overflow-auto border rounded-xl bg-card">
      {/* Header Columns */}
      <div className="sticky top-0 z-20 bg-card border-b flex">
        <div className="w-[64px] flex-shrink-0 border-r bg-muted/80" />
        {weekDays.map((date, i) => {
          const isToday = dateToYmd(date) === today
          return (
            <div key={i} className={`flex-1 min-w-[120px] p-2 border-r last:border-r-0 text-center ${isToday ? 'bg-primary/10' : 'bg-muted/80'}`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase">{WEEKDAYS[i]}</p>
              <p className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{date.getDate()}</p>
            </div>
          )
        })}
      </div>

      {/* Grid Body */}
      <div className="relative flex">
        {/* Time Labels */}
        <div className="w-[64px] flex-shrink-0 relative border-r bg-muted/50">
          {HOURS.map((hour) => (
            <div key={hour} className="border-b border-dashed border-gray-100 flex items-start justify-end pr-2 pt-0.5" style={{ height: HOUR_HEIGHT }}>
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Day Columns */}
        {weekDays.map((date, dayIndex) => {
          const isToday = dateToYmd(date) === today
          return (
            <div key={dayIndex} className="flex-1 min-w-[120px] relative border-r last:border-r-0 cursor-crosshair" onClick={(e) => handleGridClick(date, e)}>
              {HOURS.map((hour) => (
                <div key={hour} className="border-b border-dashed border-gray-100" style={{ height: HOUR_HEIGHT }}>
                  <div className="border-b border-dotted border-gray-50" style={{ height: HOUR_HEIGHT / 2 }} />
                </div>
              ))}

              {/* Appointments */}
              {(appointmentsByDay.get(dayIndex) || []).map((appt) => {
                const apptStart = clinicDate(appt.startTime)
                const apptMinutesFromTop = (apptStart.getHours() * 60 + apptStart.getMinutes() - firstHour * 60) * MINUTE_HEIGHT
                const apptHeight = appt.durationMinutes * MINUTE_HEIGHT

                return (
                  <div key={appt.id} className="absolute left-1 right-1" style={{ top: apptMinutesFromTop, height: Math.max(apptHeight, 24) }} onClick={(e) => e.stopPropagation()}>
                    <AppointmentCard appointment={appt} compact={appt.durationMinutes <= 15} style={{ height: '100%' }} />
                  </div>
                )
              })}

              {/* Current time indicator */}
              {isToday && nowOffset > 0 && nowOffset < HOURS.length * HOUR_HEIGHT && (
                <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowOffset }}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 z-10" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
