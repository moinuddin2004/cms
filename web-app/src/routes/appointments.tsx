import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  List,
  Loader2,
  ListChecks,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAppointments } from '@/features/appointments/hooks/useAppointments'
import { useDoctors } from '@/features/appointments/hooks/useDoctors'
import { useAppointmentStats } from '@/features/appointments/hooks/useAppointmentStats'
import { useQuery } from '@tanstack/react-query'
import { fetchAvailability } from '@/features/appointments/services/appointments.api'
import { useAppointmentStore } from '@/store/appointment-store'
import { FullCalendarView } from '@/features/appointments/components/FullCalendarView'
import { StatsCards } from '@/features/appointments/components/StatsCards'
import { AppointmentModal } from '@/features/appointments/components/AppointmentModal'
import { AppointmentDetailModal } from '@/features/appointments/components/AppointmentDetailModal'
import { AppointmentsList } from '@/features/appointments/components/AppointmentsList'
import { QueueView } from '@/features/appointments/components/QueueView'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/appointments')({
  component: () => (
    <RequireFeaturePage feature="appointments.core">
      <AppointmentsPage />
    </RequireFeaturePage>
  ),
})

type CalendarView =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'resourceTimeGridDay'
  | 'resourceTimeGridWeek'

const VIEW_LABELS: Record<string, string> = {
  dayGridMonth: 'Month',
  resourceTimeGridWeek: 'Week',
  resourceTimeGridDay: 'Day',
}

function AppointmentsPage() {
  const { selectedDate, setSelectedDate, openCreateModal } =
    useAppointmentStore()
  // Default to the queue — the day-to-day reception/doctor driver.
  const [viewMode, setViewMode] = useState<'queue' | 'list' | 'calendar'>(
    'queue',
  )
  const [calendarView, setCalendarView] = useState<CalendarView>(
    'resourceTimeGridDay',
  )

  // ─── Compute calendar date range (only used in calendar mode) ──────
  const { rangeStart, rangeEnd } = useMemo(() => {
    const d = new Date(selectedDate)

    if (calendarView === 'dayGridMonth') {
      const start = new Date(d.getFullYear(), d.getMonth(), -7)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 14)
      return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() }
    }

    if (
      calendarView === 'resourceTimeGridWeek' ||
      calendarView === 'timeGridWeek'
    ) {
      const start = new Date(d)
      start.setDate(d.getDate() - d.getDay())
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() }
    }

    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() }
  }, [selectedDate, calendarView])

  // Stats = current month around the selected date.
  const monthStart = useMemo(() => {
    const d = new Date(selectedDate)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [selectedDate])

  const monthEnd = useMemo(() => {
    const d = new Date(selectedDate)
    d.setMonth(d.getMonth() + 1, 0)
    d.setHours(23, 59, 59, 999)
    return d.toISOString()
  }, [selectedDate])

  // ─── Data ─────────────────────────────────────────────────────────
  // Calendar appointments — only fetched in calendar mode. (List view has
  // its own self-contained fetch driven by its own filters.)
  const { data: appointmentsData, isLoading: loadingAppts } = useAppointments({
    startDate: rangeStart,
    endDate: rangeEnd,
    limit: 500,
  })

  const { data: doctors = [], isLoading: loadingDoctors } = useDoctors()
  const { data: stats, isLoading: loadingStats } = useAppointmentStats(
    monthStart,
    monthEnd,
  )

  const { data: availability = [] } = useQuery({
    queryKey: ['appointment-availability', rangeStart, rangeEnd],
    queryFn: () => fetchAvailability(rangeStart, rangeEnd),
    enabled: viewMode === 'calendar',
  })

  const appointments = appointmentsData?.data || []

  // ─── Calendar navigation ──────────────────────────────────────────
  const navigateDate = useCallback(
    (dir: number) => {
      const d = new Date(selectedDate)
      if (calendarView === 'dayGridMonth') {
        // Anchor on the 1st of the displayed month so adding/subtracting a
        // month is unambiguous (avoids "May 31 + 1 month = July 1" surprises).
        d.setDate(1)
        d.setMonth(d.getMonth() + dir)
      } else if (
        calendarView === 'resourceTimeGridWeek' ||
        calendarView === 'timeGridWeek'
      ) {
        d.setDate(d.getDate() + dir * 7)
      } else {
        d.setDate(d.getDate() + dir)
      }
      setSelectedDate(d)
    },
    [selectedDate, calendarView, setSelectedDate],
  )

  const goToToday = () => setSelectedDate(new Date())
  const isToday = selectedDate.toDateString() === new Date().toDateString()

  const formatDateLabel = (d: Date) => {
    if (calendarView === 'dayGridMonth') {
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    }
    if (
      calendarView === 'resourceTimeGridWeek' ||
      calendarView === 'timeGridWeek'
    ) {
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
      return `${weekStart.toLocaleDateString('en-US', opts)} — ${weekEnd.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
    }
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <DashboardLayout
      title="Appointments"
      subtitle="Search, schedule, and update patient appointments."
      actions={
        <>
          {/* View toggle — always visible */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('queue')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'queue'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-accent',
              )}
              aria-label="Queue view"
            >
              <ListChecks className="w-3.5 h-3.5" />
              Queue
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-accent',
              )}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'calendar'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-accent',
              )}
              aria-label="Calendar view"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>

          <Button onClick={() => openCreateModal()} className="gap-2">
            <Plus className="w-4 h-4" />
            New Appointment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* ── Stats ──────────────────────────────────── */}
        <StatsCards stats={stats} isLoading={loadingStats} />

        {/* ── Body ───────────────────────────────────── */}
        {viewMode === 'queue' ? (
          <QueueView />
        ) : viewMode === 'list' ? (
          <AppointmentsList />
        ) : (
          <>
            {/* Calendar toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateDate(-1)}
                  className="h-8 w-8"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <button
                  onClick={goToToday}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isToday
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent text-foreground hover:bg-accent/80',
                  )}
                >
                  Today
                </button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateDate(1)}
                  className="h-8 w-8"
                  aria-label="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="text-sm font-semibold text-foreground ml-2">
                  {formatDateLabel(selectedDate)}
                </span>
              </div>

              <div className="flex border rounded-lg overflow-hidden">
                {(Object.keys(VIEW_LABELS) as CalendarView[]).map((view) => (
                  <button
                    key={view}
                    onClick={() => setCalendarView(view)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-colors',
                      calendarView === view
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {VIEW_LABELS[view]}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            {loadingAppts || loadingDoctors ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <FullCalendarView
                appointments={appointments}
                doctors={doctors}
                availability={availability}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onViewChange={(v) => setCalendarView(v as CalendarView)}
                currentView={calendarView}
              />
            )}
          </>
        )}
      </div>

      <AppointmentModal />
      <AppointmentDetailModal />
    </DashboardLayout>
  )
}
