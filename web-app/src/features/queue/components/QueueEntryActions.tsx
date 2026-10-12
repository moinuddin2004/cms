import { useState } from 'react'
import {
  ArrowRightLeft,
  FlaskConical,
  MoreVertical,
  Printer,
  RotateCcw,
  SkipForward,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { entryAction, rejoinEntry } from '../services/queue.api'
import { useQueueAction } from '../hooks/useQueueAction'
import type { useQueueRole } from '../hooks/useQueueRole'
import type { QueueEntry, RejoinPolicy } from '../types'
import { printQueueTicket } from '../utils/printTicket'

export interface EntryActionHandlers {
  onCancel: (e: QueueEntry) => void
  onUrgent: (e: QueueEntry) => void
  onTransfer: (e: QueueEntry, doctorId: string) => void
}

/**
 * Reception actions for one queue entry, by status and role:
 * called → "Didn't come"; at a test → "Back from test"; skipped → "Rejoin";
 * plus a menu (print ticket, transfer, urgent priority, remove). Buttons the
 * user's role can't use are hidden — the API enforces the same rules.
 */
export function QueueEntryActions({
  entry,
  doctorId,
  role,
  rejoinPolicy,
  waiting,
  handlers,
}: {
  entry: QueueEntry
  doctorId: string
  role: ReturnType<typeof useQueueRole>
  rejoinPolicy: RejoinPolicy
  waiting: QueueEntry[]
  handlers: EntryActionHandlers
}) {
  const canSkip = role.canReception || role.isDoctorOf(doctorId)
  return (
    <div className="flex items-center justify-end gap-1">
      {entry.status === 'called' && canSkip && <SkipButton entry={entry} />}
      {entry.status === 'on_hold' && role.canReception && (
        <ReturnFromTestButton entry={entry} />
      )}
      {entry.status === 'skipped' && role.canReception && (
        <RejoinButton entry={entry} policy={rejoinPolicy} waiting={waiting} />
      )}
      <EntryMenu
        entry={entry}
        doctorId={doctorId}
        role={role}
        handlers={handlers}
      />
    </div>
  )
}

function EntryMenu({
  entry,
  doctorId,
  role,
  handlers,
}: {
  entry: QueueEntry
  doctorId: string
  role: ReturnType<typeof useQueueRole>
  handlers: EntryActionHandlers
}) {
  const stillWaiting = ['waiting', 'skipped', 'on_hold'].includes(entry.status)
  const canTransfer =
    (entry.status === 'waiting' && role.canReception) ||
    (entry.status === 'in_consultation' && role.isDoctorOf(doctorId))
  const canUrgent =
    role.isAdmin && stillWaiting && entry.priorityClass !== 'authorized_urgent'
  const canRemove = role.canReception && stillWaiting

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TooltipButton
          tooltip={`Actions for ${entry.token}`}
          variant="ghost"
          size="icon"
          className="size-7"
        >
          <MoreVertical className="size-3.5" />
        </TooltipButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void printQueueTicket(entry.id)}>
          <Printer className="mr-2 size-3.5" /> Print ticket
        </DropdownMenuItem>
        {canTransfer && (
          <DropdownMenuItem
            onClick={() => handlers.onTransfer(entry, doctorId)}
          >
            <ArrowRightLeft className="mr-2 size-3.5" /> Transfer to another
            doctor
          </DropdownMenuItem>
        )}
        {canUrgent && (
          <DropdownMenuItem onClick={() => handlers.onUrgent(entry)}>
            <Zap className="mr-2 size-3.5" /> Urgent priority
          </DropdownMenuItem>
        )}
        {canRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => handlers.onCancel(entry)}
            >
              <X className="mr-2 size-3.5" /> Remove from queue
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SkipButton({ entry }: { entry: QueueEntry }) {
  const skip = useQueueAction(
    () => entryAction(entry.id, 'skip', entry.version),
    {
      success: () => `${entry.token} skipped`,
    },
  )
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7"
      disabled={skip.isPending}
      onClick={() => skip.mutate(undefined)}
    >
      <SkipForward className="size-3.5" /> Didn&apos;t come
    </Button>
  )
}

function ReturnFromTestButton({ entry }: { entry: QueueEntry }) {
  const back = useQueueAction(
    () => entryAction(entry.id, 'return-from-test', entry.version),
    {
      success: () => `${entry.token} is back in the queue`,
    },
  )
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7"
      disabled={back.isPending}
      onClick={() => back.mutate(undefined)}
    >
      <FlaskConical className="size-3.5" /> Back from test
    </Button>
  )
}

/** Rejoin per policy; MANUAL asks where to place the patient. */
function RejoinButton({
  entry,
  policy,
  waiting,
}: {
  entry: QueueEntry
  policy: RejoinPolicy
  waiting: QueueEntry[]
}) {
  const [after, setAfter] = useState('')
  const rejoin = useQueueAction(
    (placeAfter: string | undefined) =>
      rejoinEntry(entry.id, entry.version, placeAfter),
    { success: () => `${entry.token} is back in the queue` },
  )
  if (policy === 'manual' && waiting.length > 0) {
    return (
      <div className="flex items-center gap-1">
        <Select value={after} onValueChange={setAfter}>
          <SelectTrigger
            className="h-7 w-[110px] text-xs"
            aria-label="Place after"
          >
            <SelectValue placeholder="Place after…" />
          </SelectTrigger>
          <SelectContent>
            {waiting.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.token}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={!after || rejoin.isPending}
          onClick={() => rejoin.mutate(after)}
        >
          <RotateCcw className="size-3.5" /> Rejoin
        </Button>
      </div>
    )
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7"
      disabled={rejoin.isPending}
      onClick={() => rejoin.mutate(undefined)}
    >
      <RotateCcw className="size-3.5" /> Rejoin
    </Button>
  )
}
