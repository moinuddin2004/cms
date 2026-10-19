import { useEffect, useMemo, useState } from 'react'
import { Loader2, Rocket, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { diffForm } from '../lib/diff'
import { parseJson, readFields, toJsonText } from '../lib/form-preview'
import {
  useDiscardFormDraft,
  useFormVersion,
  usePublishFormVersion,
  useSaveFormDraft,
} from '../hooks/useFormSchemas'
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning'
import type { FormSchemaDetail, FormVersion } from '../types'
import { FormPreview } from './FormPreview'
import { IssuesList } from './IssuesList'
import { JsonEditor } from './JsonEditor'
import { DefinitionStatusBadge } from './studio-badges'

interface Texts {
  schema: string
  ui: string
  promotions: string
}

const textsOf = (v: FormVersion): Texts => ({
  schema: toJsonText(v.schemaJson),
  ui: toJsonText(v.uiJson),
  promotions: toJsonText(
    v.promotions && Object.keys(v.promotions).length ? v.promotions : null,
  ),
})

/**
 * One form version: JSON editor on the left (fields, layout, promotions),
 * live preview on the right. Drafts can be saved (optimistic `version`),
 * discarded and — once the saved draft has no issues — published.
 * Published and retired versions are read-only.
 */
export function FormVersionEditor({
  schema,
  version,
  onDiscarded,
}: {
  schema: FormSchemaDetail
  version: FormVersion
  onDiscarded: () => void
}) {
  const isDraft = version.status === 'draft'
  const [texts, setTexts] = useState<Texts>(() => textsOf(version))
  // Re-seed only when another version opens or a save bumps `version` —
  // a background refetch of the same version must not wipe unsaved edits.
  const saved = useMemo(() => textsOf(version), [version.id, version.version])
  useEffect(() => setTexts(saved), [saved])

  const parsed = {
    schema: parseJson(texts.schema),
    ui: parseJson(texts.ui),
    promotions: parseJson(texts.promotions),
  }
  const dirty =
    isDraft &&
    (texts.schema !== saved.schema ||
      texts.ui !== saved.ui ||
      texts.promotions !== saved.promotions)
  useUnsavedChangesWarning(dirty)

  const schemaObject =
    parsed.schema.ok &&
    parsed.schema.value !== null &&
    typeof parsed.schema.value === 'object' &&
    !Array.isArray(parsed.schema.value)
  const jsonOk =
    schemaObject &&
    parsed.ui.ok &&
    parsed.promotions.ok &&
    isObjOrNull(parsed.ui.value) &&
    isObjOrNull(parsed.promotions.value)

  // The preview follows the editor; while the JSON is broken it keeps the
  // saved definition so it does not flicker away.
  const liveFields = useMemo(
    () =>
      readFields(parsed.schema.ok ? parsed.schema.value : version.schemaJson),
    [texts.schema, version.schemaJson],
  )
  const liveUi = parsed.ui.ok ? parsed.ui.value : version.uiJson

  const save = useSaveFormDraft(schema.id)
  const discard = useDiscardFormDraft(schema.id)
  const publish = usePublishFormVersion(schema.id)
  const [confirm, setConfirm] = useState<'discard' | 'publish' | null>(null)

  const current =
    schema.current && schema.current.id !== version.id ? schema.current : null
  const currentVersion = useFormVersion(
    schema.id,
    confirm === 'publish' ? current?.id : undefined,
  )
  const changes =
    currentVersion.data && diffForm(currentVersion.data, version).total

  const onSave = () => {
    if (!jsonOk || !parsed.schema.ok) return
    save.mutate({
      versionId: version.id,
      version: version.version,
      schemaJson: parsed.schema.value as FormVersion['schemaJson'],
      uiJson: (parsed.ui.ok ? parsed.ui.value : null) as FormVersion['uiJson'],
      promotions: (parsed.promotions.ok
        ? parsed.promotions.value
        : null) as FormVersion['promotions'],
    })
  }

  const publishBlocked = dirty || version.issues.length > 0
  const set = (k: keyof Texts) => (v: string) =>
    setTexts((t) => ({ ...t, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium">Version {version.versionNo}</h2>
        <DefinitionStatusBadge status={version.status} />
        {dirty && <Badge variant="warning">Unsaved changes</Badge>}
        {isDraft && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirm('discard')}
              disabled={discard.isPending}
            >
              <Trash2 className="size-4" /> Discard draft
            </Button>
            <Button
              variant="outline"
              onClick={onSave}
              disabled={!dirty || !jsonOk || save.isPending}
            >
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save draft
            </Button>
            <Button
              onClick={() => setConfirm('publish')}
              disabled={publishBlocked || publish.isPending}
            >
              {publish.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Publish
            </Button>
          </div>
        )}
      </div>

      {isDraft &&
        !jsonOk &&
        parsed.schema.ok &&
        parsed.ui.ok &&
        parsed.promotions.ok && (
          <p className="text-sm text-danger" role="alert">
            schemaJson must be an object, and uiJson / promotions an object or
            empty.
          </p>
        )}
      {isDraft && (
        <div className="space-y-1">
          <IssuesList issues={version.issues} />
          {dirty && (
            <p className="text-xs text-text-3">
              Issues are from the last save. Save the draft to re-check —
              publishing needs a saved draft with no issues.
            </p>
          )}
        </div>
      )}
      {!isDraft && (
        <p className="text-sm text-text-3">
          {version.status === 'published'
            ? 'Published versions never change. Create a new draft to make changes — orders already on this version keep it.'
            : 'Retired — no new orders use this version; orders pinned to it keep working.'}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">
          <Tabs defaultValue="fields">
            <TabsList>
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="promotions">Promotions</TabsTrigger>
            </TabsList>
            <TabsContent value="fields" className="pt-3">
              <JsonEditor
                id="form-schema-json"
                label="schemaJson"
                hint='{ "fields": [{ "key", "type", "label", "required", "options", "visibleIf" … }] }'
                value={texts.schema}
                onChange={set('schema')}
                readOnly={!isDraft}
                rows={24}
              />
            </TabsContent>
            <TabsContent value="layout" className="pt-3">
              <JsonEditor
                id="form-ui-json"
                label="uiJson"
                hint='Optional: { "sections": [{ "title": "Shade", "fields": ["shade_system", "shade"] }] }'
                value={texts.ui}
                onChange={set('ui')}
                readOnly={!isDraft}
              />
            </TabsContent>
            <TabsContent value="promotions" className="pt-3">
              <JsonEditor
                id="form-promotions-json"
                label="promotions"
                hint='Optional: { "shade": "dental_item_details.shade" } — copies an answer into a typed column.'
                value={texts.promotions}
                onChange={set('promotions')}
                readOnly={!isDraft}
              />
            </TabsContent>
          </Tabs>
        </section>

        <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">
          <FormPreview
            key={version.id}
            formSchemaId={schema.id}
            versionId={version.id}
            fields={liveFields}
            ui={liveUi}
            stale={dirty}
          />
        </section>
      </div>

      <ConfirmDialog
        open={confirm === 'discard'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Discard draft v${version.versionNo}?`}
        description="The draft and its unsaved and saved changes are deleted. Published versions are not affected."
        confirmLabel="Discard draft"
        destructive
        isLoading={discard.isPending}
        onConfirm={() =>
          discard.mutate(version.id, {
            onSuccess: () => {
              setConfirm(null)
              onDiscarded()
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'publish'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Publish version ${version.versionNo}?`}
        description={
          current
            ? `New orders will use v${version.versionNo}; v${current.versionNo} is retired and orders already on it keep it.${
                changes === undefined
                  ? ''
                  : ` ${changes} change${changes === 1 ? '' : 's'} vs v${current.versionNo}.`
              }`
            : `New orders will use v${version.versionNo}. Published versions can never be edited.`
        }
        confirmLabel="Publish"
        isLoading={publish.isPending}
        onConfirm={() =>
          publish.mutate(
            { versionId: version.id, version: version.version },
            { onSuccess: () => setConfirm(null) },
          )
        }
      />
    </div>
  )
}

const isObjOrNull = (v: unknown) =>
  v === null || (typeof v === 'object' && !Array.isArray(v))
