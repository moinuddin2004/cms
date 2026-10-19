import api from '@/lib/api'
import type {
  ClinicServiceParams,
  ClinicServiceRow,
  ClinicTreatment,
  CurrentForm,
  DefinitionRef,
  LabServiceInput,
  LabServiceItem,
  OptionInput,
  OrderTemplate,
  Paginated,
  PlatformServiceParams,
  PlatformServiceRow,
  PriceInput,
  PriceQuote,
  PriceWindow,
  ServiceCategory,
  ServiceMapping,
  ServiceOption,
  TemplateInput,
  TemplateParams,
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

const svc = (labId: string, rest = '') =>
  `/platform/labs/${labId}/services${rest}`

/** Engine definitions a lab service may point at (platform, active). */
export interface ServiceDefinitions {
  forms: DefinitionRef[]
  workflows: DefinitionRef[]
  stageTemplates: DefinitionRef[]
}

interface DefinitionRow extends DefinitionRef {
  organization: { id: string } | null
  isActive: boolean
  entityType?: string
}

const platformOnly = (rows: DefinitionRow[]) =>
  rows
    .filter((r) => !r.organization && r.isActive)
    .map(({ id, code, name }) => ({ id, code, name }))

/** Lab services, options and prices — super admins (later the lab portal). */
export const platformCatalogApi = {
  categories: (specialtyId?: string) =>
    get<ServiceCategory[]>(
      '/platform/service-categories',
      specialtyId ? { specialtyId } : {},
    ),
  /** Active platform definitions of one specialty. */
  definitions: async (specialtyId: string): Promise<ServiceDefinitions> => {
    const [forms, workflows, stageTemplates] = await Promise.all([
      get<DefinitionRow[]>('/platform/form-schemas', {
        owner: 'platform',
        specialtyId,
      }),
      get<DefinitionRow[]>('/platform/workflow-templates', {
        owner: 'platform',
        specialtyId,
      }),
      get<DefinitionRow[]>('/platform/stage-templates', { specialtyId }),
    ])
    return {
      forms: platformOnly(forms),
      workflows: platformOnly(workflows.filter((w) => w.entityType === 'item')),
      stageTemplates: platformOnly(stageTemplates),
    }
  },
  /** Clinics on the lab's client list (for negotiated prices). */
  labClinics: (labId: string) =>
    get<{ organization: { id: string; name: string }; status: string }[]>(
      `/platform/labs/${labId}/links`,
    ),
  services: (labId: string, params: PlatformServiceParams) =>
    get<Paginated<PlatformServiceRow>>(svc(labId), params),
  createService: (labId: string, body: LabServiceInput) =>
    post<LabServiceItem>(svc(labId), body),
  updateService: (
    labId: string,
    id: string,
    body: Partial<LabServiceInput> & { isActive?: boolean; version: number },
  ) => patch<LabServiceItem>(svc(labId, `/${id}`), body),
  addOption: (labId: string, serviceId: string, body: OptionInput) =>
    post<ServiceOption>(svc(labId, `/${serviceId}/options`), body),
  updateOption: (
    labId: string,
    serviceId: string,
    optionId: string,
    body: Partial<OptionInput> & { isActive?: boolean; version: number },
  ) =>
    patch<ServiceOption>(svc(labId, `/${serviceId}/options/${optionId}`), body),
  prices: (labId: string, serviceId: string) =>
    get<PriceWindow[]>(svc(labId, `/${serviceId}/prices`), {
      includeVoided: true,
    }),
  addPrice: (labId: string, serviceId: string, body: PriceInput) =>
    post<PriceWindow>(svc(labId, `/${serviceId}/prices`), body),
  updatePrice: (
    labId: string,
    serviceId: string,
    priceId: string,
    body: Partial<Omit<PriceInput, 'organizationId'>> & { version: number },
  ) => patch<PriceWindow>(svc(labId, `/${serviceId}/prices/${priceId}`), body),
  voidPrice: (
    labId: string,
    serviceId: string,
    priceId: string,
    body: { reason: string; version: number },
  ) =>
    post<PriceWindow>(svc(labId, `/${serviceId}/prices/${priceId}/void`), body),
}

/** The active clinic's view of the catalog. */
export const clinicCatalogApi = {
  categories: () => get<ServiceCategory[]>('/lab-catalog/categories'),
  /** The clinic's labs, for the lab filter (Sprint 1 lab list). */
  labs: async () =>
    (
      await get<Paginated<{ lab: { id: string; name: string } }>>(
        '/lab-links',
        { page: 1, limit: 100 },
      )
    ).data.map((l) => l.lab),
  services: (params: ClinicServiceParams) =>
    get<Paginated<ClinicServiceRow>>('/lab-catalog/services', params),
  treatments: () => get<ClinicTreatment[]>('/lab-catalog/treatments'),
  quote: (params: {
    labServiceId: string
    optionIds?: string
    rush?: boolean
  }) => get<PriceQuote>('/lab-catalog/price-quote', params),
  mappings: () => get<ServiceMapping[]>('/lab-catalog/mappings'),
  createMapping: (body: {
    clinicTreatmentId: string
    labServiceId: string
    isDefault?: boolean
  }) => post<ServiceMapping>('/lab-catalog/mappings', body),
  updateMapping: (
    id: string,
    body: { isDefault?: boolean; isActive?: boolean; version: number },
  ) => patch<ServiceMapping>(`/lab-catalog/mappings/${id}`, body),
  /** Published forms the clinic fills today (engine). */
  forms: () => get<CurrentForm[]>('/form-schemas'),
}

export const orderTemplatesApi = {
  list: (params: TemplateParams) =>
    get<Paginated<OrderTemplate>>('/lab-catalog/order-templates', params),
  create: (body: TemplateInput) =>
    post<OrderTemplate>('/lab-catalog/order-templates', body),
  update: (
    id: string,
    body: Partial<TemplateInput> & { isActive?: boolean; version: number },
  ) => patch<OrderTemplate>(`/lab-catalog/order-templates/${id}`, body),
}
