import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EmptyState } from '@/components/shared'
import { useSetLocationFeature } from '../hooks/useFeatureSettings'
import type { OwnerFeature } from '../types/feature-settings.types'

/**
 * Per-location narrowing of one feature: a location can switch an
 * org-active feature off, never on beyond the clinic setting.
 */
export function FeatureLocationsSheet({
  feature,
  locations,
  onOpenChange,
}: {
  feature: OwnerFeature | null
  locations: { id: string; name: string }[]
  onOpenChange: (open: boolean) => void
}) {
  const setLocation = useSetLocationFeature()
  const pendingId = setLocation.isPending
    ? setLocation.variables.locationId
    : null

  return (
    <Sheet open={!!feature} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{feature?.name ?? 'Feature'} by location</SheetTitle>
          <SheetDescription>
            Turn this feature off at a location that does not use it. A location
            can only switch it off — it never gets a feature the clinic has off.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-1 px-4">
          {feature && locations.length === 0 && (
            <EmptyState title="No locations" />
          )}
          {feature &&
            locations.map((loc) => {
              const off = feature.disabledLocationIds.includes(loc.id)
              const tip = off
                ? `Turn ${feature.name} back on at ${loc.name}`
                : `Turn ${feature.name} off at ${loc.name}`
              return (
                <div
                  key={loc.id}
                  className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{loc.name}</p>
                    <p className="text-xs text-text-3">
                      {off ? 'Off at this location' : 'Follows the clinic (on)'}
                    </p>
                  </div>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Switch
                            checked={!off}
                            disabled={pendingId === loc.id}
                            aria-label={tip}
                            onCheckedChange={(on) =>
                              setLocation.mutate({
                                key: feature.key,
                                locationId: loc.id,
                                disabled: !on,
                              })
                            }
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">{tip}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )
            })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
