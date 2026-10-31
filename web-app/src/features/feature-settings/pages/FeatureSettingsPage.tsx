import { useMemo } from 'react'
import { ToggleRight } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
} from '@/components/shared'
import {
  useOwnerFeatures,
  useSetFeatureEnabled,
} from '../hooks/useFeatureSettings'
import { useFeatureSettingsStore } from '../hooks/useFeatureSettingsStore'
import {
  activeFilterCount,
  filterFeatureModules,
  moduleLabel,
} from '../lib/filter-features'
import { FeatureFilters } from '../components/FeatureFilters'
import { FeatureSwitchRow } from '../components/FeatureSwitchRow'
import { FeatureImpactDialog } from '../components/FeatureImpactDialog'
import { FeatureLocationsSheet } from '../components/FeatureLocationsSheet'
import type { OwnerFeature } from '../types/feature-settings.types'

/** `/settings/features` — the clinic owner switches entitled features on/off. */
export function FeatureSettingsPage() {
  return (
    <DashboardLayout
      title="Features"
      subtitle="Turn the features in your plan on or off for the clinic, or for one location."
      backTo="/settings"
      backLabel="Back to settings"
    >
      <FeatureSettings />
    </DashboardLayout>
  )
}

export function FeatureSettings() {
  const query = useOwnerFeatures()
  const toggle = useSetFeatureEnabled()
  const filters = useFeatureSettingsStore((s) => s.filters)
  const clearFilters = useFeatureSettingsStore((s) => s.clearFilters)
  const confirmOffKey = useFeatureSettingsStore((s) => s.confirmOffKey)
  const setConfirmOffKey = useFeatureSettingsStore((s) => s.setConfirmOffKey)
  const locationsKey = useFeatureSettingsStore((s) => s.locationsKey)
  const setLocationsKey = useFeatureSettingsStore((s) => s.setLocationsKey)

  const modules = query.data?.modules
  const locations = query.data?.locations ?? []
  const all = useMemo(
    () => modules?.flatMap((m) => m.features) ?? [],
    [modules],
  )
  const visible = useMemo(
    () => (modules ? filterFeatureModules(modules, filters) : []),
    [modules, filters],
  )
  const visibleCount = visible.reduce((n, m) => n + m.features.length, 0)
  const byKey = (key: string | null) =>
    key ? (all.find((f) => f.key === key) ?? null) : null

  const onToggle = (feature: OwnerFeature, enabled: boolean) => {
    if (enabled) toggle.mutate({ key: feature.key, enabled: true })
    else setConfirmOffKey(feature.key) // confirm with the impact list first
  }

  if (query.isLoading) return <LoadingSkeleton variant="cards" rows={3} />
  if (query.isError) {
    return (
      <ErrorState
        description="Could not load the clinic's features."
        onRetry={() => void query.refetch()}
      />
    )
  }
  if (all.length === 0) {
    return (
      <EmptyState
        icon={ToggleRight}
        title="No features yet"
        description="The platform has not set up any features for this clinic."
      />
    )
  }

  const activeCount = all.filter((f) => f.active).length

  return (
    <div className="space-y-6">
      <FeatureFilters
        modules={(modules ?? []).map((m) => m.module)}
        resultLabel={`${activeCount} of ${all.length} on`}
      />

      {visibleCount === 0 ? (
        <NoResultsState
          message="No features match your filters."
          onClear={activeFilterCount(filters) ? clearFilters : undefined}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {visible.map((group) => (
            <Card
              key={group.module}
              className="rounded-lg border border-border shadow-sm"
            >
              <CardHeader>
                <CardTitle className="text-lg font-medium">
                  {moduleLabel(group.module)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {group.features.map((feature, idx) => (
                  <div key={feature.key}>
                    {idx > 0 && <Separator />}
                    <FeatureSwitchRow
                      feature={feature}
                      locationCount={locations.length}
                      isPending={
                        toggle.isPending && toggle.variables.key === feature.key
                      }
                      onToggle={onToggle}
                      onOpenLocations={(f) => setLocationsKey(f.key)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FeatureImpactDialog
        feature={byKey(confirmOffKey)}
        onOpenChange={(open) => !open && setConfirmOffKey(null)}
        isLoading={toggle.isPending}
        onConfirm={() => {
          if (!confirmOffKey) return
          toggle.mutate(
            { key: confirmOffKey, enabled: false },
            { onSettled: () => setConfirmOffKey(null) },
          )
        }}
      />
      <FeatureLocationsSheet
        feature={byKey(locationsKey)}
        locations={locations}
        onOpenChange={(open) => !open && setLocationsKey(null)}
      />
    </div>
  )
}
