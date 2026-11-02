import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/forms/NumberInput'
import { Switch } from '@/components/ui/switch'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { EmploymentRolesManager } from './EmploymentRolesManager'
import { useOrganizationSettingsForm } from './hooks/useOrganizationSettingsForm'
import type { OrganizationSettings } from './hooks/useOrganizationSettingsForm'

type NumberField =
  'defaultSlotDuration' | 'advanceBookingDays' | 'cancellationNoticeHours'

export function OrganizationSettingsFeature({
  organizationId,
}: {
  organizationId: string
}) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['orgSettings', organizationId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/organizations/${organizationId}/settings`,
      )
      return res.data.data as OrganizationSettings
    },
  })

  const form = useOrganizationSettingsForm({ organizationId, settings })

  if (isLoading) return <div>Loading settings...</div>

  const numberField = (name: NumberField, label: string) => (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper
          label={label}
          htmlFor={`org-${name}`}
          error={fieldError(field)}
        >
          <NumberInput
            id={`org-${name}`}
            mode="integer"
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )

  return (
    // Not a <form>: EmploymentRolesManager renders its own buttons in here.
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Overrides</CardTitle>
          <CardDescription>
            Configure overriding rules for locations in this organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <Label className="text-base">Allow Location Override</Label>
              <p className="text-sm text-muted-foreground">
                If enabled, locations can have their own custom settings. If
                disabled, they will inherit these organization settings and
                their local settings will be disabled.
              </p>
            </div>
            <form.Field name="allowLocationOverride">
              {(field) => (
                <Switch
                  checked={field.state.value}
                  onCheckedChange={(val) => field.handleChange(val)}
                />
              )}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      <EmploymentRolesManager />

      <Card>
        <CardHeader>
          <CardTitle>Booking Defaults</CardTitle>
          <CardDescription>
            Default parameters used across locations unless overridden.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {numberField('defaultSlotDuration', 'Default Slot Duration (mins)')}
          {numberField('advanceBookingDays', 'Advance Booking Days')}
          {numberField(
            'cancellationNoticeHours',
            'Cancellation Notice (hours)',
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              onClick={() => void form.handleSubmit()}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? 'Saving...' : 'Save All Settings'}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </div>
  )
}
