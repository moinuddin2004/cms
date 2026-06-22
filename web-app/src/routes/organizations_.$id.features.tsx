import { useMemo, useState } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/useAuthStore'
import {
  useBulkToggleFeatures,
  useOrgFeatures,
  useToggleFeature,
} from '@/features/feature-flags/hooks/useFeatureFlags'
import type { ModuleFeatureGroup } from '@/features/feature-flags/services/feature-flags.api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/organizations_/$id/features')({
  component: FeatureManagementRoute,
})

const SPECIALTIES = [
  { key: 'all', label: 'All' },
  { key: 'dental', label: 'Dental' },
  { key: 'skin', label: 'Skin' },
  { key: 'ortho', label: 'Ortho' },
  { key: 'physio', label: 'Physio' },
  { key: 'eye', label: 'Eye' },
] as const

function FeatureManagementRoute() {
  const { id } = Route.useParams()
  const { isSuperAdmin } = useAuthStore()

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" />
  }

  return (
    <DashboardLayout title="Feature Management">
      <FeatureManagement orgId={id} />
    </DashboardLayout>
  )
}

function FeatureManagement({ orgId }: { orgId: string }) {
  const { data: groups, isLoading } = useOrgFeatures(orgId)
  const toggle = useToggleFeature(orgId)
  const bulkToggle = useBulkToggleFeatures(orgId)
  const [specialty, setSpecialty] = useState<string>('all')

  // Filter each module's features by the active specialty
  const filteredGroups = useMemo<ModuleFeatureGroup[]>(() => {
    if (!groups) return []
    if (specialty === 'all') return groups
    return groups
      .map((g) => ({
        ...g,
        features: g.features.filter((f) =>
          f.specialtyTags.includes(specialty),
        ),
      }))
      .filter((g) => g.features.length > 0)
  }, [groups, specialty])

  const allFeatures = useMemo(
    () => filteredGroups.flatMap((g) => g.features),
    [filteredGroups],
  )
  const enabledCount = allFeatures.filter((f) => f.isEnabled).length
  const totalCount = allFeatures.length

  const handleBulk = (isEnabled: boolean) => {
    const featureKeys = allFeatures.map((f) => f.key)
    if (featureKeys.length === 0) return
    bulkToggle.mutate({ featureKeys, isEnabled })
  }

  if (isLoading) {
    return <FeatureSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Feature Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {enabledCount} of {totalCount} features enabled
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulk(true)}
            disabled={bulkToggle.isPending || totalCount === 0}
          >
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulk(false)}
            disabled={bulkToggle.isPending || totalCount === 0}
          >
            Disable All
          </Button>
        </div>
      </div>

      {/* Specialty filter bar */}
      <div className="flex flex-wrap gap-2">
        {SPECIALTIES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSpecialty(s.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              specialty === s.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/40',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Separator />

      {/* Feature groups */}
      {filteredGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No features match this specialty.
        </p>
      ) : (
        filteredGroups.map((group) => (
          <Card key={group.module}>
            <CardHeader>
              <CardTitle className="capitalize">{group.module}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {group.features.map((feature, idx) => (
                <div key={feature.key}>
                  {idx > 0 && <Separator className="my-1" />}
                  <div className="flex items-start justify-between gap-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{feature.name}</span>
                        {feature.specialtyTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs capitalize"
                          >
                            {tag}
                          </Badge>
                        ))}
                        <Badge
                          variant={feature.isEnabled ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {feature.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      {feature.description && (
                        <p className="text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={feature.isEnabled}
                      onCheckedChange={(isEnabled) =>
                        toggle.mutate({ featureKey: feature.key, isEnabled })
                      }
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

function FeatureSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex justify-between">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
