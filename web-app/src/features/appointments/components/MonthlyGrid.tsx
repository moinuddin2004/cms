import { useMemo } from 'react'
import { type Appointment, AppointmentStatus, STATUS_BG_COLORS } from '@/features/appointments/types'
import { useAppointmentStore } from '@/store/appointment-store'

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
      const dayAppts = appointments.filter((a) => {
        const aDate = new Date(a.startTime)
        return aDate.getDate() === date.getDate() && aDate.getMonth() === date.getMonth() && aDate.getFullYear() === date.getFullYear()
      })
      return { date, appointments: dayAppts }
    })
    
    return { days, startEmptyCells }
  }, [appointments, selectedDate])

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date()

  return (
    <div className="flex-1 flex flex-col border rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b bg-gray-50/80">
        {WEEKDAYS.map((day) => (
          <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      
      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {Array.from({ length: startEmptyCells }).map((_, i) => (
          <div key={`empty-${i}`} className="border-r border-b bg-gray-50/30" />
        ))}
        
        {days.map(({ date, appointments }) => {
          const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
          
          return (
            <div 
              key={date.toISOString()} 
              className={`border-r border-b p-1.5 flex flex-col min-h-[100px] hover:bg-gray-50 cursor-pointer ${isToday ? 'bg-blue-50/30' : ''}`}
              onClick={() => {
                const clickDate = new Date(date)
                clickDate.setHours(9, 0, 0, 0)
                openCreateModal(undefined, clickDate.toISOString().slice(0, 16))
              }}
            >
              <div className="flex justify-between items-center mb-1 px-1">
                <span className={`text-xs font-medium ${isToday ? 'bg-primary text-primary-foreground w-5 h-5 flex items-center justify-center rounded-full' : 'text-foreground'}`}>
                  {date.getDate()}
                </span>
                {appointments.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{appointments.length} appts</span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 pb-1">
                {appointments.slice(0, 4).map((appt) => {
                  const statusClass = STATUS_BG_COLORS[appt.status] || STATUS_BG_COLORS.scheduled
                  const isCancelled = appt.status === AppointmentStatus.CANCELLED
                  return (
                    <div
                      key={appt.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditModal(appt.id)
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate transition-colors hover:brightness-95 ${statusClass} ${isCancelled ? 'opacity-50 line-through' : ''}`}
                      title={`${new Date(appt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${appt.patient?.fullName}`}
                    >
                      {new Date(appt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {appt.patient?.fullName}
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
        {Array.from({ length: (7 - ((startEmptyCells + days.length) % 7)) % 7 }).map((_, i) => (
          <div key={`end-empty-${i}`} className="border-r border-b bg-gray-50/30" />
        ))}
      </div>
    </div>
  )
}
