import type { FormSchemaListParams, WorkflowListParams } from './types'

/** Every Studio query lives under one root, so a mutation can refresh them all. */
export const studioKeys = {
  all: ['studio'] as const,
  specialties: ['studio', 'specialties'] as const,
  effects: ['studio', 'effects'] as const,
  forms: {
    list: (params: FormSchemaListParams) =>
      ['studio', 'forms', 'list', params] as const,
    detail: (id: string) => ['studio', 'forms', 'detail', id] as const,
    version: (id: string, versionId: string) =>
      ['studio', 'forms', 'version', id, versionId] as const,
    history: (id: string) => ['studio', 'forms', 'history', id] as const,
  },
  workflows: {
    list: (params: WorkflowListParams) =>
      ['studio', 'workflows', 'list', params] as const,
    detail: (id: string) => ['studio', 'workflows', 'detail', id] as const,
    version: (id: string, versionId: string) =>
      ['studio', 'workflows', 'version', id, versionId] as const,
  },
  stages: {
    list: (params: { specialtyId?: string }) =>
      ['studio', 'stages', 'list', params] as const,
  },
}
