import { StatusBadge } from '@/components/shared'
import {
  BILL_STATUS_LABEL,
  MATCH_LABEL,
  STATEMENT_STATUS_LABEL,
} from '../types'
import type { BillStatus, MatchStatus, StatementStatus } from '../types'

const BILL_TONE = {
  draft: 'info',
  approved: 'violet',
  partially_paid: 'warning',
  paid: 'success',
  void: 'muted',
} as const

export function BillStatusBadge({ status }: { status: BillStatus }) {
  return (
    <StatusBadge
      status={status}
      tone={BILL_TONE[status]}
      label={BILL_STATUS_LABEL[status]}
    />
  )
}

const MATCH_TONE = {
  matched: 'success',
  amount_mismatch: 'warning',
  missing_in_system: 'danger',
  missing_in_statement: 'danger',
} as const

export function MatchBadge({ status }: { status: MatchStatus }) {
  return (
    <StatusBadge
      status={status}
      tone={MATCH_TONE[status]}
      label={MATCH_LABEL[status]}
    />
  )
}

const STATEMENT_TONE = {
  uploaded: 'info',
  reconciling: 'warning',
  reconciled: 'success',
  disputed: 'danger',
} as const

export function StatementStatusBadge({ status }: { status: StatementStatus }) {
  return (
    <StatusBadge
      status={status}
      tone={STATEMENT_TONE[status]}
      label={STATEMENT_STATUS_LABEL[status]}
    />
  )
}

export const BILL_STATUS_OPTIONS = (
  Object.keys(BILL_STATUS_LABEL) as BillStatus[]
).map((value) => ({ value, label: BILL_STATUS_LABEL[value] }))
