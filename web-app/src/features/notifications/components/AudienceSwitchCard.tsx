import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUpdateAudience } from '../hooks/useNotificationSettings'
import { AUDIENCE_LABEL } from '../types'
import type { AudienceSetting } from '../types'

const HINT: Record<AudienceSetting['audience'], string> = {
  patient:
    'WhatsApp / SMS to patients. Off by default — nothing is sent to patients until you switch this on.',
  doctor: 'Updates about the doctor’s own lab orders.',
  coordinator: 'Lab order follow-up for the staff who coordinate with labs.',
  lab: 'Messages to the labs you work with (new orders, remakes …).',
}

/** Master switch + quiet hours for one audience. */
export function AudienceSwitchCard({
  setting,
  onEditQuietHours,
}: {
  setting: AudienceSetting
  onEditQuietHours: (setting: AudienceSetting) => void
}) {
  const update = useUpdateAudience()
  const label = AUDIENCE_LABEL[setting.audience]
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-text-3">{HINT[setting.audience]}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-2">
          <Clock className="size-3.5" />
          {setting.quietStart && setting.quietEnd
            ? `Quiet hours ${setting.quietStart} – ${setting.quietEnd}${setting.timezone ? ` (${setting.timezone})` : ''}`
            : 'No quiet hours'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEditQuietHours(setting)}
        >
          Quiet hours
        </Button>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Switch
                  checked={setting.isEnabled}
                  disabled={update.isPending}
                  aria-label={`Notifications to ${label.toLowerCase()}`}
                  onCheckedChange={(isEnabled) =>
                    update.mutate({
                      audience: setting.audience,
                      input: { isEnabled },
                    })
                  }
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {setting.isEnabled
                ? `On — click to stop all messages to ${label.toLowerCase()}`
                : `Off — click to start sending to ${label.toLowerCase()}`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
