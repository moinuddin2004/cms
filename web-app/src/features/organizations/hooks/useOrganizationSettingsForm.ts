import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { organizationSettingsSchema } from '../schemas/organization-settings.schema'
import type { OrganizationSettingsFormValues } from '../schemas/organization-settings.schema'

export interface OrganizationSettings {
  id: string
  organizationId: string
  allowLocationOverride: boolean
  defaultSlotDuration: number
  advanceBookingDays: number
  cancellationNoticeHours: number
}

function defaultsFor(
  s: OrganizationSettings | undefined,
): OrganizationSettingsFormValues {
  return {
    allowLocationOverride: !!s?.allowLocationOverride,
    defaultSlotDuration: String(s?.defaultSlotDuration || 30),
    advanceBookingDays: String(s?.advanceBookingDays || 30),
    cancellationNoticeHours: String(s?.cancellationNoticeHours ?? 24),
  }
}

/** Organization-wide booking defaults. Re-seeds whenever settings reload. */
export function useOrganizationSettingsForm({
  organizationId,
  settings,
}: {
  organizationId: string
  settings: OrganizationSettings | undefined
}) {
  const queryClient = useQueryClient()
  const update = useMutation({
    mutationFn: async (data: {
      allowLocationOverride: boolean
      defaultSlotDuration: number
      advanceBookingDays: number
      cancellationNoticeHours: number
    }) => apiClient.patch(`/organizations/${organizationId}/settings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['orgSettings', organizationId],
      })
      toast.success('Organization settings updated successfully')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to update settings'),
  })

  const form = useForm({
    defaultValues: defaultsFor(settings),
    validators: {
      onChange: organizationSettingsSchema,
      onSubmit: organizationSettingsSchema,
    },
    onSubmit: async ({ value }) => {
      // Only the DTO's fields — the API rejects unknown keys (id, timestamps…).
      // Failures are toasted by the mutation's onError.
      await update
        .mutateAsync({
          allowLocationOverride: value.allowLocationOverride,
          defaultSlotDuration: Number(value.defaultSlotDuration),
          advanceBookingDays: Number(value.advanceBookingDays),
          cancellationNoticeHours: Number(value.cancellationNoticeHours),
        })
        .catch(() => undefined)
    },
  })

  useEffect(() => {
    if (settings) form.reset(defaultsFor(settings))
  }, [settings, form])

  return form
}
