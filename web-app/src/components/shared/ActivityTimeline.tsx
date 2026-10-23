import { format } from 'date-fns'
import { ArrowRight, History, Pencil, Plus, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'

/** One row of a record's history, as the backend `AuditService.timeline()` returns it. */
export interface TimelineEntry {
  id: string
  kind: 'audit' | 'status'
  /** Present on merged histories (one subject, many record types). */
  entityType?: string
  entityId?: string
  action: string
  fromState: string | null
  toState: string | null
  /** Null when nothing was recorded, or the reader may not see the values. */
  changes: {
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
  } | null
  reason: string | null
  actorSide: 'clinic' | 'lab' | 'platform' | 'system'
  via: string | null
  actor: { id: string; name: string | null } | null
  createdAt: string
}

const SIDE_LABEL: Record<TimelineEntry['actorSide'], string> = {
  clinic: 'clinic',
  lab: 'lab',
  platform: 'platform team',
  system: 'system',
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

const humanize = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) {
    return v.every((x) => typeof x !== 'object')
      ? v.map(humanize).join(', ') || '—'
      : `${v.length} item${v.length === 1 ? '' : 's'}`
  }
  if (typeof v === 'object') return '(details)'
  if (typeof v === 'string' && ISO_DATETIME.test(v)) {
    return format(new Date(v), 'd MMM yyyy, h:mm a')
  }
  return String(v).replace(/_/g, ' ')
}

/** `bpSystolic` → `Bp systolic`, for fields without a label. */
const fieldName = (key: string, labels: Record<string, string>) =>
  labels[key] ??
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())

interface DescribeOptions {
  fieldLabels: Record<string, string>
  entityLabels?: Record<string, string>
  hiddenFields: ReadonlySet<string>
}

function describe(
  entry: TimelineEntry,
  { fieldLabels, entityLabels, hiddenFields }: DescribeOptions,
): { title: string; lines: string[] } {
  const subject =
    entityLabels && entry.entityType
      ? (entityLabels[entry.entityType] ?? fieldName(entry.entityType, {}))
      : null
  const titled = (verb: string) =>
    subject ? `${subject} ${verb.toLowerCase()}` : verb

  if (entry.kind === 'status') {
    const move = entry.fromState
      ? `${humanize(entry.fromState)} → ${humanize(entry.toState)}`
      : `created as ${humanize(entry.toState)}`
    return {
      title: subject ? `${subject}: ${move}` : move.replace(/^c/, 'C'),
      lines: entry.reason ? [`Reason: ${entry.reason}`] : [],
    }
  }

  const shown = (key: string) =>
    !hiddenFields.has(key) && (!key.endsWith('Id') || key in fieldLabels)
  const verb =
    entry.action === 'create'
      ? 'Created'
      : entry.action === 'delete'
        ? 'Deleted'
        : entry.action === 'update'
          ? 'Edited'
          : humanize(entry.action).replace(/^./, (c) => c.toUpperCase())
  if (!entry.changes) {
    return { title: titled(verb), lines: ['Details are not shown to you.'] }
  }

  const after = entry.changes.after ?? {}
  const before = entry.changes.before ?? {}
  if (entry.action === 'create') {
    return {
      title: titled(verb),
      lines: Object.entries(after)
        .filter(([k, v]) => shown(k) && v !== null)
        .map(([k, v]) => `${fieldName(k, fieldLabels)}: ${humanize(v)}`),
    }
  }
  if (entry.action === 'delete') {
    const linked = before.linkedRecords as Record<string, number> | undefined
    const lines = Object.entries(linked ?? {}).map(
      ([table, n]) => `${n} ${table.replace(/_/g, ' ')} removed with it`,
    )
    return { title: titled(verb), lines }
  }
  return {
    title: titled(verb),
    lines: Object.keys(after)
      .filter(shown)
      .map(
        (k) =>
          `${fieldName(k, fieldLabels)}: ${humanize(before[k])} → ${humanize(after[k])}`,
      ),
  }
}

function iconFor(entry: TimelineEntry) {
  if (entry.kind === 'status') return ArrowRight
  if (entry.action === 'create') return Plus
  if (entry.action === 'delete') return Trash2
  return Pencil
}

const NO_FIELDS: ReadonlySet<string> = new Set()

/** Newest-first history of a record: who changed what, and when. */
export function ActivityTimeline({
  entries,
  isLoading,
  isError,
  onRetry,
  fieldLabels = {},
  entityLabels,
  hiddenFields = NO_FIELDS,
}: {
  entries: TimelineEntry[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  /** Display names for fields; unlabelled `…Id` fields are not listed. */
  fieldLabels?: Record<string, string>
  /** Display names per `entityType`, for merged histories. */
  entityLabels?: Record<string, string>
  /** Fields never listed. */
  hiddenFields?: ReadonlySet<string>
}) {
  if (isLoading) return <LoadingSkeleton variant="detail" />
  if (isError) return <ErrorState onRetry={onRetry} />
  if (!entries?.length) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Every change to this record will be listed here."
      />
    )
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, i) => {
        const { title, lines } = describe(entry, {
          fieldLabels,
          entityLabels,
          hiddenFields,
        })
        const Icon = iconFor(entry)
        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < entries.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border"
              />
            )}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="size-3.5 text-text-3" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm font-medium">{title}</p>
              {lines.map((line) => (
                <p key={line} className="break-words text-xs text-text-2">
                  {line}
                </p>
              ))}
              <p className="mt-1 text-xs text-text-3">
                {format(new Date(entry.createdAt), 'd MMM yyyy, h:mm a')}
                {' · '}
                {entry.actor?.name ?? 'System'} ({SIDE_LABEL[entry.actorSide]})
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
