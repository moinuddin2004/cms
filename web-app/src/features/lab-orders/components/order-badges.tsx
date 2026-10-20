import { StatusBadge } from '@/components/shared'
import { ITEM_STATUS_LABEL, ORDER_STATUS_LABEL, statusLabel } from '../types'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'muted'

const ORDER_TONE: Record<string, Tone> = {
  draft: 'muted',
  submitted: 'info',
  clarification_needed: 'warning',
  rejected_by_lab: 'danger',
  accepted: 'info',
  in_progress: 'violet',
  on_hold: 'warning',
  partially_ready: 'violet',
  ready: 'success',
  partially_received: 'violet',
  under_review: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

const ITEM_TONE: Record<string, Tone> = {
  pending_acceptance: 'info',
  in_production: 'violet',
  at_clinic_tryin: 'warning',
  qc: 'violet',
  ready: 'success',
  approved: 'success',
  delivered: 'success',
  rejected: 'danger',
  cancelled: 'danger',
  remake_required: 'danger',
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      status={status}
      tone={ORDER_TONE[status] ?? 'muted'}
      label={statusLabel(status)}
    />
  )
}

export function ItemStatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <StatusBadge
      status={status}
      tone={ITEM_TONE[status] ?? 'info'}
      label={statusLabel(status, ITEM_STATUS_LABEL)}
    />
  )
}

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABEL).map(
  ([value, label]) => ({ value, label }),
)
