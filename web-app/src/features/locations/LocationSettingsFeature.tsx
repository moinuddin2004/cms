import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { NumberInput } from '@/components/forms/NumberInput'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { SaveBar } from '@/components/shared/SaveBar'
import { QueueSettingsSection } from '@/features/queue'
import { Can } from '@/features/access'
import { SettingsCard, SettingsRow } from '@/features/settings'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ShieldOff } from 'lucide-react'
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
  const locationQuery = useQuery({
    queryKey: ['locations', locationId],
    queryFn: async () => {
      const res = await apiClient.get(`/locations/${locationId}`)
      return res.data.data as Location
    },
  })
  const location = locationQuery.data

  const orgSettingsQuery = useQuery({
    queryKey: ['orgSettings', location?.organizationId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/organizations/${location?.organizationId}/settings`,
      )
      return res.data.data as OrganizationSettings
    },
    enabled: !!location?.organizationId,
  })
  const orgSettings = orgSettingsQuery.data

  const settingsQuery = useQuery({
    queryKey: ['locSettings', locationId],
    queryFn: async () => {
      const res = await apiClient.get(`/locations/${locationId}/settings`)
      return res.data.data as LocationSettings
    },
  })

  const form = useLocationSettingsForm({
    locationId,
    settings: settingsQuery.data,
  })

  if (
    locationQuery.isLoading ||
    orgSettingsQuery.isLoading ||
    settingsQuery.isLoading
  )
    return <LoadingSkeleton variant="detail" />
  if (locationQuery.isError || settingsQuery.isError)
    return (
      <ErrorState
        title="Couldn't load this location's settings"
        onRetry={() => {
          void locationQuery.refetch()
          void settingsQuery.refetch()
        }}
      />
    )

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
    hint: string,
    unit: string,
    decimal?: boolean,
  ) => (
    <form.Field name={name}>
      {(field) => {
        const isInherited = name in inherited
        return (
          <SettingsRow
            label={label}
            hint={
              <>
                {hint}
                {isInherited && (
                  <span className="ml-1.5 inline-flex rounded-full bg-amber-soft px-1.5 py-px text-[10px] font-medium text-amber">
                    From clinic
                  </span>
                )}
              </>
            }
          >
            <FieldWrapper
              htmlFor={`loc-${name}`}
              error={isInherited ? undefined : fieldError(field)}
            >
              <div className="relative max-w-[220px]">
                <NumberInput
                  id={`loc-${name}`}
                  mode={decimal ? 'decimal' : 'integer'}
                  disabled={isInherited || isOverrideDisabled}
                  value={
                    isInherited
                      ? String(inherited[name] ?? '')
                      : field.state.value
                  }
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="pr-16"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-3">
                  {unit}
                </span>
              </div>
            </FieldWrapper>
          </SettingsRow>
        )
      }}
    </form.Field>
  )

  return (
    <div className="max-w-4xl space-y-6">
      {location && (
        <p className="text-sm text-text-2">
          Settings for{' '}
          <span className="font-semibold text-foreground">{location.name}</span>
        </p>
      )}

      {isOverrideDisabled && (
        <div className="rounded-lg border border-amber/30 bg-amber-soft p-4 text-sm text-amber">
          Booking rules marked “From clinic” are set for the whole clinic and
          can’t be changed for one location.
        </div>
      )}

      {orgSettings?.featureAppointments !== false && (
        <SettingsCard
          title="Booking rules"
          description="How appointments can be booked at this location."
        >
          <div className="divide-y divide-border">
            {numberField(
              'appointmentSlotDuration',
              'Slot length',
              'Default length of one appointment.',
              'minutes',
            )}
            {numberField(
              'maxAppointmentsPerDay',
              'Daily limit',
              'Most appointments in one day. 0 = no limit.',
              'per day',
            )}
            {numberField(
              'advanceBookingDays',
              'Book ahead',
              'How far ahead a slot can be booked.',
              'days',
            )}
            {numberField(
              'cancellationNoticeHours',
              'Cancellation notice',
              'How early a patient must cancel.',
              'hours',
            )}
          </div>
        </SettingsCard>
      )}

      {/* Appointment reminders: hidden until SMS/WhatsApp delivery exists —
          notifications are in-app only for now (see CHANNELS_BY_AUDIENCE). */}

      {orgSettings?.featureFinance !== false && (
        <SettingsCard
          title="Tax & late fees"
          description="Added to patient invoices from this location."
        >
          <div className="divide-y divide-border">
            {numberField(
              'taxRate',
              'Sales tax',
              'Added on top of each invoice. 0 = no tax.',
              '%',
              true,
            )}
            {numberField(
              'lateFeePercentage',
              'Late fee',
              'Charged on overdue invoices.',
              '%',
              true,
            )}
          </div>
        </SettingsCard>
      )}

      <form.Subscribe
        selector={(st) =>
          [st.canSubmit, st.isSubmitting, !st.isDefaultValue] as const
        }
      >
        {([canSubmit, isSubmitting, dirty]) => (
          <SaveBar
            dirty={dirty && !isOverrideDisabled}
            saving={isSubmitting}
            canSave={canSubmit}
            onSave={() => void form.handleSubmit()}
            onDiscard={() => form.reset()}
          />
        )}
      </form.Subscribe>

      <QueueSettingsSection locationId={locationId} />
    </div>
  )
}
