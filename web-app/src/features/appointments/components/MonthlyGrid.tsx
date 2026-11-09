import { useMemo } from 'react'
import {
  
  AppointmentStatus,
  STATUS_BG_COLORS
} from '@/features/appointments/types'
import type {Appointment} from '@/features/appointments/types';
import { useAppointmentStore } from '@/store/appointment-store'
import {
  dateToYmd,
  formatInClinic,
  toClinicYmd,
  todayYmd,
} from '@/lib/datetime'

interface MonthlyGridProps {
  appointments: Appointment[]
  selectedDate: Date
}

export function MonthlyGrid({ appointments, selectedDate }: MonthlyGridProps) {
  const { openCreateModal, openEditModal } = useAppointmentStore()

  const { days, startEmptyCells } = useMemo(() => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()

    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)

    const startEmptyCells = firstDay.getDay() // 0 for Sunday
    const daysInMonth = lastDay.getDate()

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1)
      const ymd = dateToYmd(date)
      // Bucket by the clinic calendar day the appointment starts on.
      const dayAppts = appointments.filter(
        (a) => toClinicYmd(a.startTime) === ymd,
      )
      return { date, appointments: dayAppts }
    })

    return { days, startEmptyCells }
  }, [appointments, selectedDate])

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = todayYmd()

  return (
    <div className="flex-1 flex flex-col border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b bg-muted/80">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {Array.from({ length: startEmptyCells }).map((_, i) => (
          <div key={`empty-${i}`} className="border-r border-b bg-muted/30" />
        ))}

        {days.map(({ date, appointments }) => {
          const isToday = dateToYmd(date) === today

          return (
            <div
              key={date.toISOString()}
              className={`border-r border-b p-1.5 flex flex-col min-h-[100px] hover:bg-muted cursor-pointer ${isToday ? 'bg-primary/10' : ''}`}
              onClick={() => {
                // 09:00 on that day, clinic wall time.
                openCreateModal(undefined, `${dateToYmd(date)}T09:00`)
              }}
            >
              <div className="flex justify-between items-center mb-1 px-1">
                <span
                  className={`text-xs font-medium ${isToday ? 'bg-primary text-primary-foreground w-5 h-5 flex items-center justify-center rounded-full' : 'text-foreground'}`}
                >
                  {date.getDate()}
                </span>
                {appointments.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {appointments.length} appts
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 pb-1">
                {appointments.slice(0, 4).map((appt) => {
                  const statusClass =
                    STATUS_BG_COLORS[appt.status] || STATUS_BG_COLORS.scheduled
                  const isCancelled =
                    appt.status === AppointmentStatus.CANCELLED
                  return (
                    <div
                      key={appt.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditModal(appt.id)
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate transition-colors hover:brightness-95 ${statusClass} ${isCancelled ? 'opacity-50 line-through' : ''}`}
                      title={`${formatInClinic(appt.startTime, 'hh:mm a')} - ${appt.patient?.fullName}`}
                    >
                      {formatInClinic(appt.startTime, 'hh:mm a')}{' '}
                      {appt.patient?.fullName}
                    </div>
                  )
                })}
                {appointments.length > 4 && (
                  <div className="text-[10px] text-center text-muted-foreground font-medium pt-0.5">
                    +{appointments.length - 4} more
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Fill remaining cells to complete the grid */}
        {Array.from({
          length: (7 - ((startEmptyCells + days.length) % 7)) % 7,
        }).map((_, i) => (
          <div
            key={`end-empty-${i}`}
            className="border-r border-b bg-muted/30"
          />
        ))}
      </div>
    </div>
  )
}
