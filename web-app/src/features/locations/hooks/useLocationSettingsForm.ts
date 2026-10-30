import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { locationSettingsSchema } from '../schemas/location-settings.schema'
import type { LocationSettingsFormValues } from '../schemas/location-settings.schema'

export interface LocationSettings {
  id: string
  locationId: string
  appointmentSlotDuration: number
  maxAppointmentsPerDay: number
  advanceBookingDays: number
  cancellationNoticeHours: number
  reminderEnabled: boolean
  reminderDaysBefore: number
  reminderHoursBefore: number
  paymentGateway: string | null
  // Postgres decimals arrive as strings ("12.50").
  taxRate: number | string
  lateFeePercentage: number | string
  theme: string
}

const str = (v: number | string | null | undefined, fallback = '') =>
  v === null || v === undefined || v === '' ? fallback : String(Number(v))

function defaultsFor(
  s: LocationSettings | undefined,
): LocationSettingsFormValues {
  return {
    appointmentSlotDuration: str(s?.appointmentSlotDuration, '30'),
    maxAppointmentsPerDay: str(s?.maxAppointmentsPerDay, '0'),
    advanceBookingDays: str(s?.advanceBookingDays, '30'),
    cancellationNoticeHours: str(s?.cancellationNoticeHours, '24'),
    taxRate: str(s?.taxRate, '0'),
    lateFeePercentage: str(s?.lateFeePercentage, '0'),
  }
}

/** Location settings form. Re-seeds whenever the settings reload. */
export function useLocationSettingsForm({
  locationId,
  settings,
}: {
  locationId: string
  settings: LocationSettings | undefined
}) {
  const queryClient = useQueryClient()
  const update = useMutation({
    mutationFn: async (data: Record<string, number>) =>
      apiClient.patch(`/locations/${locationId}/settings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locSettings', locationId] })
      toast.success('Location settings updated successfully')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to update settings'),
  })

  const form = useForm({
    defaultValues: defaultsFor(settings),
    validators: {
      onChange: locationSettingsSchema,
      onSubmit: locationSettingsSchema,
    },
    onSubmit: async ({ value }) => {
      // Only keys UpdateLocationSettingsDto accepts (the API rejects unknown
      // ones).
      await update
        .mutateAsync({
          appointmentSlotDuration: Number(value.appointmentSlotDuration),
          maxAppointmentsPerDay: Number(value.maxAppointmentsPerDay),
          advanceBookingDays: Number(value.advanceBookingDays),
          cancellationNoticeHours: Number(value.cancellationNoticeHours),
          taxRate: Number(value.taxRate),
          lateFeePercentage: Number(value.lateFeePercentage),
        })
        .catch(() => undefined)
    },
  })

  useEffect(() => {
    if (settings) form.reset(defaultsFor(settings))
  }, [settings, form])

  return form
}
