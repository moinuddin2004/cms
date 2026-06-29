import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  List,
  Loader2,
  ListChecks,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useSearch } from '@tanstack/react-router'
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
import { QueueView } from '@/features/appointments/components/QueueView'

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
  const { selectedDate, setSelectedDate, openCreateModal } =
    useAppointmentStore()
  const { create } = useSearch({ from: '/appointments' })
  const [viewMode, setViewMode] = useState<'queue' | 'list' | 'calendar'>(
    'queue',
  )

  useEffect(() => {
    if (create === '1') openCreateModal()
  }, []) // eslint-disable-line
  const [calendarView, setCalendarView] = useState<CalendarView>(
    'resourceTimeGridDay',
  )

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
      ).map(({ key, icon: Icon, label }) => (
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
            <Button onClick={() => openCreateModal()} size="sm">
              <Plus className="size-3.5" />
              Create
            </Button>
          </div>
        }
      />

      <div className="mt-5 space-y-4">
        <StatsCards stats={stats} isLoading={loadingStats} />

        {viewMode === 'queue' ? (
          <QueueView />
        ) : viewMode === 'list' ? (
          <AppointmentsList />
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateDate(-1)}
                  className="size-8"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <button
                  type="button"
                  onClick={goToToday}
                  className={`rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors ${
                    isToday
                      ? 'bg-primary text-white'
                      : 'bg-panel text-foreground hover:bg-panel-2'
                  }`}
                >
                  Today
                </button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateDate(1)}
                  className="size-8"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <span className="ml-2 text-sm font-semibold">
                  {formatDateLabel(selectedDate)}
                </span>
              </div>

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
            </div>

            {loadingAppts || loadingDoctors ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="size-8 animate-spin text-primary" />
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
    </>
  )
}
