import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Issue } from '../types'

/** Problems that block publishing, or answers the server rejected. */
export function IssuesList({
  issues,
  title = 'Fix before publishing',
  okText = 'No issues — ready to publish.',
  className,
}: {
  issues: Issue[]
  title?: string
  okText?: string
  className?: string
}) {
  if (!issues.length) {
    return (
      <p
        className={cn(
          'flex items-center gap-2 rounded-lg border border-emerald/30 bg-emerald-soft px-3 py-2 text-sm text-emerald',
          className,
        )}
        role="status"
      >
        <CheckCircle2 className="size-4 shrink-0" /> {okText}
      </p>
    )
  }
  return (
    <div
      className={cn(
        'rounded-lg border border-amber/30 bg-amber-soft px-3 py-2',
        className,
      )}
      role="alert"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-amber">
        <AlertTriangle className="size-4 shrink-0" />
        {title} ({issues.length})
      </p>
      <ul className="mt-1.5 space-y-1 text-sm">
        {issues.map((i, n) => (
          <li key={`${i.path}-${i.code}-${n}`} className="flex gap-2">
            {i.path && (
              <code className="shrink-0 rounded bg-panel-2 px-1 text-xs text-text-2">
                {i.path}
              </code>
            )}
            <span>{i.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
