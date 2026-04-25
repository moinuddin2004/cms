import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
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
import { useAppointmentStore } from '@/store/appointment-store'
import { TimelineGrid } from '@/features/appointments/components/TimelineGrid'
import { WeeklyGrid } from '@/features/appointments/components/WeeklyGrid'
import { MonthlyGrid } from '@/features/appointments/components/MonthlyGrid'
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

function AppointmentsPage() {
  const { selectedDate, setSelectedDate, openCreateModal } =
    useAppointmentStore()
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [dateFilter, setDateFilter] = useState<'day' | 'week' | 'month'>('day')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Compute date range for the selected day/week/month
  const dayStart = useMemo(() => {
    const d = new Date(selectedDate)
    if (dateFilter === 'week') d.setDate(d.getDate() - d.getDay())
    else if (dateFilter === 'month') d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [selectedDate, dateFilter])

  const dayEnd = useMemo(() => {
    const d = new Date(selectedDate)
    if (dateFilter === 'week') d.setDate(d.getDate() - d.getDay() + 6)
    else if (dateFilter === 'month') d.setMonth(d.getMonth() + 1, 0)
    d.setHours(23, 59, 59, 999)
    return d.toISOString()
  }, [selectedDate, dateFilter])

  // Month range for stats
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
    startDate: dayStart,
    endDate: dayEnd,
    status: statusFilter !== 'all' ? (statusFilter as AppStatus) : undefined,
    limit: 200,
  })

  const { data: doctors = [], isLoading: loadingDoctors } = useDoctors()
  const { data: stats, isLoading: loadingStats } = useAppointmentStats(
    monthStart,
    monthEnd,
  )

  const appointments = appointmentsData?.data || []

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + dir)
    setSelectedDate(d)
  }

  const goToToday = () => setSelectedDate(new Date())

  const isToday = selectedDate.toDateString() === new Date().toDateString()

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border rounded-xl px-4 py-3">
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
              {formatDate(selectedDate)}
            </span>
          </div>

          {/* Filters & View */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle (Day/Week/Month) */}
            <div className="flex border rounded-lg overflow-hidden mr-2">
              <button
                onClick={() => setDateFilter('day')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  dateFilter === 'day' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground hover:bg-accent'
                )}
              >
                Day
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  dateFilter === 'week' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground hover:bg-accent'
                )}
              >
                Week
              </button>
              <button
                onClick={() => setDateFilter('month')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  dateFilter === 'month' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground hover:bg-accent'
                )}
              >
                Month
              </button>
            </div>

            {/* Date picker */}
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => {
                if (e.target.value)
                  setSelectedDate(new Date(e.target.value + 'T00:00:00'))
              }}
              className="h-8 px-2 text-xs border rounded-md bg-white"
            />

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

            {/* View toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'calendar'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-muted-foreground hover:bg-accent',
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
                    : 'bg-white text-muted-foreground hover:bg-accent',
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
              <div className="flex flex-col items-center justify-center text-center gap-3 bg-white border rounded-xl py-16">
                <CalendarDays className="w-12 h-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">
                  No appointments for this {dateFilter}.
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
        ) : dateFilter === 'month' ? (
          <MonthlyGrid appointments={appointments} selectedDate={selectedDate} />
        ) : dateFilter === 'week' ? (
          <WeeklyGrid appointments={appointments} selectedDate={selectedDate} />
        ) : doctors.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 bg-white border rounded-xl py-16">
            <CalendarDays className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              No doctors found at this location.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Assign employees to this location first.
            </p>
          </div>
        ) : (
          <TimelineGrid
            appointments={appointments}
            doctors={doctors}
            selectedDate={selectedDate}
          />
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────── */}
      <AppointmentModal />
    </DashboardLayout>
  )
}
