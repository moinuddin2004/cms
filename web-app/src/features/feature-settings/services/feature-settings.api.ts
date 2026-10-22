import api from '@/lib/api'
import type {
  FeatureImpact,
  OwnerFeaturesView,
} from '../types/feature-settings.types'

const key = (featureKey: string) => encodeURIComponent(featureKey)

export async function fetchOwnerFeatures(): Promise<OwnerFeaturesView> {
  const { data } = await api.get('/admin/features')
  return data.data
}

export async function fetchFeatureImpact(
  featureKey: string,
): Promise<FeatureImpact> {
  const { data } = await api.get(`/admin/features/${key(featureKey)}/impact`)
  return data.data
}

export async function setFeatureEnabled(
  featureKey: string,
  enabled: boolean,
): Promise<{ key: string; enabled: boolean }> {
  const { data } = await api.patch(`/admin/features/${key(featureKey)}`, {
    enabled,
  })
  return data.data
}

export async function setLocationFeatureDisabled(
  featureKey: string,
  locationId: string,
  disabled: boolean,
): Promise<{ featureKey: string; locationId: string; disabled: boolean }> {
  const { data } = await api.put(
    `/admin/features/${key(featureKey)}/locations/${locationId}`,
    { disabled },
  )
  return data.data
}
