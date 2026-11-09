import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FieldWrapper } from '@/components/shared'
import { SaveBar } from '@/components/shared/SaveBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TIMEZONE_OPTIONS, timezoneLabel } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { useSetupClinicForm } from '../hooks/useSetupForms'
import { fieldError } from '../lib/fieldError'
import { errorMessage } from '../lib/session'
import { SPECIALTY_OPTIONS } from '../types'
import type { ClinicSetup } from '../types'

const CURRENCIES = [
  'PKR',
  'AED',
  'SAR',
  'QAR',
  'INR',
  'BDT',
  'GBP',
  'USD',
  'EUR',
]

/**
 * The clinic's own details. `wizard` = setup step with "Save & continue";
 * `settings` = sticky save bar that appears once something changes.
 */
export function ClinicDetailsForm({
  setup,
  onSaved,
  mode,
}: {
  setup: ClinicSetup
  onSaved: () => void
  mode: 'wizard' | 'settings'
}) {
  const { form, save } = useSetupClinicForm(setup, onSaved)
  const submit = () =>
    form.handleSubmit().catch((err) => toast.error(errorMessage(err)))

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void submit()
      }}
    >
      <form.Field name="name">
        {(f) => (
          <FieldWrapper
            label="Clinic name"
            htmlFor="setup-name"
            required
            error={fieldError(f)}
          >
            <Input
              id="setup-name"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Field name="specialtyTags">
        {(f) => (
          <FieldWrapper
            label="What kind of clinic is it?"
            required
            hint="Pick every type that applies — it decides which tools you see."
            error={fieldError(f)}
          >
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((o) => {
                const on = f.state.value.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      f.handleChange(
                        on
                          ? f.state.value.filter((v) => v !== o.value)
                          : [...f.state.value, o.value],
                      )
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </FieldWrapper>
        )}
      </form.Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="phone">
          {(f) => (
            <FieldWrapper
              label="Phone"
              htmlFor="setup-phone"
              error={fieldError(f)}
            >
              <Input
                id="setup-phone"
                inputMode="tel"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="email">
          {(f) => (
            <FieldWrapper
              label="Clinic email"
              htmlFor="setup-email"
              error={fieldError(f)}
            >
              <Input
                id="setup-email"
                type="email"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="website">
          {(f) => (
            <FieldWrapper
              label="Website"
              htmlFor="setup-website"
              error={fieldError(f)}
            >
              <Input
                id="setup-website"
                inputMode="url"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="timezone">
          {(f) => (
            <FieldWrapper label="Timezone" required error={fieldError(f)}>
              <Select value={f.state.value} onValueChange={f.handleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(TIMEZONE_OPTIONS.includes(f.state.value)
                    ? TIMEZONE_OPTIONS
                    : [f.state.value, ...TIMEZONE_OPTIONS]
                  ).map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {timezoneLabel(tz)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="currency">
          {(f) => (
            <FieldWrapper label="Currency" required error={fieldError(f)}>
              <Select value={f.state.value} onValueChange={f.handleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(CURRENCIES.includes(f.state.value)
                    ? CURRENCIES
                    : [f.state.value, ...CURRENCIES]
                  ).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}
        </form.Field>
      </div>

      <form.Subscribe
        selector={(s) =>
          [s.canSubmit, s.isSubmitting, !s.isDefaultValue] as const
        }
      >
        {([canSubmit, isSubmitting, isDirty]) => {
          const saving = isSubmitting || save.isPending
          return mode === 'settings' ? (
            <SaveBar
              dirty={isDirty}
              saving={saving}
              canSave={canSubmit}
              onSave={() => void submit()}
              onDiscard={() => form.reset()}
            />
          ) : (
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={!canSubmit || saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save & continue
              </Button>
            </div>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
