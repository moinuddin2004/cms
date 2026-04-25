import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  List,
  Loader2,
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
import { AppointmentCard } from '@/features/appointments/components/AppointmentCard'
import {
  type AppointmentStatus as AppStatus,
  APPOINTMENT_STATUS_OPTIONS,
} from '@/features/appointments/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/appointments')({
  component: AppointmentsPage,
})

type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'resourceTimeGridDay' | 'resourceTimeGridWeek'

const VIEW_LABELS: Record<string, string> = {
  dayGridMonth: 'Month',
  resourceTimeGridWeek: 'Week',
  resourceTimeGridDay: 'Day',
}

function AppointmentsPage() {
  const { selectedDate, setSelectedDate, openCreateModal } =
    useAppointmentStore()
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('resourceTimeGridDay')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // ─── Compute date ranges based on calendar view ───────────────────

  const { rangeStart, rangeEnd } = useMemo(() => {
    const d = new Date(selectedDate)

    if (calendarView === 'dayGridMonth') {
      // Fetch 6 weeks around the month (FullCalendar may show prev/next month days)
      const start = new Date(d.getFullYear(), d.getMonth(), -7)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 14)
      return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() }
    }

    if (calendarView === 'resourceTimeGridWeek' || calendarView === 'timeGridWeek') {
      const start = new Date(d)
      start.setDate(d.getDate() - d.getDay())
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() }
    }

    // Day
    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() }
  }, [selectedDate, calendarView])

  // Stats range = current month
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

  // ─── Data fetching ────────────────────────────────────────────────

  const { data: appointmentsData, isLoading: loadingAppts } = useAppointments({
    startDate: rangeStart,
    endDate: rangeEnd,
    status: statusFilter !== 'all' ? (statusFilter as AppStatus) : undefined,
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
  })

  const appointments = appointmentsData?.data || []

  // ─── Navigation helpers ───────────────────────────────────────────

  const navigateDate = useCallback(
    (dir: number) => {
      const d = new Date(selectedDate)
      if (calendarView === 'dayGridMonth') {
        d.setMonth(d.getMonth() + dir)
      } else if (calendarView === 'resourceTimeGridWeek' || calendarView === 'timeGridWeek') {
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
    if (calendarView === 'resourceTimeGridWeek' || calendarView === 'timeGridWeek') {
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

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <DashboardLayout title="Appointments">
      <div className="flex flex-col h-full gap-4 p-4 lg:p-6">
        {/* ── Header ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Appointments
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage and schedule patient appointments
            </p>
          </div>
          <Button
            onClick={() => openCreateModal()}
            className="gap-2"
            size="default"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </Button>
        </div>

        {/* ── Stats ─────────────────────────────────────── */}
        <StatsCards stats={stats} isLoading={loadingStats} />

        {/* ── Toolbar ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border rounded-xl px-4 py-3">
          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate(-1)}
              className="h-8 w-8"
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
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground ml-2">
              {formatDateLabel(selectedDate)}
            </span>
          </div>

          {/* Filters & View */}
          <div className="flex items-center gap-2">
            {/* Calendar View Toggle (Day/Week/Month) */}
            <div className="flex border rounded-lg overflow-hidden mr-1">
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

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {APPOINTMENT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Calendar / List toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'calendar'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-accent',
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-accent',
                )}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────── */}
        {loadingAppts || loadingDoctors ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : viewMode === 'list' ? (
          /* ── List View ──────────────────────────────── */
          <div className="flex-1 overflow-auto">
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center gap-3 bg-card border rounded-xl py-16">
                <CalendarDays className="w-12 h-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">
                  No appointments found.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {appointments.map((appt) => (
                  <div key={appt.id} className="max-w-2xl">
                    <AppointmentCard appointment={appt} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── FullCalendar View ──────────────────────── */
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
      </div>

      {/* ── Modal ──────────────────────────────────────── */}
      <AppointmentModal />
    </DashboardLayout>
  )
}
