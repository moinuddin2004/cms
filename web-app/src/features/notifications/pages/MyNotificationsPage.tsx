import { Lock, Volume2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SettingsCard } from '@/features/settings'
import {
  useMyNotificationPrefs,
  useUpdateMyNotificationPrefs,
} from '../hooks/useMyNotifications'
import type { MyEmailPref } from '../types'

/**
 * Your own notification switches: the bell's sound, and which events may
 * email you. Your clinic decides what is sent at all (Settings →
 * Notifications); here you can only say no to more — never to the ones the
 * clinic marks mandatory. In-app notifications can't be muted.
 */
export function MyNotificationsPage() {
  const prefs = useMyNotificationPrefs()
  const update = useUpdateMyNotificationPrefs()
  const data = prefs.data

  return (
    <DashboardLayout
      title="My notifications"
      subtitle="Which emails you get, and the notification sound. In-app notifications always appear in the bell."
    >
      {prefs.isPending && !data?.email.length ? (
        <LoadingSkeleton variant="detail" />
      ) : prefs.isError ? (
        <ErrorState onRetry={() => void prefs.refetch()} />
      ) : (
        <div className="space-y-6">
          <SettingsCard title="Sound">
            <label className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="flex items-center gap-3">
                <Volume2 className="size-4 text-text-3" />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    Play a sound for new notifications
                  </span>
                  <span className="block text-xs text-text-3">
                    On every device you sign in on.
                  </span>
                </span>
              </span>
              <Switch
                aria-label="Notification sound"
                checked={data?.sound ?? true}
                disabled={update.isPending}
                onCheckedChange={(sound) => update.mutate({ sound })}
              />
            </label>
          </SettingsCard>

          <SettingsCard
            title="Email"
            description="Emails only go to a verified address. Your clinic chooses which events are emailed; switch off any you don’t want."
          >
            {data?.email.length ? (
              <ul className="divide-y divide-border-soft">
                {data.email.map((e) => (
                  <EmailRow
                    key={e.code}
                    pref={e}
                    disabled={update.isPending}
                    onChange={(enabled) =>
                      update.mutate({ email: { [e.code]: enabled } })
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-text-3">
                No emails to choose from yet.
              </p>
            )}
          </SettingsCard>
        </div>
      )}
    </DashboardLayout>
  )
}

function EmailRow({
  pref,
  disabled,
  onChange,
}: {
  pref: MyEmailPref
  disabled: boolean
  onChange: (enabled: boolean) => void
}) {
  const control = (
    <Switch
      aria-label={`Email: ${pref.name}`}
      checked={pref.enabled}
      disabled={disabled || pref.mandatory}
      onCheckedChange={onChange}
    />
  )
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-panel">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          {pref.name}
          {pref.mandatory && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Lock className="size-3" /> Required
            </Badge>
          )}
          {!pref.clinicDefault && !pref.mandatory && (
            <Badge variant="outline" className="text-[10px] text-text-3">
              Off unless your clinic turns it on
            </Badge>
          )}
        </p>
        <p className="text-xs text-text-3">{pref.description}</p>
      </div>
      {pref.mandatory ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{control}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              Required by your clinic
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        control
      )}
    </li>
  )
}
