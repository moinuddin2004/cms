import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { catalogKeys } from '../query-keys'
import { platformCatalogApi } from '../services/lab-catalog.api'
import type {
  LabServiceInput,
  LabServiceItem,
  OptionInput,
  PlatformServiceParams,
  PriceInput,
  PriceWindow,
  ServiceOption,
} from '../types'
import { useCatalogMutation } from './useCatalogMutation'

export function useServiceCategories(specialtyId?: string) {
  return useQuery({
    queryKey: catalogKeys.platform.categories(specialtyId),
    queryFn: () => platformCatalogApi.categories(specialtyId),
    staleTime: 5 * 60_000,
  })
}

export function useServiceDefinitions(specialtyId: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.platform.definitions(specialtyId ?? ''),
    queryFn: () => platformCatalogApi.definitions(specialtyId!),
    enabled: !!specialtyId,
    staleTime: 5 * 60_000,
  })
}

export function useLabClinics(labId: string, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.platform.clinics(labId),
    queryFn: () => platformCatalogApi.labClinics(labId),
    enabled,
  })
}

export function useLabServices(labId: string, params: PlatformServiceParams) {
  return useQuery({
    queryKey: catalogKeys.platform.services(labId, params),
    queryFn: () => platformCatalogApi.services(labId, params),
    placeholderData: keepPreviousData,
  })
}

export function useServicePrices(labId: string, serviceId: string | null) {
  return useQuery({
    queryKey: catalogKeys.platform.prices(labId, serviceId ?? ''),
    queryFn: () => platformCatalogApi.prices(labId, serviceId!),
    enabled: !!serviceId,
  })
}

export function useSaveLabService(
  labId: string,
  service: LabServiceItem | null,
) {
  return useCatalogMutation(
    (v: LabServiceInput) => {
      if (!service) return platformCatalogApi.createService(labId, v)
      const { code: _code, ...rest } = v
      return platformCatalogApi.updateService(labId, service.id, {
        ...rest,
        version: service.version,
      })
    },
    { success: service ? 'Service saved' : 'Service added' },
  )
}

export function useSetServiceActive(labId: string) {
  return useCatalogMutation(
    (v: { service: LabServiceItem; isActive: boolean }) =>
      platformCatalogApi.updateService(labId, v.service.id, {
        isActive: v.isActive,
        version: v.service.version,
      }),
    {
      success: (s) =>
        s.isActive ? 'Service is offered again' : 'Service archived',
    },
  )
}

export function useSaveOption(
  labId: string,
  serviceId: string,
  option: ServiceOption | null,
) {
  return useCatalogMutation(
    (v: OptionInput) => {
      if (!option) return platformCatalogApi.addOption(labId, serviceId, v)
      const { code: _code, optionType: _type, ...rest } = v
      return platformCatalogApi.updateOption(labId, serviceId, option.id, {
        ...rest,
        version: option.version,
      })
    },
    { success: option ? 'Option saved' : 'Option added' },
  )
}

export function useSetOptionActive(labId: string, serviceId: string) {
  return useCatalogMutation(
    (v: { option: ServiceOption; isActive: boolean }) =>
      platformCatalogApi.updateOption(labId, serviceId, v.option.id, {
        isActive: v.isActive,
        version: v.option.version,
      }),
    { success: (o) => (o.isActive ? 'Option enabled' : 'Option disabled') },
  )
}

export function useSavePrice(
  labId: string,
  serviceId: string,
  price: PriceWindow | null,
) {
  return useCatalogMutation(
    (v: PriceInput) => {
      if (!price) return platformCatalogApi.addPrice(labId, serviceId, v)
      const { organizationId: _org, ...rest } = v
      return platformCatalogApi.updatePrice(labId, serviceId, price.id, {
        ...rest,
        version: price.version,
      })
    },
    { success: price ? 'Price updated' : 'Price saved' },
  )
}

export function useVoidPrice(labId: string, serviceId: string) {
  return useCatalogMutation(
    (v: { price: PriceWindow; reason: string }) =>
      platformCatalogApi.voidPrice(labId, serviceId, v.price.id, {
        reason: v.reason,
        version: v.price.version,
      }),
    { success: 'Price voided' },
  )
}
