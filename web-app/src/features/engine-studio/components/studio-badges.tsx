import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared'
import type { DefinitionStatus, Owner } from '../types'

const STATUS_TONE = {
  draft: 'warning',
  published: 'success',
  retired: 'muted',
} as const

const STATUS_LABEL: Record<DefinitionStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  retired: 'Retired',
}

export function DefinitionStatusBadge({
  status,
}: {
  status: DefinitionStatus
}) {
  return (
    <StatusBadge
      status={status}
      tone={STATUS_TONE[status]}
      label={STATUS_LABEL[status]}
    />
  )
}

/** Platform default, or the organization that forked it. */
export function OwnerBadge({ owner }: { owner: Owner | null }) {
  return owner ? (
    <Badge variant="violet" className="max-w-48 truncate">
      {owner.name}
    </Badge>
  ) : (
    <Badge variant="outline">Platform default</Badge>
  )
}

/** "v3 live · v4 draft" for list rows and cards. */
export function VersionSummary({
  current,
  draft,
}: {
  current: { versionNo: number } | null
  draft: { versionNo: number } | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current ? (
        <Badge variant="success">v{current.versionNo} published</Badge>
      ) : (
        <Badge variant="muted">Not published</Badge>
      )}
      {draft && <Badge variant="warning">v{draft.versionNo} draft</Badge>}
    </div>
  )
}
