import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared'
import { LAB_TYPE_LABEL, LINK_STATUS_LABEL } from '../types'
import type { LabLinkStatus, LabStatus, LabType } from '../types'

export function LabStatusBadge({ status }: { status: LabStatus }) {
  return (
    <StatusBadge
      status={status}
      tone={status === 'active' ? 'success' : 'danger'}
    />
  )
}

const LINK_TONE = {
  invited: 'warning',
  active: 'success',
  suspended: 'danger',
} as const

export function LinkStatusBadge({ status }: { status: LabLinkStatus }) {
  return (
    <StatusBadge
      status={status}
      tone={LINK_TONE[status]}
      label={LINK_STATUS_LABEL[status]}
    />
  )
}

export function LabTypeBadge({ type }: { type: LabType }) {
  return (
    <Badge variant={type === 'internal' ? 'violet' : 'outline'}>
      {LAB_TYPE_LABEL[type]}
    </Badge>
  )
}
