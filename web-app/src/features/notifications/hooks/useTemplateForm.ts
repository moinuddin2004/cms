import { useEffect, useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { templateSchema } from '../schemas/notification.schema'
import type { TemplateFormValues } from '../schemas/notification.schema'
import type {
  NotificationChannel,
  NotificationLanguage,
  NotificationTemplate,
} from '../types'
import { useSaveTemplate } from './useNotificationSettings'

function defaultsFor(t: NotificationTemplate | null): TemplateFormValues {
  return {
    subject: t?.subject ?? '',
    body: t?.body ?? '',
    providerTemplateRef: t?.providerTemplateRef ?? '',
  }
}

/** The clinic's wording for one event × channel × language (starts from the current one). */
export function useTemplateForm({
  eventCode,
  channel,
  language,
  current,
  variables,
}: {
  eventCode: string
  channel: NotificationChannel
  language: NotificationLanguage
  current: NotificationTemplate | null
  variables: string[]
}) {
  const save = useSaveTemplate()
  const schema = useMemo(() => templateSchema(variables), [variables])
  const form = useForm({
    defaultValues: defaultsFor(current),
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        eventCode,
        channel,
        language,
        subject: value.subject.trim() || null,
        body: value.body.trim(),
        providerTemplateRef: value.providerTemplateRef.trim() || null,
      })
      form.reset(value)
    },
  })

  // Switching channel / language loads that wording.
  useEffect(() => {
    form.reset(defaultsFor(current))
  }, [current, form])

  return form
}
