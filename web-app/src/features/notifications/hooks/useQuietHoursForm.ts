import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { quietHoursSchema } from '../schemas/notification.schema'
import type { QuietHoursFormValues } from '../schemas/notification.schema'
import type { AudienceSetting } from '../types'
import { useUpdateAudience } from './useNotificationSettings'

function defaultsFor(setting: AudienceSetting | null): QuietHoursFormValues {
  return {
    enabled: !!setting?.quietStart,
    start: setting?.quietStart ?? '22:00',
    end: setting?.quietEnd ?? '08:00',
    timezone: setting?.timezone ?? '',
  }
}

/** Quiet hours for one audience: messages in the window wait until it ends. */
export function useQuietHoursForm({
  open,
  setting,
  onDone,
}: {
  open: boolean
  setting: AudienceSetting | null
  onDone: () => void
}) {
  const update = useUpdateAudience()
  const form = useForm({
    defaultValues: defaultsFor(setting),
    validators: { onChange: quietHoursSchema, onSubmit: quietHoursSchema },
    onSubmit: async ({ value }) => {
      if (!setting) return
      await update.mutateAsync({
        audience: setting.audience,
        input: value.enabled
          ? {
              quietStart: value.start,
              quietEnd: value.end,
              timezone: value.timezone.trim() || null,
            }
          : { quietStart: null, quietEnd: null },
      })
      onDone()
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(setting))
  }, [open, setting, form])

  return form
}
