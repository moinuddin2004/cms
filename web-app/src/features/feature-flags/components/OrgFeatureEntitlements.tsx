import { useMemo, useState } from 'react'
import { Search, ToggleRight } from 'lucide-react'
import {
  useBulkSetEntitlement,
  useOrgFeatures,
  useSetEntitlement,
  useToggleFeature,
} from '../hooks/useFeatureFlags'
import type { ModuleFeatureGroup } from '../services/feature-flags.api'
import { EntitlementRow } from './EntitlementRow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
} from '@/components/shared'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

const SPECIALTIES = [
  { key: 'all', label: 'All' },
  { key: 'dental', label: 'Dental' },
  { key: 'skin', label: 'Skin' },
  { key: 'ortho', label: 'Ortho' },
  { key: 'physio', label: 'Physio' },
  { key: 'eye', label: 'Eye' },
] as const

/**
 * Super admin: what the org is entitled to (with trial dates) and the
 * owner's on/off switch, per feature; bulk entitle by module.
 */
export function OrgFeatureEntitlements({ orgId }: { orgId: string }) {
  const { data: groups, isLoading, isError, refetch } = useOrgFeatures(orgId)
  const toggle = useToggleFeature(orgId)
  const entitle = useSetEntitlement(orgId)
  const bulkEntitle = useBulkSetEntitlement(orgId)
  const [specialty, setSpecialty] = useState<string>('all')
  const [search, setSearch] = useState('')
  const q = useDebounce(search, 300).trim().toLowerCase()

  const filteredGroups = useMemo<ModuleFeatureGroup[]>(() => {
    if (!groups) return []
    return groups
      .map((g) => ({
        ...g,
        features: g.features.filter(
          (f) =>
            (specialty === 'all' || f.specialtyTags.includes(specialty)) &&
            (!q ||
              f.name.toLowerCase().includes(q) ||
              f.key.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.features.length > 0)
  }, [groups, specialty, q])

  const all = groups?.flatMap((g) => g.features) ?? []
  const entitledCount = all.filter((f) => f.entitled).length
  const activeCount = all.filter((f) => f.active).length
  const filtersOn = specialty !== 'all' || !!search

  if (isLoading) return <LoadingSkeleton variant="cards" rows={3} />
  if (isError) {
    return (
      <ErrorState
        description="Could not load this organization's features."
        onRetry={() => void refetch()}
      />
    )
  }
  if (all.length === 0) {
    return (
      <EmptyState
        icon={ToggleRight}
        title="No features in the catalog"
        description="Add features to the catalog first."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search features"
            aria-label="Search features"
            className="h-9 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSpecialty(s.key)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                specialty === s.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="ml-auto pr-1 text-xs text-text-3">
          {entitledCount} entitled · {activeCount} active · {all.length} total
        </span>
      </div>

      {filteredGroups.length === 0 ? (
        <NoResultsState
          message="No features match your filters."
          onClear={
            filtersOn
              ? () => {
                  setSpecialty('all')
                  setSearch('')
                }
              : undefined
          }
        />
      ) : (
        filteredGroups.map((group) => (
          <Card key={group.module}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="capitalize">{group.module}</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkEntitle.isPending}
                  onClick={() =>
                    bulkEntitle.mutate({ module: group.module, entitled: true })
                  }
                >
                  Entitle module
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkEntitle.isPending}
                  onClick={() =>
                    bulkEntitle.mutate({
                      module: group.module,
                      entitled: false,
                    })
                  }
                >
                  Withdraw module
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {group.features.map((feature, idx) => (
                <div key={feature.key}>
                  {idx > 0 && <Separator className="my-1" />}
                  <EntitlementRow
                    feature={feature}
                    onEntitle={(entitled, until) =>
                      entitle.mutate({
                        featureKey: feature.key,
                        entitled,
                        until,
                      })
                    }
                    onEnable={(isEnabled) =>
                      toggle.mutate({ featureKey: feature.key, isEnabled })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
