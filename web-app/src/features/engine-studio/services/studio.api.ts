import api from '@/lib/api'
import type {
  CreateFormSchemaInput,
  CreateStageTemplateInput,
  CreateWorkflowInput,
  FormDataResult,
  FormSchemaDetail,
  FormSchemaListParams,
  FormSchemaSummary,
  FormVersion,
  Specialty,
  StageTemplate,
  TimelineEntry,
  UpdateStageTemplateInput,
  WorkflowDefinition,
  WorkflowEffect,
  WorkflowListParams,
  WorkflowTemplateDetail,
  WorkflowTemplateSummary,
  WorkflowVersion,
} from '../types'

async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function post<T>(url: string, body?: object): Promise<T> {
  const { data } = await api.post(url, body)
  return data.data as T
}
async function patch<T>(url: string, body: object): Promise<T> {
  const { data } = await api.patch(url, body)
  return data.data as T
}
async function del(url: string): Promise<void> {
  await api.delete(url)
}

/** Drop empty filter values so the query string stays clean. */
const clean = (params: object) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v))

export const specialtiesApi = {
  list: () => get<Specialty[]>('/platform/specialties'),
}

const FORMS = '/platform/form-schemas'

/** Form schemas and versions — super admins only. */
export const formSchemasApi = {
  list: (params: FormSchemaListParams) =>
    get<FormSchemaSummary[]>(FORMS, clean(params)),
  get: (id: string) => get<FormSchemaDetail>(`${FORMS}/${id}`),
  create: (body: CreateFormSchemaInput) => post<FormSchemaDetail>(FORMS, body),
  update: (
    id: string,
    body: { name?: string; description?: string | null; version: number },
  ) => patch<FormSchemaDetail>(`${FORMS}/${id}`, body),
  history: (id: string) => get<TimelineEntry[]>(`${FORMS}/${id}/history`),
  version: (id: string, versionId: string) =>
    get<FormVersion>(`${FORMS}/${id}/versions/${versionId}`),
  createDraft: (id: string, fromVersionId?: string) =>
    post<FormVersion>(
      `${FORMS}/${id}/versions`,
      fromVersionId ? { fromVersionId } : {},
    ),
  saveDraft: (
    id: string,
    versionId: string,
    body: Pick<FormVersion, 'schemaJson' | 'uiJson' | 'promotions'> & {
      version: number
    },
  ) => patch<FormVersion>(`${FORMS}/${id}/versions/${versionId}`, body),
  discardDraft: (id: string, versionId: string) =>
    del(`${FORMS}/${id}/versions/${versionId}`),
  publish: (id: string, versionId: string, version: number) =>
    post<FormVersion>(`${FORMS}/${id}/versions/${versionId}/publish`, {
      version,
    }),
  retire: (id: string, versionId: string, version: number) =>
    post<FormVersion>(`${FORMS}/${id}/versions/${versionId}/retire`, {
      version,
    }),
  validate: (id: string, versionId: string, data: Record<string, unknown>) =>
    post<FormDataResult>(`${FORMS}/${id}/versions/${versionId}/validate`, {
      data,
    }),
}

const WORKFLOWS = '/platform/workflow-templates'

/** Workflow templates and versions — super admins only. */
export const workflowsApi = {
  list: (params: WorkflowListParams) =>
    get<WorkflowTemplateSummary[]>(WORKFLOWS, clean(params)),
  get: (id: string) => get<WorkflowTemplateDetail>(`${WORKFLOWS}/${id}`),
  create: (body: CreateWorkflowInput) =>
    post<WorkflowTemplateDetail>(WORKFLOWS, body),
  version: (id: string, versionId: string) =>
    get<WorkflowVersion>(`${WORKFLOWS}/${id}/versions/${versionId}`),
  createDraft: (id: string, fromVersionId?: string) =>
    post<WorkflowVersion>(
      `${WORKFLOWS}/${id}/versions`,
      fromVersionId ? { fromVersionId } : {},
    ),
  saveDraft: (
    id: string,
    versionId: string,
    body: { definition: WorkflowDefinition; version: number },
  ) => patch<WorkflowVersion>(`${WORKFLOWS}/${id}/versions/${versionId}`, body),
  discardDraft: (id: string, versionId: string) =>
    del(`${WORKFLOWS}/${id}/versions/${versionId}`),
  publish: (id: string, versionId: string, version: number) =>
    post<WorkflowVersion>(`${WORKFLOWS}/${id}/versions/${versionId}/publish`, {
      version,
    }),
  retire: (id: string, versionId: string, version: number) =>
    post<WorkflowVersion>(`${WORKFLOWS}/${id}/versions/${versionId}/retire`, {
      version,
    }),
  effects: () => get<WorkflowEffect[]>('/platform/workflow-effects'),
}

const STAGES = '/platform/stage-templates'

/** Stage templates (try-in sequences) — super admins only. */
export const stageTemplatesApi = {
  list: (params: { specialtyId?: string }) =>
    get<StageTemplate[]>(STAGES, clean(params)),
  get: (id: string) => get<StageTemplate>(`${STAGES}/${id}`),
  create: (body: CreateStageTemplateInput) => post<StageTemplate>(STAGES, body),
  update: (id: string, body: UpdateStageTemplateInput) =>
    patch<StageTemplate>(`${STAGES}/${id}`, body),
}
