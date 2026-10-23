import { Lock, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/shared/TooltipButton'
import type { OwnerFeature } from '../types/feature-settings.types'

export const LOCKED_MESSAGE = 'Plan mein nahi — super admin se rabta karein'
export const TRIAL_ENDED_MESSAGE =
  'Trial khatam ho gaya — super admin se rabta karein'

export function formatUntil(until: string | null) {
  if (!until) return null
  return new Date(until).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** One feature: name, state, the owner's switch (or a lock) and locations. */
export function FeatureSwitchRow({
  feature,
  locationCount,
  isPending,
  onToggle,
  onOpenLocations,
}: {
  feature: OwnerFeature
  locationCount: number
  isPending: boolean
  onToggle: (feature: OwnerFeature, enabled: boolean) => void
  onOpenLocations: (feature: OwnerFeature) => void
}) {
  const locked = !feature.entitled
  const lockText =
    feature.lockedReason === 'trial_expired'
      ? TRIAL_ENDED_MESSAGE
      : LOCKED_MESSAGE
  const until = formatUntil(feature.entitledUntil)
  const offAt = feature.disabledLocationIds.length
  const switchTip = locked
    ? lockText
    : feature.enabled
      ? `Turn ${feature.name} off for the clinic`
      : `Turn ${feature.name} on for the clinic`

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-4 py-3"
      data-testid={`feature-row-${feature.key}`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {locked && <Lock className="size-4 text-text-3" aria-hidden />}
          <span className="font-medium">{feature.name}</span>
          {locked ? (
            <Badge variant="outline" className="text-xs">
              Locked
            </Badge>
          ) : (
            <Badge
              variant={feature.active ? 'default' : 'outline'}
              className="text-xs"
            >
              {feature.active ? 'On' : 'Off'}
            </Badge>
          )}
          {until && !locked && (
            <Badge variant="secondary" className="text-xs">
              Trial until {until}
            </Badge>
          )}
          {offAt > 0 && feature.active && (
            <Badge variant="secondary" className="text-xs">
              Off at {offAt} location{offAt === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
        {feature.description && (
          <p className="text-sm text-muted-foreground">{feature.description}</p>
        )}
        {locked && <p className="text-sm text-text-3">{lockText}</p>}
      </div>

      <div className="flex items-center gap-2">
        {locationCount > 1 && (
          <TooltipButton
            tooltip={`Per-location settings for ${feature.name}`}
            variant="ghost"
            size="icon"
            disabled={!feature.active}
            onClick={() => onOpenLocations(feature)}
          >
            <MapPin className="size-4" />
          </TooltipButton>
        )}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* The span keeps the tooltip working on a disabled switch. */}
              <span tabIndex={locked ? 0 : -1}>
                <Switch
                  checked={feature.enabled && !locked}
                  disabled={locked || isPending}
                  aria-label={switchTip}
                  onCheckedChange={(on) => onToggle(feature, on)}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{switchTip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
