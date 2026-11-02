import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRightLeft,
  BellRing,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Megaphone,
  NotebookPen,
  Pause,
  Play,
  Power,
  SkipForward,
  Stethoscope,
  Undo2,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { cn } from '@/lib/utils'
import { formatYmd } from '@/lib/datetime'
import { useMySession, useQueuePolicies } from '../hooks/useQueueData'
import { useQueuePermissions } from '../hooks/useQueuePermissions'
import { useDoctors } from '@/features/appointments'
import { useOpenConsultation } from '@/features/consultation/hooks/useConsultation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { useQueueAction } from '../hooks/useQueueAction'
import {
  abortConsultation,
  callNext,
  closeSession,
  entryAction,
  pauseSession,
  selectPatient,
  sendForTest,
  sessionAction,
  transferEntry,
} from '../services/queue.api'
import {
  ENTRY_STATUS_LABELS,
  REASON_LABELS,
  SESSION_STATUS_LABELS,
} from '../types'
import type { QueueEntry } from '../types'
import { queueError, formatClock } from '../utils/queueError'
import { EntryBadges } from '../components/EntryBadges'
import { ReasonDialog } from '../components/ReasonDialog'
import { TransferDialog } from '../components/TransferDialog'
import { CloseSessionDialog } from '../components/CloseSessionDialog'

/**
 * The doctor's own queue: current patient card, a big Call Next button
 * (the engine picks), the waiting list in engine order with Select (the
 * doctor picks; audited with the engine's suggestion), and session controls.
 */
export function DoctorQueuePage() {
  const role = useQueuePermissions()
  const navigate = useNavigate()
  const openConsultation = useOpenConsultation()
  const { data: doctors = [] } = useDoctors()
  // `queue.doctor.any` without a doctor profile here: pick whose queue to run.
  const [pickedDoctor, setPickedDoctor] = useState('')
  const needsPicker = role.canRunAnyQueue && !role.employeeId
  const { data, isLoading, isError, error, refetch, live } = useMySession(
    needsPicker ? pickedDoctor || undefined : undefined,
    !needsPicker || !!pickedDoctor,
  )
  const { data: policies } = useQueuePolicies()
  const [selectTarget, setSelectTarget] = useState<QueueEntry | null>(null)
  const [testTarget, setTestTarget] = useState<QueueEntry | null>(null)
  const [abortTarget, setAbortTarget] = useState<QueueEntry | null>(null)
  const [transferTarget, setTransferTarget] = useState<QueueEntry | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  const sessionId = data?.session.id ?? ''
  const call = useQueueAction(() => callNext(sessionId), {
    success: (r) =>
      r.entry
        ? `Calling ${r.entry.token} — ${r.entry.patient?.fullName ?? ''}`
        : 'Nobody is waiting',
  })
  const select = useQueueAction(
    (a: { entry: QueueEntry; reason?: string }) =>
      selectPatient(a.entry.id, a.entry.version, a.reason),
    { success: (r) => (r.entry ? `Calling ${r.entry.token}` : null) },
  )
  const act = useQueueAction(
    (a: { entry: QueueEntry; action: Parameters<typeof entryAction>[1] }) =>
      entryAction(a.entry.id, a.action, a.entry.version),
  )
  const test = useQueueAction(
    (a: { entry: QueueEntry; reason: string }) =>
      sendForTest(a.entry.id, a.entry.version, a.reason || undefined),
    { success: (r) => `${r.entry.token} sent for a test` },
  )
  const abort = useQueueAction(
    (a: { entry: QueueEntry; reason: string }) =>
      abortConsultation(a.entry.id, a.entry.version, a.reason || undefined),
    { success: (r) => `Consultation with ${r.entry.token} stopped` },
  )
  const transfer = useQueueAction(
    (a: { entry: QueueEntry; toDoctorId: string; reason: string }) =>
      transferEntry(
        a.entry.id,
        a.entry.version,
        a.toDoctorId,
        a.reason || undefined,
      ),
    { success: (r) => `Transferred — new token ${r.token}` },
  )
  const start = useQueueAction(() => sessionAction(sessionId, 'start'), {
    success: () => 'Queue started',
  })
  const resume = useQueueAction(() => sessionAction(sessionId, 'resume'), {
    success: () => 'Queue resumed',
  })
  const pause = useQueueAction(
    (reason: string) => pauseSession(sessionId, reason),
    { success: () => 'Queue paused' },
  )
  const close = useQueueAction(
    (decisions: Parameters<typeof closeSession>[1]) =>
      closeSession(sessionId, decisions),
    { success: () => 'Queue closed for today' },
  )

  const picker = needsPicker ? (
    <div className="mb-4 max-w-xs">
      <Select value={pickedDoctor} onValueChange={setPickedDoctor}>
        <SelectTrigger aria-label="Choose doctor">
          <SelectValue placeholder="Choose a doctor's queue" />
        </SelectTrigger>
        <SelectContent>
          {doctors.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              Dr. {d.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null

  if (needsPicker && !pickedDoctor) {
    return (
      <>
        <PageWrapper
          title="My queue"
          subtitle="Choose which doctor's queue to run"
        />
        <div className="mt-5">{picker}</div>
      </>
    )
  }

  if (isLoading) {
    return (
      <>
        <PageWrapper title="My queue" />
        <LoadingSkeleton variant="detail" className="mt-5" />
      </>
    )
  }
  if (isError || !data) {
    const { code, message } = queueError(error)
    return (
      <>
        <PageWrapper title="My queue" />
        <ErrorState
          className="mt-5"
          title={
            code === 'FORBIDDEN' || code === 'NOT_FOUND'
              ? 'You are not set up as a doctor at this location'
              : 'Could not load your queue'
          }
          description={message}
          onRetry={() => void refetch()}
        />
      </>
    )
  }

  const { session, entries, waitingOrder, suggestion } = data
  const byId = new Map(entries.map((e) => [e.id, e]))
  const current = entries.find(
    (e) => e.status === 'called' || e.status === 'in_consultation',
  )
  const waiting = waitingOrder.map((id) => byId.get(id)!).filter(Boolean)
  const onHold = entries.filter((e) => e.status === 'on_hold')
  const skipped = entries.filter((e) => e.status === 'skipped')
  const remaining = entries.filter((e) =>
    ['waiting', 'skipped', 'on_hold'].includes(e.status),
  )
  const completedCount = entries.filter((e) => e.status === 'completed').length
  const isOpen = session.status === 'open'
  const now = new Date(data.now)
  const reasonRequired = policies?.effective.manualSelectReasonRequired ?? false

  const onSelect = (entry: QueueEntry) => {
    if (reasonRequired || entry.id !== suggestion?.entryId)
      setSelectTarget(entry)
    else select.mutate({ entry })
  }

  return (
    <>
      {picker}
      <PageWrapper
        title="My queue"
        subtitle={`Dr. ${session.doctorName ?? ''} · ${formatYmd(session.serviceDate, 'EEEE, MMMM d')}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs',
                live ? 'text-emerald-600' : 'text-amber-600',
              )}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  live ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              />
              {live ? 'Live' : 'Reconnecting'}
            </span>
            <Badge variant="outline">
              {session.smartQueueEnabled
                ? 'Smart queue'
                : 'First come, first served'}
            </Badge>
            <Badge variant="secondary">
              {SESSION_STATUS_LABELS[session.status]}
            </Badge>
            {session.status === 'waiting_for_doctor' && (
              <Button
                size="sm"
                onClick={() => start.mutate(undefined)}
                disabled={start.isPending}
              >
                {start.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}{' '}
                Start my queue
              </Button>
            )}
            {session.status === 'open' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPauseOpen(true)}
              >
                <Pause className="size-3.5" /> Pause
              </Button>
            )}
            {session.status === 'paused' && (
              <Button
                size="sm"
                onClick={() => resume.mutate(undefined)}
                disabled={resume.isPending}
              >
                {resume.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}{' '}
                Resume
              </Button>
            )}
            {session.status !== 'closed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCloseOpen(true)}
                disabled={!!current}
              >
                <Power className="size-3.5" /> Close day
              </Button>
            )}
          </div>
        }
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* Current patient + Call Next */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Stethoscope className="size-3.5" /> Current patient
            </p>
            {current ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="font-mono text-5xl font-extrabold tabular-nums">
                      {current.token}
                    </p>
                    <p className="mt-1 text-lg font-medium">
                      {current.patient?.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {current.patient?.phone} ·{' '}
                      {ENTRY_STATUS_LABELS[current.status]}
                      {current.calledAt
                        ? ` · called ${formatClock(current.calledAt)}`
                        : ''}
                    </p>
                    {current.reasonForVisit && (
                      <p className="mt-1 text-sm italic text-muted-foreground">
                        “{current.reasonForVisit}”
                      </p>
                    )}
                  </div>
                  <EntryBadges entry={current} now={now} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {current.status === 'called' ? (
                    <>
                      <Button
                        onClick={() =>
                          act.mutate(
                            { entry: current, action: 'start-consultation' },
                            {
                              // Straight into the consultation screen.
                              onSuccess: (r) => {
                                if (r.encounterId) {
                                  void navigate({
                                    to: '/consultation/$encounterId',
                                    params: { encounterId: r.encounterId },
                                  })
                                }
                              },
                            },
                          )
                        }
                        disabled={act.isPending}
                      >
                        <UserCheck className="size-4" /> Patient is here — start
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          act.mutate({ entry: current, action: 'recall' })
                        }
                        disabled={act.isPending}
                      >
                        <Megaphone className="size-4" /> Call again
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          act.mutate({ entry: current, action: 'skip' })
                        }
                        disabled={act.isPending}
                      >
                        <SkipForward className="size-4" /> Didn't come
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          act.mutate({ entry: current, action: 'undo-call' })
                        }
                        disabled={act.isPending}
                      >
                        <Undo2 className="size-4" /> Undo call
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        onClick={() => openConsultation.mutate(current.id)}
                        disabled={openConsultation.isPending}
                      >
                        {openConsultation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <NotebookPen className="size-4" />
                        )}
                        Open consultation
                      </Button>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() =>
                          act.mutate({ entry: current, action: 'complete' })
                        }
                        disabled={act.isPending}
                      >
                        <CheckCircle2 className="size-4" /> Complete
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setTestTarget(current)}
                      >
                        <FlaskConical className="size-4" /> Send for test
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setTransferTarget(current)}
                      >
                        <ArrowRightLeft className="size-4" /> Transfer
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setAbortTarget(current)}
                      >
                        <XCircle className="size-4" /> Stop consultation
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nobody is with you right now.
              </p>
            )}
          </div>

          <Button
            size="lg"
            className="h-20 w-full text-xl"
            disabled={
              !isOpen || !!current || waiting.length === 0 || call.isPending
            }
            onClick={() => call.mutate(undefined)}
          >
            {call.isPending ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <BellRing className="size-6" />
            )}
            Call next
            {suggestion && !current && (
              <span className="ml-2 text-base font-normal opacity-80">
                ({byId.get(suggestion.entryId)?.token} ·{' '}
                {REASON_LABELS[suggestion.reason]})
              </span>
            )}
          </Button>
          {!isOpen && session.status !== 'closed' && (
            <p className="text-center text-xs text-muted-foreground">
              {session.status === 'paused'
                ? `Paused${session.pauseReason ? ` — ${session.pauseReason}` : ''}. Resume to call patients.`
                : 'Start your queue to call patients. Reception can check patients in meanwhile.'}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {completedCount} completed today
          </p>
        </div>

        {/* Waiting list */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">
                Waiting ({waiting.length})
              </p>
              <p className="text-xs text-muted-foreground">
                In the order Call Next would pick them
              </p>
            </div>
            {waiting.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No one is waiting.
              </p>
            ) : (
              <ol className="divide-y divide-border">
                {waiting.map((e) => {
                  const suggested = e.id === suggestion?.entryId
                  return (
                    <li
                      key={e.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50',
                        suggested && 'bg-primary/5',
                      )}
                    >
                      <span className="w-16 font-mono text-sm font-bold tabular-nums">
                        {e.token}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {e.patient?.fullName}
                        </p>
                        <EntryBadges entry={e} now={now} className="mt-0.5" />
                        {suggestion && suggested && (
                          <p className="mt-0.5 text-[11px] text-primary">
                            Suggested · {REASON_LABELS[suggestion.reason]}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={suggested ? 'default' : 'outline'}
                        className="h-7"
                        disabled={!isOpen || !!current || select.isPending}
                        onClick={() => onSelect(e)}
                      >
                        Select
                      </Button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          {(onHold.length > 0 || skipped.length > 0) && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              {onHold.length > 0 && (
                <>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    At a test — reception returns them
                  </p>
                  {onHold.map((e) => (
                    <p key={e.id} className="text-sm">
                      <span className="font-mono font-bold">{e.token}</span>{' '}
                      {e.patient?.fullName}
                    </p>
                  ))}
                </>
              )}
              {skipped.length > 0 && (
                <>
                  <p className="mb-1 mt-2 text-xs font-semibold text-muted-foreground">
                    Skipped — reception can rejoin them
                  </p>
                  {skipped.map((e) => (
                    <p key={e.id} className="text-sm">
                      <span className="font-mono font-bold">{e.token}</span>{' '}
                      {e.patient?.fullName}
                    </p>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <ReasonDialog
        open={!!selectTarget}
        onOpenChange={(o) => !o && setSelectTarget(null)}
        title={`Call ${selectTarget?.token ?? ''} now?`}
        description={
          suggestion && selectTarget?.id !== suggestion.entryId
            ? `The queue would call ${byId.get(suggestion.entryId)?.token} next (${REASON_LABELS[suggestion.reason]}). Your choice is recorded.`
            : 'Your choice is recorded.'
        }
        required={reasonRequired}
        confirmLabel="Call this patient"
        isLoading={select.isPending}
        onConfirm={(reason) =>
          select.mutate(
            { entry: selectTarget!, reason: reason || undefined },
            { onSuccess: () => setSelectTarget(null) },
          )
        }
      />
      <ReasonDialog
        open={!!testTarget}
        onOpenChange={(o) => !o && setTestTarget(null)}
        title={`Send ${testTarget?.token ?? ''} for a test`}
        description="They keep their token and come back ahead of walk-ins."
        label="Test"
        placeholder="e.g. X-ray, CBC"
        confirmLabel="Send for test"
        isLoading={test.isPending}
        onConfirm={(reason) =>
          test.mutate(
            { entry: testTarget!, reason },
            { onSuccess: () => setTestTarget(null) },
          )
        }
      />
      <ReasonDialog
        open={!!abortTarget}
        onOpenChange={(o) => !o && setAbortTarget(null)}
        title={`Stop the consultation with ${abortTarget?.token ?? ''}?`}
        description="The visit ends without completing; a booked appointment is closed as cancelled."
        confirmLabel="Stop consultation"
        destructive
        isLoading={abort.isPending}
        onConfirm={(reason) =>
          abort.mutate(
            { entry: abortTarget!, reason },
            { onSuccess: () => setAbortTarget(null) },
          )
        }
      />
      <ReasonDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        title="Pause your queue"
        description="Patients keep their place; nobody is called until you resume."
        required
        placeholder="e.g. Break, prayer"
        confirmLabel="Pause"
        isLoading={pause.isPending}
        onConfirm={(reason) =>
          pause.mutate(reason, { onSuccess: () => setPauseOpen(false) })
        }
      />
      <TransferDialog
        entry={transferTarget}
        currentDoctorId={session.doctorId}
        onOpenChange={(o) => !o && setTransferTarget(null)}
        isLoading={transfer.isPending}
        onConfirm={(toDoctorId, reason) =>
          transfer.mutate(
            { entry: transferTarget!, toDoctorId, reason },
            { onSuccess: () => setTransferTarget(null) },
          )
        }
      />
      <CloseSessionDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        remaining={remaining}
        doctorId={session.doctorId}
        isLoading={close.isPending}
        onConfirm={(decisions) =>
          close.mutate(decisions, { onSuccess: () => setCloseOpen(false) })
        }
      />
    </>
  )
}
