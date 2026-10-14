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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { useDoctors } from '@/features/appointments'
import type { QueueEntry } from '../types'

/** Move a patient to another doctor; they get a new token in that queue. */
export function TransferDialog({
  entry,
  currentDoctorId,
  onOpenChange,
  isLoading,
  onConfirm,
}: {
  entry: QueueEntry | null
  currentDoctorId?: string
  onOpenChange: (open: boolean) => void
  isLoading?: boolean
  onConfirm: (toDoctorId: string, reason: string) => void
}) {
  const { data: doctors = [] } = useDoctors()
  const [toDoctorId, setToDoctorId] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => {
    setToDoctorId('')
    setReason('')
  }, [entry?.id])

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Transfer {entry?.token}</DialogTitle>
          <DialogDescription>
            {entry?.patient?.fullName} gets a new token in the other doctor's
            queue, keeping their original arrival time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">To doctor *</Label>
            <Select value={toDoctorId} onValueChange={setToDoctorId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose a doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors
                  .filter((d) => d.id !== currentDoctorId)
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Dr. {d.fullName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Back
          </Button>
          <Button
            disabled={!toDoctorId || isLoading}
            onClick={() => onConfirm(toDoctorId, reason.trim())}
          >
            {isLoading && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
