import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { VisitNotes } from '../types'

export type RxSummary = 'none' | 'draft' | 'signed'

/**
 * One last look before the visit ends. It only reminds — the doctor can always
 * finish anyway, because a quick check-up may genuinely need no prescription.
 */
export function CompleteDialog({
  open,
  onOpenChange,
  notes,
  treatmentCount,
  rx,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  notes: VisitNotes
  treatmentCount: number
  rx: RxSummary
  pending: boolean
  onConfirm: () => void
}) {
  const hasNotes = Boolean(
    notes.diagnosis.trim() || notes.chiefComplaint.trim(),
  )
  const rows: { ok: boolean; text: string }[] = [
    {
      ok: hasNotes,
      text: hasNotes
        ? 'Visit notes written'
        : 'No complaint or diagnosis written',
    },
    {
      ok: treatmentCount > 0,
      text:
        treatmentCount > 0
          ? `${treatmentCount} treatment${treatmentCount > 1 ? 's' : ''} recorded`
          : 'No treatment recorded',
    },
    {
      ok: rx === 'signed',
      text:
        rx === 'signed'
          ? 'Prescription signed'
          : rx === 'draft'
            ? 'Prescription is still a draft — not signed'
            : 'No prescription written',
    },
    {
      ok: Boolean(notes.followUpDate),
      text: notes.followUpDate
        ? `Next visit: ${format(new Date(`${notes.followUpDate}T12:00:00`), 'dd MMM yyyy')}`
        : 'No next visit set',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete this visit?</DialogTitle>
          <DialogDescription>
            The patient leaves your queue and reception is told you are done.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.text}
              className={cn(
                'flex items-center gap-2 text-sm',
                r.ok ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {r.ok ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-amber" />
              )}
              {r.text}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            variant="outline"
            className="h-11"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Keep working
          </Button>
          <Button
            className="h-11 bg-emerald text-white hover:bg-emerald/90"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Complete visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
