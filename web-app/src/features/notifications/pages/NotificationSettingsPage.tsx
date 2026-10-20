import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AudienceSwitchCard } from '../components/AudienceSwitchCard'
import { EventRulesTable } from '../components/EventRulesTable'
import { MessageLogPanel } from '../components/MessageLogPanel'
import { QuietHoursSheet } from '../components/QuietHoursSheet'
import { TemplateSheet } from '../components/TemplateSheet'
import { useNotificationOverview } from '../hooks/useNotificationSettings'
import type {
  AudienceSetting,
  NotificationAudience,
  NotificationChannel,
  NotificationEventSettings,
  NotificationOverview,
} from '../types'

const GROUPS: {
  value: 'patient' | 'team'
  label: string
  audiences: NotificationAudience[]
}[] = [
  { value: 'patient', label: 'Patients', audiences: ['patient'] },
  {
    value: 'team',
    label: 'Team & labs',
    audiences: ['doctor', 'coordinator', 'lab'],
  },
]

function channelsOf(
  o: NotificationOverview,
  audiences: NotificationAudience[],
) {
  const set = new Set<NotificationChannel>()
  for (const a of audiences) for (const c of o.channelsByAudience[a]) set.add(c)
  return [...set]
}

/** Clinic notification settings (lab ERD §16) — clinic admins only. */
export function NotificationSettingsPage() {
  const overview = useNotificationOverview()
  const [quietOf, setQuietOf] = useState<AudienceSetting | null>(null)
  const [wording, setWording] = useState<{
    event: NotificationEventSettings
    channels: NotificationChannel[]
  } | null>(null)

  return (
    <DashboardLayout
      title="Notifications"
      subtitle="Who is told what, on which channel — and the log of every message."
      backTo="/settings"
      backLabel="Back to settings"
    >
      {overview.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : overview.isError || !overview.data ? (
        <ErrorState onRetry={() => void overview.refetch()} />
      ) : (
        <Tabs defaultValue="patient">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
            {GROUPS.map((g) => (
              <TabsTrigger key={g.value} value={g.value} className="text-sm">
                {g.label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="log" className="text-sm">
              Message log
            </TabsTrigger>
          </TabsList>

          {GROUPS.map((g) => {
            const data = overview.data
            const channels = channelsOf(data, g.audiences)
            const events = data.events.filter((e) =>
              e.audiences.some((a) => g.audiences.includes(a)),
            )
            return (
              <TabsContent
                key={g.value}
                value={g.value}
                className="mt-4 space-y-6 animate-in fade-in duration-300"
              >
                <section className="space-y-3">
                  <h2 className="text-lg font-medium">Master switches</h2>
                  {data.audiences
                    .filter((s) => g.audiences.includes(s.audience))
                    .map((s) => (
                      <AudienceSwitchCard
                        key={s.audience}
                        setting={s}
                        onEditQuietHours={setQuietOf}
                      />
                    ))}
                </section>
                <section className="space-y-3">
                  <h2 className="text-lg font-medium">Events</h2>
                  <EventRulesTable
                    events={events}
                    audiences={g.audiences}
                    channels={channels}
                    settings={data.audiences}
                    onEditWording={(event) => setWording({ event, channels })}
                  />
                </section>
              </TabsContent>
            )
          })}

          <TabsContent
            value="log"
            className="mt-4 animate-in fade-in duration-300"
          >
            <MessageLogPanel />
          </TabsContent>
        </Tabs>
      )}

      <QuietHoursSheet
        setting={quietOf}
        onOpenChange={(o) => !o && setQuietOf(null)}
      />
      <TemplateSheet
        event={wording?.event ?? null}
        channels={wording?.channels ?? ['in_app']}
        onOpenChange={(o) => !o && setWording(null)}
      />
    </DashboardLayout>
  )
}
