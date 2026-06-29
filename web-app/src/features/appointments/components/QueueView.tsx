import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  Zap,
  Footprints,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { useAppointmentStore } from '@/store/appointment-store'
import { useQueue } from '../hooks/useQueue'
import {
  useCancelAppointment,
  useCheckIn,
  useStartAppointment,
  useCompleteAppointment,
} from '../hooks/useAppointmentActions'
import {
  AppointmentStatus,
  CancelReason,
  CANCEL_REASON_OPTIONS,
  formatToken,
  type Appointment,
} from '../types'
import { WalkInDialog } from './WalkInDialog'

// ─── Role gating ──────────────────────────────────────────────────────
// The system doesn't yet surface a granular doctor/receptionist role on the
// client, so default to permissive (show everything) and only narrow when a
// recognizable role string is present. Admins/super-admins always see all.
function useQueueRole() {
  const { user, isSuperAdmin } = useAuthStore()
  const role = (user?.globalRole ?? '').toLowerCase()
  if (isSuperAdmin || ['admin', 'owner', 'manager'].includes(role)) {
    return { canReception: true, canDoctor: true }
  }
  if (role === 'doctor') return { canReception: false, canDoctor: true }
  if (['receptionist', 'front_desk', 'reception'].includes(role)) {
    return { canReception: true, canDoctor: false }
  }
  return { canReception: true, canDoctor: true }
}

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const NOT_ARRIVED = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
]
const CLOSED = [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]

export function QueueView() {
  const [date, setDate] = useState(() => new Date())
  const [walkInOpen, setWalkInOpen] = useState(false)
  const ymd = toYMD(date)
  const { data: queue = [], isLoading, isFetching } = useQueue(ymd)

  const isToday = toYMD(new Date()) === ymd

  // Group by section
  const groups = useMemo(() => {
    const inRoom: Appointment[] = []
    const waiting: Appointment[] = []
    const scheduled: Appointment[] = []
    const completed: Appointment[] = []
    const closed: Appointment[] = []
    for (const a of queue) {
      if (a.status === AppointmentStatus.IN_PROGRESS) inRoom.push(a)
      else if (a.status === AppointmentStatus.CHECKED_IN) waiting.push(a)
      else if (NOT_ARRIVED.includes(a.status)) scheduled.push(a)
      else if (a.status === AppointmentStatus.COMPLETED) completed.push(a)
      else if (CLOSED.includes(a.status)) closed.push(a)
    }
    return { inRoom, waiting, scheduled, completed, closed }
  }, [queue])

  // Doctors who already have a patient in the room (one-in-room-per-doctor).
  const busyDoctors = useMemo(
    () => new Set(groups.inRoom.map((a) => a.doctorId).filter(Boolean)),
    [groups.inRoom],
  )

  const stepDay = (dir: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + dir)
    setDate(d)
  }

  const label = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => stepDay(-1)}
              className="h-8 w-8"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <button
              onClick={() => setDate(new Date())}
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
              onClick={() => stepDay(1)}
              className="h-8 w-8"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground ml-2">
              {label}
            </span>
            {isFetching && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                live
              </span>
            )}
          </div>

          <Button onClick={() => setWalkInOpen(true)} size="sm">
            <Plus className="w-3.5 h-3.5" />
            Walk-in
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground bg-card border rounded-xl">
            <Footprints className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-medium">No one in the queue {isToday ? 'today' : 'this day'}.</p>
            <p className="text-xs mt-1">
              Use "Add Walk-in" or check in a booked patient to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <Section
              title="In Room"
              icon={<Stethoscope className="w-4 h-4 text-green-600" />}
              count={groups.inRoom.length}
              accent="border-l-green-500"
              items={groups.inRoom}
              busyDoctors={busyDoctors}
            />
            <Section
              title="Waiting"
              icon={<Clock className="w-4 h-4 text-amber-600" />}
              count={groups.waiting.length}
              accent="border-l-amber-400"
              items={groups.waiting}
              busyDoctors={busyDoctors}
            />
            <Section
              title="Scheduled — not arrived yet"
              icon={<Clock className="w-4 h-4 text-blue-600" />}
              count={groups.scheduled.length}
              accent="border-l-blue-400"
              items={groups.scheduled}
              busyDoctors={busyDoctors}
              muted
            />
            <Section
              title="Completed"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              count={groups.completed.length}
              accent="border-l-emerald-400"
              items={groups.completed}
              busyDoctors={busyDoctors}
              muted
              collapsible
            />
            <Section
              title="Cancelled / No-show"
              icon={<XCircle className="w-4 h-4 text-red-500" />}
              count={groups.closed.length}
              accent="border-l-red-300"
              items={groups.closed}
              busyDoctors={busyDoctors}
              muted
              collapsible
            />
          </div>
        )}
      </div>

      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
    </TooltipProvider>
  )
}

// ─── Section ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  count,
  accent,
  items,
  busyDoctors,
  muted,
  collapsible,
}: {
  title: string
  icon: React.ReactNode
  count: number
  accent: string
  items: Appointment[]
  busyDoctors: Set<string | null>
  muted?: boolean
  collapsible?: boolean
}) {
  if (count === 0) return null

  const body = (
    <div className="space-y-2">
      {items.map((a) => (
        <QueueRow
          key={a.id}
          appt={a}
          accent={accent}
          muted={muted}
          doctorBusy={!!a.doctorId && busyDoctors.has(a.doctorId)}
        />
      ))}
    </div>
  )

  if (collapsible) {
    return (
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer mb-2 list-none">
          {icon}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <Badge variant="secondary" className="text-[10px]">
            {count}
          </Badge>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        {body}
      </details>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <Badge variant="secondary" className="text-[10px]">
          {count}
        </Badge>
      </div>
      {body}
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────

function QueueRow({
  appt,
  accent,
  muted,
  doctorBusy,
}: {
  appt: Appointment
  accent: string
  muted?: boolean
  doctorBusy: boolean
}) {
  const { canReception, canDoctor } = useQueueRole()
  const openDetailModal = useAppointmentStore((s) => s.openDetailModal)

  const checkIn = useCheckIn()
  const start = useStartAppointment()
  const complete = useCompleteAppointment()
  const cancel = useCancelAppointment()

  const busy =
    checkIn.isPending ||
    start.isPending ||
    complete.isPending ||
    cancel.isPending

  const isNotArrived = NOT_ARRIVED.includes(appt.status)
  const isWaiting = appt.status === AppointmentStatus.CHECKED_IN
  const isInRoom = appt.status === AppointmentStatus.IN_PROGRESS
  const isClosed = CLOSED.includes(appt.status)

  const token = formatToken(appt)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-l-4 bg-card px-3 py-2.5 transition-colors',
        accent,
        muted && 'opacity-75',
        isClosed && 'line-through decoration-1',
      )}
    >
      {/* Token */}
      <button
        onClick={() => openDetailModal(appt.id)}
        className="shrink-0 text-left"
        title="View details"
      >
        <span
          className={cn(
            'font-mono font-bold tabular-nums',
            appt.tokenNumber == null
              ? 'text-muted-foreground text-sm'
              : 'text-base text-foreground',
          )}
        >
          {token}
        </span>
      </button>

      {/* Patient + meta */}
      <button
        onClick={() => openDetailModal(appt.id)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            {appt.patient?.fullName ?? '—'}
          </span>
          {appt.isWalkIn ? (
            <Badge variant="outline" className="text-[9px] h-4 bg-purple-50 text-purple-700 border-purple-200">
              <Footprints className="w-2.5 h-2.5 mr-0.5" /> Walk-in
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] h-4">
              Booked
            </Badge>
          )}
          {appt.isEmergency && (
            <Badge variant="outline" className="text-[9px] h-4 bg-red-50 text-red-700 border-red-200">
              <Zap className="w-2.5 h-2.5 mr-0.5" /> Emergency
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {appt.patient?.phone && (
            <span className="inline-flex items-center gap-1 mr-2">
              <Phone className="w-2.5 h-2.5" />
              {appt.patient.phone}
            </span>
          )}
          {appt.doctor?.fullName && <span className="mr-2">Dr. {appt.doctor.fullName}</span>}
          {appt.reasonForVisit && <span className="italic">· {appt.reasonForVisit}</span>}
          {isNotArrived && (
            <span className="ml-1">
              {new Date(appt.startTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
        </p>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isNotArrived && canReception && (
          <Button size="sm" className="h-8" disabled={busy} onClick={() => checkIn.mutate(appt.id)}>
            Check In
          </Button>
        )}

        {isWaiting && canDoctor && (
          <StartButton
            disabled={busy || doctorBusy}
            doctorBusy={doctorBusy}
            onStart={() => start.mutate(appt.id)}
          />
        )}

        {isInRoom && canDoctor && (
          <Button
            size="sm"
            className="h-8 bg-emerald-600 hover:bg-emerald-700"
            disabled={busy}
            onClick={() => complete.mutate(appt.id)}
          >
            Done
          </Button>
        )}

        {(isNotArrived || isWaiting) && canReception && (
          <CancelMenu
            disabled={busy}
            onCancel={(reasonCode) => cancel.mutate({ id: appt.id, reasonCode })}
          />
        )}
      </div>
    </div>
  )
}

function StartButton({
  disabled,
  doctorBusy,
  onStart,
}: {
  disabled: boolean
  doctorBusy: boolean
  onStart: () => void
}) {
  const btn = (
    <Button
      size="sm"
      className="h-8 bg-green-600 hover:bg-green-700"
      disabled={disabled}
      onClick={onStart}
    >
      Start
    </Button>
  )
  if (!doctorBusy) return btn
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span wrapper so the tooltip works on a disabled button */}
        <span className="inline-block">{btn}</span>
      </TooltipTrigger>
      <TooltipContent>Complete the current patient first.</TooltipContent>
    </Tooltip>
  )
}

function CancelMenu({
  disabled,
  onCancel,
}: {
  disabled: boolean
  onCancel: (reasonCode: CancelReason) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-destructive" disabled={disabled}>
          Cancel
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">Reason</DropdownMenuLabel>
        {CANCEL_REASON_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onCancel(o.value)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
