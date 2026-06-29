import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  CalendarClock,
  Clock,
  Stethoscope,
  Footprints,
  Zap,
  Loader2,
  CalendarPlus,
  CalendarX2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useAppointments,
  AppointmentStatus,
  STATUS_BG_COLORS,
  STATUS_LABELS,
  formatToken,
  type Appointment,
} from '@/features/appointments'
import type { Patient } from '../../types'

const TERMINAL = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
]

export function AppointmentsTab({ patient }: { patient: Patient }) {
  const { data, isLoading } = useAppointments({
    patientId: patient.id,
    limit: 100,
  })

  const appointments = data?.data ?? []

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const up: Appointment[] = []
    const old: Appointment[] = []
    for (const a of appointments) {
      const isFuture = new Date(a.startTime).getTime() >= now
      const isTerminal = TERMINAL.includes(a.status)
      if (isFuture && !isTerminal) up.push(a)
      else old.push(a)
    }
    up.sort((x, y) => +new Date(x.startTime) - +new Date(y.startTime))
    old.sort((x, y) => +new Date(y.startTime) - +new Date(x.startTime))
    return { upcoming: up, past: old }
  }, [appointments])

  return (
    <div className="mt-4 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="text-brand-600" size={20} />
            Appointments
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {appointments.length === 0
              ? 'No appointments on record for this patient.'
              : `${upcoming.length} upcoming · ${past.length} past`}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/appointments" search={{ create: '1' }}>
            <CalendarPlus className="size-3.5" />
            Book appointment
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : appointments.length === 0 ? (
        <Card className="flex min-h-[200px] flex-col items-center justify-center border-dashed bg-muted/20 p-6 text-center text-muted-foreground">
          <CalendarX2 size={32} className="mb-4 opacity-20" />
          <p className="font-medium">No appointments yet.</p>
          <p className="mt-1 text-sm">
            Book this patient's first visit from the scheduler.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <Section title="Upcoming" count={upcoming.length}>
              {upcoming.map((appt) => (
                <AppointmentHistoryCard key={appt.id} appt={appt} upcoming />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="History" count={past.length}>
              {past.map((appt) => (
                <AppointmentHistoryCard key={appt.id} appt={appt} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────
function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{children}</div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────
function AppointmentHistoryCard({
  appt,
  upcoming,
}: {
  appt: Appointment
  upcoming?: boolean
}) {
  const start = new Date(appt.startTime)
  const end = new Date(appt.endTime)
  const isCancelled = appt.status === AppointmentStatus.CANCELLED
  const token = formatToken(appt)

  const timeLabel = `${start.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })} – ${end.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`

  return (
    <Card
      className={cn(
        'flex items-stretch gap-3 p-3 shadow-sm transition-shadow hover:shadow-md',
        isCancelled && 'opacity-60',
      )}
    >
      {/* Date block */}
      <div
        className={cn(
          'flex min-w-[58px] flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center',
          upcoming
            ? 'bg-primary-soft text-primary-text'
            : 'bg-muted text-foreground',
        )}
      >
        <span className="text-[10px] font-bold uppercase leading-none opacity-70">
          {start.toLocaleDateString([], { month: 'short' })}
        </span>
        <span className="text-xl font-bold leading-tight tabular-nums">
          {start.getDate()}
        </span>
        <span className="text-[10px] leading-none opacity-70">
          {start.toLocaleDateString([], { weekday: 'short' })}
        </span>
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold capitalize">
            {appt.type.replace('_', ' ')}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize',
              STATUS_BG_COLORS[appt.status],
            )}
          >
            {STATUS_LABELS[appt.status]}
          </span>
          {appt.isWalkIn && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
              <Footprints className="size-2.5" /> Walk-in
            </span>
          )}
          {appt.isEmergency && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
              <Zap className="size-2.5" /> Emergency
            </span>
          )}
        </div>

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {timeLabel}
          </span>
          {appt.doctor?.fullName && (
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="size-3" />
              Dr. {appt.doctor.fullName}
            </span>
          )}
        </p>

        {appt.reasonForVisit && (
          <p className="mt-1 truncate text-xs italic text-muted-foreground">
            “{appt.reasonForVisit}”
          </p>
        )}
      </div>

      {/* Token */}
      <div className="flex shrink-0 flex-col items-end justify-center">
        <span
          className={cn(
            'font-mono text-sm font-bold tabular-nums',
            appt.tokenNumber == null
              ? 'text-muted-foreground'
              : 'text-primary',
          )}
        >
          {token}
        </span>
      </div>
    </Card>
  )
}
