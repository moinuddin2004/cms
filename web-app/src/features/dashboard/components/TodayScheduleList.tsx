import { Link, useNavigate } from '@tanstack/react-router'
import { CalendarClock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InitialsAvatar } from '@/components/data-display/InitialsAvatar'
import { Can } from '@/features/access/components/Can'
import type { Appointment } from '@/features/appointments/types'
import { AppointmentStatus } from '@/features/appointments/types'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/datetime'

interface Props {
  data: Appointment[]
  isLoading?: boolean
}

const STATUS: Record<string, { label: string; className: string }> = {
  [AppointmentStatus.COMPLETED]: {
    label: 'Completed',
    className: 'bg-emerald-soft text-emerald',
  },
  [AppointmentStatus.CHECKED_IN]: {
    label: 'Checked in',
    className: 'bg-amber-soft text-amber',
  },
  [AppointmentStatus.CONFIRMED]: {
    label: 'Confirmed',
    className: 'bg-primary-soft text-primary-text',
  },
  [AppointmentStatus.SCHEDULED]: {
    label: 'Scheduled',
    className: 'bg-panel-2 text-text-2',
  },
  [AppointmentStatus.NO_SHOW]: {
    label: 'No show',
    className: 'bg-danger-soft text-danger',
  },
  [AppointmentStatus.CANCELLED]: {
    label: 'Cancelled',
    className: 'bg-danger-soft text-danger',
  },
}

function time(iso: string) {
  return formatTime(iso)
}

function label(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : null
}

/** Today's visits as a compact timeline: time, patient, doctor, token, status. */
export function TodayScheduleList({ data, isLoading }: Props) {
  const navigate = useNavigate()

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-base font-semibold">Today&apos;s schedule</h2>
          <p className="text-sm text-text-3">
            {isLoading
              ? 'Loading…'
              : `${data.length} visit${data.length === 1 ? '' : 's'} today`}
          </p>
        </div>
        <Link
          to="/appointments"
          search={{ create: undefined }}
          className="text-sm font-medium text-primary-text hover:underline"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-panel" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-panel text-text-3">
            <CalendarClock className="size-6" />
          </span>
          <div>
            <p className="font-medium">No visits scheduled for today</p>
            <p className="text-sm text-text-3">
              New bookings and walk-ins will show up here.
            </p>
          </div>
          <Can perm="appointments.book">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigate({ to: '/appointments', search: { create: '1' } })
              }
            >
              <Plus className="size-3.5" />
              Book an appointment
            </Button>
          </Can>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((a) => {
            const name = a.patient?.fullName ?? 'Unknown patient'
            const status = STATUS[a.status] ?? {
              label: label(a.status) ?? '—',
              className: 'bg-panel-2 text-text-2',
            }
            const what = label(a.reasonForVisit) ?? label(a.type)
            return (
              <li
                key={a.id}
                className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-panel"
              >
                <div className="w-16 shrink-0">
                  <div className="text-sm font-semibold tabular-nums">
                    {time(a.startTime)}
                  </div>
                  {a.durationMinutes ? (
                    <div className="text-xs text-text-3">
                      {a.durationMinutes} min
                    </div>
                  ) : null}
                </div>
                <InitialsAvatar name={name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="truncate text-xs capitalize text-text-3">
                    {[a.doctor?.fullName, what].filter(Boolean).join(' · ') ||
                      '—'}
                  </div>
                </div>
                {a.queueEntry?.token && (
                  <span className="hidden rounded-md border border-border px-2 py-0.5 font-mono text-xs text-text-2 sm:inline">
                    {a.queueEntry.token}
                  </span>
                )}
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
