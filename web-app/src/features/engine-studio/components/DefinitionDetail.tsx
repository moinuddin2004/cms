import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CopyPlus, Loader2, Split } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/useAuthStore'
import { ENTITY_TYPE_LABEL } from '../types'
import type {
  FormSchemaDetail,
  VersionRow,
  WorkflowTemplateDetail,
} from '../types'
import type { DefinitionKind } from '../hooks/useDefinitionForm'
import { DefinitionSheet } from './DefinitionSheet'
import { OwnerBadge } from './studio-badges'
import { VersionsPanel } from './VersionsPanel'

type Detail = FormSchemaDetail | WorkflowTemplateDetail

/** The version to open first: the draft, else the published one, else the newest. */
export function defaultVersionId(d: Detail): string | undefined {
  return (
    d.draft?.id ??
    d.current?.id ??
    [...d.versions].sort((a, b) => b.versionNo - a.versionNo)[0]?.id
  )
}

/** Default compare pair: previous version → the open one. */
function comparePair(versions: VersionRow[], targetId?: string) {
  const sorted = [...versions].sort((a, b) => a.versionNo - b.versionNo)
  const target = sorted.find((v) => v.id === targetId) ?? sorted.at(-1)
  if (!target) return { base: '', target: '' }
  const idx = sorted.indexOf(target)
  const base = sorted.at(idx - 1 < 0 ? idx + 1 : idx - 1) ?? target
  return { base: base.id, target: target.id }
}

/**
 * Shell of a form / workflow detail page: header, version tabs (editor,
 * versions, compare, activity) and the "new draft" / "copy for an
 * organization" actions. The kind-specific editor and diff are render props.
 */
export function DefinitionDetail({
  kind,
  query,
  createDraft,
  retire,
  renderEditor,
  renderCompare,
  activity,
  onOpenCopy,
}: {
  kind: DefinitionKind
  query: {
    data: Detail | undefined
    isLoading: boolean
    isError: boolean
    refetch: () => unknown
  }
  createDraft: {
    mutate: (
      fromVersionId: string | undefined,
      opts: { onSuccess: (v: { id: string }) => void },
    ) => void
    isPending: boolean
  }
  retire: {
    mutate: (versionId: string, opts: { onSuccess: () => void }) => void
    isPending: boolean
  }
  renderEditor: (versionId: string, onDiscarded: () => void) => ReactNode
  renderCompare: (p: {
    baseId: string
    targetId: string
    onBase: (id: string) => void
    onTarget: (id: string) => void
  }) => ReactNode
  activity?: ReactNode
  onOpenCopy: (id: string) => void
}) {
  const d = query.data
  const [tab, setTab] = useState('editor')
  const [versionId, setVersionId] = useState<string | undefined>()
  const [pair, setPair] = useState({ base: '', target: '' })
  const [copying, setCopying] = useState(false)
  const organizations = useAuthStore((s) => s.accessibleOrganizations)

  // Open the default version once loaded, and again when the open one is
  // gone (draft discarded) .
  useEffect(() => {
    if (!d) return
    if (!versionId || !d.versions.some((v) => v.id === versionId)) {
      setVersionId(defaultVersionId(d))
    }
  }, [d, versionId])

  const backTo = kind === 'form' ? '/studio/forms' : '/studio/workflows'
  const backLabel =
    kind === 'form' ? 'Back to form schemas' : 'Back to workflows'

  if (query.isLoading || query.isError || !d) {
    return (
      <DashboardLayout
        title={kind === 'form' ? 'Form schema' : 'Workflow'}
        backTo={backTo}
        backLabel={backLabel}
      >
        {query.isLoading ? (
          <LoadingSkeleton variant="detail" />
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )}
      </DashboardLayout>
    )
  }

  const newDraft = (from?: string) =>
    createDraft.mutate(from, {
      onSuccess: (v) => {
        setVersionId(v.id)
        setTab('editor')
      },
    })
  const compare = (targetId: string) => {
    setPair(comparePair(d.versions, targetId))
    setTab('compare')
  }

  const canCopy = !d.organization && !!d.current && organizations.length > 0

  return (
    <DashboardLayout
      title={d.name}
      subtitle={`${d.code} · ${d.specialty.name}${'entityType' in d ? ` · ${ENTITY_TYPE_LABEL[d.entityType]} workflow` : ''}`}
      backTo={backTo}
      backLabel={backLabel}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canCopy && (
            <Button variant="outline" onClick={() => setCopying(true)}>
              <Split className="size-4" /> Copy for organization
            </Button>
          )}
          {!d.draft && (
            <Button
              onClick={() => newDraft(d.current?.id)}
              disabled={createDraft.isPending}
            >
              {createDraft.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CopyPlus className="size-4" />
              )}
              New draft
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <OwnerBadge owner={d.organization} />
          {!d.isActive && <Badge variant="muted">Inactive</Badge>}
          {d.description && (
            <p className="text-sm text-text-2">{d.description}</p>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="versions">
              Versions ({d.versions.length})
            </TabsTrigger>
            <TabsTrigger
              value="compare"
              disabled={d.versions.length < 2}
              onClick={() =>
                !pair.target && setPair(comparePair(d.versions, versionId))
              }
            >
              Compare
            </TabsTrigger>
            {activity && <TabsTrigger value="activity">Activity</TabsTrigger>}
          </TabsList>

          <TabsContent value="editor" className="pt-4">
            {versionId ? (
              <div className="space-y-4">
                {d.versions.length > 1 && (
                  <VersionTabs
                    versions={d.versions}
                    value={versionId}
                    onChange={setVersionId}
                  />
                )}
                {renderEditor(versionId, () => setVersionId(undefined))}
              </div>
            ) : (
              <p className="text-sm text-text-3">No versions yet.</p>
            )}
          </TabsContent>
          <TabsContent value="versions" className="pt-4">
            <VersionsPanel
              versions={d.versions}
              selectedId={versionId}
              hasDraft={!!d.draft}
              busy={createDraft.isPending || retire.isPending}
              onOpen={(id) => {
                setVersionId(id)
                setTab('editor')
              }}
              onCompare={compare}
              onNewDraft={newDraft}
              onRetire={(id, done) => retire.mutate(id, { onSuccess: done })}
            />
          </TabsContent>
          <TabsContent value="compare" className="pt-4">
            {pair.base &&
              renderCompare({
                baseId: pair.base,
                targetId: pair.target,
                onBase: (id) => setPair((p) => ({ ...p, base: id })),
                onTarget: (id) => setPair((p) => ({ ...p, target: id })),
              })}
          </TabsContent>
          {activity && (
            <TabsContent value="activity" className="pt-4">
              {activity}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {canCopy && (
        <DefinitionSheet
          open={copying}
          onOpenChange={setCopying}
          kind={kind}
          preset={{
            specialtyId: d.specialty.id,
            owner: organizations[0]?.id,
            entityType: 'entityType' in d ? d.entityType : 'item',
            code: d.code,
            name: d.name,
            description: d.description ?? '',
            copyFromVersionId: d.current!.id,
          }}
          onCreated={onOpenCopy}
        />
      )}
    </DashboardLayout>
  )
}

/** Quick switch between versions inside the editor tab. */
function VersionTabs({
  versions,
  value,
  onChange,
}: {
  versions: VersionRow[]
  value: string
  onChange: (id: string) => void
}) {
  const rows = [...versions].sort((a, b) => b.versionNo - a.versionNo)
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Versions">
      {rows.map((v) => (
        <Button
          key={v.id}
          size="sm"
          variant={v.id === value ? 'secondary' : 'ghost'}
          aria-pressed={v.id === value}
          onClick={() => onChange(v.id)}
        >
          v{v.versionNo}
          <span className="text-xs text-text-3">{v.status}</span>
        </Button>
      ))}
    </div>
  )
}
