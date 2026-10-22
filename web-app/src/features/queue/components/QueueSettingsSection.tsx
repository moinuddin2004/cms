import { Loader2, RotateCcw } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { FieldWrapper } from '@/components/shared'
import { useAuthStore } from '@/store/useAuthStore'
import { useQueueSettingsForm } from '../hooks/useQueueSettingsForm'
import { useQueuePermissions } from '../hooks/useQueuePermissions'
import { fieldError } from '../utils/fieldError'

type MinuteField =
  | 'earlyWindowMin'
  | 'lateGraceMin'
  | 'maxLateMin'
  | 'walkinStarvationMin'

const MINUTE_FIELDS: { name: MinuteField; label: string; hint: string }[] = [
  {
    name: 'earlyWindowMin',
    label: 'Early window (min)',
    hint: 'How long before the appointment priority starts',
  },
  {
    name: 'lateGraceMin',
    label: 'Late grace (min)',
    hint: 'How late a patient can be and keep priority',
  },
  {
    name: 'maxLateMin',
    label: 'Max late (min)',
    hint: 'After this, no token — no-show, or convert to walk-in',
  },
  {
    name: 'walkinStarvationMin',
    label: 'Walk-in wait limit (min)',
    hint: 'A walk-in waiting this long is called next',
  },
]

/**
 * Queue settings for the ACTIVE location (location override, or the
 * organization default). Changes apply from the next day's queues so
 * nobody's place moves mid-day; today's mode can be switched per doctor on
 * the queue board. Saving needs `admin.settings.manage`.
 */
export function QueueSettingsSection({ locationId }: { locationId: string }) {
  const activeLocationId = useAuthStore((s) => s.activeLocationId)
  const isActive = activeLocationId === locationId
  const { canManageSettings: canSave } = useQueuePermissions()
  const { form, data, isLoading, removeOverride } = useQueueSettingsForm()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue settings</CardTitle>
        <CardDescription>
          How patients are ordered for each doctor. Changes apply from
          tomorrow&apos;s queues so nobody&apos;s place moves mid-day.
          {data && (
            <span className="mt-1 block text-xs">
              Now using:{' '}
              {data.effective.source === 'location'
                ? 'this location’s own settings'
                : data.effective.source === 'organization'
                  ? 'the organization default'
                  : 'built-in defaults'}
              {' · '}timezone {data.effective.timezone}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isActive ? (
          <p className="text-sm text-muted-foreground">
            Switch to this location (top bar) to edit its queue settings.
          </p>
        ) : isLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <fieldset disabled={!canSave} className="space-y-6">
              <form.Field name="smartQueueEnabled">
                {(field) => (
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                    <div>
                      <Label htmlFor="smart">Smart queue</Label>
                      <p className="text-xs text-muted-foreground">
                        On: appointments get priority in their time window,
                        walk-ins are protected from waiting too long, patients
                        back from tests go first. Off: strictly first come,
                        first served (emergencies still first).
                      </p>
                    </div>
                    <Switch
                      id="smart"
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                      disabled={!canSave}
                    />
                  </div>
                )}
              </form.Field>

              <div className="grid gap-6 md:grid-cols-2">
                {MINUTE_FIELDS.map(({ name, label, hint }) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <FieldWrapper
                        label={label}
                        htmlFor={name}
                        hint={hint}
                        error={fieldError(field)}
                      >
                        <Input
                          id={name}
                          type="number"
                          min={0}
                          value={String(field.state.value)}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </FieldWrapper>
                    )}
                  </form.Field>
                ))}

                <form.Field name="skippedRejoinPolicy">
                  {(field) => (
                    <FieldWrapper label="Skipped patient rejoins">
                      <Select
                        clearable={false}
                        value={field.state.value}
                        onValueChange={(v) =>
                          field.handleChange(v as typeof field.state.value)
                        }
                        disabled={!canSave}
                      >
                        <SelectTrigger aria-label="Skipped patient rejoins">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="end">
                            At the end of the line
                          </SelectItem>
                          <SelectItem value="original_position">
                            At their original place
                          </SelectItem>
                          <SelectItem value="manual">
                            Where reception chooses
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldWrapper>
                  )}
                </form.Field>

                <form.Field name="callTimeoutSec">
                  {(field) => (
                    <FieldWrapper
                      label="Auto-skip after a call (seconds)"
                      htmlFor="callTimeoutSec"
                      hint="Leave empty to keep it off"
                      error={fieldError(field)}
                    >
                      <Input
                        id="callTimeoutSec"
                        type="number"
                        min={30}
                        placeholder="Off"
                        value={String(field.state.value)}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>

                <form.Field name="serviceDayCutoff">
                  {(field) => (
                    <FieldWrapper
                      label="Service day starts at"
                      htmlFor="serviceDayCutoff"
                      hint="e.g. 04:00 for a night-shift clinic"
                      error={fieldError(field)}
                    >
                      <Input
                        id="serviceDayCutoff"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="00:00"
                      />
                    </FieldWrapper>
                  )}
                </form.Field>

                <form.Field name="manualSelectReasonRequired">
                  {(field) => (
                    <div className="flex items-center justify-between gap-4 pt-6">
                      <Label htmlFor="reasonReq">
                        Doctor must give a reason to pick out of order
                      </Label>
                      <Switch
                        id="reasonReq"
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        disabled={!canSave}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </fieldset>

            {!canSave ? (
              <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                You can view these settings but not change them.
              </p>
            ) : (
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
                <form.Field name="scope">
                  {(field) => (
                    <FieldWrapper label="Save as">
                      <Select
                        clearable={false}
                        value={field.state.value}
                        onValueChange={(v) =>
                          field.handleChange(v as typeof field.state.value)
                        }
                      >
                        <SelectTrigger
                          className="w-[260px]"
                          aria-label="Save as"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="location">
                            This location only
                          </SelectItem>
                          <SelectItem value="organization">
                            Organization default (all locations)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldWrapper>
                  )}
                </form.Field>
                <div className="flex gap-2">
                  {data?.locationOverride && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={removeOverride.isPending}
                      onClick={() => removeOverride.mutate()}
                    >
                      {removeOverride.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                      Use organization default
                    </Button>
                  )}
                  <form.Subscribe
                    selector={(s) =>
                      [s.canSubmit, s.isSubmitting, s.isDirty] as const
                    }
                  >
                    {([canSubmit, isSubmitting, isDirty]) => (
                      <Button
                        type="submit"
                        disabled={!canSubmit || isSubmitting || !isDirty}
                      >
                        {isSubmitting && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        {isDirty ? 'Save queue settings' : 'Saved'}
                      </Button>
                    )}
                  </form.Subscribe>
                </div>
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  )
}
