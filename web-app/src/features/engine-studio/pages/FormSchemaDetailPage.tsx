import { useNavigate } from '@tanstack/react-router'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { DefinitionDetail } from '../components/DefinitionDetail'
import { FormCompare } from '../components/FormCompare'
import { FormVersionEditor } from '../components/FormVersionEditor'
import { StudioActivity } from '../components/StudioActivity'
import {
  useCreateFormDraft,
  useFormHistory,
  useFormSchema,
  useFormVersion,
  useRetireFormVersion,
} from '../hooks/useFormSchemas'
import type { FormSchemaDetail } from '../types'

/** One form schema: versions, JSON editor + live preview, diff, history. */
export function FormSchemaDetailPage({ formId }: { formId: string }) {
  const navigate = useNavigate()
  const query = useFormSchema(formId)
  const history = useFormHistory(formId)
  const createDraft = useCreateFormDraft(formId)
  const retire = useRetireFormVersion(formId)

  return (
    <DefinitionDetail
      kind="form"
      query={query}
      createDraft={createDraft}
      retire={retire}
      renderEditor={(versionId, onDiscarded) =>
        query.data && (
          <FormVersionLoader
            schema={query.data}
            versionId={versionId}
            onDiscarded={onDiscarded}
          />
        )
      }
      renderCompare={(p) =>
        query.data && (
          <FormCompare
            schemaId={formId}
            versions={query.data.versions}
            {...p}
          />
        )
      }
      activity={
        <StudioActivity
          entries={history.data}
          isLoading={history.isLoading}
          isError={history.isError}
          onRetry={() => void history.refetch()}
        />
      }
      onOpenCopy={(id) =>
        void navigate({ to: '/studio/forms/$formId', params: { formId: id } })
      }
    />
  )
}

function FormVersionLoader({
  schema,
  versionId,
  onDiscarded,
}: {
  schema: FormSchemaDetail
  versionId: string
  onDiscarded: () => void
}) {
  const v = useFormVersion(schema.id, versionId)
  if (v.isLoading) return <LoadingSkeleton variant="detail" />
  if (v.isError || !v.data)
    return <ErrorState onRetry={() => void v.refetch()} />
  return (
    <FormVersionEditor
      schema={schema}
      version={v.data}
      onDiscarded={onDiscarded}
    />
  )
}
