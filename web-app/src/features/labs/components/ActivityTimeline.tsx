import { format } from 'date-fns'
import { ArrowRight, History, Pencil, Plus } from 'lucide-react'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import type { TimelineEntry } from '../types'

const FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  phone: 'Phone',
  whatsappPhone: 'WhatsApp',
  email: 'Email',
  city: 'City',
  address: 'Address',
  status: 'Status',
  role: 'Role',
  isActive: 'Active',
  paymentTermsDays: 'Payment terms (days)',
  patientDataLevel: 'Patient data shared',
  notes: 'Notes',
}

/** Fields that only identify the record — not worth a line on create. */
const HIDDEN_ON_CREATE = new Set(['labId', 'userId', 'ownerOrganizationId'])

const SIDE_LABEL: Record<TimelineEntry['actorSide'], string> = {
  clinic: 'clinic',
  lab: 'lab',
  platform: 'platform team',
  system: 'system',
}

const humanize = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v).replace(/_/g, ' ')
}

function describe(entry: TimelineEntry): { title: string; lines: string[] } {
  if (entry.kind === 'status') {
    return {
      title: entry.fromState
        ? `${humanize(entry.fromState)} → ${humanize(entry.toState)}`
        : `Created as ${humanize(entry.toState)}`,
      lines: entry.reason ? [`Reason: ${entry.reason}`] : [],
    }
  }
  const after = entry.changes?.after ?? {}
  const before = entry.changes?.before ?? {}
  if (entry.action === 'create') {
    return {
      title: 'Created',
      lines: Object.entries(after)
        .filter(([k, v]) => !HIDDEN_ON_CREATE.has(k) && v !== null)
        .map(([k, v]) => `${FIELD_LABEL[k] ?? k}: ${humanize(v)}`),
    }
  }
  return {
    title: 'Edited',
    lines: Object.keys(after).map(
      (k) =>
        `${FIELD_LABEL[k] ?? k}: ${humanize(before[k])} → ${humanize(after[k])}`,
    ),
  }
}

const ICON = {
  status: ArrowRight,
  create: Plus,
  edit: Pencil,
}

/** Newest-first history of one record: who changed what, and when. */
export function ActivityTimeline({
  entries,
  isLoading,
  isError,
  onRetry,
}: {
  entries: TimelineEntry[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
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
        const { title, lines } = describe(entry)
        const Icon =
          entry.kind === 'status'
            ? ICON.status
            : entry.action === 'create'
              ? ICON.create
              : ICON.edit
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
