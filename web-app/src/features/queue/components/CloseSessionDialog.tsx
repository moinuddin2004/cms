import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDoctors } from '@/features/appointments'
import { ENTRY_STATUS_LABELS } from '../types'
import type { CloseDecision, QueueEntry } from '../types'

/**
 * End the day. Every patient still waiting, skipped or at a test needs a
 * decision — cancel, or transfer (waiting patients only) to another doctor.
 */
export function CloseSessionDialog({
  open,
  onOpenChange,
  remaining,
  doctorId,
  isLoading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  remaining: QueueEntry[]
  doctorId: string
  isLoading?: boolean
  onConfirm: (decisions: CloseDecision[]) => void
}) {
  const { data: doctors = [] } = useDoctors()
  const [choice, setChoice] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open)
      setChoice(Object.fromEntries(remaining.map((e) => [e.id, 'cancel'])))
  }, [open])

  const decisions: CloseDecision[] = remaining.map((e) => {
    const c = choice[e.id] ?? 'cancel'
    return c === 'cancel'
      ? { entryId: e.id, action: 'cancel' }
      : { entryId: e.id, action: 'transfer', toDoctorId: c }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Close today's queue</DialogTitle>
          <DialogDescription>
            {remaining.length === 0
              ? 'Nobody is left in your queue.'
              : `Decide for each of the ${remaining.length} patient(s) still in your queue.`}
          </DialogDescription>
        </DialogHeader>
        {remaining.length > 0 && (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {remaining.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="w-16 font-mono text-sm font-bold">
                  {e.token}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{e.patient?.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ENTRY_STATUS_LABELS[e.status]}
                  </p>
                </div>
                <Select
                  value={choice[e.id] ?? 'cancel'}
                  onValueChange={(v) => setChoice((c) => ({ ...c, [e.id]: v }))}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cancel">Cancel</SelectItem>
                    {e.status === 'waiting' &&
                      doctors
                        .filter((d) => d.id !== doctorId)
                        .map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            Transfer → Dr. {d.fullName}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Back
          </Button>
          <Button
            variant="destructive"
            disabled={isLoading}
            onClick={() => onConfirm(decisions)}
          >
            {isLoading && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Close queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
