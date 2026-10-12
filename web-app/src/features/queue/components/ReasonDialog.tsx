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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Confirm a queue action with a (required or optional) reason — cancel,
 * urgent priority, pause, send for test, stop consultation, select out of
 * order. Destructive actions show a red confirm button.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = 'Reason',
  placeholder,
  required = false,
  confirmLabel,
  destructive = false,
  isLoading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label?: string
  placeholder?: string
  required?: boolean
  confirmLabel: string
  destructive?: boolean
  isLoading?: boolean
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (open) {
      setReason('')
      setTouched(false)
    }
  }, [open])
  const missing = required && !reason.trim()

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="queue-reason" className="text-xs">
            {label} {required ? '*' : '(optional)'}
          </Label>
          <Textarea
            id="queue-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            rows={2}
            autoFocus
          />
          {touched && missing && (
            <p className="text-xs text-red-500">{label} is required.</p>
          )}
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
            variant={destructive ? 'destructive' : 'default'}
            disabled={isLoading || missing}
            onClick={() => onConfirm(reason.trim())}
          >
            {isLoading && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
