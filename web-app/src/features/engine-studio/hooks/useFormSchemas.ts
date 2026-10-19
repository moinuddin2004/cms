import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { studioKeys } from '../query-keys'
import { formSchemasApi, specialtiesApi } from '../services/studio.api'
import type {
  CreateFormSchemaInput,
  FormSchemaListParams,
  FormVersion,
} from '../types'
import { useStudioMutation } from './useStudioMutation'

export function useSpecialties() {
  return useQuery({
    queryKey: studioKeys.specialties,
    queryFn: specialtiesApi.list,
    staleTime: 5 * 60_000,
  })
}

export function useFormSchemas(params: FormSchemaListParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: studioKeys.forms.list(params),
    queryFn: () => formSchemasApi.list(params),
    // Keep the rows on screen while a filter change refetches.
    placeholderData: keepPreviousData,
  })
}

export function useFormSchema(id: string) {
  return useQuery({
    queryKey: studioKeys.forms.detail(id),
    queryFn: () => formSchemasApi.get(id),
  })
}

export function useFormVersion(id: string, versionId: string | undefined) {
  return useQuery({
    queryKey: studioKeys.forms.version(id, versionId ?? ''),
    queryFn: () => formSchemasApi.version(id, versionId!),
    enabled: !!versionId,
  })
}

export function useFormHistory(id: string) {
  return useQuery({
    queryKey: studioKeys.forms.history(id),
    queryFn: () => formSchemasApi.history(id),
  })
}

// ── Mutations ──────────────────────────────────────────────────────────

export function useCreateFormSchema() {
  return useStudioMutation(
    (body: CreateFormSchemaInput) => formSchemasApi.create(body),
    { success: 'Form created as a draft' },
  )
}

export function useUpdateFormSchema(id: string) {
  return useStudioMutation(
    (body: { name: string; description: string | null; version: number }) =>
      formSchemasApi.update(id, body),
    { success: 'Form updated' },
  )
}

export function useCreateFormDraft(id: string) {
  return useStudioMutation(
    (fromVersionId?: string) => formSchemasApi.createDraft(id, fromVersionId),
    { success: (v) => `Draft v${v.versionNo} created` },
  )
}

export function useSaveFormDraft(id: string) {
  const queryClient = useQueryClient()
  return useStudioMutation(
    async (
      body: Pick<FormVersion, 'schemaJson' | 'uiJson' | 'promotions'> & {
        versionId: string
        version: number
      },
    ) => {
      const { versionId, ...rest } = body
      const saved = await formSchemasApi.saveDraft(id, versionId, rest)
      queryClient.setQueryData(studioKeys.forms.version(id, versionId), saved)
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

export function useDiscardFormDraft(id: string) {
  return useStudioMutation(
    (versionId: string) => formSchemasApi.discardDraft(id, versionId),
    { success: 'Draft discarded' },
  )
}

export function usePublishFormVersion(id: string) {
  return useStudioMutation(
    (v: { versionId: string; version: number }) =>
      formSchemasApi.publish(id, v.versionId, v.version),
    { success: (v) => `Version ${v.versionNo} published` },
  )
}

/** Retire by id: reads the version first for its optimistic `version`. */
export function useRetireFormVersion(id: string) {
  const queryClient = useQueryClient()
  return useStudioMutation(
    async (versionId: string) => {
      const v = await queryClient.fetchQuery({
        queryKey: studioKeys.forms.version(id, versionId),
        queryFn: () => formSchemasApi.version(id, versionId),
        staleTime: 0,
      })
      return formSchemasApi.retire(id, versionId, v.version)
    },
    { success: (v) => `Version ${v.versionNo} retired` },
  )
}
