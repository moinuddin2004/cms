import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AUDIENCE_LABEL, CHANNEL_LABEL } from '../types'
import type { NotificationEventSettings, NotificationRule } from '../types'

/** One event × audience × channel toggle. Mandatory in-app rules show locked on. */
export function RuleSwitch({
  event,
  rule,
  pending,
  onChange,
}: {
  event: NotificationEventSettings
  rule: NotificationRule
  pending: boolean
  onChange: (isEnabled: boolean) => void
}) {
  const what = `${event.name} — ${CHANNEL_LABEL[rule.channel]} to ${AUDIENCE_LABEL[rule.audience].toLowerCase()}`
  const tip = rule.platformMode
    ? rule.platformMode === 'on'
      ? 'Always on — set by the platform for your clinic'
      : 'Always off — set by the platform for your clinic'
    : rule.locked
      ? 'Mandatory — always sent in-app'
      : rule.isEnabled
        ? `On — click to stop ${CHANNEL_LABEL[rule.channel]} messages`
        : `Off — click to send by ${CHANNEL_LABEL[rule.channel]}`
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Switch
              size="sm"
              checked={rule.isEnabled}
              disabled={rule.locked || !!rule.platformMode || pending}
              aria-label={what}
              onCheckedChange={onChange}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
