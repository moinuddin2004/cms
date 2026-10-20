import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquareOff } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { notificationErrorMessage } from '../lib/notification-errors'
import { notificationSettingsApi } from '../services/notifications.api'
import type { PatientCommPrefs } from '../types'

type OptOut = 'whatsappOptOut' | 'smsOptOut' | 'emailOptOut'

const CHANNELS: { key: OptOut; label: string }[] = [
  { key: 'whatsappOptOut', label: 'WhatsApp' },
  { key: 'smsOptOut', label: 'SMS' },
  { key: 'emailOptOut', label: 'Email' },
]

/**
 * Lab ERD §16 "Patient opt-out": stop messages to this patient per
 * channel. Opted-out messages are still logged as `skipped_opt_out`.
 */
export function PatientMessagesCard({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient()
  const key = ['notification-settings', 'patient-prefs', patientId]
  const prefs = useQuery({
    queryKey: key,
    queryFn: () => notificationSettingsApi.patientPrefs(patientId),
  })
  const save = useMutation({
    mutationFn: (body: Partial<Record<OptOut, boolean>>) =>
      notificationSettingsApi.updatePatientPrefs(patientId, body),
    onSuccess: (data: PatientCommPrefs) => {
      queryClient.setQueryData(key, data)
      toast.success('Messaging preferences saved')
    },
    onError: (err) => toast.error(notificationErrorMessage(err)),
  })

  if (prefs.isError) return null
  return (
    <section className="mt-6 space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquareOff className="size-4 text-text-3" />
        <h3 className="text-lg font-medium">Messages to this patient</h3>
      </div>
      <p className="text-sm text-text-3">
        Turn a channel off if the patient asked not to be messaged there.
      </p>
      <div className="flex flex-wrap gap-6">
        {CHANNELS.map((c) => (
          <label key={c.key} className="flex items-center gap-2 text-sm">
            <Switch
              checked={!(prefs.data?.[c.key] ?? false)}
              disabled={prefs.isLoading || save.isPending}
              onCheckedChange={(on) => save.mutate({ [c.key]: !on })}
              aria-label={`${c.label} messages`}
            />
            {c.label}
          </label>
        ))}
      </div>
    </section>
  )
}
