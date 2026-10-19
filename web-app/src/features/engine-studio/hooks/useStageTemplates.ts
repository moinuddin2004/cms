import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { studioKeys } from '../query-keys'
import { stageTemplatesApi } from '../services/studio.api'
import type {
  CreateStageTemplateInput,
  StageTemplate,
  UpdateStageTemplateInput,
} from '../types'
import { useStudioMutation } from './useStudioMutation'

export function useStageTemplates(params: { specialtyId?: string }) {
  return useQuery({
    queryKey: studioKeys.stages.list(params),
    queryFn: () => stageTemplatesApi.list(params),
    // Keep the rows on screen while a filter change refetches.
    placeholderData: keepPreviousData,
  })
}

export function useSaveStageTemplate(template: StageTemplate | null) {
  return useStudioMutation(
    (
      input:
        | { kind: 'create'; body: CreateStageTemplateInput }
        | { kind: 'update'; body: Omit<UpdateStageTemplateInput, 'version'> },
    ) =>
      input.kind === 'update' && template
        ? stageTemplatesApi.update(template.id, {
            ...input.body,
            version: template.version,
          })
        : stageTemplatesApi.create(input.body as CreateStageTemplateInput),
    { success: template ? 'Stage template saved' : 'Stage template created' },
  )
}

export function useSetStageTemplateActive() {
  return useStudioMutation(
    (v: { template: StageTemplate; isActive: boolean }) =>
      stageTemplatesApi.update(v.template.id, {
        isActive: v.isActive,
        version: v.template.version,
      }),
    {
      success: (t) =>
        t.isActive ? 'Stage template activated' : 'Stage template deactivated',
    },
  )
}
