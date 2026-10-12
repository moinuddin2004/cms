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
  type Appointment,
} from '@/features/appointments'
import {
  ENTRY_STATUS_LABELS,
  usePatientVisits,
  type PatientVisit,
} from '@/features/queue'
import type { Patient } from '../../types'

type HistoryItem =
  | { kind: 'appointment'; at: number; appt: Appointment }
  | { kind: 'walk_in'; at: number; visit: PatientVisit }

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

  // Walk-ins have no appointment row — they come from the patient's queue visits.
  const { data: visits = [], isLoading: loadingVisits } = usePatientVisits(patient.id)

  const appointments = data?.data ?? []
  const walkIns = visits.filter((v) => v.queueType === 'walk_in')

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const up: Appointment[] = []
    const old: HistoryItem[] = []
    for (const a of appointments) {
      const isFuture = new Date(a.startTime).getTime() >= now
      const isTerminal = TERMINAL.includes(a.status)
      if (isFuture && !isTerminal) up.push(a)
      else old.push({ kind: 'appointment', at: +new Date(a.startTime), appt: a })
    }
    for (const v of walkIns) {
      old.push({ kind: 'walk_in', at: +new Date(v.checkedInAt), visit: v })
    }
    up.sort((x, y) => +new Date(x.startTime) - +new Date(y.startTime))
    old.sort((x, y) => y.at - x.at)
    return { upcoming: up, past: old }
  }, [appointments, walkIns])
  const total = appointments.length + walkIns.length

  return (
    <div className="mt-4 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="text-brand-600" size={20} />
            Appointments
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total === 0
              ? 'No appointments or visits on record for this patient.'
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

      {isLoading || loadingVisits ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : total === 0 ? (
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
              {past.map((item) =>
                item.kind === 'appointment' ? (
                  <AppointmentHistoryCard key={item.appt.id} appt={item.appt} />
                ) : (
                  <WalkInVisitCard key={item.visit.id} visit={item.visit} />
                ),
              )}
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
  const token = appt.queueEntry?.token ?? '—'

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
            !appt.queueEntry
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

// ─── Walk-in visit (queue entry, no appointment) ──────────────────────
function WalkInVisitCard({ visit }: { visit: PatientVisit }) {
  const at = new Date(visit.checkedInAt)
  const left = visit.status === 'cancelled' || visit.status === 'aborted'
  return (
    <Card
      className={cn(
        'flex items-stretch gap-3 p-3 shadow-sm transition-shadow hover:shadow-md',
        left && 'opacity-60',
      )}
    >
      <div className="flex min-w-[58px] flex-col items-center justify-center rounded-lg bg-muted px-2 py-1.5 text-center text-foreground">
        <span className="text-[10px] font-bold uppercase leading-none opacity-70">
          {at.toLocaleDateString([], { month: 'short' })}
        </span>
        <span className="text-xl font-bold leading-tight tabular-nums">{at.getDate()}</span>
        <span className="text-[10px] leading-none opacity-70">
          {at.toLocaleDateString([], { weekday: 'short' })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5 rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300">
            <Footprints className="size-2.5" /> Walk-in
          </span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium">
            {ENTRY_STATUS_LABELS[visit.status]}
          </span>
          {visit.priorityClass === 'authorized_urgent' && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
              <Zap className="size-2.5" /> Emergency
            </span>
          )}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            Arrived {at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
          {visit.doctorName && (
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="size-3" />
              Dr. {visit.doctorName}
            </span>
          )}
        </p>
        {visit.reasonForVisit && (
          <p className="mt-1 truncate text-xs italic text-muted-foreground">“{visit.reasonForVisit}”</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center">
        <span className="font-mono text-sm font-bold tabular-nums text-primary">{visit.token}</span>
      </div>
    </Card>
  )
}
