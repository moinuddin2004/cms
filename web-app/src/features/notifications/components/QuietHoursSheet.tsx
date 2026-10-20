import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FieldWrapper, FormSection, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useQuietHoursForm } from '../hooks/useQuietHoursForm'
import { AUDIENCE_LABEL } from '../types'
import type { AudienceSetting } from '../types'

/** Quiet hours for one audience: WhatsApp/SMS/email in the window wait until it ends. */
export function QuietHoursSheet({
  setting,
  onOpenChange,
}: {
  setting: AudienceSetting | null
  onOpenChange: (open: boolean) => void
}) {
  const open = !!setting
  const form = useQuietHoursForm({
    open,
    setting,
    onDone: () => onOpenChange(false),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={`Quiet hours — ${setting ? AUDIENCE_LABEL[setting.audience] : ''}`}
      description="Messages that fall inside quiet hours are held and sent when they end. In-app notifications are never held."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
          >
            {([canSubmit, isSubmitting, isDirty]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || !isDirty}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save quiet hours
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FormSection title="Window">
          <div className="space-y-4">
            <form.Field name="enabled">
              {(f) => (
                <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <span>
                    <span className="block text-sm font-semibold">
                      Use quiet hours
                    </span>
                    <span className="block text-xs text-text-3">
                      Off: messages go out as soon as they are created.
                    </span>
                  </span>
                  <Switch
                    checked={f.state.value}
                    onCheckedChange={f.handleChange}
                    aria-label="Use quiet hours"
                  />
                </label>
              )}
            </form.Field>
            <form.Subscribe selector={(s) => s.values.enabled}>
              {(enabled) =>
                enabled && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <form.Field name="start">
                        {(f) => (
                          <FieldWrapper
                            label="From"
                            htmlFor="quiet-start"
                            required
                            error={fieldError(f)}
                          >
                            <Input
                              id="quiet-start"
                              type="time"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                              onBlur={f.handleBlur}
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                      <form.Field name="end">
                        {(f) => (
                          <FieldWrapper
                            label="Until"
                            htmlFor="quiet-end"
                            required
                            hint="May be the next morning, e.g. 22:00 → 08:00."
                            error={fieldError(f)}
                          >
                            <Input
                              id="quiet-end"
                              type="time"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                              onBlur={f.handleBlur}
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                    </div>
                    <form.Field name="timezone">
                      {(f) => (
                        <FieldWrapper
                          label="Timezone"
                          htmlFor="quiet-tz"
                          hint="Leave empty to use each location's own timezone."
                          error={fieldError(f)}
                        >
                          <Input
                            id="quiet-tz"
                            placeholder="Asia/Karachi"
                            value={f.state.value}
                            onChange={(e) => f.handleChange(e.target.value)}
                            onBlur={f.handleBlur}
                          />
                        </FieldWrapper>
                      )}
                    </form.Field>
                  </div>
                )
              }
            </form.Subscribe>
          </div>
        </FormSection>
      </form>
    </FormSheet>
  )
}
