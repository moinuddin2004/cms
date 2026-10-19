import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { diffForm } from '../lib/diff'
import { useFormVersion } from '../hooks/useFormSchemas'
import { FIELD_TYPE_LABEL } from '../types'
import type { VersionRow } from '../types'
import { DiffSection, VersionPickers } from './DiffView'

/** Field-level diff between two versions of one form. */
export function FormCompare({
  schemaId,
  versions,
  baseId,
  targetId,
  onBase,
  onTarget,
}: {
  schemaId: string
  versions: VersionRow[]
  baseId: string
  targetId: string
  onBase: (id: string) => void
  onTarget: (id: string) => void
}) {
  const a = useFormVersion(schemaId, baseId)
  const b = useFormVersion(schemaId, targetId)
  const diff = useMemo(
    () => (a.data && b.data ? diffForm(a.data, b.data) : null),
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
            title="Fields"
            diff={diff.fields}
            describe={(f) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.label || f.key}</span>
                <code className="text-xs text-text-3">{f.key}</code>
                <Badge variant="muted">{FIELD_TYPE_LABEL[f.type]}</Badge>
                {f.required && <Badge variant="outline">required</Badge>}
              </span>
            )}
          />
          {diff.reordered && (
            <p className="text-sm text-text-2">Field order changed.</p>
          )}
          <DiffSection
            title="Promotions"
            diff={diff.promotions}
            describe={(p) => (
              <span className="font-mono text-xs">
                {p.field} → {p.column}
              </span>
            )}
          />
          <section className="space-y-1">
            <h3 className="text-sm font-semibold">Layout</h3>
            <p className="text-sm text-text-3">
              {diff.layoutChanged ? 'Layout (uiJson) changed.' : 'No changes.'}
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
