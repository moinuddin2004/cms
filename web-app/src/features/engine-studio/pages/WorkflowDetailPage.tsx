import { useNavigate } from '@tanstack/react-router'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { DefinitionDetail } from '../components/DefinitionDetail'
import { WorkflowCompare } from '../components/WorkflowCompare'
import { WorkflowVersionEditor } from '../components/WorkflowVersionEditor'
import {
  useCreateWorkflowDraft,
  useRetireWorkflowVersion,
  useWorkflowTemplate,
  useWorkflowVersion,
} from '../hooks/useWorkflows'
import type { WorkflowTemplateDetail } from '../types'

/** One workflow template: versions, state/transition tables, test run, diff. */
export function WorkflowDetailPage({ workflowId }: { workflowId: string }) {
  const navigate = useNavigate()
  const query = useWorkflowTemplate(workflowId)
  const createDraft = useCreateWorkflowDraft(workflowId)
  const retire = useRetireWorkflowVersion(workflowId)

  return (
    <DefinitionDetail
      kind="workflow"
      query={query}
      createDraft={createDraft}
      retire={retire}
      renderEditor={(versionId, onDiscarded) =>
        query.data && (
          <WorkflowVersionLoader
            template={query.data}
            versionId={versionId}
            onDiscarded={onDiscarded}
          />
        )
      }
      renderCompare={(p) =>
        query.data && (
          <WorkflowCompare
            templateId={workflowId}
            versions={query.data.versions}
            {...p}
          />
        )
      }
      onOpenCopy={(id) =>
        void navigate({
          to: '/studio/workflows/$workflowId',
          params: { workflowId: id },
        })
      }
    />
  )
}

function WorkflowVersionLoader({
  template,
  versionId,
  onDiscarded,
}: {
  template: WorkflowTemplateDetail
  versionId: string
  onDiscarded: () => void
}) {
  const v = useWorkflowVersion(template.id, versionId)
  if (v.isLoading) return <LoadingSkeleton variant="detail" />
  if (v.isError || !v.data)
    return <ErrorState onRetry={() => void v.refetch()} />
  return (
    <WorkflowVersionEditor
      template={template}
      version={v.data}
      onDiscarded={onDiscarded}
    />
  )
}
