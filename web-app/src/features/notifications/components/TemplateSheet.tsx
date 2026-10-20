import { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ErrorState,
  FieldWrapper,
  FormSection,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { fieldError } from '@/features/queue'
import {
  useNotificationTemplates,
  useResetTemplate,
} from '../hooks/useNotificationSettings'
import { useTemplateForm } from '../hooks/useTemplateForm'
import { CHANNEL_LABEL, LANGUAGE_LABEL } from '../types'
import type {
  NotificationChannel,
  NotificationEventSettings,
  NotificationLanguage,
  NotificationTemplate,
} from '../types'

/** The clinic's own template if any, else the platform's (same language, then English). */
export function currentTemplate(
  templates: NotificationTemplate[],
  channel: NotificationChannel,
  language: NotificationLanguage,
): NotificationTemplate | null {
  const of = (own: boolean, lang: NotificationLanguage) =>
    templates.find(
      (t) =>
        t.channel === channel && t.language === lang && t.isOverride === own,
    )
  return of(true, language) ?? of(false, language) ?? of(false, 'en') ?? null
}

/** Edit how one event is worded, per channel and language. */
export function TemplateSheet({
  event,
  channels,
  onOpenChange,
}: {
  event: NotificationEventSettings | null
  /** Channels shown on this tab (patient: WhatsApp/SMS …). */
  channels: NotificationChannel[]
  onOpenChange: (open: boolean) => void
}) {
  const open = !!event
  const [channel, setChannel] = useState<NotificationChannel>(channels[0])
  const [language, setLanguage] = useState<NotificationLanguage>('en')
  const [discarding, setDiscarding] = useState(false)
  const [resetting, setResetting] = useState(false)
  const templates = useNotificationTemplates(event?.code ?? null)
  const reset = useResetTemplate()

  useEffect(() => {
    if (open) {
      setChannel(channels[0])
      setLanguage('en')
    }
  }, [open, channels])

  const current = useMemo(
    () =>
      templates.data
        ? currentTemplate(templates.data, channel, language)
        : null,
    [templates.data, channel, language],
  )
  const own =
    current?.isOverride && current.language === language ? current : null
  const form = useTemplateForm({
    eventCode: event?.code ?? '',
    channel,
    language,
    current,
    variables: event?.variables ?? [],
  })

  const close = () => {
    if (form.state.isDirty) setDiscarding(true)
    else onOpenChange(false)
  }
  const hasSubject = channel === 'in_app' || channel === 'email'

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={(o) => (o ? onOpenChange(true) : close())}
        title={`Wording — ${event?.name ?? ''}`}
        description="Your clinic's own message. Placeholders in {braces} are filled in for each recipient."
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Close
            </Button>
            <form.Subscribe
              selector={(s) =>
                [s.canSubmit, s.isSubmitting, s.isDirty] as const
              }
            >
              {([canSubmit, isSubmitting, isDirty]) => (
                <Button
                  onClick={() => void form.handleSubmit()}
                  disabled={!canSubmit || isSubmitting || !isDirty}
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Save wording
                </Button>
              )}
            </form.Subscribe>
          </>
        }
      >
        <div className="space-y-6">
          <FormSection title="Message">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelect
                label="Channel"
                value={channel}
                onValueChange={(v) => setChannel(v as NotificationChannel)}
                options={channels.map((c) => ({
                  value: c,
                  label: CHANNEL_LABEL[c],
                }))}
              />
              <FormSelect
                label="Language"
                value={language}
                onValueChange={(v) => setLanguage(v as NotificationLanguage)}
                options={(
                  Object.keys(LANGUAGE_LABEL) as NotificationLanguage[]
                ).map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
              />
            </div>
          </FormSection>

          {templates.isLoading ? (
            <div className="space-y-3" aria-label="Loading wording">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : templates.isError ? (
            <ErrorState onRetry={() => void templates.refetch()} />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
                {own ? (
                  <Badge variant="secondary">Your wording</Badge>
                ) : (
                  <Badge variant="outline">
                    {current
                      ? `Default${current.language !== language ? ` (${LANGUAGE_LABEL[current.language]})` : ''}`
                      : 'No default yet'}
                  </Badge>
                )}
                {own && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setResetting(true)}
                  >
                    <RotateCcw className="size-3.5" /> Reset to default
                  </Button>
                )}
              </div>

              {hasSubject && (
                <form.Field name="subject">
                  {(f) => (
                    <FieldWrapper
                      label={channel === 'email' ? 'Subject' : 'Title'}
                      htmlFor="tpl-subject"
                      error={fieldError(f)}
                    >
                      <Input
                        id="tpl-subject"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              )}
              <form.Field name="body">
                {(f) => (
                  <FieldWrapper
                    label="Message"
                    htmlFor="tpl-body"
                    required
                    error={fieldError(f)}
                  >
                    <Textarea
                      id="tpl-body"
                      rows={5}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
              {channel === 'whatsapp' && (
                <form.Field name="providerTemplateRef">
                  {(f) => (
                    <FieldWrapper
                      label="WhatsApp template ID"
                      htmlFor="tpl-ref"
                      hint="WhatsApp needs a pre-approved template for messages your clinic starts. Paste its ID here."
                      error={fieldError(f)}
                    >
                      <Input
                        id="tpl-ref"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              )}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-text-2">
                  Placeholders you can use
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(event?.variables ?? []).map((v) => (
                    <code
                      key={v}
                      className="rounded bg-panel px-1.5 py-0.5 text-[11px] text-text-2"
                    >
                      {`{${v}}`}
                    </code>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>
      </FormSheet>

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard changes?"
        description="Your edits to this wording are not saved yet."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setDiscarding(false)
          form.reset()
          onOpenChange(false)
        }}
      />
      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset to the default wording?"
        description="Your clinic's own wording for this channel and language is deleted, and the default is used again."
        confirmLabel="Reset"
        destructive
        isLoading={reset.isPending}
        onConfirm={() => {
          if (!own) return
          reset.mutate(own.id, { onSettled: () => setResetting(false) })
        }}
      />
    </>
  )
}
