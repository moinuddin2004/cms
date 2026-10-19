import { useState } from 'react'
import { Lock, PencilLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { useUpdateRules } from '../hooks/useNotificationSettings'
import { AUDIENCE_LABEL, CHANNEL_LABEL } from '../types'
import type {
  AudienceSetting,
  NotificationAudience,
  NotificationChannel,
  NotificationEventSettings,
  RuleChange,
} from '../types'
import { RuleSwitch } from './RuleSwitch'

const ruleKey = (r: Omit<RuleChange, 'isEnabled'>) =>
  `${r.eventCode}:${r.audience}:${r.channel}`

/**
 * Event × channel toggles for a group of audiences: one row per event and
 * audience, one column per channel. A row whose audience is switched off is
 * dimmed — its rules are kept but nothing is sent.
 */
export function EventRulesTable({
  events,
  audiences,
  channels,
  settings,
  onEditWording,
}: {
  events: NotificationEventSettings[]
  audiences: NotificationAudience[]
  channels: NotificationChannel[]
  settings: AudienceSetting[]
  onEditWording: (event: NotificationEventSettings) => void
}) {
  const update = useUpdateRules()
  const [pending, setPending] = useState<Set<string>>(new Set())
  const enabledOf = new Map(settings.map((s) => [s.audience, s.isEnabled]))

  const toggle = (change: RuleChange) => {
    const key = ruleKey(change)
    setPending((p) => new Set(p).add(key))
    update.mutate([change], {
      onSettled: () =>
        setPending((p) => {
          const next = new Set(p)
          next.delete(key)
          return next
        }),
    })
  }

  const rows = events.flatMap((event) =>
    event.audiences
      .filter((a) => audiences.includes(a))
      .map((audience) => ({ event, audience })),
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[240px]">Event</TableHead>
            {audiences.length > 1 && <TableHead>Sent to</TableHead>}
            {channels.map((c) => (
              <TableHead key={c} className="w-24 text-center">
                {CHANNEL_LABEL[c]}
              </TableHead>
            ))}
            <TableHead className="w-14" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ event, audience }, i) => {
            const firstOfEvent = i === 0 || rows[i - 1].event !== event
            const off = enabledOf.get(audience) === false
            return (
              <TableRow
                key={`${event.code}:${audience}`}
                className={cn(
                  'transition-colors hover:bg-panel',
                  off && 'opacity-60',
                )}
              >
                <TableCell className="align-top">
                  {firstOfEvent && (
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {event.name}
                        {event.isMandatoryInternal &&
                          audience !== 'patient' && (
                            <Badge
                              variant="secondary"
                              className="gap-1 text-[10px]"
                            >
                              <Lock className="size-3" /> Mandatory
                            </Badge>
                          )}
                      </p>
                      <p className="text-xs text-text-3">{event.description}</p>
                    </div>
                  )}
                </TableCell>
                {audiences.length > 1 && (
                  <TableCell className="text-sm text-text-2">
                    {AUDIENCE_LABEL[audience]}
                  </TableCell>
                )}
                {channels.map((channel) => {
                  const rule = event.rules.find(
                    (r) => r.audience === audience && r.channel === channel,
                  )
                  return (
                    <TableCell key={channel} className="text-center">
                      {rule ? (
                        <RuleSwitch
                          event={event}
                          rule={rule}
                          pending={pending.has(
                            ruleKey({
                              eventCode: event.code,
                              audience,
                              channel,
                            }),
                          )}
                          onChange={(isEnabled) =>
                            toggle({
                              eventCode: event.code,
                              audience,
                              channel,
                              isEnabled,
                            })
                          }
                        />
                      ) : (
                        <span className="text-xs text-text-3">—</span>
                      )}
                    </TableCell>
                  )
                })}
                <TableCell className="text-right">
                  {firstOfEvent && (
                    <TooltipButton
                      tooltip={`Edit wording — ${event.name}`}
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onEditWording(event)}
                    >
                      <PencilLine className="size-4" />
                    </TooltipButton>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
