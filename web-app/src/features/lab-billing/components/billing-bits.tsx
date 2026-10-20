import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper, StatusBadge } from '@/components/shared'
import { formatPaisa } from '@/features/lab-catalog'
import { cn } from '@/lib/utils'
import { STATUS_LABEL } from '../types'
import type { LabInvoiceStatus } from '../types'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'muted'

const TONE: Record<LabInvoiceStatus, Tone> = {
  draft: 'violet',
  issued: 'info',
  partially_paid: 'warning',
  paid: 'success',
  void: 'muted',
}

export function LabInvoiceStatusBadge({
  status,
  overdue,
}: {
  status: LabInvoiceStatus
  overdue?: boolean
}) {
  if (overdue)
    return <StatusBadge status="overdue" tone="danger" label="Overdue" />
  return (
    <StatusBadge
      status={status}
      tone={TONE[status]}
      label={STATUS_LABEL[status]}
    />
  )
}

export const STATUS_OPTIONS: {
  value: LabInvoiceStatus | 'overdue'
  label: string
}[] = [
  { value: 'draft', label: 'Estimate' },
  { value: 'issued', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partly paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
]

/** Right-aligned paisa amount; muted when zero. */
export function Paisa({
  value,
  className,
  strong,
}: {
  value: number
  className?: string
  strong?: boolean
}) {
  return (
    <span
      className={cn(
        'tabular-nums',
        strong && 'font-semibold',
        value === 0 && !strong && 'text-text-3',
        className,
      )}
    >
      {formatPaisa(value)}
    </span>
  )
}

export function MoneyRow({
  label,
  value,
  strong,
  negative,
}: {
  label: string
  value: number
  strong?: boolean
  negative?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={strong ? 'font-medium' : 'text-text-3'}>{label}</span>
      <Paisa value={negative && value ? -value : value} strong={strong} />
    </div>
  )
}

/** Confirm a money correction, asking for the reason that goes on record. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isLoading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  isLoading: boolean
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const short = reason.trim().length < 3
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isLoading) {
          setReason('')
          onOpenChange(o)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FieldWrapper label="Reason" htmlFor="billing-reason" required>
          <Textarea
            id="billing-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FieldWrapper>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            Back
          </Button>
          <Button
            variant="destructive"
            disabled={short || isLoading}
            onClick={() => onConfirm(reason.trim())}
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
