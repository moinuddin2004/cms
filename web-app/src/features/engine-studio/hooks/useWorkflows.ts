import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { studioKeys } from '../query-keys'
import { workflowsApi } from '../services/studio.api'
import type {
  CreateWorkflowInput,
  WorkflowDefinition,
  WorkflowListParams,
} from '../types'
import { useStudioMutation } from './useStudioMutation'

export function useWorkflowTemplates(
  params: WorkflowListParams,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: studioKeys.workflows.list(params),
    queryFn: () => workflowsApi.list(params),
    // Keep the rows on screen while a filter change refetches.
    placeholderData: keepPreviousData,
  })
}

export function useWorkflowTemplate(id: string) {
  return useQuery({
    queryKey: studioKeys.workflows.detail(id),
    queryFn: () => workflowsApi.get(id),
  })
}

export function useWorkflowVersion(id: string, versionId: string | undefined) {
  return useQuery({
    queryKey: studioKeys.workflows.version(id, versionId ?? ''),
    queryFn: () => workflowsApi.version(id, versionId!),
    enabled: !!versionId,
  })
}

/** The effect handlers this build has — the transition effect dropdown. */
export function useWorkflowEffects() {
  return useQuery({
    queryKey: studioKeys.effects,
    queryFn: workflowsApi.effects,
    staleTime: 5 * 60_000,
  })
}

// ── Mutations ──────────────────────────────────────────────────────────

export function useCreateWorkflowTemplate() {
  return useStudioMutation(
    (body: CreateWorkflowInput) => workflowsApi.create(body),
    { success: 'Workflow created as a draft' },
  )
}

export function useCreateWorkflowDraft(id: string) {
  return useStudioMutation(
    (fromVersionId?: string) => workflowsApi.createDraft(id, fromVersionId),
    { success: (v) => `Draft v${v.versionNo} created` },
  )
}

export function useSaveWorkflowDraft(id: string) {
  const queryClient = useQueryClient()
  return useStudioMutation(
    async (body: {
      versionId: string
      definition: WorkflowDefinition
      version: number
    }) => {
      const saved = await workflowsApi.saveDraft(id, body.versionId, {
        definition: body.definition,
        version: body.version,
      })
      queryClient.setQueryData(
        studioKeys.workflows.version(id, body.versionId),
        saved,
      )
      return saved
    },
    {
      success: (v) =>
        v.issues.length
          ? `Draft saved — ${v.issues.length} issue${v.issues.length === 1 ? '' : 's'} to fix before publishing`
          : 'Draft saved',
    },
  )
}

export function useDiscardWorkflowDraft(id: string) {
  return useStudioMutation(
    (versionId: string) => workflowsApi.discardDraft(id, versionId),
    { success: 'Draft discarded' },
  )
}

export function usePublishWorkflowVersion(id: string) {
  return useStudioMutation(
    (v: { versionId: string; version: number }) =>
      workflowsApi.publish(id, v.versionId, v.version),
    { success: (v) => `Version ${v.versionNo} published` },
  )
}

/** Retire by id: reads the version first for its optimistic `version`. */
export function useRetireWorkflowVersion(id: string) {
  const queryClient = useQueryClient()
  return useStudioMutation(
    async (versionId: string) => {
      const v = await queryClient.fetchQuery({
        queryKey: studioKeys.workflows.version(id, versionId),
        queryFn: () => workflowsApi.version(id, versionId),
        staleTime: 0,
      })
      return workflowsApi.retire(id, versionId, v.version)
    },
    { success: (v) => `Version ${v.versionNo} retired` },
  )
}
