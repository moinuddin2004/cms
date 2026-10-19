import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { diffWorkflow, transitionLabel } from '../lib/diff'
import { useWorkflowVersion } from '../hooks/useWorkflows'
import type { VersionRow } from '../types'
import { DiffSection, VersionPickers } from './DiffView'

/** States and transitions added / removed / changed between two versions. */
export function WorkflowCompare({
  templateId,
  versions,
  baseId,
  targetId,
  onBase,
  onTarget,
}: {
  templateId: string
  versions: VersionRow[]
  baseId: string
  targetId: string
  onBase: (id: string) => void
  onTarget: (id: string) => void
}) {
  const a = useWorkflowVersion(templateId, baseId)
  const b = useWorkflowVersion(templateId, targetId)
  const diff = useMemo(
    () => (a.data && b.data ? diffWorkflow(a.data, b.data) : null),
    [a.data, b.data],
  )

  return (
    <div className="space-y-4">
      <VersionPickers
        versions={versions}
        baseId={baseId}
        targetId={targetId}
        onBase={onBase}
        onTarget={onTarget}
      />
      {a.isLoading || b.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : a.isError || b.isError || !diff ? (
        <ErrorState
          onRetry={() => {
            void a.refetch()
            void b.refetch()
          }}
        />
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-text-2">
            {diff.total === 0
              ? 'These versions are identical.'
              : `${diff.total} change${diff.total === 1 ? '' : 's'} from v${a.data!.versionNo} to v${b.data!.versionNo}.`}
          </p>
          <DiffSection
            title="States"
            diff={diff.states}
            describe={(s) => (
              <span className="flex flex-wrap items-center gap-2">
                <code className="text-xs">{s.code}</code>
                <span>{s.name}</span>
                <Badge variant="muted">{s.category}</Badge>
              </span>
            )}
          />
          <DiffSection
            title="Transitions"
            diff={diff.transitions}
            describe={(t) => (
              <span className="flex flex-wrap items-center gap-2">
                <code className="text-xs">{transitionLabel(t)}</code>
                <span className="text-xs text-text-3">
                  {t.allowedSides.join(', ') || 'no side'}
                </span>
              </span>
            )}
          />
        </div>
      )}
    </div>
  )
}
