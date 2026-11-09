import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useMyFeatures } from '@/features/feature-flags/hooks/useFeatureFlags'

interface FeatureFlagsContextValue {
  /** Set of enabled feature keys for the active org */
  features: Set<string>
  /** Active org's specialty tags */
  specialtyTags: string[]
  isLoading: boolean
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  features: new Set(),
  specialtyTags: ['general'],
  isLoading: false,
})

export function FeatureFlagsProvider({
  children,
  specialtyTags = ['general'],
  enabled = true,
}: {
  children: ReactNode
  specialtyTags?: string[]
  /** Only fetch features when authenticated with an active org */
  enabled?: boolean
}) {
  const { data, isLoading } = useMyFeatures(enabled)

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      features: new Set(enabled ? (data ?? []) : []),
      specialtyTags,
      isLoading,
    }),
    [data, specialtyTags, isLoading, enabled],
  )

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

/**
 * Returns true if the given feature key is enabled for the active org.
 */
export function useFeature(key: string): boolean {
  const { features } = useContext(FeatureFlagsContext)
  return features.has(key)
}

/**
 * Access to the full enabled-feature set plus loading state — used by the
 * sidebar to hide nav items and by route guards to avoid a flash while the
 * org's flags are still loading.
 */
export function useFeatures(): { features: Set<string>; isLoading: boolean } {
  const { features, isLoading } = useContext(FeatureFlagsContext)
  return { features, isLoading }
}

/**
 * Returns true if the active org has the given specialty tag.
 */
export function useSpecialty(specialty: string): boolean {
  const { specialtyTags } = useContext(FeatureFlagsContext)
  return specialtyTags.includes(specialty)
}

/**
 * Renders children only when the feature is enabled.
 */
export function FeatureGuard({
  feature,
  children,
  fallback = null,
}: {
  feature: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const enabled = useFeature(feature)
  return <>{enabled ? children : fallback}</>
}

/**
 * Renders children only for orgs with the given specialty.
 */
export function SpecialtyGuard({
  specialty,
  children,
  fallback = null,
}: {
  specialty: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const matches = useSpecialty(specialty)
  return <>{matches ? children : fallback}</>
}
