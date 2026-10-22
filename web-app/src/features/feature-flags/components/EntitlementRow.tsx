import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DatePicker } from '@/components/shared/DatePicker'
import type { OrgFeature } from '../services/feature-flags.api'

/** `yyyy-MM-dd` → the end of that day (local) as ISO: the trial lasts the whole day. */
export function trialUntilIso(ymd: string): string | null {
  return ymd ? new Date(`${ymd}T23:59:59`).toISOString() : null
}

function toYmd(iso: string | null): string {
  return iso ? format(new Date(iso), 'yyyy-MM-dd') : ''
}

function LabeledSwitch({
  label,
  tooltip,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  tooltip: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex items-center gap-2 text-xs text-text-3">
            <Switch
              checked={checked}
              disabled={disabled}
              aria-label={tooltip}
              onCheckedChange={onCheckedChange}
            />
            {label}
          </label>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * One feature on the super admin's entitlement page: Entitled (platform's
 * switch, with an optional trial end date) and Enabled (the clinic owner's
 * switch, which the super admin can also flip).
 */
export function EntitlementRow({
  feature,
  onEntitle,
  onEnable,
}: {
  feature: OrgFeature
  onEntitle: (entitled: boolean, until: string | null) => void
  onEnable: (enabled: boolean) => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const expired = feature.lockedReason === 'trial_expired'

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-4 py-3"
      data-testid={`entitlement-row-${feature.key}`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{feature.name}</span>
          {feature.specialtyTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs capitalize">
              {tag}
            </Badge>
          ))}
          <Badge
            variant={feature.active ? 'default' : 'outline'}
            className="text-xs"
          >
            {feature.active
              ? 'Active'
              : expired
                ? 'Trial ended'
                : feature.entitled
                  ? 'Off by clinic'
                  : 'Not entitled'}
          </Badge>
        </div>
        {feature.description && (
          <p className="text-sm text-muted-foreground">{feature.description}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {(feature.entitled || expired) && (
          <div className="w-44">
            <DatePicker
              value={toYmd(feature.entitledUntil)}
              onChange={(ymd) => onEntitle(true, trialUntilIso(ymd))}
              placeholder="No trial end"
              min={today}
              clearable
              className="h-8 text-xs"
            />
          </div>
        )}
        <LabeledSwitch
          label="Entitled"
          tooltip={
            feature.entitled
              ? `Withdraw ${feature.name} from this clinic's plan`
              : `Entitle this clinic to ${feature.name}`
          }
          checked={feature.entitled}
          onCheckedChange={(on) =>
            // Re-entitling keeps a running trial; an ended one is dropped.
            onEntitle(on, on && !expired ? feature.entitledUntil : null)
          }
        />
        <LabeledSwitch
          label="Enabled"
          tooltip={
            feature.enabled
              ? `Turn ${feature.name} off for the clinic (owner's switch)`
              : `Turn ${feature.name} on for the clinic (owner's switch)`
          }
          checked={feature.enabled}
          onCheckedChange={onEnable}
        />
      </div>
    </div>
  )
}
