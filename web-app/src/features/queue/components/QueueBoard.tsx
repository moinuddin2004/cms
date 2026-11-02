import { useMemo, useState } from 'react'
import { MonitorPlay, Plus, RefreshCw, Search, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
  ViewToggle,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/store/useAuthStore'
import { useQueueBoard } from '../hooks/useQueueData'
import { useQueueAction } from '../hooks/useQueueAction'
import { useQueuePermissions } from '../hooks/useQueuePermissions'
import {
  cancelEntry,
  entryAction,
  setSessionMode,
  setUrgentPriority,
  transferEntry,
} from '../services/queue.api'
import type { QueueEntry } from '../types'
import { matchesQueueSearch } from '../utils/queueSearch'
import { QueueEntriesTable } from './QueueEntriesTable'
import type { EntryActionHandlers } from './QueueEntryActions'
import { QueueLaneCard } from './QueueLaneCard'
import { ReasonDialog } from './ReasonDialog'
import { TransferDialog } from './TransferDialog'
import { WalkInSheet } from './WalkInSheet'

/**
 * Reception board. Card view: one lane per doctor, waiting patients in the
 * order the engine would call them. List view: every patient in one table.
 * Live over WebSocket; falls back to polling while disconnected. Actions
 * follow the user's queue permissions (the API enforces the same rules).
 */
export function QueueBoard() {
  const locationId = useAuthStore((s) => s.activeLocationId)
  const role = useQueuePermissions()
  const { data, isLoading, isError, refetch, isFetching, live } =
    useQueueBoard()
  const [view, setView] = useState<ViewMode>('card')
  const [search, setSearch] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const q = useDebounce(search.trim(), 300)

  const [walkInFor, setWalkInFor] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<QueueEntry | null>(null)
  const [urgentTarget, setUrgentTarget] = useState<QueueEntry | null>(null)
  const [forceTarget, setForceTarget] = useState<QueueEntry | null>(null)
  const [transferTarget, setTransferTarget] = useState<{
    entry: QueueEntry
    doctorId: string
  } | null>(null)

  const cancel = useQueueAction(
    (a: { entry: QueueEntry; reason: string }) =>
      cancelEntry(a.entry.id, a.entry.version, a.reason || undefined),
    { success: (r) => `${r.entry.token} removed from the queue` },
  )
  const urgent = useQueueAction(
    (a: { entry: QueueEntry; reason: string }) =>
      setUrgentPriority(a.entry.id, a.entry.version, a.reason),
    { success: (r) => `${r.entry.token} has urgent priority` },
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
  const forceComplete = useQueueAction(
    (entry: QueueEntry) =>
      entryAction(entry.id, 'force-complete', entry.version),
    { success: (r) => `${r.entry.token} marked completed` },
  )
  const setMode = useQueueAction(
    (a: { sessionId: string; smart: boolean }) =>
      setSessionMode(a.sessionId, a.smart),
    {
      success: (r) =>
        `Today's queue is now ${r.session.smartQueueEnabled ? 'smart' : 'first come, first served'}`,
    },
  )

  const handlers = useMemo<EntryActionHandlers>(
    () => ({
      onCancel: setCancelTarget,
      onUrgent: setUrgentTarget,
      onTransfer: (entry, doctorId) => setTransferTarget({ entry, doctorId }),
    }),
    [],
  )

  const lanes = data?.lanes ?? []
  const visibleLanes = lanes.filter(
    (l) => doctorFilter === 'all' || l.doctor.id === doctorFilter,
  )
  const activeFilters = (q ? 1 : 0) + (doctorFilter !== 'all' ? 1 : 0)
  const now = data ? new Date(data.now) : new Date()
  const anyMatch =
    !q ||
    visibleLanes.some((l) =>
      l.snapshot?.entries.some((e) => matchesQueueSearch(e, q)),
    )
  const clearFilters = () => {
    setSearch('')
    setDoctorFilter('all')
  }

  return (
    <div className="space-y-4">
      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search token, name or phone…"
            className="h-8 pl-8"
            aria-label="Search the queue"
          />
        </div>
        <Select value={doctorFilter} onValueChange={setDoctorFilter}>
          <SelectTrigger
            className="h-8 w-full sm:w-[190px]"
            aria-label="Filter by doctor"
          >
            <SelectValue placeholder="All doctors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {lanes.map((l) => (
              <SelectItem key={l.doctor.id} value={l.doctor.id}>
                Dr. {l.doctor.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={clearFilters}
          >
            <X className="size-3.5" /> Clear filters
            <Badge variant="secondary" className="ml-0.5">
              {activeFilters}
            </Badge>
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs',
              live ? 'text-emerald-600' : 'text-amber-600',
            )}
            title={
              live
                ? 'Updates arrive instantly'
                : 'Live connection lost — refreshing every 10 seconds'
            }
          >
            <span
              className={cn(
                'size-2 rounded-full',
                live ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            />
            {live ? 'Live' : 'Reconnecting'}
          </span>
          {data && (
            <Badge
              variant="outline"
              title="Queue order for new sessions at this location"
            >
              {data.policy.smartQueueEnabled
                ? 'Smart queue'
                : 'First come, first served'}
            </Badge>
          )}
          <ViewToggle value={view} onChange={setView} size="sm" />
          <TooltipButton
            tooltip="Refresh"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => void refetch()}
          >
            <RefreshCw
              className={cn('size-3.5', isFetching && 'animate-spin')}
            />
          </TooltipButton>
          {locationId && (
            <TooltipButton
              tooltip="Open the waiting-room TV display"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() =>
                window.open(`/display/${locationId}`, '_blank', 'noopener')
              }
            >
              <MonitorPlay className="size-3.5" />
            </TooltipButton>
          )}
          {role.canCheckIn && (
            <Button size="sm" className="h-8" onClick={() => setWalkInFor('')}>
              <Plus className="size-3.5" /> Walk-in
            </Button>
          )}
        </div>
      </div>

      {/* Content + states */}
      {isLoading ? (
        <LoadingSkeleton
          variant={view === 'card' ? 'cards' : 'table'}
          rows={6}
        />
      ) : isError ? (
        <ErrorState
          title="Could not load the queue"
          onRetry={() => void refetch()}
        />
      ) : lanes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No doctors at this location yet"
          description="Assign doctors to this location to start taking patients."
        />
      ) : !anyMatch ? (
        <NoResultsState
          message="No patients match your filters"
          onClear={clearFilters}
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleLanes.map((lane) => (
            <QueueLaneCard
              key={lane.doctor.id}
              lane={lane}
              q={q}
              now={now}
              policy={data!.policy}
              role={role}
              handlers={handlers}
              onWalkIn={() => setWalkInFor(lane.doctor.id)}
              onForceComplete={setForceTarget}
              onSetMode={(sessionId, smart) =>
                setMode.mutate({ sessionId, smart })
              }
            />
          ))}
        </div>
      ) : (
        <QueueEntriesTable
          lanes={visibleLanes}
          q={q}
          now={now}
          policy={data!.policy}
          role={role}
          handlers={handlers}
        />
      )}

      <WalkInSheet
        open={walkInFor !== null}
        defaultDoctorId={walkInFor || undefined}
        onOpenChange={(o) => {
          if (!o) setWalkInFor(null)
        }}
      />
      <ReasonDialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null)
        }}
        title={`Remove ${cancelTarget?.token ?? ''} from the queue?`}
        description={`${cancelTarget?.patient?.fullName ?? 'The patient'} leaves the queue. The token is never given to anyone else.`}
        placeholder="e.g. Left without being seen"
        confirmLabel="Remove from queue"
        destructive
        isLoading={cancel.isPending}
        onConfirm={(reason) => {
          if (cancelTarget)
            cancel.mutate(
              { entry: cancelTarget, reason },
              { onSuccess: () => setCancelTarget(null) },
            )
        }}
      />
      <ReasonDialog
        open={!!urgentTarget}
        onOpenChange={(o) => {
          if (!o) setUrgentTarget(null)
        }}
        title={`Urgent priority for ${urgentTarget?.token ?? ''}`}
        description="The patient goes ahead of everyone else waiting for this doctor."
        required
        placeholder="e.g. Severe bleeding"
        confirmLabel="Give urgent priority"
        isLoading={urgent.isPending}
        onConfirm={(reason) => {
          if (urgentTarget)
            urgent.mutate(
              { entry: urgentTarget, reason },
              { onSuccess: () => setUrgentTarget(null) },
            )
        }}
      />
      <TransferDialog
        entry={transferTarget?.entry ?? null}
        currentDoctorId={transferTarget?.doctorId}
        onOpenChange={(o) => {
          if (!o) setTransferTarget(null)
        }}
        isLoading={transfer.isPending}
        onConfirm={(toDoctorId, reason) => {
          if (transferTarget) {
            transfer.mutate(
              { entry: transferTarget.entry, toDoctorId, reason },
              { onSuccess: () => setTransferTarget(null) },
            )
          }
        }}
      />
      <ConfirmDialog
        open={!!forceTarget}
        onOpenChange={(o) => {
          if (!o) setForceTarget(null)
        }}
        title={`Complete ${forceTarget?.token ?? ''} for the doctor?`}
        description="Use this when the doctor finished the visit but forgot to press Complete. It is recorded in the queue history."
        confirmLabel="Mark completed"
        isLoading={forceComplete.isPending}
        onConfirm={() => {
          if (forceTarget)
            forceComplete.mutate(forceTarget, {
              onSuccess: () => setForceTarget(null),
            })
        }}
      />
    </div>
  )
}
