import type {
  ClinicServiceParams,
  PlatformServiceParams,
  TemplateParams,
} from './types'

/** Every catalog query lives under one root, so a mutation refreshes them all. */
export const catalogKeys = {
  all: ['lab-catalog'] as const,
  platform: {
    categories: (specialtyId?: string) =>
      ['lab-catalog', 'platform', 'categories', specialtyId ?? 'all'] as const,
    services: (labId: string, params: PlatformServiceParams) =>
      ['lab-catalog', 'platform', 'services', labId, params] as const,
    prices: (labId: string, serviceId: string) =>
      ['lab-catalog', 'platform', 'prices', labId, serviceId] as const,
    clinics: (labId: string) =>
      ['lab-catalog', 'platform', 'clinics', labId] as const,
    definitions: (specialtyId: string) =>
      ['lab-catalog', 'platform', 'definitions', specialtyId] as const,
  },
  clinic: {
    categories: ['lab-catalog', 'clinic', 'categories'] as const,
    labs: ['lab-catalog', 'clinic', 'labs'] as const,
    services: (params: ClinicServiceParams) =>
      ['lab-catalog', 'clinic', 'services', params] as const,
    treatments: ['lab-catalog', 'clinic', 'treatments'] as const,
    mappings: ['lab-catalog', 'clinic', 'mappings'] as const,
    forms: ['lab-catalog', 'clinic', 'forms'] as const,
  },
  templates: {
    list: (params: TemplateParams) =>
      ['lab-catalog', 'templates', 'list', params] as const,
  },
}
