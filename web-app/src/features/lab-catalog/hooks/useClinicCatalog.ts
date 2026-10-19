import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { catalogKeys } from '../query-keys'
import {
  clinicCatalogApi,
  orderTemplatesApi,
} from '../services/lab-catalog.api'
import type {
  ClinicServiceParams,
  OrderTemplate,
  ServiceMapping,
  TemplateInput,
  TemplateParams,
} from '../types'
import { useCatalogMutation } from './useCatalogMutation'

export function useClinicCategories() {
  return useQuery({
    queryKey: catalogKeys.clinic.categories,
    queryFn: clinicCatalogApi.categories,
    staleTime: 5 * 60_000,
  })
}

export function useClinicLabs() {
  return useQuery({
    queryKey: catalogKeys.clinic.labs,
    queryFn: clinicCatalogApi.labs,
    staleTime: 60_000,
  })
}

export function useClinicServices(params: ClinicServiceParams, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.clinic.services(params),
    queryFn: () => clinicCatalogApi.services(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useClinicTreatments(enabled = true) {
  return useQuery({
    queryKey: catalogKeys.clinic.treatments,
    queryFn: clinicCatalogApi.treatments,
    enabled,
  })
}

export function useServiceMappings() {
  return useQuery({
    queryKey: catalogKeys.clinic.mappings,
    queryFn: clinicCatalogApi.mappings,
  })
}

/** Published forms of the clinic's specialties (for template pre-fill). */
export function useClinicForms(enabled = true) {
  return useQuery({
    queryKey: catalogKeys.clinic.forms,
    queryFn: clinicCatalogApi.forms,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useCreateMapping() {
  return useCatalogMutation(
    (v: {
      clinicTreatmentId: string
      labServiceId: string
      isDefault: boolean
    }) => clinicCatalogApi.createMapping(v),
    { success: 'Mapping saved' },
  )
}

export function useUpdateMapping() {
  return useCatalogMutation(
    (v: { mapping: ServiceMapping; isDefault?: boolean; isActive?: boolean }) =>
      clinicCatalogApi.updateMapping(v.mapping.id, {
        isDefault: v.isDefault,
        isActive: v.isActive,
        version: v.mapping.version,
      }),
    {
      success: (m) =>
        !m.isActive
          ? 'Mapping removed'
          : m.isDefault
            ? 'Default lab service set'
            : 'Mapping updated',
    },
  )
}

export function useOrderTemplates(params: TemplateParams) {
  return useQuery({
    queryKey: catalogKeys.templates.list(params),
    queryFn: () => orderTemplatesApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useSaveOrderTemplate(template: OrderTemplate | null) {
  return useCatalogMutation(
    (v: TemplateInput) =>
      template
        ? orderTemplatesApi.update(template.id, {
            ...v,
            version: template.version,
          })
        : orderTemplatesApi.create(v),
    { success: template ? 'Template saved' : 'Template created' },
  )
}

export function useSetTemplateActive() {
  return useCatalogMutation(
    (v: { template: OrderTemplate; isActive: boolean }) =>
      orderTemplatesApi.update(v.template.id, {
        isActive: v.isActive,
        version: v.template.version,
      }),
    {
      success: (t) => (t.isActive ? 'Template restored' : 'Template archived'),
    },
  )
}
