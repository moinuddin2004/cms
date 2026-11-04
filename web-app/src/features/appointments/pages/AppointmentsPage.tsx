import { useState, useMemo, useCallback, useEffect } from 'react'
import { Can, useAccess } from '@/features/access'
import { Plus, CalendarDays, List, Loader2, ListChecks } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useAppointments } from '@/features/appointments/hooks/useAppointments'
import { useDoctors } from '@/features/appointments/hooks/useDoctors'
import { useAppointmentStats } from '@/features/appointments/hooks/useAppointmentStats'
import { fetchAvailability } from '@/features/appointments/services/appointments.api'
import { useAppointmentStore } from '@/store/appointment-store'
import { FullCalendarView } from '@/features/appointments/components/FullCalendarView'
import { StatsCards } from '@/features/appointments/components/StatsCards'
import { AppointmentModal } from '@/features/appointments/components/AppointmentModal'
import { AppointmentDetailModal } from '@/features/appointments/components/AppointmentDetailModal'
import { AppointmentsList } from '@/features/appointments/components/AppointmentsList'
import { QueueBoard } from '@/features/queue'
import { clinicDayBounds } from '@/lib/datetime'
import { AppointmentsToolbar } from '@/features/appointments/components/AppointmentsToolbar'
import {
  AppointmentFilters,
  matchesAppointmentSearch,
} from '@/features/appointments/components/AppointmentFilters'

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

export function AppointmentsPage() {
  const {
    selectedDate,
    setSelectedDate,
    doctorFilter,
    setDoctorFilter,
    openCreateModal,
  } = useAppointmentStore()
  const { create } = useSearch({ from: '/appointments' })
  const { can } = useAccess()
  // The route opens for either permission; each tab needs its own.
  const canSeeBoard = can('queue.board.view')
  const canSeeBookings = can('appointments.view')
  const [viewMode, setViewMode] = useState<'queue' | 'list' | 'calendar'>(
    canSeeBoard ? 'queue' : 'list',
  )

  const navigate = useNavigate()
  // `?create=1` (quick search action) opens the booking form — also when the
  // page is already open — then is cleared so it can fire again.
  useEffect(() => {
    if (create !== '1') return
    if (can('appointments.book')) openCreateModal()
    void navigate({ to: '/appointments', search: { create: undefined }, replace: true })
  }, [create])
  const [calendarView, setCalendarView] = useState<CalendarView>(
    'resourceTimeGridDay',
  )
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // selectedDate is a calendar day; the API gets that day's bounds on the
  // CLINIC's clock (location timezone), not the browser's.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const d = new Date(selectedDate)
    if (calendarView === 'dayGridMonth') {
      return {
        rangeStart: clinicDayBounds(new Date(d.getFullYear(), d.getMonth(), -7)).start,
        rangeEnd: clinicDayBounds(new Date(d.getFullYear(), d.getMonth() + 1, 14)).end,
      }
    }
    if (
      calendarView === 'resourceTimeGridWeek' ||
      calendarView === 'timeGridWeek'
    ) {
      const start = new Date(d)
      start.setDate(d.getDate() - d.getDay())
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return {
        rangeStart: clinicDayBounds(start).start,
        rangeEnd: clinicDayBounds(end).end,
      }
    }
    const { start, end } = clinicDayBounds(d)
    return { rangeStart: start, rangeEnd: end }
  }, [selectedDate, calendarView])

  const monthStart = useMemo(() => {
    const d = new Date(selectedDate)
    return clinicDayBounds(new Date(d.getFullYear(), d.getMonth(), 1)).start
  }, [selectedDate])

  const monthEnd = useMemo(() => {
    const d = new Date(selectedDate)
    return clinicDayBounds(new Date(d.getFullYear(), d.getMonth() + 1, 0)).end
  }, [selectedDate])

  const { data: appointmentsData, isLoading: loadingAppts } = useAppointments(
    {
      startDate: rangeStart,
      endDate: rangeEnd,
      limit: 500,
    },
    canSeeBookings,
  )
  const { data: doctors = [], isLoading: loadingDoctors } = useDoctors()
  const { data: stats, isLoading: loadingStats } = useAppointmentStats(
    monthStart,
    monthEnd,
    canSeeBookings,
  )
  const { data: availability = [] } = useQuery({
    queryKey: ['appointment-availability', rangeStart, rangeEnd],
    queryFn: () => fetchAvailability(rangeStart, rangeEnd),
    enabled: viewMode === 'calendar',
  })

  const appointments = appointmentsData?.data || []

  // Doctor filter → narrow the columns + events the calendar renders.
  const calendarDoctors = useMemo(
    () =>
      doctorFilter === 'all'
        ? doctors
        : doctors.filter((d) => d.id === doctorFilter),
    [doctors, doctorFilter],
  )
  const calendarAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          (doctorFilter === 'all' || a.doctorId === doctorFilter) &&
          (statusFilter === 'all' || a.status === statusFilter) &&
          (typeFilter === 'all' || a.type === typeFilter) &&
          matchesAppointmentSearch(a, searchInput),
      ),
    [appointments, doctorFilter, statusFilter, typeFilter, searchInput],
  )

  const hasActiveFilters =
    !!searchInput ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    doctorFilter !== 'all'

  const clearFilters = () => {
    setSearchInput('')
    setStatusFilter('all')
    setTypeFilter('all')
    setDoctorFilter('all')
  }
  const calendarAvailability = useMemo(
    () =>
      doctorFilter === 'all'
        ? availability
        : availability.filter((b) => b.doctorId === doctorFilter),
    [availability, doctorFilter],
  )

  const navigateDate = useCallback(
    (dir: number) => {
      const d = new Date(selectedDate)
      if (calendarView === 'dayGridMonth') {
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
      const opts: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
      }
      return `${weekStart.toLocaleDateString('en-US', opts)} — ${weekEnd.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
    }
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const viewToggle = (
    <div className="flex items-center rounded-lg border border-border bg-surface p-[3px]">
      {(
        [
          { key: 'queue', icon: ListChecks, label: 'Queue' },
          { key: 'list', icon: List, label: 'List' },
          { key: 'calendar', icon: CalendarDays, label: 'Calendar' },
        ] as const
      )
        .filter(({ key }) => (key === 'queue' ? canSeeBoard : canSeeBookings))
        .map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setViewMode(key)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === key
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-2 hover:text-foreground'
            }`}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
    </div>
  )

  return (
    <>
      <PageWrapper
        title="Appointments"
        subtitle="Search, schedule, and update patient appointments."
        actions={
          <div className="flex items-center gap-2.5">
            {viewToggle}
            <Can perm="appointments.book">
              <Button onClick={() => openCreateModal()} size="sm">
                <Plus className="size-3.5" />
                Create
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mt-5 space-y-4">
        {canSeeBookings && (
          <StatsCards stats={stats} isLoading={loadingStats} />
        )}

        {viewMode === 'queue' ? (
          <QueueBoard />
        ) : viewMode === 'list' ? (
          <AppointmentsList />
        ) : (
          <>
            <AppointmentsToolbar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              doctors={doctors}
              doctorFilter={doctorFilter}
              onDoctorChange={setDoctorFilter}
              isFetching={loadingAppts}
              onStepPrev={() => navigateDate(-1)}
              onStepNext={() => navigateDate(1)}
              label={formatDateLabel(selectedDate)}
              actions={
                <div className="flex items-center rounded-[9px] border border-border bg-surface p-[3px]">
                  {(Object.keys(VIEW_LABELS) as CalendarView[]).map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setCalendarView(view)}
                      className={`rounded-[7px] px-3 py-[5px] text-[13px] font-medium transition-colors ${
                        calendarView === view
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-text-2 hover:text-foreground'
                      }`}
                    >
                      {VIEW_LABELS[view]}
                    </button>
                  ))}
                </div>
              }
              filters={
                <AppointmentFilters
                  searchInput={searchInput}
                  onSearchChange={setSearchInput}
                  status={statusFilter}
                  onStatusChange={setStatusFilter}
                  type={typeFilter}
                  onTypeChange={setTypeFilter}
                  hasActiveFilters={hasActiveFilters}
                  onReset={clearFilters}
                  count={calendarAppointments.length}
                />
              }
            />

            {loadingAppts || loadingDoctors ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : (
              <FullCalendarView
                appointments={calendarAppointments}
                doctors={calendarDoctors}
                availability={calendarAvailability}
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
    </>
  )
}
