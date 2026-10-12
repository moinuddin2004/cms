import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Printer, Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { checkInAppointment, convertToWalkIn } from '../services/queue.api'
import { useQueueAction } from '../hooks/useQueueAction'
import { printQueueTicket } from '../utils/printTicket'
import type { ArrivalResult } from '../types'

export interface CheckInTarget {
  id: string
  patientName?: string | null
  doctorName?: string | null
  startTime: string
  isEmergency?: boolean
}

function tokenToast(result: ArrivalResult, prefix: string) {
  toast.success(`${prefix} — token ${result.token}`, {
    description: result.entry.patient?.fullName ?? undefined,
    action: {
      label: 'Print ticket',
      onClick: () => void printQueueTicket(result.entry.id),
    },
    duration: 8000,
  })
}

/**
 * Check a booked patient in. Asks "Urgent priority?" first (emergency
 * bookings never jump the queue on their own). If the patient is past the
 * late limit, offers "Convert to walk-in" instead.
 */
export function CheckInDialog({
  target,
  onOpenChange,
}: {
  target: CheckInTarget | null
  onOpenChange: (open: boolean) => void
}) {
  const [urgent, setUrgent] = useState(false)
  const [reason, setReason] = useState('')
  const [tooLate, setTooLate] = useState<string | null>(null)

  useEffect(() => {
    setUrgent(false)
    setReason('')
    setTooLate(null)
  }, [target?.id])

  const checkIn = useQueueAction(
    (args: { id: string; urgentReason?: string }) =>
      checkInAppointment(args.id, args.urgentReason),
    {
      onError: (err) => {
        if (err.code === 'LATE_LIMIT_EXCEEDED') {
          setTooLate(err.message)
          return true
        }
        if (err.code === 'ALREADY_CHECKED_IN') {
          const token = err.data?.entry?.token
          toast.info(
            token ? `Already checked in — token ${token}` : err.message,
          )
          onOpenChange(false)
          return true
        }
      },
    },
  )
  const convert = useQueueAction((id: string) => convertToWalkIn(id))

  if (!target) return null
  const busy = checkIn.isPending || convert.isPending
  const urgentInvalid = urgent && !reason.trim()

  const submit = async () => {
    if (tooLate) {
      const result = await convert.mutateAsync(target.id).catch(() => null)
      if (result) {
        tokenToast(result, 'Added as walk-in')
        onOpenChange(false)
      }
      return
    }
    const result = await checkIn
      .mutateAsync({
        id: target.id,
        urgentReason: urgent ? reason.trim() : undefined,
      })
      .catch(() => null)
    if (result) {
      tokenToast(result, 'Checked in')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {tooLate ? 'Too late for the appointment' : 'Check in patient'}
          </DialogTitle>
          <DialogDescription>
            {target.patientName ?? 'Patient'}
            {target.doctorName ? ` · Dr. ${target.doctorName}` : ''} ·{' '}
            {new Date(target.startTime).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </DialogDescription>
        </DialogHeader>

        {tooLate ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p>{tooLate}</p>
              <p className="mt-1 text-xs">
                The appointment will be marked as a no-show and the patient
                joins the same doctor's queue as a walk-in with a new token.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {target.isEmergency && (
              <p className="text-xs text-slate-500">
                This booking is marked emergency. It does not move ahead on its
                own — give urgent priority below if needed.
              </p>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="urgent"
                checked={urgent}
                onCheckedChange={(v) => setUrgent(v === true)}
              />
              <Label
                htmlFor="urgent"
                className="flex items-center gap-1 text-sm"
              >
                <Zap className="size-3.5 text-red-500" /> Give urgent priority?
              </Label>
            </div>
            {urgent && (
              <div className="space-y-1">
                <Label htmlFor="urgent-reason" className="text-xs">
                  Reason (required)
                </Label>
                <Textarea
                  id="urgent-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. severe bleeding, chest pain"
                  rows={2}
                />
                {urgentInvalid && (
                  <p className="text-xs text-red-500">
                    Enter a reason for urgent priority.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || (!tooLate && urgentInvalid)}
          >
            {busy ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Printer className="mr-1.5 size-4" />
            )}
            {tooLate ? 'Convert to walk-in' : 'Check in & get token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
