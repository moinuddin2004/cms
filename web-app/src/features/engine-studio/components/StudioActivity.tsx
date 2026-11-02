import { History } from 'lucide-react'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { formatInClinic } from '@/lib/datetime'
import { formatValue } from '../lib/diff'
import type { TimelineEntry } from '../types'

/** JSON blocks are too big for a line — just say they changed. */
const BLOCKS = new Set(['schemaJson', 'uiJson', 'promotions', 'definition'])

function describe(e: TimelineEntry): { title: string; lines: string[] } {
  if (e.kind === 'status') {
    return {
      title: e.fromState
        ? `${e.fromState} → ${e.toState}`
        : `Created as ${e.toState}`,
      lines: e.reason ? [`Reason: ${e.reason}`] : [],
    }
  }
  const before = e.changes?.before ?? {}
  const after = e.changes?.after ?? {}
  const lines = Object.keys(after).map((k) =>
    BLOCKS.has(k)
      ? `${k} changed`
      : e.action === 'create'
        ? `${k}: ${formatValue(after[k])}`
        : `${k}: ${formatValue(before[k])} → ${formatValue(after[k])}`,
  )
  return { title: e.action === 'create' ? 'Created' : 'Edited', lines }
}

/** Newest-first audit trail of a form schema and its versions. */
export function StudioActivity({
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
        description="Every change to this form and its versions is listed here."
      />
    )
  }
  return (
    <ol className="divide-y divide-border rounded-lg border border-border bg-card">
      {entries.map((entry) => {
        const { title, lines } = describe(entry)
        return (
          <li key={entry.id} className="px-4 py-3">
            <p className="text-sm font-medium">{title}</p>
            {lines.map((line) => (
              <p key={line} className="break-words text-xs text-text-2">
                {line}
              </p>
            ))}
            <p className="mt-1 text-xs text-text-3">
              {formatInClinic(entry.createdAt, 'd MMM yyyy, h:mm a')} ·{' '}
              {entry.actor?.name ?? 'System'}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
