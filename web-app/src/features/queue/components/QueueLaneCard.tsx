import {
  ChevronRight,
  FlaskConical,
  Plus,
  Settings2,
  SkipForward,
  Stethoscope,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import type { QueuePermissions } from '../hooks/useQueuePermissions'
import { ENTRY_STATUS_LABELS, SESSION_STATUS_LABELS } from '../types'
import type { QueueEntry, QueueLane, QueuePolicy } from '../types'
import { matchesQueueSearch } from '../utils/queueSearch'
import { EntryBadges } from './EntryBadges'
import { QueueEntryActions } from './QueueEntryActions'
import type { EntryActionHandlers } from './QueueEntryActions'

const FINISHED = ['completed', 'cancelled', 'transferred', 'aborted']

/**
 * One doctor's lane on the reception board: who is with the doctor, the
 * waiting list in the order Call Next would pick them, patients at a test,
 * skipped patients, and today's finished visits.
 */
export function QueueLaneCard({
  lane,
  q,
  now,
  policy,
  role,
  handlers,
  onWalkIn,
  onForceComplete,
  onSetMode,
}: {
  lane: QueueLane
  q: string
  now: Date
  policy: QueuePolicy
  role: QueuePermissions
  handlers: EntryActionHandlers
  onWalkIn: () => void
  onForceComplete: (entry: QueueEntry) => void
  onSetMode: (sessionId: string, smart: boolean) => void
}) {
  const doctorId = lane.doctor.id
  const snap = lane.snapshot
  const entries = snap?.entries ?? []
  const byId = new Map(entries.map((e) => [e.id, e]))
  const withDoctor = entries.find(
    (e) => e.status === 'called' || e.status === 'in_consultation',
  )
  const waiting = (snap?.waitingOrder ?? [])
    .map((id) => byId.get(id))
    .filter((e): e is QueueEntry => !!e)
  const onHold = entries.filter((e) => e.status === 'on_hold')
  const skipped = entries.filter((e) => e.status === 'skipped')
  const finished = entries.filter((e) => FINISHED.includes(e.status))
  const session = snap?.session
  const actionProps = {
    doctorId,
    role,
    rejoinPolicy: policy.skippedRejoinPolicy,
    waiting,
    handlers,
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            Dr. {lane.doctor.fullName}
          </p>
          <p className="text-xs text-muted-foreground">
            Tokens {lane.doctor.tokenPrefix}-xxx · {waiting.length} waiting
            {session
              ? ` · ${session.smartQueueEnabled ? 'Smart queue' : 'First come, first served'}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={cn(
              session?.status === 'open' &&
                'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
              session?.status === 'paused' &&
                'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
            )}
            title={session?.pauseReason ?? undefined}
          >
            {session
              ? SESSION_STATUS_LABELS[session.status]
              : 'No patients yet'}
            {session?.status === 'paused' && session.pauseReason
              ? ` · ${session.pauseReason}`
              : ''}
          </Badge>
          {role.canReprioritize && session && session.status !== 'closed' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TooltipButton
                  tooltip={`Queue options for Dr. ${lane.doctor.fullName}`}
                  variant="ghost"
                  size="icon"
                  className="size-7"
                >
                  <Settings2 className="size-3.5" />
                </TooltipButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">
                  Today only
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() =>
                    onSetMode(session.id, !session.smartQueueEnabled)
                  }
                >
                  {session.smartQueueEnabled
                    ? 'Switch to first come, first served'
                    : 'Switch to smart queue'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 p-3">
        <div className="rounded-md border border-dashed border-border p-2.5">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Stethoscope className="size-3" /> With doctor
          </p>
          {withDoctor ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-lg font-bold tabular-nums">
                  {withDoctor.token}
                </span>{' '}
                <span className="text-sm">{withDoctor.patient?.fullName}</span>
                <p className="text-[11px] text-muted-foreground">
                  {ENTRY_STATUS_LABELS[withDoctor.status]}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {withDoctor.status === 'in_consultation' &&
                  role.canRunAnyQueue && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => onForceComplete(withDoctor)}
                    >
                      Force complete
                    </Button>
                  )}
                <QueueEntryActions entry={withDoctor} {...actionProps} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nobody right now</p>
          )}
        </div>

        {waiting.length === 0 ? (
          <p className="px-1 py-2 text-center text-xs text-muted-foreground">
            No one waiting
          </p>
        ) : (
          <ol className="space-y-1.5">
            {waiting.map((e, i) =>
              matchesQueueSearch(e, q) ? (
                <li
                  key={e.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-border px-2.5 py-2 transition-colors hover:bg-muted/50',
                    i === 0 && !withDoctor && 'border-primary/40 bg-primary/5',
                  )}
                >
                  <span className="w-5 text-center text-[11px] tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="w-16 font-mono text-sm font-bold tabular-nums">
                    {e.token}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {e.patient?.fullName ?? '—'}
                    </p>
                    <EntryBadges entry={e} now={now} className="mt-0.5" />
                  </div>
                  <QueueEntryActions entry={e} {...actionProps} />
                </li>
              ) : null,
            )}
          </ol>
        )}

        {onHold.length > 0 && (
          <LaneGroup
            title="At a test"
            icon={<FlaskConical className="size-3" />}
          >
            {onHold
              .filter((e) => matchesQueueSearch(e, q))
              .map((e) => (
                <LaneRow key={e.id} entry={e}>
                  <QueueEntryActions entry={e} {...actionProps} />
                </LaneRow>
              ))}
          </LaneGroup>
        )}

        {skipped.length > 0 && (
          <LaneGroup
            title="Skipped — didn't come when called"
            icon={<SkipForward className="size-3" />}
          >
            {skipped
              .filter((e) => matchesQueueSearch(e, q))
              .map((e) => (
                <LaneRow key={e.id} entry={e}>
                  <QueueEntryActions entry={e} {...actionProps} />
                </LaneRow>
              ))}
          </LaneGroup>
        )}

        {finished.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground">
              <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
              Done today ({finished.length})
            </summary>
            <ul className="mt-1 space-y-1">
              {finished
                .filter((e) => matchesQueueSearch(e, q))
                .map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 px-2.5 text-xs text-muted-foreground"
                  >
                    <span className="w-16 font-mono">{e.token}</span>
                    <span className="flex-1 truncate">
                      {e.patient?.fullName}
                    </span>
                    <span>{ENTRY_STATUS_LABELS[e.status]}</span>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>

      {role.canCheckIn && (
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onWalkIn}
          >
            <Plus className="size-3.5" /> Add walk-in for Dr.{' '}
            {lane.doctor.fullName.split(' ')[0]}
          </Button>
        </div>
      )}
    </div>
  )
}

function LaneGroup({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function LaneRow({
  entry,
  children,
}: {
  entry: QueueEntry
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 transition-colors hover:bg-muted/50">
      <span className="w-16 font-mono text-sm font-bold tabular-nums">
        {entry.token}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm">
        {entry.patient?.fullName ?? '—'}
      </p>
      {children}
    </div>
  )
}
