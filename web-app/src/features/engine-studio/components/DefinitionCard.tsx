import { Badge } from '@/components/ui/badge'
import { ENTITY_TYPE_LABEL } from '../types'
import type { FormSchemaSummary, WorkflowTemplateSummary } from '../types'
import { OwnerBadge, VersionSummary } from './studio-badges'

/** A form schema or workflow template, card view. */
export function DefinitionCard({
  item,
  onOpen,
}: {
  item: FormSchemaSummary | WorkflowTemplateSummary
  onOpen: () => void
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">{item.name}</h2>
        <p className="truncate font-mono text-xs text-text-3">{item.code}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{item.specialty.name}</Badge>
        {'entityType' in item && (
          <Badge variant="info">{ENTITY_TYPE_LABEL[item.entityType]}</Badge>
        )}
        <OwnerBadge owner={item.organization} />
      </div>
      {item.description && (
        <p className="line-clamp-2 text-xs text-text-2">{item.description}</p>
      )}
      <div className="mt-auto border-t border-border/60 pt-2">
        <VersionSummary current={item.current} draft={item.draft} />
      </div>
    </article>
  )
}
