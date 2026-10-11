import { StatusBadge } from '@/components/shared'
import { PrescriptionStatus } from '../types'

const TONE = {
  [PrescriptionStatus.DRAFT]: 'warning',
  [PrescriptionStatus.FINALIZED]: 'success',
  [PrescriptionStatus.AMENDED]: 'violet',
} as const

const LABEL: Record<PrescriptionStatus, string> = {
  [PrescriptionStatus.DRAFT]: 'Draft',
  [PrescriptionStatus.FINALIZED]: 'Finalized',
  [PrescriptionStatus.AMENDED]: 'Amended',
}

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  return (
    <StatusBadge
      status={status}
      tone={TONE[status]}
      label={LABEL[status]}
      className="gap-1.5"
    />
  )
}
