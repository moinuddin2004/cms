import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
// import { Switch } from '@/components/ui/switch' // only the (hidden) reminders card uses it
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { QueueSettingsSection } from '@/features/queue'
import { Can } from '@/features/access'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Loader2, ShieldOff } from 'lucide-react'
import { useLocationSettingsForm } from './hooks/useLocationSettingsForm'
import type { LocationSettings } from './hooks/useLocationSettingsForm'
import type { LocationSettingsFormValues } from './schemas/location-settings.schema'

interface OrganizationSettings {
  allowLocationOverride: boolean
  defaultSlotDuration: number
  advanceBookingDays: number
  cancellationNoticeHours: number
  featureAppointments: boolean
  featureInventory: boolean
  featureFinance: boolean
  featureReminders: boolean
}

interface Location {
  id: string
  organizationId: string
  name: string
}

/**
 * Location settings. The route already requires `admin.locations.manage`;
 * this guard keeps the feature safe wherever else it gets mounted.
 */
export function LocationSettingsFeature({
  locationId,
}: {
  locationId: string
}) {
  return (
    <Can
      perm="admin.locations.manage"
      fallback={
        <EmptyState
          icon={ShieldOff}
          title="No access"
          description="You don't have permission to manage this location's settings."
        />
      }
    >
      <LocationSettingsContent locationId={locationId} />
    </Can>
  )
}

function LocationSettingsContent({ locationId }: { locationId: string }) {
  const { data: location, isLoading: isLocLoading } = useQuery({
    queryKey: ['locations', locationId],
    queryFn: async () => {
      const res = await apiClient.get(`/locations/${locationId}`)
      return res.data.data as Location
    },
  })

  const { data: orgSettings, isLoading: isOrgSettingsLoading } = useQuery({
    queryKey: ['orgSettings', location?.organizationId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/organizations/${location?.organizationId}/settings`,
      )
      return res.data.data as OrganizationSettings
    },
    enabled: !!location?.organizationId,
  })

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['locSettings', locationId],
    queryFn: async () => {
      const res = await apiClient.get(`/locations/${locationId}/settings`)
      return res.data.data as LocationSettings
    },
  })

  const form = useLocationSettingsForm({ locationId, settings })

  if (isLocLoading || isOrgSettingsLoading || isSettingsLoading)
    return <div>Loading settings...</div>

  const isOverrideDisabled = orgSettings?.allowLocationOverride === false

  // When overrides are off, show the inherited org values instead.
  const inherited: Partial<
    Record<keyof LocationSettingsFormValues, number | undefined>
  > = isOverrideDisabled
    ? {
        appointmentSlotDuration: orgSettings.defaultSlotDuration,
        advanceBookingDays: orgSettings.advanceBookingDays,
        cancellationNoticeHours: orgSettings.cancellationNoticeHours,
      }
    : {}

  const numberField = (
    name: keyof LocationSettingsFormValues,
    label: string,
    step?: string,
  ) => (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper
          label={label}
          htmlFor={`loc-${name}`}
          error={isOverrideDisabled ? undefined : fieldError(field)}
        >
          <Input
            id={`loc-${name}`}
            type="number"
            step={step}
            disabled={isOverrideDisabled}
            value={
              name in inherited
                ? String(inherited[name] ?? '')
                : field.state.value
            }
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )

  return (
    <div className="space-y-6">
      {isOverrideDisabled && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-md border border-amber-200">
          <strong>Notice:</strong> Organization override is disabled. Some
          settings are inherited from the organization and cannot be changed
          here.
        </div>
      )}

      {orgSettings?.featureAppointments !== false && (
        <Card>
          <CardHeader>
            <CardTitle>Appointment Settings</CardTitle>
            <CardDescription>
              Configure booking rules for this location.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            {numberField('appointmentSlotDuration', 'Slot Duration (mins)')}
            {numberField('maxAppointmentsPerDay', 'Max Appointments / Day')}
            {numberField('advanceBookingDays', 'Advance Booking Days')}
            {numberField(
              'cancellationNoticeHours',
              'Cancellation Notice (hours)',
            )}
          </CardContent>
        </Card>
      )}

      <QueueSettingsSection locationId={locationId} />

      {/* Appointment reminders: hidden until SMS/WhatsApp delivery exists —
          notifications are in-app only for now (see CHANNELS_BY_AUDIENCE).
      {orgSettings?.featureReminders !== false && (
        <Card>
          <CardHeader>
            <CardTitle>Reminder Settings</CardTitle>
            <CardDescription>Configure automated reminders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4 mt-2">
              <Label>Enable Reminders</Label>
              <Switch
                disabled={isOverrideDisabled}
                checked={!!formData.reminderEnabled}
                onCheckedChange={(val) => handleChange('reminderEnabled', val)}
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Days Before</Label>
                <Input
                  type="number"
                  disabled={isOverrideDisabled}
                  value={formData.reminderDaysBefore || ''}
                  onChange={(e) =>
                    handleChange('reminderDaysBefore', parseInt(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Hours Before</Label>
                <Input
                  type="number"
                  disabled={isOverrideDisabled}
                  value={formData.reminderHoursBefore || ''}
                  onChange={(e) =>
                    handleChange(
                      'reminderHoursBefore',
                      parseInt(e.target.value),
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      */}

      {orgSettings?.featureFinance !== false && (
        <Card>
          <CardHeader>
            <CardTitle>Payment & Billing</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            {numberField('taxRate', 'Tax Rate (%)', '0.01')}
            {numberField('lateFeePercentage', 'Late Fee (%)', '0.01')}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <form.Subscribe
          selector={(st) => [st.canSubmit, st.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              onClick={() => void form.handleSubmit()}
              disabled={!canSubmit || isSubmitting || isOverrideDisabled}
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
